// Vehicle and Charger Communications Engine via WebSocket (CSMS / In-Car Gateway)
// Enables real-time reading of car metrics: range, battery SOC %, charging state, and battery capacity.

export interface CarTelemetryPayload {
  range: number;
  battery: number; // 0 - 100%
  charging: boolean;
  batteryCapacity: number; // kWh
  speed: number; // km/h
  chargingPowerKw: number;
  voltage: number;
  current: number;
  timestamp: number;
}

let WebSocketServer: any = null;
let WebSocketClient: any = typeof WebSocket !== "undefined" ? WebSocket : null;

try {
  const wsModule = require("ws");
  if (wsModule) {
    WebSocketServer = wsModule.WebSocketServer || null;
    if (wsModule.WebSocket) {
      WebSocketClient = wsModule.WebSocket;
    }
  }
} catch (_) {
  // Mobile React Native environment: ws native server package is not present
}

const wss = WebSocketServer ? new WebSocketServer({ port: 8080 }) : null;

// Ping chargers for status updates
const foundChargers: any[] = [];

// In-memory latest vehicle telemetry received over WebSocket
let latestCarData: CarTelemetryPayload = {
  range: 0,
  battery: 0,
  charging: false,
  batteryCapacity: 0,
  speed: 0,
  chargingPowerKw: 0,
  voltage: 0,
  current: 0,
  timestamp: 0,
};

type CarDataListener = (data: CarTelemetryPayload) => void;
const carDataListeners = new Set<CarDataListener>();

function notifyCarDataListeners(data: CarTelemetryPayload): void {
  carDataListeners.forEach((cb) => {
    try {
      cb(data);
    } catch (_) {}
  });
}

function updateCarData(newData: Partial<CarTelemetryPayload>): void {
  if (!newData) return;
  latestCarData = {
    ...latestCarData,
    ...newData,
    timestamp: Date.now(),
  };
  notifyCarDataListeners(latestCarData);
}

/**
 * Parses car & charger telemetry payloads from WebSocket messages.
 * Extracts: range (km), battery (SOC %), charging (boolean/status), battery capacity (kWh), speed, and charging power.
 */
export function parseCarData(payload: any): CarTelemetryPayload | null {
  let obj = payload;
  if (typeof payload === "string") {
    try {
      obj = JSON.parse(payload);
    } catch (_) {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;

  // Handle OCPP 1.6J / 2.0.1 MeterValues calls: [2, "id", "MeterValues", { ... }]
  if (Array.isArray(obj) && obj.length >= 4 && obj[2] === "MeterValues") {
    const p = obj[3];
    let soc: number | null = null;
    let powerKw: number | null = null;
    if (p && Array.isArray(p.meterValue)) {
      for (const mv of p.meterValue) {
        if (Array.isArray(mv.sampledValue)) {
          for (const sv of mv.sampledValue) {
            if (sv.measurand === "SoC") soc = Number(sv.value);
            if (sv.measurand === "Power.Active.Import") powerKw = Number(sv.value) / 1000;
          }
        }
      }
    }
    return {
      range: 0,
      battery: soc ?? 0,
      charging: (powerKw ?? 0) > 0,
      batteryCapacity: 0,
      speed: 0,
      chargingPowerKw: powerKw ?? 0,
      voltage: 0,
      current: 0,
      timestamp: Date.now(),
    };
  }

  const v = obj.vehicle || obj.data || obj.telemetry || obj.car || obj;

  const range = Number(v.range ?? v.rangeKm ?? v.estimatedRange ?? v.remainingRangeKm ?? 0);

  let battery = 0;
  if (typeof v.battery === "number") {
    battery = v.battery;
  } else if (typeof v.battery === "object" && v.battery !== null) {
    battery = Number(v.battery.soc ?? v.battery.percent ?? v.battery.level ?? 0);
  } else if (v.batterySoc !== undefined) {
    battery = Number(v.batterySoc);
  } else if (v.soc !== undefined) {
    battery = Number(v.soc);
  } else if (v.batteryPercent !== undefined) {
    battery = Number(v.batteryPercent);
  }

  let batteryCapacity = 0;
  if (typeof v.batteryCapacity === "number") {
    batteryCapacity = v.batteryCapacity;
  } else if (typeof v.battery === "object" && v.battery !== null && v.battery.capacity !== undefined) {
    batteryCapacity = Number(v.battery.capacity);
  } else if (v.batteryCapacityKwh !== undefined) {
    batteryCapacity = Number(v.batteryCapacityKwh);
  } else if (v.capacity !== undefined) {
    batteryCapacity = Number(v.capacity);
  }

  let charging = false;
  if (typeof v.charging === "boolean") charging = v.charging;
  else if (typeof v.isCharging === "boolean") charging = v.isCharging;
  else if (typeof v.charging === "string") {
    const s = v.charging.toLowerCase();
    charging = s === "charging" || s === "fast_dc" || s === "plugged_in" || s === "true";
  } else if (typeof v.chargingStatus === "string") {
    const s = v.chargingStatus.toLowerCase();
    charging = s === "charging" || s === "fast_dc" || s === "plugged_in";
  } else if (v.charging && typeof v.charging.status === "string") {
    const s = v.charging.status.toLowerCase();
    charging = s === "charging" || s === "fast_dc" || s === "plugged_in";
  }

  const speed = Number(v.speed ?? v.speedKmH ?? 0);
  const chargingPowerKw = Number(v.chargingPowerKw ?? v.powerKw ?? (v.charging && v.charging.powerKw) ?? 0);
  const voltage = Number(v.voltage ?? v.chargingVoltageV ?? (v.charging && v.charging.voltage) ?? 0);
  const current = Number(v.current ?? v.chargingCurrentA ?? (v.charging && v.charging.current) ?? 0);

  return {
    range: isNaN(range) ? 0 : range,
    battery: isNaN(battery) ? 0 : battery,
    charging,
    batteryCapacity: isNaN(batteryCapacity) ? 0 : batteryCapacity,
    speed: isNaN(speed) ? 0 : speed,
    chargingPowerKw: isNaN(chargingPowerKw) ? 0 : chargingPowerKw,
    voltage: isNaN(voltage) ? 0 : voltage,
    current: isNaN(current) ? 0 : current,
    timestamp: Date.now(),
  };
}

/**
 * Sends a query payload over WebSocket asking the connected car or charger for telemetry.
 */
export function requestCarData(ws: any): boolean {
  if (!ws) return false;
  try {
    const query = JSON.stringify({
      action: "get_car_data",
      type: "TELEMETRY_REQUEST",
      fields: ["range", "battery", "charging", "batteryCapacity", "speed"],
      timestamp: Date.now(),
    });
    ws.send(query);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Get latest known vehicle data received from WebSocket
 */
export function getLatestCarData(): CarTelemetryPayload {
  return latestCarData;
}

/**
 * Subscribe to car data updates
 */
export function onCarDataUpdate(callback: CarDataListener): () => void {
  if (typeof callback !== "function") return () => {};
  carDataListeners.add(callback);
  if (latestCarData.timestamp > 0) {
    try {
      callback(latestCarData);
    } catch (_) {}
  }
  return () => {
    carDataListeners.delete(callback);
  };
}

// Server mode connection handling (e.g. CSMS)
if (wss) {
  wss.on("connection", (ws: any) => {
    // Request vehicle/charger data immediately on connect
    requestCarData(ws);

    ws.on("message", (message: any) => {
      try {
        const text = typeof message === "string" ? message : message.toString("utf8");
        const parsed = parseCarData(text);
        if (parsed && (parsed.range > 0 || parsed.battery > 0 || parsed.batteryCapacity > 0 || parsed.charging)) {
          updateCarData(parsed);
        }
      } catch (_) {}
    });

    ws.on("close", () => {
      const index = foundChargers.indexOf(ws);
      if (index !== -1) {
        foundChargers.splice(index, 1);
      }
    });

    ws.on("error", () => ws.terminate());
  });
}

export function broadcastCarDataRequest(): void {
  if (!wss) return;
  wss.clients.forEach((ws: any) => {
    requestCarData(ws);
  });
}

export function pingChargers(): any {
  if (!wss) return null;

  return setInterval(() => {
    wss.clients.forEach((ws: any) => {
      const status = checkChargerStatus(ws);

      if (status === "online") {
        if (!foundChargers.includes(ws)) {
          foundChargers.push(ws);
        }
        requestCarData(ws);
      } else if (status === "offline") {
        const sumfailure = foundChargers.indexOf(ws);
        if (sumfailure !== -1) {
          foundChargers.splice(sumfailure, 1);
        }
      }
    });
  }, 30000);
}

export function checkChargerStatus(ws: any): string {
  if (!ws) return "unknown";
  const WS = WebSocketClient || (typeof WebSocket !== "undefined" ? WebSocket : null);
  if (WS) {
    switch (ws.readyState) {
      case WS.CONNECTING:
        return "connecting";
      case WS.OPEN:
        try {
          ws.send(JSON.stringify({ message: "Checking Status ONLINE......" }));
        } catch (_) {}
        return "online";
      case WS.CLOSING:
        return "closing";
      case WS.CLOSED:
        return "offline";
      default:
        return "unknown";
    }
  }
  return "unknown";
}

export function hasChargers(): boolean {
  return wss ? wss.clients.size > 0 : false;
}

// Active client connection for React Native mobile app
let activeClientWs: any = null;

export function connectVehicleClient(url = "ws://127.0.0.1:8080"): any {
  const WS = WebSocketClient || (typeof WebSocket !== "undefined" ? WebSocket : null);
  if (!WS) return null;

  if (activeClientWs) {
    try {
      activeClientWs.close();
    } catch (_) {}
    activeClientWs = null;
  }

  try {
    const ws = new WS(url);
    activeClientWs = ws;

    ws.onopen = () => {
      requestCarData(ws);
    };

    ws.onmessage = (event: any) => {
      try {
        const parsed = parseCarData(event.data);
        if (parsed) {
          updateCarData(parsed);
        }
      } catch (_) {}
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      if (activeClientWs === ws) {
        activeClientWs = null;
      }
    };

    return ws;
  } catch (_) {
    return null;
  }
}

export function disconnectVehicleClient(): void {
  if (activeClientWs) {
    try {
      activeClientWs.close();
    } catch (_) {}
    activeClientWs = null;
  }
}

// Route default export for Expo Router compatibility
export default function ChargerStatusRoute(): null {
  return null;
}
