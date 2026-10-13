import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CarColorVariant } from "../components/UltraRealisticCar";
import { supabase } from "../app/lib/supabase";

export interface DriverVehicleSpecs {
  id: string;
  plateNumber: string;
  makeModel: string;
  vehicleType: "ev" | "hybrid" | "gasoline" | "diesel";
  colorVariant: CarColorVariant;
  colorName: string;
  bodyStyle: "Sedan" | "SUV" | "Coupe" | "Hatchback" | "Truck";
  plugType: "CCS2 Combo" | "Type 2 Mennekes" | "Supercharger" | "CHAdeMO" | "None";
  batteryCapacityKwh: number;
  batteryLevelPercent: number; // 0 - 100
  estimatedRangeKm: number;
  parkingPermitType: "Standard" | "EV Priority" | "Handicap Concession";
  driveMode: "Eco Range" | "Normal Balanced" | "Sport Dynamic";
  headlightsActive: boolean;
  clearanceHeightMeters: number;
  lengthMeters: number;
  widthMeters: number;
  vinNumber: string;
  insuranceExpiry: string;
  lastTelemetryPing: string;
}

export const DEFAULT_DRIVER_VEHICLE: DriverVehicleSpecs = {
  id: "veh-rw-01",
  plateNumber: "RAD 123 A",
  makeModel: "Porsche Taycan 4S",
  vehicleType: "ev",
  colorVariant: "obsidian",
  colorName: "Obsidian Metallic Black",
  bodyStyle: "Sedan",
  plugType: "CCS2 Combo",
  batteryCapacityKwh: 93.4,
  batteryLevelPercent: 86,
  estimatedRangeKm: 420,
  parkingPermitType: "EV Priority",
  driveMode: "Normal Balanced",
  headlightsActive: true,
  clearanceHeightMeters: 1.4,
  lengthMeters: 4.96,
  widthMeters: 1.96,
  vinNumber: "WP0AA2Y16MSA19204",
  insuranceExpiry: "2027-04-15",
  lastTelemetryPing: new Date().toISOString(),
};

const STORAGE_KEY = "@parkzone_driver_vehicle_specs";

type VehicleChangeListener = (vehicle: DriverVehicleSpecs) => void;
const listeners = new Set<VehicleChangeListener>();

let cachedVehicle: DriverVehicleSpecs = DEFAULT_DRIVER_VEHICLE;
let isInitialized = false;

export function useDriverVehicle() {
  const [vehicle, setVehicleState] = useState<DriverVehicleSpecs>(cachedVehicle);
  const [isLoaded, setIsLoaded] = useState(isInitialized);

  useEffect(() => {
    // Initial load
    if (!isInitialized) {
      AsyncStorage.getItem(STORAGE_KEY).then((json) => {
        if (json) {
          try {
            const parsed = JSON.parse(json);
            cachedVehicle = { ...DEFAULT_DRIVER_VEHICLE, ...parsed };
          } catch (e) {
            console.warn("Failed to parse stored vehicle:", e);
          }
        }
        isInitialized = true;
        setVehicleState(cachedVehicle);
        setIsLoaded(true);
      });
    } else {
      setVehicleState(cachedVehicle);
      setIsLoaded(true);
    }

    const handler: VehicleChangeListener = (updated) => {
      setVehicleState(updated);
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const updateVehicle = useCallback(async (partial: Partial<DriverVehicleSpecs>) => {
    const updated: DriverVehicleSpecs = {
      ...cachedVehicle,
      ...partial,
      lastTelemetryPing: new Date().toISOString(),
    };
    cachedVehicle = updated;
    setVehicleState(updated);

    // Notify all active screen listeners instantly in real time
    listeners.forEach((fn) => fn(updated));

    // Persist to storage
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn("Could not save vehicle specs:", err);
    }

    // Attempt background sync to Supabase if logged in
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const parts = (updated.makeModel || "").trim().split(" ");
        const brand = parts[0] || "Custom";
        const model = parts.slice(1).join(" ") || parts[0] || "Vehicle";

        await supabase.from("vehicles").upsert({
          id: updated.id,
          user_id: user.id,
          plate_number: updated.plateNumber,
          vehicle_type: updated.vehicleType === "ev" ? "ev" : "gasoline",
          brand,
          model,
          color: updated.colorVariant,
        });
      }
    } catch {
      // Offline fallback silent
    }
  }, []);

  return {
    vehicle,
    isLoaded,
    updateVehicle,
  };
}
