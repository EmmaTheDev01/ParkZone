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

export function checkChargerStatus(ws: any): string;
export function hasChargers(): boolean;
export function pingChargers(): any;
export function parseCarData(payload: any): CarTelemetryPayload | null;
export function requestCarData(ws: any): boolean;
export function getLatestCarData(): CarTelemetryPayload;
export function onCarDataUpdate(callback: (data: CarTelemetryPayload) => void): () => void;
export function connectVehicleClient(url?: string): any;
export function disconnectVehicleClient(): void;
export function broadcastCarDataRequest(): void;

export default function ChargerStatusRoute(): null;
