import React, { useState } from "react";
import {
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";

interface SettingOption {
  title: string;
  desc?: string;
  badge?: string;
  action?: string;
  variant?: "default" | "destructive";
}

interface SettingToggle {
  key: string;
  label: string;
  desc: string;
  defaultVal: boolean;
}

interface SettingAction {
  label: string;
  desc: string;
  action: string;
  variant?: "default" | "destructive";
}

interface SettingConfig {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  fields?: [string, string, string?][];
  options?: SettingOption[];
  toggles?: SettingToggle[];
  actions?: SettingAction[];
}

const SETTINGS_REGISTRY: Record<string, SettingConfig> = {
  personal: {
    title: "Personal Information",
    subtitle: "Update your motorist profile, national ID, and emergency contact details.",
    icon: "person-outline",
    fields: [
      ["Full Name", "Aline Mukamana", "Enter full legal name"],
      ["Phone Number", "+250 788 123 456", "MTN or Airtel phone number"],
      ["Email Address", "aline.mukamana@email.com", "Active email for receipts"],
      ["National ID / Passport", "1 1995 8 0012345 0 12", "Rwandan NID or passport"],
      ["Driver License No.", "RW-DL-98214-KGL", "Valid RNP traffic license"],
      ["Emergency Contact", "+250 788 987 654", "Next of kin phone number"],
    ],
  },
  vehicles: {
    title: "Vehicles & Permits",
    subtitle: "Manage vehicles linked to your ParkZone account across Rwanda.",
    icon: "car-outline",
    options: [
      {
        title: "RAB 123 C · Toyota RAV4",
        desc: "Primary Vehicle · Oblique Bays Enabled",
        badge: "PRIMARY",
      },
      {
        title: "RAC 491 F · Volkswagen Golf",
        desc: "Secondary Vehicle · Standard Regular Bay",
        badge: "ACTIVE",
      },
      {
        title: "RAD 245 B · Hyundai Ioniq 5",
        desc: "Electric Vehicle · CCS2 Fast Plug Allowed",
        badge: "EV READY",
      },
      {
        title: "Add New Vehicle",
        desc: "Register plate number, make & color",
        action: "add_vehicle",
      },
      {
        title: "Handicap Parking Permit",
        desc: "Link approved ministerial concession permit (RWA-DIS)",
        action: "permit",
      },
    ],
  },
  payments: {
    title: "Payment Channels",
    subtitle: "Configure automated parking checkout and MoMo accounts in RWF.",
    icon: "card-outline",
    options: [
      {
        title: "MTN Mobile Money (*182#)",
        desc: "+250 788 123 456 · Instant MoMo checkout",
        badge: "PRIMARY",
      },
      {
        title: "Airtel Money (*182#)",
        desc: "+250 733 654 321 · Secondary backup channel",
        badge: "LINKED",
      },
      {
        title: "Visa / Mastercard Card",
        desc: "Card ending in 4242 · Automatic billing",
        badge: "LINKED",
      },
      {
        title: "RRA Fiscal TIN Number",
        desc: "TIN 102938475 for EBM corporate invoice generation",
        action: "tin",
      },
    ],
    toggles: [
      {
        key: "auto_debit",
        label: "Auto-Pay on Gate Exit",
        desc: "Automatically pay parking fee upon plate camera recognition at exit gate.",
        defaultVal: true,
      },
      {
        key: "receipt_sms",
        label: "SMS Tax Invoice (EBM)",
        desc: "Receive immediate fiscal SMS invoice after payment confirmation.",
        defaultVal: true,
      },
    ],
  },
  performance: {
    title: "Performance & Cache",
    subtitle: "Optimize map speed, caching, and battery consumption.",
    icon: "speedometer-outline",
    toggles: [
      {
        key: "prefetch_lots",
        label: "Pre-fetch Nearby Parking Lots",
        desc: "Background load lot occupancy and EV telemetry within 5 km.",
        defaultVal: true,
      },
      {
        key: "low_data",
        label: "Low Data Mode",
        desc: "Reduce network bandwidth by disabling 3D aerial animations and CCTV previews.",
        defaultVal: false,
      },
      {
        key: "gpu_accel",
        label: "Hardware Accelerated 3D View",
        desc: "Use GPU hardware rendering for parking lot bay topology.",
        defaultVal: true,
      },
      {
        key: "screen_awake",
        label: "Keep Screen Awake When Parked",
        desc: "Prevent display sleep while parking tracker timer is running.",
        defaultVal: true,
      },
      {
        key: "offline_sync",
        label: "Background Offline Sync",
        desc: "Cache parking sensor data for seamless reconnection when signal drops.",
        defaultVal: true,
      },
    ],
    actions: [
      {
        label: "Clear Offline Map Cache",
        desc: "Frees local storage without affecting active sessions",
        action: "clear_cache",
      },
      {
        label: "Reset App State & Reload",
        desc: "Re-sync latest Kigali lot topology and sensor grid",
        action: "reset_state",
      },
    ],
  },
  navigation: {
    title: "GPS & Navigation",
    subtitle: "Configure turn-by-turn routing, GPS precision, and guidance.",
    icon: "navigate-outline",
    toggles: [
      {
        key: "high_gps",
        label: "High Precision GPS (1-meter)",
        desc: "Use fine-grained location polling for indoor and oblique parking bay detection.",
        defaultVal: true,
      },
      {
        key: "auto_reroute",
        label: "Auto-Reroute If Lot Full",
        desc: "Automatically guide you to the nearest backup lot if available spots hit zero.",
        defaultVal: true,
      },
      {
        key: "voice_cues",
        label: "Voice Parking Guidance",
        desc: "Audio cues when approaching entry barrier and assigned bay.",
        defaultVal: false,
      },
      {
        key: "background_arrival",
        label: "Background Arrival Detection",
        desc: "Automatically detect when vehicle enters geofenced parking facility.",
        defaultVal: true,
      },
    ],
    options: [
      {
        title: "Preferred Navigation App",
        desc: "In-App Navigation (Default)",
        action: "select_nav",
      },
      {
        title: "Search Radius",
        desc: "Current: 5 Kilometers around vehicle",
        action: "select_radius",
      },
    ],
  },
  security: {
    title: "Security & Biometrics",
    subtitle: "Protect your motorist identity, payment authorization, and account.",
    icon: "shield-checkmark-outline",
    toggles: [
      {
        key: "biometric_checkout",
        label: "Biometric Checkout (FaceID / PIN)",
        desc: "Require fingerprint or facial scan before debiting wallet.",
        defaultVal: true,
      },
      {
        key: "two_factor",
        label: "Two-Factor Authentication",
        desc: "Verify new sign-ins with an SMS OTP code sent to your phone.",
        defaultVal: true,
      },
      {
        key: "blind_index",
        label: "Blind-Index Plate Anonymization",
        desc: "Plate numbers stored as salted cryptographic hashes.",
        defaultVal: true,
      },
      {
        key: "suspicious_alerts",
        label: "Unrecognized Marshal Alert",
        desc: "Notify immediately if an unauthorized terminal scans your license plate.",
        defaultVal: true,
      },
    ],
    options: [
      {
        title: "Change Account Password",
        desc: "Update your ParkZone login password",
        action: "change_pw",
      },
      {
        title: "Session Auto-Lock Timer",
        desc: "Current: Lock after 5 minutes of inactivity",
        action: "autolock",
      },
    ],
  },
  notifications: {
    title: "Notifications & Alerts",
    subtitle: "Choose exactly when ParkZone alerts you on your phone.",
    icon: "notifications-outline",
    toggles: [
      {
        key: "overstay_15m",
        label: "15-Minute Expiry Notice",
        desc: "Alert 15 minutes before your booked parking session ends.",
        defaultVal: true,
      },
      {
        key: "critical_5m",
        label: "5-Minute Fine Prevention Warning",
        desc: "Critical countdown reminder to avoid the 3,000 RWF overstay penalty.",
        defaultVal: true,
      },
      {
        key: "ev_done",
        label: "EV Charging Complete Notice",
        desc: "SMS alert when battery hits 80% or 100% to avoid idle connector fees.",
        defaultVal: true,
      },
      {
        key: "momo_receipt",
        label: "Mobile Money Receipt SMS",
        desc: "Receive immediate transaction confirmation from MTN / Airtel.",
        defaultVal: true,
      },
      {
        key: "surge_alert",
        label: "Peak Demand & Tariff Alerts",
        desc: "Notifications when nearby parking hubs reach >90% occupancy.",
        defaultVal: false,
      },
      {
        key: "haptic_ping",
        label: "Haptic Vibration Feedback",
        desc: "Vibrate on QR code scans, bay locks, and payment authorizations.",
        defaultVal: true,
      },
    ],
  },
  language: {
    title: "Language & Regional Units",
    subtitle: "Set how text, currency, and measurements are displayed.",
    icon: "globe-outline",
    options: [
      {
        title: "Language",
        desc: "English (Default)",
        action: "lang",
      },
      {
        title: "Country & Region",
        desc: "Rwanda (Kigali Time, GMT+2)",
        action: "region",
      },
      {
        title: "Billing Currency",
        desc: "Rwandan Franc (RWF)",
        action: "currency",
      },
      {
        title: "Distance Measurement",
        desc: "Metric System (Meters & Kilometers)",
        action: "units",
      },
      {
        title: "Date & Time Format",
        desc: "24-Hour Clock · DD/MM/YYYY",
        action: "date_format",
      },
    ],
  },
  appearance: {
    title: "Appearance & Display",
    subtitle: "Customize the visual appearance and contrast of ParkZone.",
    icon: "contrast-outline",
    options: [
      {
        title: "Light Mode",
        desc: "Clean, high-contrast monochrome light theme (Default)",
        badge: "ACTIVE",
        action: "theme_light",
      },
      {
        title: "Dark Mode",
        desc: "Deep carbon black theme for night driving",
        action: "theme_dark",
      },
      {
        title: "System Default",
        desc: "Automatically match your phone's OS theme",
        action: "theme_system",
      },
    ],
    toggles: [
      {
        key: "high_contrast",
        label: "High Contrast Bay Markings",
        desc: "Enhance visibility of road lines and bay borders in direct sunlight.",
        defaultVal: true,
      },
      {
        key: "bold_text",
        label: "Bold Motorist Typography",
        desc: "Increase font weight for quick glanceability while driving.",
        defaultVal: false,
      },
    ],
  },
  diagnostics: {
    title: "System & Sensor Diagnostics",
    subtitle: "Monitor real-time connection to Kigali smart parking telemetry.",
    icon: "hardware-chip-outline",
    options: [
      {
        title: "City Smart Grid Connection",
        desc: "Connected · 18ms latency to Kigali Central Node",
        badge: "ONLINE",
      },
      {
        title: "Ultrasonic Bay Sensor Mesh",
        desc: "60 / 60 Sensors communicating via LoRaWAN",
        badge: "99.98%",
      },
      {
        title: "ANPR Plate Camera Relay",
        desc: "Optical barriers operational at Kigali Heights",
        badge: "READY",
      },
    ],
    toggles: [
      {
        key: "debug_telemetry",
        label: "Live Diagnostic Telemetry",
        desc: "Log real-time sensor packets and latency pings locally.",
        defaultVal: false,
      },
      {
        key: "crash_reporting",
        label: "Anonymous Diagnostics Reporting",
        desc: "Help ParkZone engineers fix app crashes automatically.",
        defaultVal: true,
      },
    ],
    actions: [
      {
        label: "Run Network Latency Ping Test",
        desc: "Tests response time to Kigali parking backend",
        action: "ping_test",
      },
      {
        label: "Report Sensor Malfunction",
        desc: "Alert marshals if an occupied bay shows as vacant",
        action: "report_sensor",
      },
    ],
  },
  privacy: {
    title: "Privacy & Data Protection",
    subtitle: "Your personal data is protected with end-to-end cryptographic encryption.",
    icon: "lock-closed-outline",
    options: [
      {
        title: "Data Protection & Privacy Policy",
        desc: "Read our full compliance framework and rights notice",
        action: "law_info",
      },
      {
        title: "Export My Parking History",
        desc: "Download JSON / CSV of all sessions and EBM invoices",
        action: "export_data",
      },
      {
        title: "Revoke Location Permissions",
        desc: "Turn off background GPS tracking in iOS settings",
        action: "location_perm",
      },
      {
        title: "Anonymize Historical Records",
        desc: "Sever link between your profile and past parking tickets",
        action: "anonymize",
      },
      {
        title: "Delete My Account & Data",
        desc: "Permanently delete account, wallet, and linked plates",
        action: "delete_account",
        variant: "destructive",
      },
    ],
  },
  help: {
    title: "Help & Dispatch Center",
    subtitle: "Get assistance from Kigali parking marshals and dispatch operators.",
    icon: "help-buoy-outline",
    options: [
      {
        title: "Call Toll-Free Dispatch Hotline",
        desc: "Toll-Free 3122 · 24/7 Operations across Kigali",
        action: "call_hotline",
      },
      {
        title: "WhatsApp Motorist Support",
        desc: "+250 788 123 456 · Instant chat with dispatch agent",
        action: "whatsapp",
      },
      {
        title: "Dispute a Parking Ticket or Fine",
        desc: "Submit photo evidence and request fine waiver",
        action: "dispute_fine",
      },
      {
        title: "How to Pay via MTN MoMo / Airtel",
        desc: "Step-by-step guide for manual *182# code payment",
        action: "momo_guide",
      },
      {
        title: "Frequently Asked Questions",
        desc: "Answers to common questions about tariffs and reservations",
        action: "faq",
      },
    ],
  },
  about: {
    title: "About ParkZone",
    subtitle: "Smart parking made simple across Kigali & Rwanda.",
    icon: "information-circle-outline",
    options: [
      {
        title: "Version 2.4.0 (Build 2026.10)",
        desc: "Production release with Kigali LoRaWAN sensor integration",
        badge: "LATEST",
      },
      {
        title: "City of Kigali Smart Urban Grid",
        desc: "Authorized under City of Kigali Transport Regulatory Framework",
        action: "license",
      },
      {
        title: "Terms of Service",
        desc: "Review user agreement and motorist code of conduct",
        action: "terms",
      },
      {
        title: "Privacy Policy",
        desc: "Review how data is collected, stored, and encrypted",
        action: "privacy",
      },
      {
        title: "Open-Source Acknowledgements",
        desc: "React Native, Expo, Supabase, and SQLite licenses",
        action: "oss",
      },
    ],
  },
};

export default function Setting() {
  const { setting } = useLocalSearchParams<{ setting: string }>();
  const theme = useTheme();

  const item = SETTINGS_REGISTRY[setting || ""] ?? SETTINGS_REGISTRY.about;

  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    item.toggles?.forEach((t) => {
      initial[t.key] = t.defaultVal;
    });
    return initial;
  });

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 500));
    setRefreshing(false);
  };

  const handleToggle = (key: string, val: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    Alert.alert("Changes Saved", "Your settings preferences have been updated successfully.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  const handleAction = (action?: string) => {
    if (!action) return;

    switch (action) {
      case "clear_cache":
        Alert.alert(
          "Clear Offline Map Cache",
          "This will remove locally cached map tiles, telemetry traces, and lot geometry. Active parking sessions will remain intact.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Clear Now",
              onPress: () => Alert.alert("Cache Cleared", "Freed 48.2 MB of local storage."),
            },
          ]
        );
        break;

      case "reset_state":
        Alert.alert(
          "Reset App State",
          "Re-download latest parking lot coordinates and sensor configurations from Kigali backend?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Re-Sync",
              onPress: () => Alert.alert("Synchronized", "All sensor nodes updated."),
            },
          ]
        );
        break;

      case "ping_test":
        Alert.alert(
          "Network Latency Diagnostic",
          "Pinging Kigali Municipal Node (kgl-gw-01.parkzone.rw)...\n\nRound trip: 18 ms\nPacket loss: 0.0%\nProtocol: Secure MQTT / TLS 1.3\nSignal: Excellent (4G / 5G LTE)"
        );
        break;

      case "report_sensor":
        Alert.alert(
          "Report Sensor Malfunction",
          "Enter bay identifier (e.g. Spot A-15 at Central Metro Park):",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Submit Report",
              onPress: () =>
                Alert.alert("Report Dispatched", "Marshall inspection ticket created. Thank you!"),
            },
          ]
        );
        break;

      case "call_hotline":
        Alert.alert("Call Dispatch", "Dialing Kigali Parking Authority Hotline: 3122 (Toll-Free)");
        break;

      case "whatsapp":
        Alert.alert(
          "WhatsApp Motorist Support",
          "Opening WhatsApp chat with City of Kigali Parking Assistance (+250 788 123 456)..."
        );
        break;

      case "dispute_fine":
        Alert.alert(
          "Dispute a Fine",
          "You have 48 hours following checkout to dispute a fine. Have your plate number and parking ticket ID ready."
        );
        break;

      case "momo_guide":
        Alert.alert(
          "Mobile Money Payment Guide",
          "1. Dial *182# on MTN or Airtel\n2. Select Pay Bill / Irembo / Merchant\n3. Enter Merchant Code: 890123 (ParkZone)\n4. Enter Amount in RWF\n5. Input PIN to confirm"
        );
        break;

      case "change_pw":
        router.push("/(auth)/forgot_pass");
        break;

      case "terms":
      case "privacy":
        router.push("/(auth)/terms_privacy");
        break;

      case "delete_account":
        Alert.alert(
          "Delete Account",
          "Are you sure you want to permanently delete your ParkZone motorist profile? All saved vehicles, wallet balance, and parking history will be wiped immediately.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete Permanently",
              style: "destructive",
              onPress: () => {
                Alert.alert("Account Deleted", "Your account has been deleted.");
                router.replace("/(auth)/sign_in");
              },
            },
          ]
        );
        break;

      default:
        Alert.alert(item.title, `Configured setting: ${action}`);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: "transparent" }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.text}
            colors={[theme.text]}
          />
        }
      >
        {/* Banner with Icon & Subtitle */}
        <View style={[styles.bannerCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.iconCircle, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Ionicons name={item.icon} size={22} color={theme.text} />
          </View>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {item.subtitle}
          </Text>
        </View>

        {/* Input Fields (if any) */}
        {item.fields && item.fields.length > 0 && (
          <View style={styles.sectionWrapper}>
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              PROFILE INFORMATION
            </Text>
            {item.fields.map(([label, value, placeholder]) => (
              <View key={label} style={styles.fieldBox}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
                <TextInput
                  defaultValue={value}
                  placeholder={placeholder || label}
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                />
              </View>
            ))}
          </View>
        )}

        {/* Interactive Toggles (if any) */}
        {item.toggles && item.toggles.length > 0 && (
          <View style={styles.sectionWrapper}>
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              PREFERENCES & CONTROLS
            </Text>
            {item.toggles.map((tog) => {
              const isEnabled = toggles[tog.key] ?? tog.defaultVal;
              return (
                <View
                  key={tog.key}
                  style={[
                    styles.toggleCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.toggleTextCol}>
                    <Text style={[styles.toggleLabel, { color: theme.text }]}>
                      {tog.label}
                    </Text>
                    <Text style={[styles.toggleDesc, { color: theme.textSecondary }]}>
                      {tog.desc}
                    </Text>
                  </View>
                  <Switch
                    value={isEnabled}
                    onValueChange={(val) => handleToggle(tog.key, val)}
                    trackColor={{ false: theme.border, true: theme.primaryBtnBg }}
                    thumbColor={isEnabled ? theme.primaryBtnText : theme.textSecondary}
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* Option Rows (if any) */}
        {item.options && item.options.length > 0 && (
          <View style={styles.sectionWrapper}>
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              OPTIONS & INTEGRATIONS
            </Text>
            {item.options.map((opt) => (
              <TouchableOpacity
                key={opt.title}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => handleAction(opt.action || opt.title)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                  <Text
                    style={[
                      styles.optionTitle,
                      { color: opt.variant === "destructive" ? "#EF4444" : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {opt.title}
                  </Text>
                  {opt.desc ? (
                    <Text style={[styles.optionDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                      {opt.desc}
                    </Text>
                  ) : null}
                </View>

                {opt.badge ? (
                  <View style={[styles.badgePill, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Text style={[styles.badgeText, { color: theme.text }]}>{opt.badge}</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Action Buttons (if any) */}
        {item.actions && item.actions.length > 0 && (
          <View style={styles.sectionWrapper}>
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              ACTIONS & UTILITIES
            </Text>
            {item.actions.map((act) => (
              <TouchableOpacity
                key={act.label}
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                  },
                ]}
                onPress={() => handleAction(act.action)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      styles.actionLabel,
                      { color: act.variant === "destructive" ? "#EF4444" : theme.text },
                    ]}
                  >
                    {act.label}
                  </Text>
                  <Text style={[styles.actionDesc, { color: theme.textSecondary }]}>
                    {act.desc}
                  </Text>
                </View>
                <Ionicons
                  name={act.variant === "destructive" ? "trash-outline" : "chevron-forward"}
                  size={18}
                  color={act.variant === "destructive" ? "#EF4444" : theme.text}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Save Changes Button (if fields are editable) */}
        {item.fields && item.fields.length > 0 && (
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.primaryBtnBg }]}
            onPress={handleSave}
            activeOpacity={0.88}
          >
            <Text style={[styles.saveBtnText, { color: theme.primaryBtnText }]}>
              Save Changes
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "transparent",
    borderBottomWidth: 0,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  bannerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  sectionWrapper: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  fieldBox: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: "600",
  },
  toggleCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  toggleTextCol: {
    flex: 1,
    paddingRight: 14,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  toggleDesc: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  optionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  optionDesc: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  badgePill: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  actionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  actionDesc: {
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  saveBtn: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
});
