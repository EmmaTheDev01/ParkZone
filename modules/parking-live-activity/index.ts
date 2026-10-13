import { requireNativeModule } from "expo-modules-core";

let NativeModule: any = null;
try {
  NativeModule = requireNativeModule("ParkingLiveActivityModule");
} catch {
  // Graceful fallback when running in environment before native build
}

export const areActivitiesEnabled = (): boolean => {
  try {
    return NativeModule?.areActivitiesEnabled?.() ?? false;
  } catch {
    return false;
  }
};

export const startParkingActivity = async (
  bayNumber: string,
  locationName: string,
  plate: string,
  totalSeconds: number,
  remainingSeconds: number
): Promise<boolean> => {
  try {
    if (!NativeModule?.startActivity) return false;
    return await NativeModule.startActivity(
      bayNumber,
      locationName,
      plate,
      totalSeconds,
      remainingSeconds
    );
  } catch (e) {
    console.warn("ParkingLiveActivity.startActivity error:", e);
    return false;
  }
};

export const updateParkingActivity = async (
  remainingSeconds: number,
  progressPercent: number
): Promise<boolean> => {
  try {
    if (!NativeModule?.updateActivity) return false;
    return await NativeModule.updateActivity(remainingSeconds, progressPercent);
  } catch (e) {
    console.warn("ParkingLiveActivity.updateActivity error:", e);
    return false;
  }
};

export const endParkingActivity = async (): Promise<boolean> => {
  try {
    if (!NativeModule?.endActivity) return false;
    return await NativeModule.endActivity();
  } catch (e) {
    console.warn("ParkingLiveActivity.endActivity error:", e);
    return false;
  }
};
