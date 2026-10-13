import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and create Android notification channels
 */
export async function registerForPushNotificationsAsync(): Promise<boolean> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("parking_live_activity", {
      name: "ParkZone Parking Sessions",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#10B981",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "default",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

/**
 * Trigger local notification when motorist locks spot and starts parking
 */
export async function notifyParkingStarted(bayNumber: string, locationName: string, durationHours: number) {
  try {
    await registerForPushNotificationsAsync();

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🚗 Live Parking Active • Bay ${bayNumber}`,
        body: `Locked at ${locationName}. Booked for ${durationHours}h. Live Dynamic Island tracker active.`,
        data: { bayNumber, locationName, type: "parking_started" },
        sound: "default",
      },
      trigger: null, // trigger immediately
    });

    // Schedule 15-minute warning notification
    const warningSeconds = Math.max(30, (durationHours * 3600) - 900);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ Parking Expiring in 15 Minutes`,
        body: `Your session at Bay ${bayNumber} (${locationName}) is about to end. Tap to extend or depart.`,
        data: { bayNumber, locationName, type: "parking_warning" },
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: warningSeconds,
      },
    });
  } catch (err) {
    console.warn("Notification error:", err);
  }
}

/**
 * Cancel all scheduled parking notifications when parking is completed
 */
export async function clearParkingNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (err) {
    console.warn("Error clearing notifications:", err);
  }
}

export default function () {
  return null;
}
