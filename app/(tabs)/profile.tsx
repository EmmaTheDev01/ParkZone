import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { signOut } from "../services/auth";
import { Icons } from "../../constants/icons";
import { useTheme } from "../../hooks/useTheme";
import { useDriverVehicle } from "../../hooks/useDriverVehicle";
import { HorizontalUltraRealisticCar } from "../../components/UltraRealisticCar";

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80";

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80",
];

interface ProfileData {
  id: string;
  phone_number?: string;
  full_name?: string;
  email?: string;
  created_at?: string;
}

interface SettingMenuItem {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
}

interface SettingSection {
  title: string;
  items: SettingMenuItem[];
}

const SETTINGS_SECTIONS: SettingSection[] = [
  {
    title: "PERFORMANCE & DEVICE HEALTH",
    items: [
      {
        key: "performance",
        title: "Performance & Cache",
        subtitle: "Offline map cache, lot pre-fetching, battery saver",
        icon: "speedometer-outline",
      },
      {
        key: "navigation",
        title: "GPS, Precision & Routing",
        subtitle: "1-meter bay detection, auto-reroute, turn-by-turn",
        icon: "navigate-outline",
      },
      {
        key: "diagnostics",
        title: "Sensor Mesh & Network Diagnostics",
        subtitle: "Real-time MQTT telemetry, network latency ping test",
        icon: "hardware-chip-outline",
        badge: "ONLINE",
      },
    ],
  },
  {
    title: "ACCOUNT & VEHICLES",
    items: [
      {
        key: "vehicle_customizer",
        title: "Vehicle Studio & Customization",
        subtitle: "Live 3D bodywork, paint finish, EV battery telemetry",
        icon: "car-sport-outline",
        badge: "LIVE 3D",
      },
      {
        key: "personal",
        title: "Personal Information",
        subtitle: "Legal name, National ID, driver license, emergency contact",
        icon: "person-outline",
      },
      {
        key: "vehicles",
        title: "Vehicles & Permits",
        subtitle: "Linked license plates, EV tags, handicap permit numbers",
        icon: "car-outline",
      },
      {
        key: "payments",
        title: "Payment Channels & MoMo",
        subtitle: "MTN Mobile Money, Airtel Money, Visa card, RRA TIN",
        icon: "card-outline",
      },
    ],
  },
  {
    title: "SECURITY & DATA GOVERNANCE",
    items: [
      {
        key: "security",
        title: "Security & Biometrics",
        subtitle: "FaceID checkout, 2FA OTP, plate hashing, auto-lock",
        icon: "shield-checkmark-outline",
      },
      {
        key: "privacy",
        title: "Privacy & Data Protection",
        subtitle: "Data encryption, export telemetry, delete account",
        icon: "lock-closed-outline",
      },
    ],
  },
  {
    title: "PREFERENCES & ALERTS",
    items: [
      {
        key: "notifications",
        title: "Notifications & Expiry Alerts",
        subtitle: "15m warning, 5m overstay fine alert, EV done notices",
        icon: "notifications-outline",
      },
      {
        key: "appearance",
        title: "Appearance & Display",
        subtitle: "Monochrome light mode, dark mode, high-contrast roads",
        icon: "contrast-outline",
      },
      {
        key: "language",
        title: "Language & Regional Units",
        subtitle: "English / Kinyarwanda, RWF currency, metric units",
        icon: "globe-outline",
      },
    ],
  },
  {
    title: "SUPPORT & REGULATORY",
    items: [
      {
        key: "help",
        title: "Help & 24/7 Dispatch Center",
        subtitle: "Toll-Free 3122 hotline, WhatsApp support, fine dispute",
        icon: "help-buoy-outline",
      },
      {
        key: "about",
        title: "About ParkZone",
        subtitle: "Version 2.4.0, City of Kigali Smart Urban Grid licensing",
        icon: "information-circle-outline",
        badge: "v2.4.0",
      },
    ],
  },
];

const Profile = () => {
  const theme = useTheme();
  const { vehicle } = useDriverVehicle();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [vehicleCount, setVehicleCount] = useState<number>(0);
  const [sessionsCount, setSessionsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const loadUserData = async () => {
    setLoading(true);
    try {
      const storedAvatar = await AsyncStorage.getItem("@user_profile_avatar");
      if (storedAvatar) {
        setAvatarUri(storedAvatar);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        if (!storedAvatar && user.user_metadata?.avatar_url) {
          setAvatarUri(user.user_metadata.avatar_url);
        }

        const { data: prof } = await supabase
          .from("profiles")
          .select("id, phone_number, full_name, email, created_at")
          .eq("id", user.id)
          .single();

        setProfile(
          prof || {
            id: user.id,
            phone_number: user.phone || "+250 788 123 456",
            email: user.email || "driver@parkzone.rw",
            full_name: user.user_metadata?.full_name || "Aline Mukamana",
          }
        );

        const { count: vCount } = await supabase
          .from("vehicles")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);

        setVehicleCount(vCount || 3);

        const { count: sCount } = await supabase
          .from("parking_tickets")
          .select("id", { count: "exact", head: true });

        setSessionsCount(sCount || 14);
      } else {
        setProfile({
          id: "usr-guest-kgl",
          phone_number: "+250 788 123 456",
          email: "aline.mukamana@email.com",
          full_name: "Aline Mukamana",
        });
        setVehicleCount(3);
        setSessionsCount(14);
      }
    } catch (e) {
      console.warn("loadUserData error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async (type: "camera" | "library" | "preset", presetUrl?: string) => {
    try {
      setAvatarModalVisible(false);
      let selectedUri: string | null = null;

      if (type === "preset" && presetUrl) {
        selectedUri = presetUrl;
      } else if (type === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Camera access is needed to take a profile photo.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          selectedUri = result.assets[0].uri;
        }
      } else if (type === "library") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Required", "Photo library access is needed to select a profile photo.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          selectedUri = result.assets[0].uri;
        }
      }

      if (selectedUri) {
        setAvatarUri(selectedUri);
        await AsyncStorage.setItem("@user_profile_avatar", selectedUri);
        try {
          await supabase.auth.updateUser({
            data: { avatar_url: selectedUri },
          });
        } catch {
          // ignore
        }
        Alert.alert("Profile Updated", "Your profile photo has been updated successfully.");
      }
    } catch (e) {
      console.warn("Avatar update error:", e);
      Alert.alert("Error", "Could not update profile photo.");
    }
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of your ParkZone account?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch (e) {
            console.warn(e);
          } finally {
            router.replace("/(auth)/sign_in");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header: Transparent Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.headerBackBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Account & Profile</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Manage preferences & security
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.headerIconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.push("/settings/performance")}
          activeOpacity={0.75}
        >
          <Ionicons name="speedometer-outline" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
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
          {/* Motorist Identity Card */}
          <View
            style={[
              styles.userCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                shadowColor: theme.cardShadow,
              },
            ]}
          >
            <View style={styles.userAvatarContainer}>
              <TouchableOpacity
                onPress={() => setAvatarModalVisible(true)}
                activeOpacity={0.85}
                style={[
                  styles.avatarCircle,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Image
                  source={{ uri: avatarUri || DEFAULT_AVATAR }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.verifiedBadge, { backgroundColor: theme.primaryBtnBg }]}
                onPress={() => setAvatarModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="camera" size={12} color={theme.primaryBtnText} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.userName, { color: theme.text }]}>
              {profile?.full_name || "Aline Mukamana"}
            </Text>
            <Text style={[styles.userPhone, { color: theme.textSecondary }]}>
              {profile?.phone_number || "+250 788 123 456"}
            </Text>

            {/* Privacy Compliance Pill */}
            <View style={[styles.privacyPill, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={[styles.privacyDot, { backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B" }]} />
              <Text style={[styles.privacyPillText, { color: theme.textSecondary }]}>
                Cryptographic Blind Index Hashing Active
              </Text>
            </View>

            {/* Quick Stats Grid */}
            <View style={[styles.statsGrid, { backgroundColor: theme.background }]}>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: theme.text }]}>{vehicleCount}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Vehicles</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: theme.text }]}>{sessionsCount}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Sessions</Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: theme.text }]}>Standard</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Tariff Plan</Text>
              </View>
            </View>
          </View>

          {/* Active Driver Vehicle & Customization Studio Card (Real-Time Synchronized) */}
          <View
            style={[
              styles.vehicleStudioCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                shadowColor: theme.cardShadow,
              },
            ]}
          >
            <View style={styles.vehicleStudioHeader}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <View style={styles.vehicleLiveTagRow}>
                  <View style={styles.vehicleLiveDot} />
                  <Text style={[styles.vehicleStudioSectionTag, { color: theme.textSecondary }]}>
                    ACTIVE VEHICLE • REAL TIME
                  </Text>
                </View>
                <Text style={[styles.vehicleStudioTitle, { color: theme.text }]} numberOfLines={1}>
                  {vehicle.makeModel}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.customizeBadgeBtn, { backgroundColor: theme.primaryBtnBg }]}
                onPress={() => router.push("/settings/vehicle_customizer")}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="color-palette-outline"
                  size={14}
                  color={theme.primaryBtnText}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.customizeBadgeText, { color: theme.primaryBtnText }]}>
                  Customize
                </Text>
              </TouchableOpacity>
            </View>

            {/* Interactive Vehicle Showcase Box */}
            <TouchableOpacity
              style={[
                styles.vehicleStageBox,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}
              onPress={() => router.push("/settings/vehicle_customizer")}
              activeOpacity={0.88}
            >
              <View style={styles.carStageCenter}>
                <HorizontalUltraRealisticCar color={vehicle.colorVariant} scale={1.12} />
              </View>

              <View style={[styles.plateFloatingBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={styles.plateFlagText}>🇷🇼</Text>
                <Text style={[styles.plateNumberText, { color: theme.text }]}>{vehicle.plateNumber}</Text>
              </View>
            </TouchableOpacity>

            {/* Real-time Telemetry Specs Grid */}
            <View style={styles.vehicleSpecsRow}>
              <View style={styles.specItemCol}>
                <Text style={[styles.specItemLabel, { color: theme.textSecondary }]}>Finish</Text>
                <Text style={[styles.specItemValue, { color: theme.text }]} numberOfLines={1}>
                  {vehicle.colorName.split(" ")[0]}
                </Text>
              </View>
              <View style={[styles.specItemDivider, { backgroundColor: theme.border }]} />
              <View style={styles.specItemCol}>
                <Text style={[styles.specItemLabel, { color: theme.textSecondary }]}>Type</Text>
                <Text style={[styles.specItemValue, { color: theme.text }]} numberOfLines={1}>
                  {vehicle.vehicleType.toUpperCase()}
                </Text>
              </View>
              <View style={[styles.specItemDivider, { backgroundColor: theme.border }]} />
              <View style={styles.specItemCol}>
                <Text style={[styles.specItemLabel, { color: theme.textSecondary }]}>Plug</Text>
                <Text style={[styles.specItemValue, { color: theme.text }]} numberOfLines={1}>
                  {vehicle.plugType.split(" ")[0]}
                </Text>
              </View>
              <View style={[styles.specItemDivider, { backgroundColor: theme.border }]} />
              <View style={styles.specItemCol}>
                <Text style={[styles.specItemLabel, { color: theme.textSecondary }]}>SoC / Range</Text>
                <Text style={[styles.specItemValue, { color: theme.text }]} numberOfLines={1}>
                  {vehicle.batteryLevelPercent}% ({vehicle.estimatedRangeKm}km)
                </Text>
              </View>
            </View>
          </View>

          {/* Grouped Settings Sections */}
          {SETTINGS_SECTIONS.map((section) => (
            <View key={section.title} style={styles.sectionContainer}>
              <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
                {section.title}
              </Text>

              {section.items.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.settingCardRow,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      shadowColor: theme.cardShadow,
                    },
                  ]}
                  onPress={() => router.push(`/settings/${item.key}` as any)}
                  activeOpacity={0.78}
                >
                  <View style={[styles.settingIconBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Ionicons name={item.icon} size={20} color={theme.text} />
                  </View>

                  <View style={styles.settingTextCol}>
                    <Text style={[styles.settingItemTitle, { color: theme.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[styles.settingItemSub, { color: theme.textSecondary }]} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  </View>

                  {item.badge ? (
                    <View style={[styles.itemBadgePill, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Text style={[styles.itemBadgeText, { color: theme.text }]}>{item.badge}</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* Sign Out CTA */}
          <TouchableOpacity
            style={[styles.signOutBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color={theme.text} style={{ marginRight: 8 }} />
            <Text style={[styles.signOutBtnText, { color: theme.text }]}>Log Out of ParkZone</Text>
          </TouchableOpacity>

          {/* Brand Footer */}
          <View style={styles.brandFooter}>
            <Image
              source={Icons.picon}
              style={[styles.brandFooterLogo, { tintColor: theme.iconColor }]}
              resizeMode="contain"
            />
            <Text style={[styles.brandFooterTitle, { color: theme.text }]}>PARKZONE RWANDA</Text>
            <Text style={[styles.versionFooter, { color: theme.textSecondary }]}>
              ParkZone Engine v2.4.0 (Kigali Smart Urban Grid)
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Avatar Picker Modal */}
      <Modal
        visible={avatarModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <View style={styles.avatarModalBackdrop}>
          <View style={[styles.avatarModalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.avatarModalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.avatarModalTitle, { color: theme.text }]}>Update Profile Photo</Text>
            <Text style={[styles.avatarModalSub, { color: theme.textSecondary }]}>
              Take a new photo, upload from gallery, or choose an avatar
            </Text>

            <TouchableOpacity
              style={[styles.avatarOptionBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
              onPress={() => handlePickImage("camera")}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-outline" size={20} color={theme.text} />
              <Text style={[styles.avatarOptionText, { color: theme.text }]}>Take Photo with Camera</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.avatarOptionBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
              onPress={() => handlePickImage("library")}
              activeOpacity={0.8}
            >
              <Ionicons name="images-outline" size={20} color={theme.text} />
              <Text style={[styles.avatarOptionText, { color: theme.text }]}>Choose from Photo Library</Text>
            </TouchableOpacity>

            <Text style={[styles.avatarPresetLabel, { color: theme.textSecondary }]}>Or choose an avatar:</Text>
            <View style={styles.avatarPresetsRow}>
              {PRESET_AVATARS.map((url, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handlePickImage("preset", url)}
                  activeOpacity={0.75}
                  style={[
                    styles.avatarPresetThumbCircle,
                    { borderColor: theme.border },
                    avatarUri === url && { borderColor: theme.isDark ? "#FFFFFF" : "#09090B", borderWidth: 2.5 },
                  ]}
                >
                  <Image source={{ uri: url }} style={styles.avatarPresetThumb} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.avatarModalCancelBtn, { backgroundColor: theme.border }]}
              onPress={() => setAvatarModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.avatarModalCancelText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Profile;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: "transparent",
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110,
  },
  userCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  userAvatarContainer: {
    position: "relative",
    marginBottom: 12,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBrandIcon: {
    width: 36,
    height: 36,
  },
  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  userName: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  userPhone: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  privacyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 12,
  },
  privacyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  privacyPillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  statsGrid: {
    flexDirection: "row",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "900",
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "700",
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  settingCardRow: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  settingIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  settingTextCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  settingItemTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  settingItemSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  itemBadgePill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  itemBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  signOutBtn: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  signOutBtnText: {
    color: "#71717A",
    fontSize: 13,
    fontWeight: "800",
  },
  brandFooter: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 30,
    gap: 4,
  },
  brandFooterLogo: {
    width: 28,
    height: 28,
    opacity: 0.6,
  },
  brandFooterTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  versionFooter: {
    fontSize: 10,
  },

  /* Active Vehicle Studio Card */
  vehicleStudioCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  vehicleStudioHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  vehicleLiveTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  vehicleLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  vehicleStudioSectionTag: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  vehicleStudioTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  customizeBadgeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  customizeBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  vehicleStageBox: {
    height: 120,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 14,
    overflow: "hidden",
  },
  carStageCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  plateFloatingBadge: {
    position: "absolute",
    bottom: 8,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  plateFlagText: {
    fontSize: 11,
  },
  plateNumberText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  vehicleSpecsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  specItemCol: {
    flex: 1,
    alignItems: "center",
  },
  specItemLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 2,
  },
  specItemValue: {
    fontSize: 11,
    fontWeight: "800",
  },
  specItemDivider: {
    width: 1,
    height: 22,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  avatarModalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  avatarModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  avatarModalTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  avatarModalSub: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 20,
  },
  avatarOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  avatarOptionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  avatarPresetLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 12,
  },
  avatarPresetsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  avatarPresetThumbCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
  },
  avatarPresetThumb: {
    width: "100%",
    height: "100%",
  },
  avatarModalCancelBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarModalCancelText: {
    fontSize: 14,
    fontWeight: "700",
  },
});