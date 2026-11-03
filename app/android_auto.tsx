import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import {
  CarTelemetry,
  subscribeCarTelemetry,
  connectCarViaBluetooth,
  disconnectCarBluetooth,
  setAndroidAutoConnected,
} from "./services/carTelemetry";
import {
  nearbyDevices,
  BluetoothDeviceInfo,
} from "./utils/bluetooth";

const { width } = Dimensions.get("window");

export default function AndroidAutoScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [telemetry, setTelemetry] = useState<CarTelemetry | null>(null);

  // Bluetooth Scanner Modal State
  const [bluetoothModalVisible, setBluetoothModalVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnectingDevice, setIsConnectingDevice] = useState<string | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<BluetoothDeviceInfo[]>([]);
  const [bluetoothError, setBluetoothError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeCarTelemetry((data) => {
      setTelemetry(data);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleStartBluetoothScan = async () => {
    setIsScanning(true);
    setBluetoothError(null);
    try {
      const devices = await nearbyDevices(6000);
      setDiscoveredDevices(devices);
      if (devices.length === 0) {
        setBluetoothError("No vehicle Bluetooth adapters found within range.");
      }
    } catch (err: any) {
      setBluetoothError(err?.message || "Failed to scan for Bluetooth devices.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnectBluetoothDevice = async (device: BluetoothDeviceInfo) => {
    setIsConnectingDevice(device.id);
    setBluetoothError(null);
    try {
      await connectCarViaBluetooth(device.id, device.name);
      setBluetoothModalVisible(false);
    } catch (err: any) {
      setBluetoothError(err?.message || "Failed to connect to selected device.");
    } finally {
      setIsConnectingDevice(null);
    }
  };

  const handleDisconnect = async () => {
    if (telemetry?.connectionType === "bluetooth_ble") {
      await disconnectCarBluetooth();
    } else {
      setAndroidAutoConnected(false);
    }
  };

  if (!telemetry) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="small" color={theme.text} />
        <Text style={[styles.loadingText, { color: theme.textSecondary, marginTop: 10 }]}>
          Connecting to In-Vehicle System...
        </Text>
      </View>
    );
  }

  const isCharging =
    telemetry.chargingStatus === "charging" ||
    telemetry.chargingStatus === "fast_dc";

  const isConnected = telemetry.connectionState === "connected";

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top", "bottom"]}
    >
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />

      {/* Top Header Row matching app layout */}
      <View style={[styles.topHeaderRow, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.backNavBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <MaterialCommunityIcons name="alpha-a-circle-outline" size={18} color={theme.text} />
            <Text style={[styles.headerMainTitle, { color: theme.text }]}>
              Android Auto
            </Text>
          </View>
          <Text style={[styles.headerSubTitle, { color: theme.textSecondary }]}>
            {telemetry.vehicleModel || "Vehicle Telemetry"}
          </Text>
        </View>

        <View
          style={[
            styles.connectionPill,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View
            style={[
              styles.connectionDot,
              {
                backgroundColor: isConnected ? theme.evGreen : theme.textMuted,
              },
            ]}
          />
          <Text style={[styles.connectionPillText, { color: theme.text }]}>
            {isConnected
              ? telemetry.connectionType === "bluetooth_ble"
                ? "BLUETOOTH"
                : "ANDROID AUTO"
              : "OFFLINE"}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Speedometer & Instant Consumption Cards */}
        <View style={styles.clusterGrid}>
          {/* Speed Card */}
          <View
            style={[
              styles.clusterCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Ionicons
                name="speedometer-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.cardTagLabel, { color: theme.textSecondary }]}>
                CURRENT SPEED
              </Text>
            </View>

            <View style={styles.speedDisplayBox}>
              <Text style={[styles.speedHeroNumber, { color: theme.text }]}>
                {telemetry.speedKmH}
              </Text>
              <Text style={[styles.speedUnitLabel, { color: theme.textSecondary }]}>
                km/h
              </Text>
            </View>

            <View style={styles.gearRow}>
              {(["P", "R", "N", "D"] as const).map((gear) => {
                const isActive =
                  (gear === "P" && telemetry.speedKmH === 0) ||
                  (gear === "D" && telemetry.speedKmH > 0);
                return (
                  <View
                    key={gear}
                    style={[
                      styles.gearPill,
                      isActive
                        ? {
                            backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B",
                          }
                        : { backgroundColor: "transparent" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.gearText,
                        {
                          color: isActive
                            ? theme.isDark
                              ? "#09090B"
                              : "#FFFFFF"
                            : theme.textMuted,
                        },
                      ]}
                    >
                      {gear}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Power Per Distance Card */}
          <View
            style={[
              styles.clusterCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Ionicons name="flash-outline" size={16} color={theme.evGreen} />
              <Text style={[styles.cardTagLabel, { color: theme.textSecondary }]}>
                POWER PER DISTANCE
              </Text>
            </View>

            <View style={styles.speedDisplayBox}>
              <Text style={[styles.speedHeroNumber, { color: theme.text }]}>
                {telemetry.predictedPowerPerDistanceWhPerKm}
              </Text>
              <Text style={[styles.speedUnitLabel, { color: theme.textSecondary }]}>
                Wh / km
              </Text>
            </View>

            <View
              style={[
                styles.efficiencyBadgeBox,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.efficiencyText, { color: theme.text }]}>
                Efficiency: {telemetry.drivingEfficiencyScore}%
              </Text>
              <Text style={[styles.efficiencySub, { color: theme.textSecondary }]}>
                {telemetry.elevationGradientPct > 0 ? "+" : ""}
                {telemetry.elevationGradientPct}% slope
              </Text>
            </View>
          </View>
        </View>

        {/* Battery & Charging Telemetry Section */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons
                name={isCharging ? "flash" : "battery-charging-outline"}
                size={18}
                color={isCharging ? theme.evGreen : theme.text}
              />
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                Battery & Energy Status
              </Text>
            </View>

            <View
              style={[
                styles.stateBadge,
                {
                  backgroundColor: isCharging
                    ? theme.evGreenSoft
                    : theme.surfaceMuted,
                  borderColor: isCharging
                    ? theme.evGreenBorder
                    : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.stateBadgeText,
                  { color: isCharging ? theme.evGreen : theme.textSecondary },
                ]}
              >
                {telemetry.chargingStatus.toUpperCase().replace("_", " ")}
              </Text>
            </View>
          </View>

          {/* Battery Bar */}
          <View style={[styles.batteryTrack, { backgroundColor: theme.surfaceMuted }]}>
            <View
              style={[
                styles.batteryFill,
                {
                  width: `${Math.min(100, Math.max(0, telemetry.batterySoc))}%`,
                  backgroundColor: isCharging ? theme.evGreen : theme.text,
                },
              ]}
            />
          </View>

          {/* Grid of Battery Telemetry Metrics */}
          <View style={styles.metricGrid}>
            <View
              style={[
                styles.metricCell,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                CHARGE LEVEL
              </Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {telemetry.batterySoc}%
              </Text>
            </View>

            <View
              style={[
                styles.metricCell,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                ESTIMATED RANGE
              </Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {telemetry.estimatedRangeRemainingKm} km
              </Text>
            </View>

            <View
              style={[
                styles.metricCell,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                ACTIVE DRAW
              </Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {telemetry.chargingPowerKw !== 0
                  ? `${telemetry.chargingPowerKw} kW`
                  : "0.0 kW"}
              </Text>
            </View>

            <View
              style={[
                styles.metricCell,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                PACK VOLTAGE
              </Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {telemetry.chargingVoltageV} V
              </Text>
            </View>

            <View
              style={[
                styles.metricCell,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                TEMPERATURE
              </Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {telemetry.batteryTempC} °C
              </Text>
            </View>

            <View
              style={[
                styles.metricCell,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                PACK SIZE
              </Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {telemetry.batteryCapacityKwh} kWh
              </Text>
            </View>
          </View>
        </View>

        {/* Location & Navigation Telemetry */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="navigate-outline" size={18} color={theme.text} />
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                Location & Navigation Telemetry
              </Text>
            </View>
          </View>

          <View style={styles.listRowsContainer}>
            <View style={[styles.listRowItem, { borderBottomColor: theme.border }]}>
              <Text style={[styles.listRowLabel, { color: theme.textSecondary }]}>
                GPS Coordinates
              </Text>
              <Text style={[styles.listRowValue, { color: theme.text }]}>
                {telemetry.location.latitude.toFixed(4)} N,{" "}
                {telemetry.location.longitude.toFixed(4)} E
              </Text>
            </View>

            <View style={[styles.listRowItem, { borderBottomColor: theme.border }]}>
              <Text style={[styles.listRowLabel, { color: theme.textSecondary }]}>
                Elevation
              </Text>
              <Text style={[styles.listRowValue, { color: theme.text }]}>
                {telemetry.location.altitude} m altitude
              </Text>
            </View>

            <View style={[styles.listRowItem, { borderBottomColor: theme.border }]}>
              <Text style={[styles.listRowLabel, { color: theme.textSecondary }]}>
                Compass Heading
              </Text>
              <Text style={[styles.listRowValue, { color: theme.text }]}>
                {telemetry.location.heading}° North-East
              </Text>
            </View>

            <View style={styles.listRowItem}>
              <Text style={[styles.listRowLabel, { color: theme.textSecondary }]}>
                Cabin Climate
              </Text>
              <Text style={[styles.listRowValue, { color: theme.text }]}>
                {telemetry.ambientTemperatureC} °C • HVAC {telemetry.hvacPowerKw} kW
              </Text>
            </View>
          </View>
        </View>

        {/* In-Vehicle Connection Card (Bluetooth Alternative) */}
        <View
          style={[
            styles.connectionCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.connectionCardHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons
                name="bluetooth-outline"
                size={18}
                color={isConnected ? theme.evGreen : theme.textSecondary}
              />
              <Text style={[styles.connectionCardTitle, { color: theme.text }]}>
                Vehicle Communications Link
              </Text>
            </View>
            <View
              style={[
                styles.connectionStateTag,
                {
                  backgroundColor: isConnected
                    ? theme.evGreenSoft
                    : theme.surfaceMuted,
                  borderColor: isConnected
                    ? theme.evGreenBorder
                    : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.connectionStateTagText,
                  { color: isConnected ? theme.evGreen : theme.textSecondary },
                ]}
              >
                {isConnected ? "ACTIVE" : "STANDBY"}
              </Text>
            </View>
          </View>

          <Text style={[styles.connectionCardDescription, { color: theme.textSecondary }]}>
            {isConnected
              ? telemetry.connectionType === "bluetooth_ble"
                ? `Vehicle connected via Bluetooth (${telemetry.connectedDeviceName || "BLE Adapter"}). Live speed and telemetry synced.`
                : "Vehicle linked via Android Auto CarApp Protocol. Driving telemetry synced in real time."
              : "If your car cannot run Android Auto, pair with your vehicle's Bluetooth (OBD-II adapter or head unit) to transmit live charging, speed, and power data."}
          </Text>

          {isConnected ? (
            <TouchableOpacity
              style={[
                styles.standardActionButton,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  borderWidth: 1,
                },
              ]}
              onPress={handleDisconnect}
              activeOpacity={0.8}
            >
              <Text style={[styles.standardActionButtonText, { color: theme.text }]}>
                Disconnect Vehicle Link
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.standardActionButton,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                  borderWidth: 1,
                },
              ]}
              onPress={() => {
                setBluetoothModalVisible(true);
                handleStartBluetoothScan();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="bluetooth" size={16} color={theme.text} />
              <Text style={[styles.standardActionButtonText, { color: theme.text }]}>
                Connect Vehicle Bluetooth
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Primary Action Buttons matching App Design */}
        <View style={styles.actionButtonGroup}>
          <TouchableOpacity
            style={[
              styles.primaryAppButton,
              { backgroundColor: theme.primaryBtnBg },
            ]}
            onPress={() => router.push("/ai_prediction")}
            activeOpacity={0.85}
          >
            <Ionicons
              name="sparkles-outline"
              size={16}
              color={theme.primaryBtnText}
            />
            <Text
              style={[
                styles.primaryAppButtonText,
                { color: theme.primaryBtnText },
              ]}
            >
              AI Power & Range Prediction
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryAppButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
            onPress={() => router.push("/(tabs)/ev_chargers")}
            activeOpacity={0.85}
          >
            <Ionicons name="flash-outline" size={16} color={theme.text} />
            <Text style={[styles.secondaryAppButtonText, { color: theme.text }]}>
              Nearby Charging Stations
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bluetooth Vehicle Scanner Modal */}
      <Modal
        visible={bluetoothModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBluetoothModalVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View
            style={[
              styles.bluetoothModalBox,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>
                  Connect Vehicle Bluetooth
                </Text>
                <Text
                  style={[styles.modalHeaderSubtitle, { color: theme.textSecondary }]}
                >
                  Select your vehicle's OBD-II adapter or head unit
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.closeModalBtn,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                ]}
                onPress={() => setBluetoothModalVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            {bluetoothError && (
              <View
                style={[
                  styles.errorNoticeBox,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={15}
                  color={theme.textSecondary}
                />
                <Text
                  style={[styles.errorNoticeText, { color: theme.textSecondary }]}
                >
                  {bluetoothError}
                </Text>
              </View>
            )}

            <ScrollView
              style={styles.deviceListScroll}
              contentContainerStyle={styles.deviceListContent}
            >
              {isScanning ? (
                <View style={styles.scanningBox}>
                  <ActivityIndicator size="small" color={theme.text} />
                  <Text style={[styles.scanningText, { color: theme.textSecondary }]}>
                    Scanning for vehicle Bluetooth devices...
                  </Text>
                </View>
              ) : discoveredDevices.length === 0 ? (
                <View style={styles.emptyDeviceBox}>
                  <Text style={[styles.emptyDeviceText, { color: theme.textSecondary }]}>
                    No devices detected. Ensure vehicle Bluetooth is powered on.
                  </Text>
                </View>
              ) : (
                discoveredDevices.map((dev) => (
                  <TouchableOpacity
                    key={dev.id}
                    style={[
                      styles.deviceRowItem,
                      {
                        backgroundColor: theme.surfaceMuted,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => handleConnectBluetoothDevice(dev)}
                    disabled={isConnectingDevice === dev.id}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.deviceNameText, { color: theme.text }]}>
                        {dev.name || "Vehicle Bluetooth Adapter"}
                      </Text>
                      <Text
                        style={[styles.deviceIdText, { color: theme.textSecondary }]}
                      >
                        ID: {dev.id}
                      </Text>
                    </View>

                    {isConnectingDevice === dev.id ? (
                      <ActivityIndicator size="small" color={theme.text} />
                    ) : (
                      <View
                        style={[
                          styles.connectActionBadge,
                          { backgroundColor: theme.primaryBtnBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.connectActionBadgeText,
                            { color: theme.primaryBtnText },
                          ]}
                        >
                          Connect
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={[
                styles.rescanBtn,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
              onPress={handleStartBluetoothScan}
              disabled={isScanning}
              activeOpacity={0.8}
            >
              <Text style={[styles.rescanBtnText, { color: theme.text }]}>
                {isScanning ? "Scanning..." : "Scan Again"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  topHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleCenter: {
    alignItems: "center",
  },
  headerMainTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerSubTitle: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  connectionPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectionPillText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  clusterGrid: {
    flexDirection: "row",
    gap: 12,
  },
  clusterCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardTagLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  speedDisplayBox: {
    alignItems: "center",
    marginVertical: 8,
  },
  speedHeroNumber: {
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  speedUnitLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: -2,
  },
  gearRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  gearPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  gearText: {
    fontSize: 11,
    fontWeight: "700",
  },
  efficiencyBadgeBox: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  efficiencyText: {
    fontSize: 10,
    fontWeight: "700",
  },
  efficiencySub: {
    fontSize: 9,
    marginTop: 1,
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  stateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  stateBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  batteryTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  batteryFill: {
    height: "100%",
    borderRadius: 4,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricCell: {
    width: (width - 40 - 32 - 16) / 3,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  listRowsContainer: {
    gap: 2,
  },
  listRowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  listRowLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  listRowValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  connectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  connectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  connectionCardTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  connectionStateTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  connectionStateTagText: {
    fontSize: 9,
    fontWeight: "700",
  },
  connectionCardDescription: {
    fontSize: 11,
    lineHeight: 16,
  },
  standardActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  standardActionButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionButtonGroup: {
    gap: 10,
  },
  primaryAppButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  primaryAppButtonText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  secondaryAppButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  secondaryAppButtonText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bluetoothModalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    maxHeight: "75%",
    gap: 14,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  modalHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalHeaderSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  closeModalBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  errorNoticeText: {
    flex: 1,
    fontSize: 11,
  },
  deviceListScroll: {
    maxHeight: 220,
  },
  deviceListContent: {
    gap: 8,
  },
  scanningBox: {
    paddingVertical: 24,
    alignItems: "center",
    gap: 10,
  },
  scanningText: {
    fontSize: 12,
  },
  emptyDeviceBox: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyDeviceText: {
    fontSize: 12,
    textAlign: "center",
  },
  deviceRowItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  deviceNameText: {
    fontSize: 12,
    fontWeight: "700",
  },
  deviceIdText: {
    fontSize: 10,
    marginTop: 2,
  },
  connectActionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  connectActionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  rescanBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  rescanBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
