// Bluetooth (BLE) Vehicle Communications Helper for ParkZone
// Connects the mobile app directly to vehicle Bluetooth (OBD-II / CAN adapter / in-vehicle audio) if Android Auto is unavailable.

import { PermissionsAndroid, Platform } from "react-native";
import { BleManager, Device, State } from "react-native-ble-plx";

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  rssi?: number | null;
  isConnected?: boolean;
}

let manager: BleManager | null = null;

const getManager = (): BleManager | null => {
  if (!manager) {
    try {
      manager = new BleManager();
    } catch (_) {
      // Graceful fallback if native BLE module is not supported in the active environment
      manager = null;
    }
  }
  return manager;
};

const requireManager = (): BleManager => {
  const ble = getManager();
  if (!ble) {
    throw new Error("Bluetooth hardware is not accessible");
  }
  return ble;
};

export const requestBluetoothPermissions = async (): Promise<boolean> => {
  try {
    if (Platform.OS !== "android") return true;

    if (Platform.Version >= 31) {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(granted).every(
        (permission) => permission === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (_) {
    return false;
  }
};

export const isBluetoothAvailable = async (): Promise<boolean> => {
  const ble = getManager();
  if (!ble) return false;
  try {
    const state = await ble.state();
    return state === State.PoweredOn;
  } catch (_) {
    return false;
  }
};

/**
 * Scan for nearby vehicle Bluetooth adapters (OBD-II, CAN bridge, Head Unit)
 */
export const nearbyDevices = async (
  durationMs = 5000
): Promise<BluetoothDeviceInfo[]> => {
  const hasPermission = await requestBluetoothPermissions();
  if (!hasPermission) {
    throw new Error("Bluetooth permissions not granted");
  }

  const ble = getManager();
  if (!ble) {
    throw new Error("Bluetooth hardware is not accessible on this device");
  }

  try {
    const state = await ble.state();
    if (state !== State.PoweredOn) {
      throw new Error("Bluetooth is turned off on your device");
    }
  } catch (err: any) {
    throw new Error(err?.message || "Failed to check Bluetooth power state");
  }

  return new Promise<BluetoothDeviceInfo[]>((resolve) => {
    const found = new Map<string, BluetoothDeviceInfo>();

    const timer = setTimeout(() => {
      try {
        ble.stopDeviceScan();
      } catch (_) {}
      resolve(Array.from(found.values()));
    }, durationMs);

    try {
      ble.startDeviceScan(null, null, (error, device) => {
        if (error) {
          clearTimeout(timer);
          try {
            ble.stopDeviceScan();
          } catch (_) {}
          resolve(Array.from(found.values()));
          return;
        }
        if (device && (device.name || device.localName)) {
          const deviceName = device.name || device.localName || "Vehicle Bluetooth Adapter";
          found.set(device.id, {
            id: device.id,
            name: deviceName,
            rssi: device.rssi,
            isConnected: false,
          });
        }
      });
    } catch (_) {
      clearTimeout(timer);
      resolve([]);
    }
  });
};

export const connectToDevice = async (deviceId: string): Promise<Device> => {
  const ble = getManager();
  if (!ble) {
    throw new Error("Bluetooth hardware is not accessible");
  }
  const device = await ble.connectToDevice(deviceId, { timeout: 10000 });
  return device.discoverAllServicesAndCharacteristics();
};

export const disconnectDevice = async (deviceId: string): Promise<void> => {
  const ble = getManager();
  if (!ble) return;
  try {
    await ble.cancelDeviceConnection(deviceId);
  } catch (_) {}
};

export interface SerialChannel {
    service: string;
    writeCharacteristic: string;
    notifyCharacteristic: string;
}


export const findSerialChannel = async (deviceId: string): Promise<SerialChannel> => {
    const ble = requireManager();
    for (const service of await ble.servicesForDevice(deviceId)) {
        let write: string | null = null;
        let notify: string | null = null;
        for (const c of await ble.characteristicsForDevice(deviceId, service.uuid)) {
            if (!write && (c.isWritableWithResponse || c.isWritableWithoutResponse)) write = c.uuid;
            if (!notify && (c.isNotifiable || c.isIndicatable)) notify = c.uuid;
        }
        if (write && notify) return { service: service.uuid, writeCharacteristic: write, notifyCharacteristic: notify };
    }
    throw new Error('No serial characteristics found on this device');
};

export const writeText = async (deviceId: string, channel: SerialChannel, text: string): Promise<void> => {
    await requireManager().writeCharacteristicWithoutResponseForDevice(
        deviceId,
        channel.service,
        channel.writeCharacteristic,
        btoa(text),
    );
};


export const monitorText = (
    deviceId: string,
    channel: SerialChannel,
    onText: (chunk: string) => void,
    onError?: (error: Error) => void,
): (() => void) => {
    const subscription = requireManager().monitorCharacteristicForDevice(
        deviceId,
        channel.service,
        channel.notifyCharacteristic,
        (error, characteristic) => {
            if (error) {
                onError?.(error);
                return;
            }
            if (characteristic?.value) onText(atob(characteristic.value));
        },
    );
    return () => subscription.remove();
};

export const destroyBluetooth = (): void => {
  if (manager) {
    try {
      manager.destroy();
    } catch (_) {}
    manager = null;
  }
};

// Route default export for Expo Router compatibility
export default function BluetoothRoute() {
  return null;
}
