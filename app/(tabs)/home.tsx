import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Ionicons, Feather } from "@expo/vector-icons";
import { router, useNavigation, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import {
  AgentAuditResponse,
  calculateParkingFee,
  completeParkingSession,
  EvChargerTelemetry,
  fetchEvChargers,
  fetchParkingLocations,
  fetchSpotsForLocation,
  fetchUserVehicles,
  flagOverdueInvoice,
  issueZeroContactCitation,
  ParkingLocation,
  ParkingSpace,
  RegisteredVehicle,
  TopologyType,
  verifyPlateStatus,
} from "../services/parking";
import { useTheme } from "../../hooks/useTheme";
import { FALLBACK_EV_STATIONS, ZONE_PARKING_LOTS } from "./ev_chargers";
import {
  HorizontalUltraRealisticCar,
  VerticalUltraRealisticCar,
} from "../../components/UltraRealisticCar";
import { AerialParkingLot3D } from "../../components/AerialParkingLot3D";
import { DynamicIslandParking } from "../../components/DynamicIslandParking";
import { notifyParkingStarted, clearParkingNotifications } from "../services/notifications";
import {
  ParkingHistoryRecord,
  PARKING_HISTORY,
  PARKING_HISTORY_STORAGE_KEY,
} from "../recent_parkings";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const width = SCREEN_WIDTH;

const KIGALI_REGION = {
  latitude: -1.9536,
  longitude: 30.0606,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const USER_COORDS = {
  latitude: -1.9575,
  longitude: 30.0580,
};

const getSteppedRoute = (start: { latitude: number; longitude: number }, end: { latitude: number; longitude: number }) => {
  const dLat = end.latitude - start.latitude;
  const dLon = end.longitude - start.longitude;
  return [
    start,
    { latitude: start.latitude + dLat * 0.25, longitude: start.longitude },
    { latitude: start.latitude + dLat * 0.25, longitude: start.longitude + dLon * 0.5 },
    { latitude: start.latitude + dLat * 0.75, longitude: start.longitude + dLon * 0.5 },
    { latitude: start.latitude + dLat * 0.75, longitude: end.longitude },
    end,
  ];
};

import { MAP_STYLE_LIGHT, MAP_STYLE_DARK } from "../../constants/mapStyles";

// High-res photography of parking infrastructure in Kigali & modern hubs
const LOCATION_IMAGES: Record<string, string> = {
  "loc-kigali-heights":
    "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80",
  "loc-downtown":
    "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80",
  "loc-chuk":
    "https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=800&q=80",
};

const DEFAULT_PARKING_IMAGE =
  "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80";

const AI_BW_BORDER_COLORS_DARK = ["#FFFFFF", "#E4E4E7", "#D4D4D8", "#A1A1AA"];
const AI_BW_BORDER_COLORS_LIGHT = ["#09090B", "#18181B", "#27272A", "#3F3F46"];

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

interface AnimatedBwGradientCardProps {
  active: boolean;
  isThinking?: boolean;
  borderRadius?: number;
  borderWidth?: number;
  style?: any;
  contentStyle?: any;
  animValue?: Animated.Value;
  colorAnimValue?: Animated.Value;
  onPress?: () => void;
  activeOpacity?: number;
  children: React.ReactNode;
}

const AnimatedBwGradientCard: React.FC<AnimatedBwGradientCardProps> = ({
  active,
  isThinking = false,
  borderRadius = 20,
  borderWidth = 2,
  style,
  animValue,
  colorAnimValue,
  onPress,
  activeOpacity = 0.88,
  children,
}) => {
  if (!active) {
    if (onPress) {
      return (
        <TouchableOpacity style={style} onPress={onPress} activeOpacity={activeOpacity}>
          {children}
        </TouchableOpacity>
      );
    }
    return <View style={style}>{children}</View>;
  }

  const effectiveBorderWidth = isThinking ? Math.max(borderWidth + 1, 2.5) : borderWidth;

  const animatedBorderColor = colorAnimValue
    ? colorAnimValue.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: ["#FFFFFF", "#71717A", "#18181B", "#E4E4E7", "#FFFFFF"],
      })
    : "#FFFFFF";

  const Component = onPress ? TouchableOpacity : View;
  const touchProps = onPress ? { onPress, activeOpacity } : {};

  return (
    <Component
      {...touchProps}
      style={[
        style,
        {
          position: "relative",
          borderColor: "transparent",
        },
      ]}
    >
      {children}

      {/* Animated Monochrome Outline Border Overlay - Preserves all normal container paddings & layout */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius,
            borderWidth: effectiveBorderWidth,
            borderColor: animatedBorderColor,
            shadowColor: "#FFFFFF",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: isThinking ? 0.95 : 0.4,
            shadowRadius: isThinking ? 14 : 6,
            elevation: isThinking ? 8 : 3,
          },
        ]}
      />
    </Component>
  );
};

export interface AppNotificationItem {
  id: string;
  category: "Parking" | "AI Radar" | "Billing" | "System";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  actionText?: string;
  actionType?: "active_session" | "ai_lot" | "receipt";
}

const DEFAULT_NOTIFICATIONS: AppNotificationItem[] = [
  {
    id: "notif-1",
    category: "Parking",
    title: "Active Session • Spot 202 Booked",
    message: "Your vehicle RAD ••• B is parked at Kigali Marina Parking. Tap to inspect remaining time.",
    timestamp: "Just now",
    read: false,
    icon: "car-sport",
    actionText: "View Live Tracker",
    actionType: "active_session",
  },
  {
    id: "notif-2",
    category: "AI Radar",
    title: "AI Found Cheaper Lot: 250 RWF/hr",
    message: "CHUK Hospital Parking is 1.4 km away and cuts 50 RWF/hr vs your historical average spend.",
    timestamp: "14 min ago",
    read: false,
    icon: "sparkles",
    actionText: "Inspect AI Lot",
    actionType: "ai_lot",
  },
  {
    id: "notif-3",
    category: "Billing",
    title: "Parking Invoice Settled • 1,200 RWF",
    message: "Automated payment confirmed for 4h downtown stay via Mobile Money wallet bridge.",
    timestamp: "2 hours ago",
    read: true,
    icon: "receipt-outline",
    actionText: "View Receipt",
    actionType: "receipt",
  },
  {
    id: "notif-4",
    category: "System",
    title: "15-Minute Grace Buffer Active",
    message: "ParkZone city council grace buffer is actively guarding your bay against municipal citations.",
    timestamp: "Yesterday",
    read: true,
    icon: "shield-checkmark-outline",
  },
];

const FALLBACK_LOCATIONS: ParkingLocation[] = [
  {
    id: "loc-Kigali-marina",
    name: "Kigali Marina Parking",
    address: "Courtyard Marina View Tower",
    city: "Kigali",
    country: "Rwanda",
    latitude: -1.9536,
    longitude: 30.0606,
    layout_topology: "oblique",
    total_spots: 60,
    available_spots: 24,
    hourly_rate: 300,
    daily_rate: 2000,
    currency: "RWF",
    qr_code_identifier: "DM-VIEW-01",
    is_active: true,
    status: "active",
    is_electric_station: false,
    is_handicap_facility: false,
    zone_code: "Zone A",
  },
  {
    id: "loc-jumeirah",
    name: "Jumeirah Park Parking",
    address: "Al Wasl Road 56, Jumeirah Concession",
    city: "Kigali",
    country: "Rwanda",
    latitude: -1.9482,
    longitude: 30.0588,
    layout_topology: "perpendicular",
    total_spots: 40,
    available_spots: 5,
    hourly_rate: 500,
    daily_rate: 3000,
    currency: "RWF",
    qr_code_identifier: "JM-PARK-02",
    is_active: true,
    status: "active",
    is_electric_station: false,
    is_handicap_facility: false,
    zone_code: "Zone B",
  },
  {
    id: "loc-downtown-blvd",
    name: "Downtown Boulevard",
    address: "321 Downtown Boulevard, Business Bay",
    city: "Kigali",
    country: "Rwanda",
    latitude: -1.9512,
    longitude: 30.0581,
    layout_topology: "parallel",
    total_spots: 50,
    available_spots: 18,
    hourly_rate: 400,
    daily_rate: 2500,
    currency: "RWF",
    qr_code_identifier: "DT-BLVD-03",
    is_active: true,
    status: "active",
    is_electric_station: false,
    is_handicap_facility: false,
    zone_code: "Zone C",
  },
  {
    id: "loc-Kigali-mall",
    name: "Kigali Mall Parking",
    address: "Al Ohood St. 87",
    city: "Kigali",
    country: "Rwanda",
    latitude: -1.9555,
    longitude: 30.0625,
    layout_topology: "perpendicular",
    total_spots: 80,
    available_spots: 32,
    hourly_rate: 350,
    daily_rate: 2200,
    currency: "RWF",
    qr_code_identifier: "DM-MALL-04",
    is_active: true,
    status: "active",
    is_electric_station: false,
    is_handicap_facility: false,
    zone_code: "Zone D",
  },
  {
    id: "loc-kigali-heights-ev",
    name: "Kigali Heights EV Charging Hub",
    address: "KG 7 Ave, Kimihurura (Level -1)",
    city: "Kigali",
    country: "Rwanda",
    latitude: -1.9525,
    longitude: 30.0618,
    layout_topology: "perpendicular",
    total_spots: 24,
    available_spots: 12,
    hourly_rate: 450,
    daily_rate: 2800,
    currency: "RWF",
    qr_code_identifier: "KH-EV-05",
    is_active: true,
    status: "active",
    is_electric_station: true,
    is_handicap_facility: false,
    zone_code: "EV Station",
    facilities: ["150kW Hypercharger", "Type 2 / CCS2", "EV Only"],
  },
  {
    id: "loc-city-hall-handicap",
    name: "Kigali City Hall Accessible Plaza",
    address: "KN 3 Ave, Nyarugenge District",
    city: "Kigali",
    country: "Rwanda",
    latitude: -1.9495,
    longitude: 30.0592,
    layout_topology: "parallel",
    total_spots: 16,
    available_spots: 8,
    hourly_rate: 250,
    daily_rate: 1500,
    currency: "RWF",
    qr_code_identifier: "CH-ACC-06",
    is_active: true,
    status: "active",
    is_electric_station: false,
    is_handicap_facility: true,
    zone_code: "Zone E",
    facilities: ["Wheelchair Ramp", "Extra-Wide Bays", "Handicap Permit Only"],
  },
];

type RecentParkingItem = ParkingHistoryRecord;
const RECENT_PARKINGS: ParkingHistoryRecord[] = PARKING_HISTORY;

const FALLBACK_SPACES: ParkingSpace[] = [
  { id: "sp-a1", location_id: "loc-Kigali-marina", space_number: "123", zone_code: "Zone C", space_type: "regular", is_occupied: false, qr_code_token: "QR-123" },
  { id: "sp-a2", location_id: "loc-Kigali-marina", space_number: "124", zone_code: "Zone C", space_type: "regular", is_occupied: true, current_vehicle_plate: "RAC 812 B", qr_code_token: "QR-124" },
  { id: "sp-a3", location_id: "loc-Kigali-marina", space_number: "125", zone_code: "Zone C", space_type: "regular", is_occupied: false, qr_code_token: "QR-125" },
  { id: "sp-a4", location_id: "loc-Kigali-marina", space_number: "126", zone_code: "Zone C", space_type: "regular", is_occupied: false, qr_code_token: "QR-126" },
  { id: "sp-a5", location_id: "loc-Kigali-marina", space_number: "127", zone_code: "Zone C", space_type: "regular", is_occupied: false, qr_code_token: "QR-127" },
  { id: "sp-a6", location_id: "loc-Kigali-marina", space_number: "128", zone_code: "Zone C", space_type: "regular", is_occupied: false, qr_code_token: "QR-128" },
  { id: "sp-a7", location_id: "loc-Kigali-marina", space_number: "131", zone_code: "Zone C", space_type: "regular", is_occupied: false, qr_code_token: "QR-131" },
  { id: "sp-a8", location_id: "loc-Kigali-marina", space_number: "132", zone_code: "Zone C", space_type: "regular", is_occupied: false, qr_code_token: "QR-132" },
  { id: "sp-a9", location_id: "loc-Kigali-marina", space_number: "134", zone_code: "Zone C", space_type: "regular", is_occupied: false, qr_code_token: "QR-134" },
  { id: "sp-ev1", location_id: "loc-Kigali-marina", space_number: "EV-01", zone_code: "Zone A", space_type: "ev", is_occupied: false, qr_code_token: "QR-EV1" },
  { id: "sp-ev2", location_id: "loc-Kigali-marina", space_number: "EV-02", zone_code: "Zone A", space_type: "ev", is_occupied: true, current_vehicle_plate: "RAD 990 E", qr_code_token: "QR-EV2" },
  { id: "sp-hc1", location_id: "loc-Kigali-marina", space_number: "H-01", zone_code: "Zone H", space_type: "handicap", is_occupied: false, qr_code_token: "QR-HC1" },
  { id: "sp-hc2", location_id: "loc-Kigali-marina", space_number: "H-02", zone_code: "Zone H", space_type: "handicap", is_occupied: false, qr_code_token: "QR-HC2" },
];

/**
 * Top-down horizontal car graphic matching parking bays in user screenshot
 */
const HorizontalCarGraphic = () => {
  return (
    <View style={styles.horizCarBox}>
      {/* Top Wheels */}
      <View style={styles.horizCarWheelsRow}>
        <View style={styles.horizWheel} />
        <View style={styles.horizWheel} />
      </View>
      {/* Car Body */}
      <View style={styles.horizCarBody}>
        <View style={styles.horizCarGlassLeft} />
        <View style={styles.horizCarRoof} />
        <View style={styles.horizCarGlassRight} />
      </View>
      {/* Bottom Wheels */}
      <View style={styles.horizCarWheelsRow}>
        <View style={styles.horizWheel} />
        <View style={styles.horizWheel} />
      </View>
    </View>
  );
};

/**
 * Top-down sleek aero car vector for parking bays matching reference
 */
const TopDownCarGraphic = ({ isDark = false }: { isDark?: boolean }) => {
  const carBg = isDark ? "#2A2A30" : "#D4D4D8";
  const glassBg = isDark ? "#121214" : "#71717A";
  const roofBg = isDark ? "#1F1F24" : "#A1A1AA";

  return (
    <View style={styles.topDownCarBox}>
      <View style={styles.carWheelRow}>
        <View style={styles.carWheel} />
        <View style={styles.carWheel} />
      </View>
      <View style={[styles.carBodyMain, { backgroundColor: carBg }]}>
        <View style={[styles.carGlassFront, { backgroundColor: glassBg }]} />
        <View style={[styles.carRoof, { backgroundColor: roofBg }]} />
        <View style={[styles.carGlassRear, { backgroundColor: glassBg }]} />
      </View>
      <View style={styles.carWheelRow}>
        <View style={styles.carWheel} />
        <View style={styles.carWheel} />
      </View>
    </View>
  );
};

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  // Core Data
  const [locations, setLocations] = useState<ParkingLocation[]>(FALLBACK_LOCATIONS);
  const [selectedLocation, setSelectedLocation] = useState<ParkingLocation>(FALLBACK_LOCATIONS[0]);
  const [currentFloor, setCurrentFloor] = useState("3rd floor");
  const [spaces, setSpaces] = useState<ParkingSpace[]>(FALLBACK_SPACES);
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(FALLBACK_SPACES[3]); // A15 selected like screenshot

  // Navigation View Modes: "discovery" (Home Screen) | "park_details" (Screen 3) | "slot_selection" (Screen 1)
  const [viewMode, setViewMode] = useState<"discovery" | "park_details" | "slot_selection">("discovery");
  const [selectedCategory, setSelectedCategory] = useState<"car" | "ev" | "truck" | "scooter">("car");
  const [detailsTab, setDetailsTab] = useState<"about" | "slots" | "reviews">("about");
  const [durationHours, setDurationHours] = useState(4);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMapView, setShowMapView] = useState(false);

  // Active Ticket & Session
  const [activeTicket, setActiveTicket] = useState<{
    id: string;
    plate: string;
    entryTime: Date;
    spaceNumber: string;
    locationName: string;
    durationHours: number;
    hourlyRate: number;
    violationFine?: number;
    violationReason?: string;
    isPrepaid?: boolean;
    paidAmount?: number;
    prepaidHours?: number;
  } | null>(null);
  const [currentTick, setCurrentTick] = useState(Date.now());
  const [ParkingBalance, setParkingBalance] = useState("25,000");
  const params = useLocalSearchParams<{ scannedBay?: string; scannedLocation?: string }>();

  // Load persisted wallet balance
  useEffect(() => {
    AsyncStorage.getItem("@parkzone_wallet_balance")
      .then((val) => {
        if (val) setParkingBalance(val);
      })
      .catch(() => { });
  }, []);



  // Dynamic Parking Time calculations based on user's active session
  const totalParkingSeconds = activeTicket ? Math.max(1, (activeTicket.durationHours || 1) * 3600) : 3600;
  const elapsedSeconds = activeTicket
    ? Math.max(0, Math.floor((currentTick - new Date(activeTicket.entryTime).getTime()) / 1000))
    : 0;
  const remainingSeconds = Math.max(0, totalParkingSeconds - elapsedSeconds);
  const isOverdue = elapsedSeconds > totalParkingSeconds;
  const progressPercent = Math.min(100, Math.max(0, (elapsedSeconds / totalParkingSeconds) * 100));

  // Live timer interval that runs only when parking is active
  useEffect(() => {
    if (!activeTicket) return;
    const timer = setInterval(() => {
      setCurrentTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTicket]);

  // Vehicles
  const [selectedVehicle, setSelectedVehicle] = useState<RegisteredVehicle | null>({
    id: "veh-demo",
    user_id: "user-demo",
    plate_number: "RAD 245 B",
    plate_hash: "hash-demo",
    masked_plate: "RAD ••• B",
    vehicle_type: "gasoline",
    is_default: true,
  });

  // Check and sync any ticket created via edge-to-edge scanner or external flow
  useFocusEffect(
    useCallback(() => {
      const checkStoredTicket = async () => {
        try {
          const raw = await AsyncStorage.getItem("@parkzone_active_ticket");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.spaceNumber) {
              setActiveTicket({
                id: parsed.id || `ticket-${Date.now()}`,
                plate: parsed.plate || selectedVehicle?.masked_plate || "RAD ••• B",
                entryTime: parsed.entryTime ? new Date(parsed.entryTime) : new Date(),
                spaceNumber: parsed.spaceNumber,
                locationName: parsed.locationName || "Kigali Marina Parking",
                durationHours: parsed.durationHours || 2,
                hourlyRate: parsed.hourlyRate || 300,
                violationFine: parsed.violationFine,
                violationReason: parsed.violationReason,
                isPrepaid: parsed.isPrepaid ?? true,
                paidAmount: parsed.paidAmount,
                prepaidHours: parsed.prepaidHours || parsed.durationHours || 2,
              });
              setCurrentTick(Date.now());
            }
          }
        } catch {
          // ignore
        }
      };
      checkStoredTicket();
    }, [selectedVehicle])
  );

  // Sync active ticket changes to persistent storage
  useEffect(() => {
    if (activeTicket) {
      AsyncStorage.setItem("@parkzone_active_ticket", JSON.stringify(activeTicket)).catch(() => { });
    } else {
      AsyncStorage.removeItem("@parkzone_active_ticket").catch(() => { });
    }
  }, [activeTicket]);

  // Vehicle eligibility determinations
  const isVehicleElectric =
    selectedVehicle?.vehicle_type === "ev" ||
    Boolean(selectedVehicle?.brand?.toLowerCase().includes("tesla")) ||
    Boolean(selectedVehicle?.brand?.toLowerCase().includes("byd"));

  const isVehicleHandicap =
    selectedVehicle?.vehicle_type === "handicap" ||
    Boolean(selectedVehicle?.handicap_permit_number);

  // Details View in-lot search query
  const [detailsSearchQuery, setDetailsSearchQuery] = useState("");

  // Strict Vehicle Eligibility Filter:
  // - If the vehicle is Electric: recommend ALL parkings (standard parking lots + electric charging lots).
  // - If the vehicle is NOT electric: ONLY show parkings that are not electric, because electric parking lots are for electric cars only.
  // - Non-handicap vehicles CANNOT see handicap-only parking facilities.
  const eligibleLocations: ParkingLocation[] = React.useMemo(() => {
    return locations.filter((loc) => {
      // If car is not electric, hide electric parking lots entirely
      if (loc.is_electric_station && !isVehicleElectric) return false;
      // Non-handicap vehicles do not see handicap-only facilities
      if (loc.is_handicap_facility && !isVehicleHandicap) return false;
      return true;
    });
  }, [locations, isVehicleElectric, isVehicleHandicap]);

  // Zone filter, interactive spot selection bottom sheet & confirm modal
  const [activeZoneFilter, setActiveZoneFilter] = useState("All zones");

  // Dynamic Parking History state synced with persistent storage
  const [recentParkingsList, setRecentParkingsList] = useState<ParkingHistoryRecord[]>(PARKING_HISTORY);

  // Load persistent parking history on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(PARKING_HISTORY_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecentParkingsList(parsed);
          }
        }
      } catch (err) {
        console.warn("Failed loading parking history:", err);
      }
    })();
  }, []);

  // AI Mode State & Multi-Second AI Thinking & Scan Animation
  const [isAiMode, setIsAiMode] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const aiScanAnim = useRef(new Animated.Value(0)).current;
  const aiOverlayOpacity = useRef(new Animated.Value(0)).current;
  const aiBorderRotateAnim = useRef(new Animated.Value(0)).current;
  const aiBorderColorAnim = useRef(new Animated.Value(0)).current;

  // Animate gradient black and white borders when AI mode or thinking is engaged
  useEffect(() => {
    if (isAiMode || isAiThinking) {
      const rotateAnim = Animated.loop(
        Animated.timing(aiBorderRotateAnim, {
          toValue: 1,
          duration: isAiThinking ? 2000 : 3500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      const colorAnim = Animated.loop(
        Animated.timing(aiBorderColorAnim, {
          toValue: 1,
          duration: isAiThinking ? 1600 : 3200,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      rotateAnim.start();
      colorAnim.start();
      return () => {
        rotateAnim.stop();
        colorAnim.stop();
      };
    } else {
      aiBorderRotateAnim.setValue(0);
      aiBorderColorAnim.setValue(0);
    }
  }, [isAiMode, isAiThinking]);

  // Dynamic black-and-white outline border color animation for the white AI Mode button
  const animatedAiBtnBorderColor = aiBorderColorAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ["#09090B", "#71717A", "#D4D4D8", "#71717A", "#09090B"],
  });

  // Previous average parking rate computed from user history
  const previousAverageRate = useMemo(() => {
    if (!recentParkingsList || recentParkingsList.length === 0) return 300;
    const rates = recentParkingsList
      .map((r: any) => r.hourly_rate || (r.amount && r.amount > 0 ? Math.round(r.amount / 2) : 300))
      .filter((n: number) => Boolean(n) && n > 0);
    if (rates.length === 0) return 300;
    const sum = rates.reduce((a: number, b: number) => a + b, 0);
    return Math.round(sum / rates.length);
  }, [recentParkingsList]);

  // Trigger AI Thinking phase lasting ~3 seconds with active border animations indicating AI calculation
  const handleToggleAiMode = () => {
    if (isAiMode || isAiThinking) {
      setIsAiMode(false);
      setIsAiThinking(false);
      setIsAiScanning(false);
      return;
    }

    // Step 1: Engage AI Thinking & Deciding state with animated borders across cards
    setIsAiThinking(true);
    setIsAiScanning(true);
    aiScanAnim.setValue(0);
    aiOverlayOpacity.setValue(1);

    // Dynamic 3-second thinking & holographic scan wave
    Animated.parallel([
      Animated.timing(aiScanAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(2600),
        Animated.timing(aiOverlayOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setIsAiScanning(false);
      setIsAiThinking(false);
      setIsAiMode(true);
    });
  };

  // Functional Zone & Search Filtering + AI Recommendation Sorting
  const displayedParkingLocations: ParkingLocation[] = React.useMemo(() => {
    const filtered = locations.filter((loc) => {
      // Zone Filter Check
      if (activeZoneFilter !== "All zones") {
        const zoneLower = activeZoneFilter.toLowerCase();
        const locZoneLower = (loc.zone_code || "").toLowerCase();
        const locNameLower = (loc.name || "").toLowerCase();
        const locAddrLower = (loc.address || "").toLowerCase();

        const matchesZone =
          locZoneLower === zoneLower ||
          (zoneLower === "zone a" && (locNameLower.includes("marina") || loc.is_electric_station || locZoneLower.includes("a"))) ||
          (zoneLower === "zone b" && (locNameLower.includes("jumeirah") || locAddrLower.includes("jumeirah") || locZoneLower.includes("b"))) ||
          (zoneLower === "zone c" && (locNameLower.includes("downtown") || locAddrLower.includes("downtown") || locZoneLower.includes("c"))) ||
          (zoneLower === "zone d" && (locNameLower.includes("mall") || locAddrLower.includes("mall") || locZoneLower.includes("d"))) ||
          (zoneLower === "zone e" && (locNameLower.includes("city hall") || loc.is_handicap_facility || locAddrLower.includes("city hall") || locZoneLower.includes("e")));
        if (!matchesZone) return false;
      }

      // Search Query Check
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = loc.name?.toLowerCase().includes(q);
        const matchesAddr = loc.address?.toLowerCase().includes(q);
        const matchesCity = loc.city?.toLowerCase().includes(q);
        const matchesZone = loc.zone_code?.toLowerCase().includes(q);
        const matchesRate = `${loc.hourly_rate || ""}`.includes(q);
        if (!matchesName && !matchesAddr && !matchesCity && !matchesZone && !matchesRate) {
          return false;
        }
      }

      return true;
    });

    if (!isAiMode) return filtered;

    // AI Mode Active: Score and sort based on vehicle specifications, previous parking amount & cheap AI balances
    return [...filtered].sort((a, b) => {
      const rateA = a.hourly_rate || 300;
      const rateB = b.hourly_rate || 300;

      // Base scoring: cheaper rates get highest points
      let scoreA = 100 - (rateA / 10);
      let scoreB = 100 - (rateB / 10);

      // Cheap AI Balances bonus
      if (rateA <= 250) scoreA += 45;
      else if (rateA <= 300) scoreA += 35;
      else if (rateA <= 350) scoreA += 20;

      if (rateB <= 250) scoreB += 45;
      else if (rateB <= 300) scoreB += 35;
      else if (rateB <= 350) scoreB += 20;

      // Previous parking amount match (reward rates equal to or cheaper than user's historic average)
      if (rateA <= previousAverageRate) scoreA += 30;
      if (rateB <= previousAverageRate) scoreB += 30;

      // Vehicle specifications match
      if (isVehicleElectric) {
        if (a.is_electric_station) scoreA += 60;
        if (b.is_electric_station) scoreB += 60;
      } else if (isVehicleHandicap) {
        if (a.is_handicap_facility) scoreA += 60;
        if (b.is_handicap_facility) scoreB += 60;
      } else {
        // Standard gasoline / sedan / SUV: penalize restricted bays
        if (a.is_electric_station || a.is_handicap_facility) scoreA -= 70;
        if (b.is_electric_station || b.is_handicap_facility) scoreB -= 70;
      }

      return scoreB - scoreA;
    });
  }, [locations, activeZoneFilter, searchQuery, isAiMode, isVehicleElectric, isVehicleHandicap, previousAverageRate]);

  const saveNewParkingSession = useCallback(
    async (record: ParkingHistoryRecord) => {
      try {
        setRecentParkingsList((prev) => {
          const updated = [record, ...prev.filter((r) => r.id !== record.id)];
          AsyncStorage.setItem(PARKING_HISTORY_STORAGE_KEY, JSON.stringify(updated)).catch((e) =>
            console.warn("AsyncStorage save error:", e)
          );
          return updated;
        });
      } catch (e) {
        console.warn("Failed saving new parking session:", e);
      }
    },
    []
  );

  const updateCompletedParkingSession = useCallback(
    async (ticketId: string, finalCost: number, elapsedSec: number) => {
      try {
        const elapsedMins = Math.round(elapsedSec / 60);
        const hours = Math.floor(elapsedMins / 60);
        const mins = elapsedMins % 60;
        const durationStr = `${hours}h ${mins < 10 ? "0" : ""}${mins}m`;

        setRecentParkingsList((prev) => {
          const updated = prev.map((item) => {
            if (item.id === ticketId || item.status === "Active") {
              return {
                ...item,
                status: "Completed" as const,
                cost: finalCost,
                duration: durationStr,
              };
            }
            return item;
          });
          AsyncStorage.setItem(PARKING_HISTORY_STORAGE_KEY, JSON.stringify(updated)).catch((e) =>
            console.warn("AsyncStorage update error:", e)
          );
          return updated;
        });
      } catch (e) {
        console.warn("Failed updating completed parking session:", e);
      }
    },
    []
  );

  // Functional Search Filtering for Recent Parkings:
  const filteredRecentParkings: ParkingHistoryRecord[] = React.useMemo(() => {
    if (!searchQuery.trim()) return recentParkingsList;
    const q = searchQuery.toLowerCase().trim();
    return recentParkingsList.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.address.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        item.bayNumber.toLowerCase().includes(q) ||
        item.plate.toLowerCase().includes(q)
    );
  }, [recentParkingsList, searchQuery]);

  // Camera & Scanner State
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [qrScannerVisible, setQrScannerVisible] = useState(false);
  const [scannerTorch, setScannerTorch] = useState(false);
  const [scannedSpaceInfo, setScannedSpaceInfo] = useState<{
    spaceNumber: string;
    zoneName: string;
    locationName: string;
    status: "available" | "occupied" | "reserved";
    hourlyRate: number;
    token: string;
  } | null>(null);

  // Screenshot UI State: interactive spot selection bottom sheet & confirm modal
  const [selectedParkForSheet, setSelectedParkForSheet] = useState<ParkingLocation | null>(null);
  const [selectedSheetZone, setSelectedSheetZone] = useState("Zone C");
  const [selectedSheetBay, setSelectedSheetBay] = useState("127");

  const handleSelectSheetZone = (zone: string) => {
    setSelectedSheetZone(zone);
    const lot = ZONE_PARKING_LOTS[zone];
    if (lot) {
      const firstAvailable =
        lot.leftColumn.find((s) => !s.isOccupied) ||
        lot.rightColumn.find((s) => !s.isOccupied);
      if (firstAvailable) {
        setSelectedSheetBay(firstAvailable.bayNumber);
      }
    }
  };

  const currentSheetLot = ZONE_PARKING_LOTS[selectedSheetZone] || ZONE_PARKING_LOTS["Zone C"];
  const [confirmBookingSheetVisible, setConfirmBookingSheetVisible] = useState(false);
  const [mapStationSheetVisible, setMapStationSheetVisible] = useState(false);
  const [selectedMapLocation, setSelectedMapLocation] = useState<ParkingLocation | null>(null);
  const [mapCategory, setMapCategory] = useState<string>("car");
  const [mapSearch, setMapSearch] = useState<string>("");
  const [mapBookmarked, setMapBookmarked] = useState<Record<string, boolean>>({});

  // Aux Modals
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [manualQrCode, setManualQrCode] = useState("");
  const [agentModalVisible, setAgentModalVisible] = useState(false);
  const [agentPlateInput, setAgentPlateInput] = useState("");
  const [agentAudit, setAgentAudit] = useState<AgentAuditResponse | null>(null);
  const [agentSearching, setAgentSearching] = useState(false);

  // Notifications Modal State (Full Screen)
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [notificationsList, setNotificationsList] = useState<AppNotificationItem[]>(DEFAULT_NOTIFICATIONS);
  const [notifFilter, setNotifFilter] = useState<"All" | "Parking" | "AI Radar" | "Billing" | "System">("All");

  const unreadNotifsCount = useMemo(() => {
    return notificationsList.filter((n) => !n.read).length;
  }, [notificationsList]);

  const filteredNotifications = useMemo(() => {
    if (notifFilter === "All") return notificationsList;
    return notificationsList.filter((n) => n.category === notifFilter);
  }, [notificationsList, notifFilter]);

  const handleMarkAllNotifsAsRead = () => {
    setNotificationsList((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleDismissNotification = (id: string) => {
    setNotificationsList((prev) => prev.filter((n) => n.id !== id));
  };

  const handleNotificationAction = (item: AppNotificationItem) => {
    setNotificationsList((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );
    setNotificationsModalVisible(false);

    if (item.actionType === "active_session") {
      // Keep discovery view with active session visible
    } else if (item.actionType === "ai_lot") {
      setIsAiMode(true);
      const targetLot = locations.find((l) => l.name?.toLowerCase().includes("chuk")) || locations[0];
      if (targetLot) {
        setSelectedParkForSheet(targetLot);
        setSelectedSheetZone(targetLot.zone_code || "Zone C");
        setSelectedSheetBay("127");
      }
    } else if (item.actionType === "receipt") {
      router.push("/recent_parkings");
    }
  };

  const navigation = useNavigation();

  // Hide bottom tabs whenever any bottom sheet, modal, or non-discovery view is active
  useEffect(() => {
    const isSheetOrModalActive =
      Boolean(selectedParkForSheet) ||
      confirmBookingSheetVisible ||
      mapStationSheetVisible ||
      qrScannerVisible ||
      qrModalVisible ||
      agentModalVisible ||
      notificationsModalVisible ||
      showMapView ||
      viewMode !== "discovery";

    if (isSheetOrModalActive) {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: "none" } });
    } else {
      navigation.getParent()?.setOptions({ tabBarStyle: undefined });
    }

    return () => {
      navigation.getParent()?.setOptions({ tabBarStyle: undefined });
    };
  }, [
    navigation,
    selectedParkForSheet,
    confirmBookingSheetVisible,
    mapStationSheetVisible,
    qrScannerVisible,
    qrModalVisible,
    agentModalVisible,
    showMapView,
    viewMode,
  ]);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await initData();
    setRefreshing(false);
  }, []);

  const initData = async () => {
    try {
      const fetchedLocs = await fetchParkingLocations();
      const zones = ["Zone A", "Zone B", "Zone C", "Zone D", "Zone E"];
      const locMap = new Map<string, ParkingLocation>();
      FALLBACK_LOCATIONS.forEach((l) => locMap.set(l.name.toLowerCase(), l));
      if (fetchedLocs.length > 0) {
        fetchedLocs.forEach((l, idx) => {
          locMap.set(l.name.toLowerCase(), {
            ...l,
            zone_code: l.zone_code || zones[idx % zones.length],
          });
        });
      }
      const combinedLocs = Array.from(locMap.values());
      setLocations(combinedLocs);
      setSelectedLocation(combinedLocs[0]);
      setSelectedMapLocation(combinedLocs[0]);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const vehicles = await fetchUserVehicles(user.id);
        if (vehicles.length > 0) {
          setSelectedVehicle(vehicles[0]);
        }
      }
    } catch (e) {
      console.warn("initData error:", e);
    }
  };

  const formatTimerDigits = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")} Hrs`;
  };

  const handleOpenParkDetails = (loc: ParkingLocation) => {
    setSelectedLocation(loc);
    setViewMode("park_details");
  };

  const handleProceedToSlots = () => {
    setViewMode("slot_selection");
  };

  const handleSelectSlot = (sp: ParkingSpace) => {
    if (sp.space_type === "ev" && !isVehicleElectric) {
      Alert.alert(
        "EV Lot Restricted",
        `Bay ${sp.space_number} is strictly reserved for Electric Vehicles (EV). Your vehicle (${selectedVehicle?.brand || "Car"}) is non-electric.\n\nUnauthorized parking in this EV lot incurs an immediate 5,000 RWF Municipal Contravention Fine. Do you want to select this bay anyway and accept the fine?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Accept 5,000 RWF Fine",
            style: "destructive",
            onPress: () => setSelectedSpace(sp),
          },
        ]
      );
      return;
    }
    if (sp.space_type === "handicap" && !isVehicleHandicap) {
      Alert.alert(
        "Accessible Lot Restricted",
        `Bay ${sp.space_number} is strictly reserved for drivers with an authorized handicap permit.\n\nUnauthorized parking in this handicap lot incurs an immediate 10,000 RWF Municipal Citation. Do you want to select this bay anyway and accept the fine?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Accept 10,000 RWF Fine",
            style: "destructive",
            onPress: () => setSelectedSpace(sp),
          },
        ]
      );
      return;
    }
    setSelectedSpace(sp);
  };

  const handleConfirmPayment = () => {
    if (!selectedSpace) {
      Alert.alert("Select Spot", "Please tap an available spot.");
      return;
    }

    let fineAmount = 0;
    let fineReason = "";
    if (selectedSpace.space_type === "ev" && !isVehicleElectric) {
      fineAmount = 5000;
      fineReason = "Unauthorized Non-EV in EV Bay";
    } else if (selectedSpace.space_type === "handicap" && !isVehicleHandicap) {
      fineAmount = 10000;
      fineReason = "Unauthorized Vehicle in Accessible Bay";
    }

    const isEvSpot = selectedSpace.space_type === "ev";
    // Clarification: EVs don't pay parking, they strictly pay for charging!
    const baseCost = isEvSpot ? 0 : (selectedLocation.hourly_rate || 500) * (durationHours || 2);
    const totalCost = baseCost + fineAmount;

    // Deduct pre-booking fee from wallet balance
    const currentNum = parseInt(ParkingBalance.replace(/,/g, ""), 10) || 0;
    const updatedBalance = Math.max(0, currentNum - totalCost);
    setParkingBalance(updatedBalance.toLocaleString());
    AsyncStorage.setItem("@parkzone_wallet_balance", updatedBalance.toLocaleString()).catch(() => { });

    const newTicket = {
      id: `ticket-${Date.now()}`,
      plate: selectedVehicle?.masked_plate || "RAD ••• B",
      entryTime: new Date(),
      spaceNumber: selectedSpace.space_number,
      locationName: selectedLocation.name,
      durationHours: durationHours || 2,
      hourlyRate: isEvSpot ? 0 : selectedLocation.hourly_rate || 500,
      violationFine: fineAmount > 0 ? fineAmount : undefined,
      violationReason: fineReason || (isEvSpot ? "EV Charging Bay (Free Parking)" : undefined),
      isPrepaid: true,
      paidAmount: totalCost,
      prepaidHours: durationHours || 2,
    };
    setActiveTicket(newTicket);
    setCurrentTick(Date.now());
    notifyParkingStarted(newTicket.spaceNumber, newTicket.locationName, newTicket.durationHours);

    // Net on persistent parking history
    const historyItem: ParkingHistoryRecord = {
      id: newTicket.id,
      name: newTicket.locationName,
      address: selectedLocation?.address || "Courtyard Marina View Tower",
      bayNumber: newTicket.spaceNumber,
      zoneCode: selectedSpace.zone_code || "Zone A",
      plate: newTicket.plate,
      date: `Today, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      duration: `${newTicket.durationHours}h 00m`,
      cost: totalCost,
      currency: "RWF",
      status: "Active",
      image: LOCATION_IMAGES[selectedLocation?.id || ""] || DEFAULT_PARKING_IMAGE,
      receiptNumber: `PZ-${Date.now().toString().slice(-6)}`,
      violationFine: fineAmount > 0 ? fineAmount : undefined,
      violationReason: fineReason || undefined,
    };
    saveNewParkingSession(historyItem);

    setViewMode("discovery");

    // If driver is charging an EV in an EV lot, open the dedicated Charging Screen
    if (isEvSpot && isVehicleElectric) {
      router.push({
        pathname: "/ev_charging",
        params: {
          name: selectedLocation.name,
          bayNumber: selectedSpace.space_number,
          plate: selectedVehicle?.masked_plate || "RAD ••• B",
          kwh: "72",
          soc: "71",
          rate: "250",
          currency: "RWF",
        },
      });
      return;
    }

    if (fineAmount > 0) {
      Alert.alert(
        "Contravention Fine Applied",
        `Spot ${selectedSpace.space_number} reserved. A ${fineAmount.toLocaleString()} RWF fine (${fineReason}) has been charged to your bill.`
      );
    } else {
      Alert.alert(
        "Parking Started",
        `Spot ${selectedSpace.space_number} at ${selectedLocation.name} is reserved for ${durationHours} hours. Parking fee (${totalCost.toLocaleString()} RWF) paid. Parking tracker is now active.`
      );
    }
  };

  const handleEndParkingSession = () => {
    if (!activeTicket) return;
    const prepaidHours = activeTicket.prepaidHours || activeTicket.durationHours || 1;
    const elapsedHours = Math.ceil(elapsedSeconds / 3600);
    const extraHours = Math.max(0, elapsedHours - prepaidHours);
    const overdueCost = extraHours * (activeTicket.hourlyRate || 500);

    if (overdueCost === 0) {
      // User is within prepaid reservation - no extra charge, avoids double paying
      Alert.alert(
        "Close Booking",
        `Spot: ${activeTicket.spaceNumber} (${activeTicket.locationName})\nElapsed Time: ${formatTimerDigits(elapsedSeconds)}\nBooked Duration: ${prepaidHours} Hour(s) (Pre-paid)\nTotal Extra Due: 0 RWF\n\nYour session was already paid before booking.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Close Booking",
            onPress: () => {
              clearParkingNotifications();
              const finalCost = activeTicket.paidAmount || (prepaidHours * (activeTicket.hourlyRate || 500));
              updateCompletedParkingSession(activeTicket.id, finalCost, elapsedSeconds);
              setActiveTicket(null);
              Alert.alert("Booking Closed", "Parking session finished. Pre-paid booking covered this session in full.");
            },
          },
        ]
      );
    } else {
      // User exceeded booked duration - only charge for the overdue time
      Alert.alert(
        "Overdue Booking",
        `Spot: ${activeTicket.spaceNumber} (${activeTicket.locationName})\nElapsed Time: ${formatTimerDigits(elapsedSeconds)}\nPre-paid Duration: ${prepaidHours} Hour(s)\nOverstay: +${extraHours} Hour(s)\nOverdue Rate: ${(activeTicket.hourlyRate || 500).toLocaleString()} RWF/hr\nTotal Extra Due: ${overdueCost.toLocaleString()} RWF`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: `Pay ${overdueCost.toLocaleString()} RWF & Close`,
            style: "destructive",
            onPress: () => {
              const currentNum = parseInt(ParkingBalance.replace(/,/g, ""), 10) || 0;
              const updated = Math.max(0, currentNum - overdueCost);
              setParkingBalance(updated.toLocaleString());
              AsyncStorage.setItem("@parkzone_wallet_balance", updated.toLocaleString()).catch(() => { });
              clearParkingNotifications();
              const finalCost = (activeTicket.paidAmount || 0) + overdueCost;
              updateCompletedParkingSession(activeTicket.id, finalCost, elapsedSeconds);
              setActiveTicket(null);
              Alert.alert("Booking Closed", `Parking session finished. ${overdueCost.toLocaleString()} RWF overdue fee deducted from wallet.`);
            },
          },
        ]
      );
    }
  };

  const handleExtendParkingTime = (addedHours: number = 1) => {
    if (!activeTicket) return;
    setActiveTicket((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        durationHours: prev.durationHours + addedHours,
        prepaidHours: (prev.prepaidHours || prev.durationHours) + addedHours,
      };
    });
    Alert.alert("Time Extended", `Added ${addedHours} hour(s) to your parking time.`);
  };

  const handleBarcodeScanned = (result: { data?: string }) => {
    const rawData = result?.data || "127";
    const bayMatch = rawData.match(/([A-Za-z0-9]+)/);
    const bayNum = bayMatch ? bayMatch[1] : "127";
    setScannedSpaceInfo({
      spaceNumber: bayNum,
      zoneName: "Zone C",
      locationName: locations[0]?.name || "Kigali Marina Parking",
      status: "available",
      hourlyRate: locations[0]?.hourly_rate || 300,
      token: rawData,
    });
  };

  const handleSimulateScan = (bayCode: string = "127") => {
    setScannedSpaceInfo({
      spaceNumber: bayCode,
      zoneName: "Zone C",
      locationName: locations[0]?.name || "Kigali Marina Parking",
      status: "available",
      hourlyRate: locations[0]?.hourly_rate || 300,
      token: `PKZ-BAY-${bayCode}`,
    });
  };

  const handleParkScannedSpot = () => {
    if (!scannedSpaceInfo) return;

    let fineAmount = 0;
    let fineReason = "";
    const isEvSpot =
      scannedSpaceInfo.zoneName === "Zone A" ||
      scannedSpaceInfo.spaceNumber.toLowerCase().startsWith("ev") ||
      scannedSpaceInfo.locationName.toLowerCase().includes("ev");
    const isHandicapSpot =
      scannedSpaceInfo.zoneName === "Zone E" ||
      scannedSpaceInfo.spaceNumber.toLowerCase().startsWith("h") ||
      scannedSpaceInfo.locationName.toLowerCase().includes("accessible");

    if (isEvSpot && !isVehicleElectric) {
      fineAmount = 5000;
      fineReason = "Unauthorized Non-EV in EV Bay";
    } else if (isHandicapSpot && !isVehicleHandicap) {
      fineAmount = 10000;
      fineReason = "Unauthorized Vehicle in Accessible Bay";
    }

    const baseCost = isEvSpot ? 0 : (scannedSpaceInfo.hourlyRate || 300) * (durationHours || 2);
    const totalCost = baseCost + fineAmount;

    // Deduct pre-booking fee from wallet balance
    const currentNum = parseInt(ParkingBalance.replace(/,/g, ""), 10) || 0;
    const updatedBalance = Math.max(0, currentNum - totalCost);
    setParkingBalance(updatedBalance.toLocaleString());
    AsyncStorage.setItem("@parkzone_wallet_balance", updatedBalance.toLocaleString()).catch(() => { });

    const newTicket = {
      id: `ticket-${Date.now()}`,
      plate: selectedVehicle?.masked_plate || "RAD ••• B",
      entryTime: new Date(),
      spaceNumber: scannedSpaceInfo.spaceNumber,
      locationName: scannedSpaceInfo.locationName,
      durationHours: durationHours || 2,
      hourlyRate: isEvSpot ? 0 : scannedSpaceInfo.hourlyRate || 300,
      violationFine: fineAmount > 0 ? fineAmount : undefined,
      violationReason: fineReason || undefined,
      isPrepaid: true,
      paidAmount: totalCost,
      prepaidHours: durationHours || 2,
    };
    setActiveTicket(newTicket);
    setCurrentTick(Date.now());
    notifyParkingStarted(newTicket.spaceNumber, newTicket.locationName, newTicket.durationHours);

    // Net on persistent parking history
    const historyItem: ParkingHistoryRecord = {
      id: newTicket.id,
      name: newTicket.locationName,
      address: "Kigali Marina Parking",
      bayNumber: newTicket.spaceNumber,
      zoneCode: scannedSpaceInfo.zoneName || "Zone C",
      plate: newTicket.plate,
      date: `Today, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      duration: `${newTicket.durationHours}h 00m`,
      cost: totalCost,
      currency: "RWF",
      status: "Active",
      image: DEFAULT_PARKING_IMAGE,
      receiptNumber: `PZ-${Date.now().toString().slice(-6)}`,
      violationFine: fineAmount > 0 ? fineAmount : undefined,
      violationReason: fineReason || undefined,
    };
    saveNewParkingSession(historyItem);

    setScannedSpaceInfo(null);
    setQrScannerVisible(false);
    if (fineAmount > 0) {
      Alert.alert(
        "Contravention Fine Applied",
        `Spot ${scannedSpaceInfo.spaceNumber} reserved at ${scannedSpaceInfo.locationName}.\n\nA ${fineAmount.toLocaleString()} RWF Municipal Fine (${fineReason}) has been added to your session.`
      );
    } else {
      Alert.alert(
        "Parking Started",
        `Spot ${scannedSpaceInfo.spaceNumber} reserved at ${scannedSpaceInfo.locationName}. Pre-booking fee (${totalCost.toLocaleString()} RWF) paid. Parking Tracker is live.`
      );
    }
  };

  const handleConfirmSheetBooking = () => {
    if (!selectedParkForSheet) return;

    let fineAmount = 0;
    let fineReason = "";
    const isEvSpot =
      selectedSheetZone === "Zone A" ||
      Boolean(selectedParkForSheet.is_electric_station) ||
      selectedSheetBay.toLowerCase().startsWith("ev");
    const isHandicapSpot =
      selectedSheetZone === "Zone E" ||
      Boolean(selectedParkForSheet.is_handicap_facility) ||
      selectedSheetBay.toLowerCase().startsWith("h");

    if (isEvSpot && !isVehicleElectric) {
      fineAmount = 5000;
      fineReason = "Unauthorized Non-EV in EV Bay";
    } else if (isHandicapSpot && !isVehicleHandicap) {
      fineAmount = 10000;
      fineReason = "Unauthorized Vehicle in Accessible Bay";
    }

    const baseCost = isEvSpot ? 0 : (selectedParkForSheet.hourly_rate || 300) * (durationHours || 2);
    const totalCost = baseCost + fineAmount;

    // Deduct pre-booking fee from wallet balance
    const currentNum = parseInt(ParkingBalance.replace(/,/g, ""), 10) || 0;
    const updatedBalance = Math.max(0, currentNum - totalCost);
    setParkingBalance(updatedBalance.toLocaleString());
    AsyncStorage.setItem("@parkzone_wallet_balance", updatedBalance.toLocaleString()).catch(() => { });

    const newTicket = {
      id: `ticket-${Date.now()}`,
      plate: selectedVehicle?.masked_plate || "RAD ••• B",
      entryTime: new Date(),
      spaceNumber: selectedSheetBay,
      locationName: selectedParkForSheet.name,
      durationHours: durationHours || 2,
      hourlyRate: isEvSpot ? 0 : selectedParkForSheet.hourly_rate || 300,
      violationFine: fineAmount > 0 ? fineAmount : undefined,
      violationReason: fineReason || undefined,
      isPrepaid: true,
      paidAmount: totalCost,
      prepaidHours: durationHours || 2,
    };
    setActiveTicket(newTicket);
    setCurrentTick(Date.now());
    notifyParkingStarted(newTicket.spaceNumber, newTicket.locationName, newTicket.durationHours);

    // Net on persistent parking history
    const historyItem: ParkingHistoryRecord = {
      id: newTicket.id,
      name: newTicket.locationName,
      address: selectedParkForSheet.address,
      bayNumber: newTicket.spaceNumber,
      zoneCode: selectedSheetZone,
      plate: newTicket.plate,
      date: `Today, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      duration: `${newTicket.durationHours}h 00m`,
      cost: totalCost,
      currency: "RWF",
      status: "Active",
      image: LOCATION_IMAGES[selectedParkForSheet.id] || DEFAULT_PARKING_IMAGE,
      receiptNumber: `PZ-${Date.now().toString().slice(-6)}`,
      violationFine: fineAmount > 0 ? fineAmount : undefined,
      violationReason: fineReason || undefined,
    };
    saveNewParkingSession(historyItem);

    setConfirmBookingSheetVisible(false);
    setSelectedParkForSheet(null);
    if (fineAmount > 0) {
      Alert.alert(
        "Contravention Fine Applied",
        `Spot ${selectedSheetBay} (${selectedSheetZone}) reserved at ${selectedParkForSheet.name}.\n\nA ${fineAmount.toLocaleString()} RWF Municipal Fine (${fineReason}) has been applied to your session.`
      );
    } else {
      Alert.alert(
        "Parking Confirmed",
        `Spot ${selectedSheetBay} (${selectedSheetZone}) reserved at ${selectedParkForSheet.name}. Pre-booking fee (${totalCost.toLocaleString()} RWF) paid. Parking Tracker is live.`
      );
    }
  };

  const handleTopUpWallet = () => {
    Alert.alert(
      "Top-Up Wallet",
      "Instant MoMo / Card reload available:\n• 5,000 RWF\n• 10,000 RWF\n• 25,000 RWF",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "+10,000 RWF",
          onPress: () => {
            const currentNum = parseInt(ParkingBalance.replace(/,/g, ""), 10) || 0;
            setParkingBalance((currentNum + 10000).toLocaleString());
            Alert.alert("Success", "10,000 RWF loaded via MTN Mobile Money.");
          },
        },
      ]
    );
  };

  const [selectedTopology, setSelectedTopology] = useState<TopologyType>("perpendicular");
  const [is3DView, setIs3DView] = useState(false);
  const [isFlaggingOverdue, setIsFlaggingOverdue] = useState(false);
  const [isIssuingFine, setIsIssuingFine] = useState(false);

  const handleAgentAuditSearch = async () => {
    if (!agentPlateInput.trim()) return;
    setAgentSearching(true);
    try {
      const result = await verifyPlateStatus(agentPlateInput);
      setAgentAudit(result);
    } catch (e) {
      console.warn("Audit error:", e);
    } finally {
      setAgentSearching(false);
    }
  };

  const handleFlagOverdue = async () => {
    if (!agentAudit || !agentPlateInput) return;
    setIsFlaggingOverdue(true);
    try {
      await flagOverdueInvoice({
        ticketId: agentAudit.ticket_id || `t-${Date.now()}`,
        plateNumber: agentPlateInput.trim().toUpperCase(),
        overdueAmount: agentAudit.overdue_amount || 1200,
      });
      Alert.alert(
        "Overdue Flag Dispatched",
        `Invoice for plate ${agentAudit.masked_plate} flagged in central registry.\n\n• Automated MoMo push prompt triggered\n• Barrier lots will require settlement on exit\n• Zero physical contact enforced.`,
        [{ text: "Done", onPress: () => setAgentAudit(null) }]
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to flag invoice.");
    } finally {
      setIsFlaggingOverdue(false);
    }
  };

  const handleIssueCitation = async () => {
    if (!agentPlateInput) return;
    setIsIssuingFine(true);
    try {
      const res = await issueZeroContactCitation({
        plateNumber: agentPlateInput.trim().toUpperCase(),
        locationId: selectedLocation?.id || "loc-cbd",
      });
      Alert.alert(
        "Digital Citation Issued",
        `Fine of 3,000 RWF issued to plate ${agentPlateInput.toUpperCase()}.\n\n• Reference: ${res.data?.irembo_reference_code || "IREMBO-RW-892104"}\n• Synced with Irembo contravention registry\n• No vehicle contact or physical paper ticket issued.`,
        [{ text: "Understood", onPress: () => setAgentAudit(null) }]
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to issue citation.");
    } finally {
      setIsIssuingFine(false);
    }
  };

  const visibleSpaces: ParkingSpace[] = useMemo(() => {
    return spaces.filter((sp: ParkingSpace) => {
      // Non-electric vehicles never see EV bays
      if (sp.space_type === "ev" && !isVehicleElectric) return false;
      // Non-handicap vehicles never see handicap bays
      if (sp.space_type === "handicap" && !isVehicleHandicap) return false;

      // In-lot search filter
      if (detailsSearchQuery.trim().length > 0) {
        const q = detailsSearchQuery.toLowerCase().trim();
        const matchesBay = sp.space_number.toLowerCase().includes(q);
        const matchesZone = sp.zone_code.toLowerCase().includes(q);
        if (!matchesBay && !matchesZone) return false;
      }

      return true;
    });
  }, [spaces, isVehicleElectric, isVehicleHandicap, detailsSearchQuery]);

  const leftColumnSpaces: ParkingSpace[] = visibleSpaces.filter((_: ParkingSpace, idx: number) => idx % 2 === 0);
  const rightColumnSpaces: ParkingSpace[] = visibleSpaces.filter((_: ParkingSpace, idx: number) => idx % 2 === 1);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={[styles.safeContainer, { backgroundColor: theme.background }]} edges={["top"]}>

        {/* =========================================================================
          SCREEN 1: PARKING SPOT / SLOT SELECTION (Left screen in reference)
      ========================================================================== */}
        {viewMode === "slot_selection" ? (
          <View style={styles.screenWrapper}>
            {/* Header */}
            <View style={styles.spotHeader}>
              <TouchableOpacity
                style={[styles.circularNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setViewMode("park_details")}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={20} color={theme.text} />
              </TouchableOpacity>

              <Text style={[styles.spotHeaderTitle, { color: theme.text }]}>Parking Spot</Text>

              <TouchableOpacity
                style={[styles.circularNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => Alert.prompt ? Alert.prompt("Search Spot", "Enter Bay ID:") : setQrModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="search-outline" size={19} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Floor Selector Pills */}
            <View style={styles.floorPillsRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.floorPillsScroll}>
                {["1st floor", "2nd floor", "3rd floor", "4th floor", "All ˅"].map((fl) => {
                  const isActive = currentFloor === fl;
                  return (
                    <TouchableOpacity
                      key={fl}
                      style={[
                        styles.floorPill,
                        {
                          backgroundColor: isActive ? theme.pillActiveBg : theme.surface,
                          borderColor: isActive ? theme.pillActiveBg : theme.border,
                        },
                      ]}
                      onPress={() => setCurrentFloor(fl)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.floorPillText,
                          { color: isActive ? theme.pillActiveText : theme.textSecondary },
                        ]}
                      >
                        {fl}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Interactive Topology Mode & 3D Aerial Engine Switcher (Matches Section 4 & 5) */}
            <View style={styles.topologySwitcherRow}>
              <View style={styles.topologyPillsGroup}>
                {[
                  { id: "oblique" as TopologyType, label: "45° Oblique" },
                  { id: "perpendicular" as TopologyType, label: "90° Mall" },
                  { id: "parallel" as TopologyType, label: "0° Parallel" },
                ].map((tp) => {
                  const isActive = selectedTopology === tp.id;
                  return (
                    <TouchableOpacity
                      key={tp.id}
                      style={[
                        styles.topologyPill,
                        {
                          backgroundColor: isActive ? theme.pillActiveBg : theme.surface,
                          borderColor: isActive ? theme.pillActiveBg : theme.border,
                        },
                      ]}
                      onPress={() => setSelectedTopology(tp.id)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.topologyPillText,
                          { color: isActive ? theme.pillActiveText : theme.textSecondary },
                        ]}
                      >
                        {tp.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.aerial3DToggleBtn,
                  {
                    backgroundColor: is3DView ? theme.primaryBtnBg : theme.surface,
                    borderColor: is3DView ? theme.primaryBtnBg : theme.border,
                  },
                ]}
                onPress={() => setIs3DView(!is3DView)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={is3DView ? "cube" : "cube-outline"}
                  size={14}
                  color={is3DView ? theme.primaryBtnText : theme.text}
                />
                <Text
                  style={[
                    styles.aerial3DToggleText,
                    { color: is3DView ? theme.primaryBtnText : theme.text },
                  ]}
                >
                  {is3DView ? "3D Aerial" : "2D Grid"}
                </Text>
              </TouchableOpacity>
            </View>

            {is3DView ? (
              <View style={{ flex: 1, paddingBottom: 160 }}>
                <AerialParkingLot3D
                  topology={selectedTopology}
                  spaces={visibleSpaces}
                  selectedSpaceId={selectedSpace?.id || null}
                  onSelectSpace={(sp) => handleSelectSlot(sp)}
                  currentZone={currentFloor}
                />
              </View>
            ) : (
              /* Parking Bay Layout Grid */
              <ScrollView style={styles.slotGridScroll} contentContainerStyle={styles.slotGridContent} showsVerticalScrollIndicator={false}>
                {/* Section A Indicator & Entry Arrow */}
                <View style={styles.bayIndicatorsRow}>
                  <View style={[styles.sectionPillBadge, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.sectionPillText, { color: theme.text }]}>A</Text>
                  </View>

                  <View style={styles.entryArrowBox}>
                    <Text style={[styles.entryArrowText, { color: theme.textSecondary }]}>ENTRY</Text>
                    <Ionicons name="chevron-down" size={16} color={theme.text} style={{ marginTop: -2 }} />
                    <Ionicons name="chevron-down" size={16} color={theme.text} style={{ marginTop: -10 }} />
                  </View>
                </View>

                {/* Parking Layout 2-Columns */}
                <View style={styles.bayLayoutTwoCols}>
                  {/* Left Column */}
                  <View style={styles.bayColumn}>
                    {leftColumnSpaces.map((sp) => {
                      const isSelected = selectedSpace?.id === sp.id;
                      const isEV = sp.space_type === "ev";
                      const isHC = sp.space_type === "handicap";
                      const isSlotDisabled = (isEV && !isVehicleElectric) || (isHC && !isVehicleHandicap);
                      const skewTransform = selectedTopology === "oblique" ? [{ skewX: "-8deg" }] : [];

                      if (sp.is_occupied) {
                        return (
                          <View key={sp.id} style={[styles.occupiedBayWrapper, { transform: skewTransform }]}>
                            <Text style={[styles.bayLabelMuted, { color: theme.textSecondary }]}>{sp.space_number}</Text>
                            <VerticalUltraRealisticCar color="obsidian" />
                          </View>
                        );
                      }
                      return (
                        <TouchableOpacity
                          key={sp.id}
                          style={[
                            styles.freeBaySlot,
                            {
                              backgroundColor: theme.surface,
                              borderColor: isSelected
                                ? (isEV ? "#10B981" : isHC ? "#3B82F6" : theme.text)
                                : isSlotDisabled
                                  ? "rgba(239, 68, 68, 0.45)"
                                  : (isEV ? "rgba(16, 185, 129, 0.45)" : isHC ? "rgba(59, 130, 246, 0.45)" : theme.border),
                              borderWidth: isSelected ? 2.5 : 1,
                              opacity: isSlotDisabled ? 0.55 : 1,
                              transform: skewTransform,
                            },
                          ]}
                          onPress={() => handleSelectSlot(sp)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.freeBaySlotText, { color: theme.text }]}>{sp.space_number}</Text>
                          {isSlotDisabled && (
                            <View style={styles.disabledBayBadge}>
                              <Ionicons name="lock-closed" size={8} color="#EF4444" />
                              <Text style={styles.disabledBayBadgeText}>{isEV ? "EV ONLY" : "PERMIT REQ"}</Text>
                            </View>
                          )}
                          {isEV && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 }}>
                              <Ionicons name="flash" size={10} color="#10B981" />
                              <Text style={{ fontSize: 9, fontWeight: "800", color: "#10B981" }}>EV</Text>
                            </View>
                          )}
                          {isHC && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 }}>
                              <Ionicons name="body" size={10} color="#3B82F6" />
                              <Text style={{ fontSize: 9, fontWeight: "800", color: "#3B82F6" }}>ACCESSIBLE</Text>
                            </View>
                          )}
                          {isSelected && (
                            <View style={[styles.selectedCheckDot, { backgroundColor: isEV ? "#10B981" : isHC ? "#3B82F6" : theme.text }]}>
                              <Ionicons name="checkmark" size={12} color={theme.background} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Center Drive Aisle */}
                  <View style={styles.driveAisle}>
                    <View style={[styles.driveAisleDashedLine, { borderColor: theme.borderStrong }]} />
                  </View>

                  {/* Right Column */}
                  <View style={styles.bayColumn}>
                    {rightColumnSpaces.map((sp) => {
                      const isSelected = selectedSpace?.id === sp.id;
                      const isEV = sp.space_type === "ev";
                      const isHC = sp.space_type === "handicap";
                      const isSlotDisabled = (isEV && !isVehicleElectric) || (isHC && !isVehicleHandicap);
                      const skewTransform = selectedTopology === "oblique" ? [{ skewX: "8deg" }] : [];

                      if (sp.is_occupied) {
                        return (
                          <View key={sp.id} style={[styles.occupiedBayWrapper, { transform: skewTransform }]}>
                            <Text style={[styles.bayLabelMuted, { color: theme.textSecondary }]}>{sp.space_number}</Text>
                            <VerticalUltraRealisticCar color="titanium" />
                          </View>
                        );
                      }
                      return (
                        <TouchableOpacity
                          key={sp.id}
                          style={[
                            styles.freeBaySlot,
                            {
                              backgroundColor: theme.surface,
                              borderColor: isSelected
                                ? (isEV ? "#10B981" : isHC ? "#3B82F6" : theme.text)
                                : isSlotDisabled
                                  ? "rgba(239, 68, 68, 0.45)"
                                  : (isEV ? "rgba(16, 185, 129, 0.45)" : isHC ? "rgba(59, 130, 246, 0.45)" : theme.border),
                              borderWidth: isSelected ? 2.5 : 1,
                              opacity: isSlotDisabled ? 0.55 : 1,
                              transform: skewTransform,
                            },
                          ]}
                          onPress={() => handleSelectSlot(sp)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.freeBaySlotText, { color: theme.text }]}>{sp.space_number}</Text>
                          {isSlotDisabled && (
                            <View style={styles.disabledBayBadge}>
                              <Ionicons name="lock-closed" size={8} color="#EF4444" />
                              <Text style={styles.disabledBayBadgeText}>{isEV ? "EV ONLY" : "PERMIT REQ"}</Text>
                            </View>
                          )}
                          {isEV && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 }}>
                              <Ionicons name="flash" size={10} color="#10B981" />
                              <Text style={{ fontSize: 9, fontWeight: "800", color: "#10B981" }}>EV</Text>
                            </View>
                          )}
                          {isHC && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 }}>
                              <Ionicons name="body" size={10} color="#3B82F6" />
                              <Text style={{ fontSize: 9, fontWeight: "800", color: "#3B82F6" }}>ACCESSIBLE</Text>
                            </View>
                          )}
                          {isSelected && (
                            <View style={[styles.selectedCheckDot, { backgroundColor: isEV ? "#10B981" : isHC ? "#3B82F6" : theme.text }]}>
                              <Ionicons name="checkmark" size={12} color={theme.background} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            )}

            {/* Bottom Floating Sheet (Spot A-15 Card) */}
            <View style={[styles.spotBottomCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.cardShadow }]}>
              <View style={styles.sheetHandleBar} />
              <Text style={[styles.spotSheetTitle, { color: theme.text }]}>
                Spot {selectedSpace ? selectedSpace.space_number : "A-15"}
              </Text>

              {/* Time Selectors Row */}
              <View style={styles.timeSelectorRow}>
                <View style={styles.timeCol}>
                  <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>Arrive after</Text>
                  <TouchableOpacity
                    style={[styles.timeChip, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => Alert.alert("Arrive After", "Select check-in hour:")}
                  >
                    <Text style={[styles.timeChipText, { color: theme.text }]}>08:00 AM ˅</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.durationCenterPill, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <TouchableOpacity onPress={() => setDurationHours((h) => Math.max(1, h - 1))}>
                    <Ionicons name="remove-circle-outline" size={18} color={theme.text} />
                  </TouchableOpacity>
                  <Ionicons name="time-outline" size={14} color={theme.text} />
                  <Text style={[styles.durationCenterText, { color: theme.text }]}>
                    {durationHours} Hours
                  </Text>
                  <TouchableOpacity onPress={() => setDurationHours((h) => h + 1)}>
                    <Ionicons name="add-circle-outline" size={18} color={theme.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.timeCol}>
                  <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>Exit after</Text>
                  <TouchableOpacity
                    style={[styles.timeChip, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => Alert.alert("Exit After", "Select check-out hour:")}
                  >
                    <Text style={[styles.timeChipText, { color: theme.text }]}>
                      {`${(8 + durationHours) % 12 || 12}:00 ${8 + durationHours >= 12 ? "PM" : "AM"} ˅`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Full Width Pill Button */}
              <TouchableOpacity
                style={[styles.fullWidthPillBtn, { backgroundColor: theme.primaryBtnBg }]}
                onPress={handleConfirmPayment}
                activeOpacity={0.88}
              >
                <View style={styles.fullWidthPillInner}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="card-outline" size={20} color={theme.primaryBtnText} />
                    <Text style={[styles.fullWidthPillBtnText, { color: theme.primaryBtnText }]}>
                      Confirm Payment
                    </Text>
                  </View>
                  <View style={[styles.circleArrowIcon, { backgroundColor: theme.background }]}>
                    <Ionicons name="arrow-forward" size={16} color={theme.text} />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ) : viewMode === "park_details" ? (
          /* =========================================================================
              SCREEN 3: PARK DETAILS (Right screen in reference)
          ========================================================================== */
          <ScrollView
            style={styles.screenWrapper}
            contentContainerStyle={styles.detailsContent}
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
            {/* Top Bar with Search & Car Selector */}
            <View style={styles.detailsTopBar}>
              <TouchableOpacity
                style={[styles.circularNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setViewMode("discovery")}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back" size={20} color={theme.text} />
              </TouchableOpacity>

              <View style={[styles.detailsSearchBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons name="search-outline" size={16} color={theme.textSecondary} />
                <TextInput
                  style={[styles.detailsSearchInput, { color: theme.text }]}
                  placeholder="Search bay (e.g. 125)..."
                  placeholderTextColor={theme.textMuted}
                  value={detailsSearchQuery}
                  onChangeText={setDetailsSearchQuery}
                  clearButtonMode="while-editing"
                />
                {detailsSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setDetailsSearchQuery("")} style={{ paddingHorizontal: 4 }}>
                    <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
                <View style={[styles.detailsCarPill, { backgroundColor: theme.background }]}>
                  <Ionicons name="car" size={13} color={theme.text} />
                  <Text style={[styles.detailsCarPillText, { color: theme.text }]}>Car ˅</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.circularNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => Alert.alert("Notifications", "No active fines. Sensor active.")}
                activeOpacity={0.7}
              >
                <Ionicons name="notifications-outline" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Park Profile Header */}
            <View style={[styles.parkCardHead, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.parkProfileRow}>
                <Image
                  source={{ uri: LOCATION_IMAGES[selectedLocation.id] || DEFAULT_PARKING_IMAGE }}
                  style={styles.parkAvatarImg}
                />
                <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.parkProfileTitle, { color: theme.text, flexShrink: 1, minWidth: 0 }]} numberOfLines={1}>
                      {selectedLocation.name}
                    </Text>
                    <Ionicons name="checkmark-circle" size={16} color={theme.text} style={{ flexShrink: 0 }} />
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Ionicons name="star" size={13} color="#F59E0B" />
                    <Text style={[styles.parkRatingText, { color: theme.text }]}>4.8</Text>
                    <Text style={[styles.parkReviewsText, { color: theme.textSecondary }]} numberOfLines={1}>
                      (12k+ reviews)
                    </Text>
                  </View>
                </View>

                <View style={[styles.verifiedPill, { backgroundColor: theme.background, borderColor: theme.border, flexShrink: 0 }]}>
                  <Ionicons name="checkmark-outline" size={13} color={theme.text} />
                  <Text style={[styles.verifiedPillText, { color: theme.text }]}>Verified</Text>
                </View>
              </View>

              {/* Address Row with Phone Action */}
              <View style={styles.addressCallRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                  <Ionicons name="location-outline" size={18} color={theme.textSecondary} style={{ flexShrink: 0 }} />
                  <Text style={[styles.addressText, { color: theme.textSecondary, flex: 1, minWidth: 0 }]} numberOfLines={2}>
                    {selectedLocation.address}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.callBtn, { backgroundColor: theme.background, borderColor: theme.border, flexShrink: 0 }]}
                  onPress={() => Alert.alert("Kigali City Parking Hotline", "Dialing +250 788 123 456...")}
                >
                  <Ionicons name="call-outline" size={18} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Segmented Tabs: About Park / Slot Details / Reviews */}
            <View style={styles.segmentedTabsRow}>
              {(["About Park", "Slot Details", "Reviews"] as const).map((tab) => {
                const active =
                  (tab === "About Park" && detailsTab === "about") ||
                  (tab === "Slot Details" && detailsTab === "slots") ||
                  (tab === "Reviews" && detailsTab === "reviews");
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.segmentedTabBtn,
                      {
                        backgroundColor: active ? theme.pillActiveBg : theme.surface,
                        borderColor: active ? theme.pillActiveBg : theme.border,
                      },
                    ]}
                    onPress={() => {
                      if (tab === "About Park") setDetailsTab("about");
                      if (tab === "Slot Details") {
                        setDetailsTab("slots");
                        setViewMode("slot_selection");
                      }
                      if (tab === "Reviews") setDetailsTab("reviews");
                    }}
                  >
                    <Text
                      style={[
                        styles.segmentedTabText,
                        { color: active ? theme.pillActiveText : theme.textSecondary },
                      ]}
                    >
                      {tab}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Hero Video/Gallery Card with Play Button */}
            <View style={styles.mediaGalleryBox}>
              <Image
                source={{ uri: LOCATION_IMAGES[selectedLocation.id] || DEFAULT_PARKING_IMAGE }}
                style={styles.mediaGalleryImg}
              />
              <TouchableOpacity
                style={styles.mediaPlayBtn}
                onPress={() => Alert.alert("360° Aerial Tour", "Streaming Kigali real-time sensor CCTV telemetry...")}
                activeOpacity={0.85}
              >
                <Ionicons name="play" size={24} color="#000000" style={{ marginLeft: 3 }} />
              </TouchableOpacity>
            </View>

            {/* Other Nearby Parks */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionTitleBold, { color: theme.text }]}>Other Nearby Parks</Text>
                <Text style={[styles.sectionSubMuted, { color: theme.textSecondary }]}>
                  The best parking space near you
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowMapView(true)}>
                <Text style={[styles.seeAllLink, { color: theme.text }]}>See all ››</Text>
              </TouchableOpacity>
            </View>

            {eligibleLocations.slice(1).map((loc) => (
              <TouchableOpacity
                key={loc.id}
                style={[styles.horizontalLotCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.cardShadow }]}
                onPress={() => handleOpenParkDetails(loc)}
                activeOpacity={0.88}
              >
                <Image
                  source={{ uri: LOCATION_IMAGES[loc.id] || DEFAULT_PARKING_IMAGE }}
                  style={styles.horizontalLotImg}
                />
                <View style={{ flex: 1, justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.lotCardTitle, { color: theme.text }]} numberOfLines={1}>
                        {loc.name}
                      </Text>
                      <Text style={[styles.lotCardTypes, { color: theme.textSecondary }]}>
                        {loc.is_electric_station ? "⚡ EV Hypercharger Station" : loc.is_handicap_facility ? "♿ Accessible Facility" : "🚗 Standard Parking"}
                      </Text>
                    </View>
                    <View style={[styles.tariffBadge, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Text style={[styles.tariffBadgeText, { color: theme.text }]}>{loc.hourly_rate} RWF/hr</Text>
                    </View>
                  </View>

                  <Text style={[styles.lotCardAddr, { color: theme.textSecondary }]} numberOfLines={1}>
                    {loc.address}
                  </Text>

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Ionicons name="star" size={12} color={theme.text} />
                      <Text style={[styles.ratingStarText, { color: theme.text }]}>4.8 <Text style={{ color: theme.textSecondary }}>(1.2k)</Text></Text>
                    </View>
                    <View style={[styles.spotsAvailablePill, { backgroundColor: theme.background }]}>
                      <Text style={[styles.spotsAvailableText, { color: theme.text }]}>
                        {loc.available_spots || 28} Open
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {/* Confirm Button */}
            <TouchableOpacity
              style={[styles.fullWidthPillBtn, { backgroundColor: theme.primaryBtnBg, marginTop: 14, marginBottom: 30 }]}
              onPress={handleProceedToSlots}
              activeOpacity={0.88}
            >
              <View style={styles.fullWidthPillInner}>
                <Text style={[styles.fullWidthPillBtnText, { color: theme.primaryBtnText }]}>
                  Confirm Slot Selection
                </Text>
                <View style={[styles.circleArrowIcon, { backgroundColor: theme.background }]}>
                  <Ionicons name="arrow-forward" size={16} color={theme.text} />
                </View>
              </View>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          /* =========================================================================
              SCREEN 2: HOME DISCOVERY (Center screen in reference)
          ========================================================================== */
          <ScrollView
            style={styles.screenWrapper}
            contentContainerStyle={styles.homeScrollContent}
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
            {/* Top Bar: Avatar, My Location, Bell */}
            <View style={styles.homeTopBar}>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/profile")}
                style={[styles.avatarCircleBtn, { borderColor: theme.border }]}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80" }}
                  style={styles.avatarImg}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.locationSelectorGroup}
                onPress={() => setShowMapView(!showMapView)}
                activeOpacity={0.7}
              >
                <Text style={[styles.myLocationSub, { color: theme.textSecondary }]}>My Location ˅</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="location-sharp" size={15} color={theme.text} />
                  <Text style={[styles.myLocationMain, { color: theme.text }]} numberOfLines={1}>
                    KN 4 Ave, Kigali CBD
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.circularNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setNotificationsModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="notifications-outline" size={20} color={theme.text} />
                {unreadNotifsCount > 0 && <View style={styles.unreadBadgeDot} />}
              </TouchableOpacity>
            </View>

            {/* Search Bar + AI Mode Button */}
            <View style={styles.searchRow}>
              <View
                style={[
                  styles.searchBarContainer,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
                <TextInput
                  style={[styles.homeSearchInput, { color: theme.text }]}
                  placeholder="Search parking by name, area, rate..."
                  placeholderTextColor={theme.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <AnimatedTouchableOpacity
                onPress={handleToggleAiMode}
                activeOpacity={0.8}
                style={[
                  styles.aiModePillBtn,
                  {
                    backgroundColor: "#FFFFFF",
                    borderColor: (isAiMode || isAiThinking) ? animatedAiBtnBorderColor : theme.border,
                    borderWidth: (isAiMode || isAiThinking) ? 2 : 1,
                    shadowColor: "#000000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: (isAiMode || isAiThinking) ? (isAiThinking ? 0.22 : 0.12) : 0.05,
                    shadowRadius: (isAiMode || isAiThinking) ? (isAiThinking ? 8 : 4) : 2,
                    elevation: (isAiMode || isAiThinking) ? 4 : 2,
                  },
                ]}
              >
                {isAiThinking ? (
                  <>
                    <ActivityIndicator size="small" color="#09090B" style={{ marginRight: 2 }} />
                    <Text style={styles.aiModePillText}>AI Deciding...</Text>
                  </>
                ) : isAiMode ? (
                  <>
                    <Ionicons name="sparkles" size={14} color="#09090B" />
                    <Text style={styles.aiModePillText}>AI Active</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles" size={14} color="#09090B" />
                    <Text style={[styles.aiModePillText, { fontWeight: "600" }]}>AI Mode</Text>
                  </>
                )}
              </AnimatedTouchableOpacity>
            </View>

            {/* Current Balance & Live Parking Tracker (Monochrome Luxury Card) - Rendered ONLY after parking has started */}
            {activeTicket ? (
              <AnimatedBwGradientCard
                active={isAiMode || isAiThinking}
                isThinking={isAiThinking}
                borderRadius={22}
                borderWidth={2.5}
                animValue={aiBorderRotateAnim}
                colorAnimValue={aiBorderColorAnim}
                style={[
                  styles.darkLuxuryBalanceCard,
                  (isAiMode || isAiThinking) && {
                    shadowColor: theme.isDark ? "#FFFFFF" : "#000000",
                    shadowOpacity: isAiThinking ? 0.8 : 0.45,
                    shadowRadius: isAiThinking ? 16 : 12,
                  },
                ]}
              >
                <View style={styles.balanceTopRow}>
                  <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <Text style={[styles.balanceSubLabel, { marginBottom: 0 }]}>Parking Balance</Text>
                      <View style={styles.hourlyRatePill}>
                        <Text style={styles.hourlyRatePillText}>
                          {activeTicket.hourlyRate || 300} RWF/hr
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={styles.balanceNumber}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {((activeTicket.durationHours || 1) * (activeTicket.hourlyRate || 300)).toLocaleString()} RWF
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.balancePlusBtn} onPress={handleTopUpWallet} activeOpacity={0.8}>
                    <Ionicons name="add" size={20} color="#09090B" />
                  </TouchableOpacity>
                </View>

                {/* Embossed Watermark P */}
                <View style={styles.watermarkLetterBox} pointerEvents="none">
                  <Text style={styles.watermarkLetter}>P</Text>
                </View>

                {/* Parking Tracker Divider */}
                <View style={styles.balanceDivider} />

                {/* Active Session Info Header */}
                <View style={styles.activeSessionInfoRow}>
                  <View style={styles.activeSessionInfoLeft}>
                    <Ionicons name="car-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.activeSessionSpotText} numberOfLines={1}>
                      Spot {activeTicket.spaceNumber} • {activeTicket.locationName}
                    </Text>
                  </View>
                  <View style={styles.activeSessionDurationPill}>
                    <Ionicons name="time-outline" size={11} color="#FFFFFF" />
                    <Text style={styles.activeSessionDurationText}>
                      {activeTicket.durationHours}h Booked
                    </Text>
                  </View>
                </View>

                {/* Municipal Contravention Fine Warning Banner */}
                {activeTicket.violationFine ? (
                  <View style={styles.contraventionFineBanner}>
                    <Ionicons name="warning" size={15} color="#EF4444" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contraventionFineTitle}>
                        MUNICIPAL FINE: +{activeTicket.violationFine.toLocaleString()} RWF
                      </Text>
                      <Text style={styles.contraventionFineSub}>
                        {activeTicket.violationReason || "Unauthorized vehicle in restricted parking facility"}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <View style={styles.balanceTrackerRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.liveBlinkingDot, { backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B" }]} />
                    <Text style={styles.trackerLabel}>Parking Tracker</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.trackerDigits}>{formatTimerDigits(elapsedSeconds)}</Text>
                    <Text style={[styles.trackerCountdownText, { color: isOverdue ? "#FFFFFF" : "#A1A1AA" }]}>
                      {isOverdue
                        ? `Overdue +${formatTimerDigits(elapsedSeconds - totalParkingSeconds)}`
                        : `${formatTimerDigits(remainingSeconds)} remaining`}
                    </Text>
                  </View>
                </View>

                {/* Progress Track Bar */}
                <View style={styles.trackerProgressBarBg}>
                  <View
                    style={[
                      styles.trackerProgressBarActive,
                      {
                        width: `${progressPercent}%`,
                        backgroundColor: isOverdue ? "#EF4444" : "#FFFFFF",
                      },
                    ]}
                  />
                </View>

                {/* Action Buttons: Extend and End Session */}
                <View style={styles.trackerActionButtonsRow}>
                  <TouchableOpacity
                    style={styles.trackerActionBtnSecondary}
                    onPress={() => handleExtendParkingTime(1)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.trackerActionBtnSecondaryText}>+1 Hour</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.trackerActionBtnPrimary}
                    onPress={handleEndParkingSession}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="log-out-outline" size={14} color="#09090B" />
                    <Text style={styles.trackerActionBtnPrimaryText}>
                      {isOverdue ? "Pay Overdue & Close" : "Close Booking"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </AnimatedBwGradientCard>
            ) : null}



            {/* PARKING NEARBY SECTION (Matches middle screen in user screenshot) */}
            {/* PARKING NEARBY / RECOMMENDED PARKING AREAS SECTION */}
            <View style={styles.nearbySectionHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={[styles.nearbySectionTitle, { color: theme.text }]}>
                  {isAiThinking
                    ? "AI Analyzing parking areas..."
                    : isAiMode
                      ? "Recommended parking areas"
                      : "Parking nearby"}
                </Text>
                {isAiThinking ? (
                  <View
                    style={[
                      styles.aiAreaBadge,
                      {
                        backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B",
                      },
                    ]}
                  >
                    <ActivityIndicator size="small" color={theme.isDark ? "#09090B" : "#FFFFFF"} style={{ transform: [{ scale: 0.65 }] }} />
                    <Text style={[styles.aiAreaBadgeText, { color: theme.isDark ? "#09090B" : "#FFFFFF" }]}>
                      DECIDING...
                    </Text>
                  </View>
                ) : isAiMode ? (
                  <View
                    style={[
                      styles.aiAreaBadge,
                      {
                        backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B",
                      },
                    ]}
                  >
                    <Ionicons name="sparkles" size={10} color={theme.isDark ? "#09090B" : "#FFFFFF"} />
                    <Text style={[styles.aiAreaBadgeText, { color: theme.isDark ? "#09090B" : "#FFFFFF" }]}>
                      AI MATCHED
                    </Text>
                  </View>
                ) : null}
              </View>
              <TouchableOpacity
                style={[styles.viewOnMapPillBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setShowMapView(!showMapView)}
                activeOpacity={0.8}
              >
                <Text style={[styles.viewOnMapPillText, { color: theme.text }]}>
                  {showMapView ? "Hide map" : "View on map"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Horizontal Zone Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.zonePillsScroll}
            >
              {["All zones", "Zone A", "Zone B", "Zone C", "Zone D", "Zone E"].map((zone) => {
                const isActive = activeZoneFilter === zone;
                return (
                  <TouchableOpacity
                    key={zone}
                    style={[
                      styles.zonePillChip,
                      {
                        backgroundColor: "transparent",
                        borderColor: isActive ? theme.text : theme.border,
                        borderWidth: isActive ? 2 : 1,
                      },
                    ]}
                    onPress={() => setActiveZoneFilter(zone)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.zonePillChipText,
                        {
                          color: isActive ? theme.text : theme.textSecondary,
                          fontWeight: isActive ? "800" : "600",
                        },
                      ]}
                    >
                      {zone}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* AI Recommendation Context Subtitle */}
            {(isAiMode || isAiThinking) && (
              <View style={styles.aiRecommendedSubtitleRow}>
                {isAiThinking ? (
                  <ActivityIndicator size="small" color={theme.text} style={{ transform: [{ scale: 0.75 }] }} />
                ) : (
                  <Ionicons name="sparkles" size={12} color={theme.text} />
                )}
                <Text style={[styles.aiRecommendedSubtitleText, { color: theme.textSecondary }]}>
                  {isAiThinking
                    ? `AI thinking & analyzing ${selectedVehicle?.model || "your vehicle"} specs to optimize balances...`
                    : `Tuned for ${selectedVehicle?.model || "your vehicle"} • Target ≤ ${previousAverageRate} RWF/hr`}
                </Text>
              </View>
            )}

            {/* Horizontal Parking Nearby Cards OR Professional Empty State Card */}
            {displayedParkingLocations.length === 0 ? (
              <View
                style={[
                  styles.emptyFilteredStateCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    shadowColor: theme.cardShadow,
                  },
                ]}
              >
                {/* Concentric Icon Halo */}
                <View
                  style={[
                    styles.emptyStateIconHalo,
                    {
                      backgroundColor: theme.isDark
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(9, 9, 11, 0.04)",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.emptyStateIconCore,
                      {
                        backgroundColor: theme.isDark ? "#27272A" : "#F4F4F6",
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={searchQuery ? "search-outline" : "location-outline"}
                      size={24}
                      color={theme.text}
                    />
                  </View>
                </View>

                {/* Title & Description */}
                <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
                  {searchQuery
                    ? `No results for "${searchQuery}"`
                    : `No parking lots in ${activeZoneFilter}`}
                </Text>
                <Text style={[styles.emptyStateSubtitle, { color: theme.textSecondary }]}>
                  {searchQuery
                    ? `We couldn't find any parking facilities matching "${searchQuery}" in ${activeZoneFilter}. Try adjusting your keywords or clearing the search.`
                    : `There are currently no active parking facilities registered in ${activeZoneFilter}. Switch zones or clear filters to view nearby lots.`}
                </Text>

                {/* Action Buttons */}
                <View style={styles.emptyStateActionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.emptyStatePrimaryBtn,
                      {
                        backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B",
                      },
                    ]}
                    onPress={() => {
                      setActiveZoneFilter("All zones");
                      setSearchQuery("");
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={15}
                      color={theme.isDark ? "#09090B" : "#FFFFFF"}
                    />
                    <Text
                      style={[
                        styles.emptyStatePrimaryBtnText,
                        { color: theme.isDark ? "#09090B" : "#FFFFFF" },
                      ]}
                    >
                      Reset All Filters
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.emptyStateSecondaryBtn,
                      {
                        backgroundColor: theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setShowMapView(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="map-outline" size={15} color={theme.text} />
                    <Text
                      style={[
                        styles.emptyStateSecondaryBtnText,
                        { color: theme.text },
                      ]}
                    >
                      View Map
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Quick Jump Suggestions */}
                {activeZoneFilter !== "All zones" && (
                  <View style={styles.emptyStateQuickJumpBox}>
                    <Text style={[styles.emptyStateQuickJumpLabel, { color: theme.textMuted }]}>
                      Try exploring:
                    </Text>
                    <View style={styles.emptyStateChipsRow}>
                      {["All zones", "Zone A", "Zone C"].map((suggestedZone) => (
                        <TouchableOpacity
                          key={suggestedZone}
                          style={[
                            styles.emptyStateChipPill,
                            {
                              backgroundColor: theme.background,
                              borderColor: theme.border,
                            },
                          ]}
                          onPress={() => {
                            setActiveZoneFilter(suggestedZone);
                            setSearchQuery("");
                          }}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.emptyStateChipText, { color: theme.text }]}>
                            {suggestedZone}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.nearbyHorizontalCardsScroll}
              >
                {displayedParkingLocations.map((loc, cardIndex) => {
                  const isEvLot = Boolean(loc.is_electric_station);
                  const isHcLot = Boolean(loc.is_handicap_facility);
                  const isLotDisabled = (isEvLot && !isVehicleElectric) || (isHcLot && !isVehicleHandicap);
                  const bwBorderColor = theme.isDark
                    ? AI_BW_BORDER_COLORS_DARK[cardIndex % AI_BW_BORDER_COLORS_DARK.length]
                    : AI_BW_BORDER_COLORS_LIGHT[cardIndex % AI_BW_BORDER_COLORS_LIGHT.length];

                  return (
                    <AnimatedBwGradientCard
                      key={loc.id}
                      active={isAiMode || isAiThinking}
                      isThinking={isAiThinking}
                      borderRadius={18}
                      borderWidth={2}
                      animValue={aiBorderRotateAnim}
                      colorAnimValue={aiBorderColorAnim}
                      style={[
                        styles.nearbyScreenshotCard,
                        {
                          backgroundColor: theme.surface,
                          borderColor: (isAiMode || isAiThinking)
                            ? "transparent"
                            : isLotDisabled
                              ? "rgba(239, 68, 68, 0.45)"
                              : theme.border,
                          borderWidth: (isAiMode || isAiThinking) ? 0 : 1,
                          shadowColor: (isAiMode || isAiThinking)
                            ? (theme.isDark ? "#FFFFFF" : "#000000")
                            : theme.cardShadow,
                          shadowOpacity: isAiThinking ? 0.65 : (isAiMode ? 0.35 : 0.08),
                          shadowRadius: isAiThinking ? 14 : (isAiMode ? 10 : 4),
                          opacity: isLotDisabled ? 0.7 : 1,
                        },
                      ]}
                      onPress={() => {
                        if (isLotDisabled) {
                          Alert.alert(
                            "Restricted Parking Facility",
                            `This parking facility (${loc.name}) is strictly reserved for ${isEvLot ? "Electric Vehicles (EV)" : "Handicap Permit Holders"}.\n\nUnauthorized parking here incurs an immediate ${isEvLot ? "5,000 RWF" : "10,000 RWF"} Municipal Contravention Fine.\n\nDo you want to proceed and view lots?`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Proceed (Fine Applies)",
                                style: "destructive",
                                onPress: () => {
                                  setSelectedParkForSheet(loc);
                                  setSelectedSheetZone(loc.zone_code || (activeZoneFilter !== "All zones" ? activeZoneFilter : "Zone C"));
                                  setSelectedSheetBay("127");
                                },
                              },
                            ]
                          );
                        } else {
                          setSelectedParkForSheet(loc);
                          setSelectedSheetZone(loc.zone_code || (activeZoneFilter !== "All zones" ? activeZoneFilter : "Zone C"));
                          setSelectedSheetBay("127");
                        }
                      }}
                      activeOpacity={0.88}
                    >
                      <View style={styles.nearbyCardImgContainer}>
                        <Image
                          source={{ uri: LOCATION_IMAGES[loc.id] || DEFAULT_PARKING_IMAGE }}
                          style={styles.nearbyScreenshotCardImg}
                        />
                        {/* Free Places Badge on Image */}
                        <View style={styles.freePlacesBadge}>
                          <Text style={styles.freePlacesBadgeText}>
                            {loc.available_spots || 24} free places
                          </Text>
                        </View>
                        {/* Zone Badge on Image */}
                        {loc.zone_code && (
                          <View style={styles.cardZoneBadge}>
                            <Text style={styles.cardZoneBadgeText}>{loc.zone_code}</Text>
                          </View>
                        )}
                        {/* EV Charging Station Badge */}
                        {isEvLot && (
                          <View style={[styles.cardEvStationBadge, isLotDisabled && { backgroundColor: "rgba(239, 68, 68, 0.9)" }]}>
                            <Ionicons name={isLotDisabled ? "lock-closed" : "flash"} size={10} color="#FFFFFF" />
                            <Text style={[styles.cardEvStationBadgeText, { color: "#FFFFFF" }]}>
                              {isLotDisabled ? "EV ONLY • DISABLED" : "EV ONLY"}
                            </Text>
                          </View>
                        )}
                        {/* Handicap Accessible Facility Badge */}
                        {isHcLot && (
                          <View style={[styles.cardEvStationBadge, { backgroundColor: isLotDisabled ? "rgba(239, 68, 68, 0.9)" : "rgba(59, 130, 246, 0.9)" }]}>
                            <Ionicons name={isLotDisabled ? "lock-closed" : "body"} size={10} color="#FFFFFF" />
                            <Text style={[styles.cardEvStationBadgeText, { color: "#FFFFFF" }]}>
                              {isLotDisabled ? "ACCESSIBLE • DISABLED" : "ACCESSIBLE ONLY"}
                            </Text>
                          </View>
                        )}
                        {/* Black and White AI Match Badge on Image */}
                        {isAiMode && (
                          <View
                            style={[
                              styles.geminiCardAiBadge,
                              {
                                backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B",
                                borderColor: theme.isDark ? "#09090B" : "#FFFFFF",
                                borderWidth: 1,
                              },
                            ]}
                          >
                            <Ionicons name="sparkles" size={10} color={theme.isDark ? "#09090B" : "#FFFFFF"} />
                            <Text style={[styles.geminiCardAiBadgeText, { color: theme.isDark ? "#09090B" : "#FFFFFF" }]}>
                              {cardIndex === 0
                                ? "TOP AI PICK • BEST VALUE"
                                : loc.hourly_rate <= previousAverageRate
                                  ? "CHEAPER THAN USUAL"
                                  : "AI MATCH"}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.nearbyCardInfoBox}>
                        <Text style={[styles.nearbyCardName, { color: theme.text }]} numberOfLines={1}>
                          {loc.name}
                        </Text>
                        <Text style={[styles.nearbyCardAddressText, { color: theme.textSecondary }]} numberOfLines={1}>
                          {loc.address}
                        </Text>
                        <Text style={[styles.nearbyCardRateText, { color: theme.text }]}>
                          {loc.hourly_rate} RWF/hour
                        </Text>
                        {/* AI Mode Cheap Balances & Savings Breakdown */}
                        {isAiMode && (
                          <View style={styles.aiBalanceEstimatedRow}>
                            <View
                              style={[
                                styles.aiBalancePill,
                                {
                                  backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(9, 9, 11, 0.06)",
                                  borderColor: theme.border,
                                },
                              ]}
                            >
                              <Ionicons name="wallet-outline" size={11} color={theme.text} />
                              <Text style={[styles.aiBalancePillText, { color: theme.text }]}>
                                AI 2h Bal: {(loc.hourly_rate * 2).toLocaleString()} RWF
                              </Text>
                            </View>
                            {loc.hourly_rate < previousAverageRate && (
                              <View
                                style={[
                                  styles.aiSavingsTag,
                                  {
                                    backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(9, 9, 11, 0.04)",
                                    borderColor: theme.border,
                                  },
                                ]}
                              >
                                <Text style={[styles.aiSavingsTagText, { color: theme.textSecondary }]}>
                                  Save {((previousAverageRate - loc.hourly_rate) * 2).toLocaleString()} RWF
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                        {isEvLot && isVehicleElectric && (
                          <View style={styles.evRecommendedPill}>
                            <Text style={styles.evRecommendedPillText}>Recommended for your EV</Text>
                          </View>
                        )}
                        {isLotDisabled && (
                          <View style={[styles.evRecommendedPill, { backgroundColor: "rgba(239, 68, 68, 0.12)", borderColor: "rgba(239, 68, 68, 0.3)" }]}>
                            <Text style={[styles.evRecommendedPillText, { color: "#EF4444" }]}>
                              {isEvLot ? "+5,000 RWF Fine for Non-EV" : "+10,000 RWF Fine without Permit"}
                            </Text>
                          </View>
                        )}
                      </View>
                    </AnimatedBwGradientCard>
                  );
                })}
              </ScrollView>
            )}

            {/* DEDICATED EV CHARGING STATIONS SECTION */}
            <AnimatedBwGradientCard
              active={isAiMode || isAiThinking}
              isThinking={isAiThinking}
              borderRadius={18}
              borderWidth={2}
              animValue={aiBorderRotateAnim}
              colorAnimValue={aiBorderColorAnim}
              style={[
                styles.evGatewayCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: (isAiMode || isAiThinking) ? "transparent" : theme.border,
                  borderWidth: (isAiMode || isAiThinking) ? 0 : 1,
                  shadowColor: (isAiMode || isAiThinking) ? (theme.isDark ? "#FFFFFF" : "#000000") : undefined,
                  shadowOpacity: isAiThinking ? 0.65 : (isAiMode ? 0.35 : undefined),
                  shadowRadius: isAiThinking ? 14 : (isAiMode ? 10 : undefined),
                },
              ]}
            >
              <View style={styles.evGatewayContentRow}>
                <View style={styles.evGatewayIconBox}>
                  <Ionicons name="flash" size={20} color="#10B981" />
                </View>
                <View style={styles.evGatewayTextCol}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[styles.evGatewayTitle, { color: theme.text }]}>
                      {isVehicleElectric ? "⚡ EV Mode: All Parkings Available" : "EV Charging Stations"}
                    </Text>
                    <View style={styles.evPillBadge}>
                      <Text style={styles.evPillBadgeText}>{isVehicleElectric ? "All Access" : "EV Only"}</Text>
                    </View>
                  </View>
                  <Text style={[styles.evGatewaySubtitle, { color: theme.textSecondary }]} numberOfLines={2}>
                    {isVehicleElectric
                      ? `Your vehicle is electric! All standard parking lots and high-speed EV charging stations are recommended and open for you.`
                      : `Your current vehicle is non-electric. Standard parking lots are displayed; electric parking stations are reserved for electric cars.`}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.evGatewayActionBtn}
                onPress={() => router.push("/(tabs)/ev_chargers")}
                activeOpacity={0.85}
              >
                <Text style={styles.evGatewayActionText}>
                  {isVehicleElectric ? "Explore 150 kW Fast Chargers" : "View EV Stations Directory"}
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#09090B" />
              </TouchableOpacity>
            </AnimatedBwGradientCard>

            {/* RECENT PARKING SECTION (Matches middle screen in user screenshot) */}
            <View style={styles.recentSectionHeader}>
              <Text style={[styles.recentSectionTitle, { color: theme.text }]}>Recent parking</Text>
              <TouchableOpacity
                style={[styles.seeAllPillBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => router.push("/recent_parkings")}
                activeOpacity={0.8}
              >
                <Text style={[styles.seeAllPillText, { color: theme.text }]}>See all</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Parking List */}
            <View style={styles.recentListContainer}>
              {filteredRecentParkings.length === 0 ? (
                <View style={[styles.emptyRecentBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.emptyRecentText, { color: theme.textSecondary }]}>
                    No recent parking records matching "{searchQuery}".
                  </Text>
                </View>
              ) : (
                filteredRecentParkings.map((item, index) => {
                  const bwRecentBorder = theme.isDark
                    ? AI_BW_BORDER_COLORS_DARK[index % AI_BW_BORDER_COLORS_DARK.length]
                    : AI_BW_BORDER_COLORS_LIGHT[index % AI_BW_BORDER_COLORS_LIGHT.length];
                  return (
                    <AnimatedBwGradientCard
                      key={item.id}
                      active={isAiMode || isAiThinking}
                      isThinking={isAiThinking}
                      borderRadius={16}
                      borderWidth={1.5}
                      animValue={aiBorderRotateAnim}
                      colorAnimValue={aiBorderColorAnim}
                      style={[
                        styles.recentParkCard,
                        {
                          backgroundColor: theme.surface,
                          borderColor: (isAiMode || isAiThinking) ? "transparent" : theme.border,
                          borderWidth: (isAiMode || isAiThinking) ? 0 : 1,
                          shadowColor: (isAiMode || isAiThinking) ? (theme.isDark ? "#FFFFFF" : "#000000") : theme.cardShadow,
                          shadowOpacity: isAiThinking ? 0.5 : (isAiMode ? 0.3 : undefined),
                          shadowRadius: isAiThinking ? 12 : (isAiMode ? 8 : undefined),
                        },
                      ]}
                      onPress={() => {
                        router.push({
                          pathname: "/parking_session",
                          params: {
                            id: item.id,
                            name: item.name,
                            address: item.address,
                            bayNumber: item.bayNumber,
                            zoneCode: item.zoneCode,
                            plate: item.plate,
                            date: item.date,
                            duration: item.duration,
                            cost: item.cost.toString(),
                            currency: item.currency,
                            status: item.status,
                            receiptNumber: item.receiptNumber,
                            violationFine: item.violationFine ? item.violationFine.toString() : "",
                            violationReason: item.violationReason || "",
                          },
                        });
                      }}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: item.image }} style={styles.recentParkImg} />
                      <View style={styles.recentParkInfoCol}>
                        <Text style={[styles.recentParkTitle, { color: theme.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.recentParkAddr, { color: theme.textSecondary }]} numberOfLines={1}>
                          {item.address}
                        </Text>
                        <View style={styles.recentStatusBadge}>
                          <Text style={styles.recentStatusBadgeText}>{item.status}</Text>
                        </View>
                      </View>
                    </AnimatedBwGradientCard>
                  );
                })
              )}
            </View>
          </ScrollView>
        )}

        {/* FULL SCREEN NOTIFICATIONS MODAL */}
        <Modal
          visible={notificationsModalVisible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setNotificationsModalVisible(false)}
        >
          <SafeAreaView
            style={[styles.notificationsFullScreenContainer, { backgroundColor: theme.background }]}
            edges={["top", "bottom"]}
          >
            {/* Header */}
            <View
              style={[
                styles.notifTopBar,
                {
                  borderBottomColor: theme.border,
                  paddingTop: Math.max(insets.top, Platform.OS === "ios" ? 54 : 24) + 6,
                  paddingBottom: 14,
                },
              ]}
            >
              <View style={styles.notifHeaderLeftCol}>
                <TouchableOpacity
                  style={[styles.circularNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setNotificationsModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={20} color={theme.text} />
                </TouchableOpacity>

                <View style={styles.notifTitleBadgeGroup}>
                  <Text style={[styles.notifHeaderTitle, { color: theme.text }]}>Notifications</Text>
                  {unreadNotifsCount > 0 && (
                    <View style={[styles.notifUnreadBadge, { backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B" }]}>
                      <Text style={[styles.notifUnreadBadgeText, { color: theme.isDark ? "#09090B" : "#FFFFFF" }]}>
                        {unreadNotifsCount} New
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {unreadNotifsCount > 0 ? (
                <TouchableOpacity
                  style={[
                    styles.notifMarkAllBtn,
                    {
                      backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(9, 9, 11, 0.05)",
                      borderColor: theme.border,
                    },
                  ]}
                  onPress={handleMarkAllNotifsAsRead}
                  activeOpacity={0.75}
                >
                  <Ionicons name="checkmark-done" size={14} color={theme.text} style={{ marginRight: 4 }} />
                  <Text style={[styles.notifMarkAllText, { color: theme.text }]}>Mark all read</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.circularNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setNotificationsModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter Pills */}
            <View style={styles.notifFiltersContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.notifFiltersScroll}>
                {(["All", "Parking", "AI Radar", "Billing", "System"] as const).map((cat) => {
                  const isActive = notifFilter === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.notifFilterChip,
                        {
                          backgroundColor: isActive ? (theme.isDark ? "#FFFFFF" : "#09090B") : theme.surface,
                          borderColor: isActive ? (theme.isDark ? "#FFFFFF" : "#09090B") : theme.border,
                        },
                      ]}
                      onPress={() => setNotifFilter(cat)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.notifFilterChipText,
                          { color: isActive ? (theme.isDark ? "#09090B" : "#FFFFFF") : theme.textSecondary },
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Notifications List */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.notifListContent}
              showsVerticalScrollIndicator={false}
            >
              {filteredNotifications.length === 0 ? (
                <View style={styles.notifEmptyStateContainer}>
                  <View style={[styles.notifEmptyIconBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Ionicons name="notifications-off-outline" size={32} color={theme.textSecondary} />
                  </View>
                  <Text style={[styles.notifEmptyTitle, { color: theme.text }]}>No Notifications</Text>
                  <Text style={[styles.notifEmptySub, { color: theme.textSecondary }]}>
                    You don't have any notifications in "{notifFilter}" right now.
                  </Text>
                </View>
              ) : (
                filteredNotifications.map((notif) => {
                  return (
                    <View
                      key={notif.id}
                      style={[
                        styles.notifCard,
                        {
                          backgroundColor: theme.surface,
                          borderColor: notif.read ? theme.border : (theme.isDark ? "#FFFFFF" : "#09090B"),
                          borderWidth: notif.read ? 1 : 1.5,
                          shadowColor: theme.cardShadow,
                        },
                      ]}
                    >
                      <View style={styles.notifCardTopRow}>
                        <View
                          style={[
                            styles.notifIconCircle,
                            {
                              backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                              borderColor: theme.border,
                            },
                          ]}
                        >
                          <Ionicons name={notif.icon} size={18} color={theme.text} />
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <Text style={[styles.notifCategoryTag, { color: theme.textSecondary }]}>
                              {notif.category} • {notif.timestamp}
                            </Text>
                            {!notif.read && (
                              <View style={[styles.notifUnreadDot, { backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B" }]} />
                            )}
                          </View>
                          <Text style={[styles.notifTitle, { color: theme.text }]} numberOfLines={1}>
                            {notif.title}
                          </Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => handleDismissNotification(notif.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close" size={16} color={theme.textMuted} />
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.notifMessage, { color: theme.textSecondary }]}>
                        {notif.message}
                      </Text>

                      {notif.actionText && (
                        <View style={styles.notifActionRow}>
                          <TouchableOpacity
                            style={[
                              styles.notifActionBtn,
                              {
                                backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B",
                              },
                            ]}
                            onPress={() => handleNotificationAction(notif)}
                            activeOpacity={0.8}
                          >
                            <Text
                              style={[
                                styles.notifActionBtnText,
                                { color: theme.isDark ? "#09090B" : "#FFFFFF" },
                              ]}
                            >
                              {notif.actionText}
                            </Text>
                            <Ionicons
                              name="arrow-forward"
                              size={12}
                              color={theme.isDark ? "#09090B" : "#FFFFFF"}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* AUX MODAL: QR SCANNER */}
        <Modal visible={qrModalVisible} animationType="slide" transparent onRequestClose={() => setQrModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContentBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitleText, { color: theme.text }]}>Scan Bay Token</Text>
                <TouchableOpacity onPress={() => setQrModalVisible(false)}>
                  <Ionicons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="Enter Bay Code (e.g. A15, 127)"
                placeholderTextColor={theme.textMuted}
                value={manualQrCode}
                onChangeText={setManualQrCode}
              />
              <TouchableOpacity
                style={[styles.fullWidthPillBtn, { backgroundColor: theme.primaryBtnBg, marginTop: 12 }]}
                onPress={() => {
                  setQrModalVisible(false);
                  setViewMode("slot_selection");
                }}
              >
                <Text style={[styles.fullWidthPillBtnText, { color: theme.primaryBtnText }]}>Proceed to Spot</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* AUX MODAL: AGENT AUDIT */}
        <Modal visible={agentModalVisible} animationType="slide" transparent onRequestClose={() => setAgentModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalContentBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalTitleText, { color: theme.text }]}>Marshal Audit Mode</Text>
                <TouchableOpacity onPress={() => setAgentModalVisible(false)}>
                  <Ionicons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.modalInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="Scan vehicle plate (e.g. RAD 245 B)"
                placeholderTextColor={theme.textMuted}
                value={agentPlateInput}
                onChangeText={setAgentPlateInput}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[styles.fullWidthPillBtn, { backgroundColor: theme.primaryBtnBg, marginTop: 12 }]}
                onPress={handleAgentAuditSearch}
              >
                <Text style={[styles.fullWidthPillBtnText, { color: theme.primaryBtnText }]}>Verify Plate</Text>
              </TouchableOpacity>
              {agentSearching ? (
                <View style={{ paddingVertical: 20, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={theme.text} />
                  <Text style={{ marginTop: 8, fontSize: 12, color: theme.textSecondary }}>
                    Verifying plate against blind index HMAC-SHA256...
                  </Text>
                </View>
              ) : agentAudit ? (
                <View
                  style={[
                    styles.auditResultBox,
                    {
                      backgroundColor: theme.background,
                      borderColor:
                        agentAudit.status === "PAID"
                          ? "#22C55E"
                          : agentAudit.status === "GRACE_BUFFER"
                            ? "#0284C7"
                            : agentAudit.status === "OVERDUE"
                              ? "#F59E0B"
                              : "#EF4444",
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  {/* Status Badge */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 12,
                        backgroundColor:
                          agentAudit.status === "PAID"
                            ? "rgba(34, 197, 94, 0.15)"
                            : agentAudit.status === "GRACE_BUFFER"
                              ? "rgba(2, 132, 199, 0.15)"
                              : agentAudit.status === "OVERDUE"
                                ? "rgba(245, 158, 11, 0.15)"
                                : "rgba(239, 68, 68, 0.15)",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "900",
                          letterSpacing: 0.5,
                          color:
                            agentAudit.status === "PAID"
                              ? "#22C55E"
                              : agentAudit.status === "GRACE_BUFFER"
                                ? "#0284C7"
                                : agentAudit.status === "OVERDUE"
                                  ? "#F59E0B"
                                  : "#EF4444",
                        }}
                      >
                        {agentAudit.status === "PAID"
                          ? "PAID • AUTHORIZED"
                          : agentAudit.status === "GRACE_BUFFER"
                            ? "GRACE BUFFER • 15M"
                            : agentAudit.status === "OVERDUE"
                              ? "OVERDUE INVOICE"
                              : "UNREGISTERED VEHICLE"}
                      </Text>
                    </View>

                    <Text style={{ fontSize: 13, fontWeight: "900", color: theme.text }}>
                      {agentAudit.masked_plate}
                    </Text>
                  </View>

                  {/* Details Breakdown */}
                  {agentAudit.status === "PAID" && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4 }}>
                        Vehicle has an active registered parking session.
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#22C55E" }}>
                        Zero Contact Mandate: Permitted action is NONE. Do not touch vehicle.
                      </Text>
                    </View>
                  )}

                  {agentAudit.status === "GRACE_BUFFER" && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4 }}>
                        15-minute arrival check-in window active ({Math.round((agentAudit.seconds_remaining || 600) / 60)}m left).
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#0284C7" }}>
                        Permitted action: NONE. Allow driver to complete parking session.
                      </Text>
                    </View>
                  )}

                  {agentAudit.status === "OVERDUE" && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 6 }}>
                        Prepaid parking expired. Overdue balance:{" "}
                        <Text style={{ fontWeight: "800", color: theme.text }}>
                          {(agentAudit.overdue_amount || 1200).toLocaleString()} RWF
                        </Text>
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.fullWidthPillBtn,
                          { backgroundColor: "#F59E0B", marginTop: 4 },
                        ]}
                        onPress={handleFlagOverdue}
                        disabled={isFlaggingOverdue}
                      >
                        <Text style={[styles.fullWidthPillBtnText, { color: "#000000" }]}>
                          {isFlaggingOverdue ? "Flagging..." : "Flag Overdue Invoice (MoMo Push)"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {agentAudit.status === "UNREGISTERED" && (
                    <View style={{ marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 6 }}>
                        Zero app check-in record found for this plate. Subject to municipal contravention.
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.fullWidthPillBtn,
                          { backgroundColor: "#EF4444", marginTop: 4 },
                        ]}
                        onPress={handleIssueCitation}
                        disabled={isIssuingFine}
                      >
                        <Text style={[styles.fullWidthPillBtnText, { color: "#FFFFFF" }]}>
                          {isIssuingFine ? "Issuing Citation..." : "Issue 3,000 RWF Citation (Irembo)"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        </Modal>
        {/* SPOT SELECTION BOTTOM SHEET (Matches left screen in screenshot) */}
        <Modal
          visible={!!selectedParkForSheet && !confirmBookingSheetVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedParkForSheet(null)}
        >
          <View style={styles.sheetModalBackdrop}>
            <View style={[styles.spotSelectionSheetBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {/* Header: Title, Address, Close X */}
              <View style={styles.sheetHeaderRow}>
                <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                  <Text style={[styles.sheetMainTitle, { color: theme.text }]} numberOfLines={1}>
                    {selectedParkForSheet?.name || "Kigali Marina Parking"}
                  </Text>
                  <Text style={[styles.sheetSubTitle, { color: theme.textSecondary }]} numberOfLines={1}>
                    {selectedParkForSheet?.address || "Courtyard Marina View Tower"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.circularCloseBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                  onPress={() => setSelectedParkForSheet(null)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* Zone Selector Pills */}
              <View style={styles.sheetZonePillsWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sheetZonePillsRow}
                >
                  {["Zone A", "Zone B", "Zone C", "Zone D", "Zone E"].map((zn) => {
                    const isSelected = selectedSheetZone === zn;
                    const isZoneDisabled = (zn === "Zone A" && !isVehicleElectric) || (zn === "Zone E" && !isVehicleHandicap);
                    return (
                      <TouchableOpacity
                        key={zn}
                        style={[
                          styles.sheetZonePill,
                          {
                            backgroundColor: "transparent",
                            borderColor: isSelected
                              ? theme.text
                              : isZoneDisabled
                                ? "rgba(239, 68, 68, 0.45)"
                                : theme.border,
                            borderWidth: isSelected ? 2 : 1,
                            opacity: isZoneDisabled ? 0.65 : 1,
                          },
                        ]}
                        onPress={() => {
                          if (isZoneDisabled) {
                            Alert.alert(
                              "Restricted Parking Zone",
                              `${zn} is strictly designated for ${zn === "Zone A" ? "Electric Vehicles (EV)" : "Handicap Permit Holders"}.\n\nNon-authorized parking in this zone incurs an immediate ${zn === "Zone A" ? "5,000 RWF" : "10,000 RWF"} Municipal Fine.\n\nDo you want to switch to this zone?`,
                              [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Select Zone (Fine Applies)",
                                  style: "destructive",
                                  onPress: () => handleSelectSheetZone(zn),
                                },
                              ]
                            );
                          } else {
                            handleSelectSheetZone(zn);
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          {isZoneDisabled && (
                            <Ionicons name="lock-closed" size={10} color="#EF4444" />
                          )}
                          <Text
                            style={[
                              styles.sheetZonePillText,
                              {
                                color: isSelected ? theme.text : isZoneDisabled ? "#EF4444" : theme.textSecondary,
                                fontWeight: isSelected ? "800" : "600",
                              },
                            ]}
                          >
                            {zn}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Zone Description Subheader (Omits KWs if not an EV charging facility) */}
              {(() => {
                const isEvLot = Boolean(selectedParkForSheet?.is_electric_station);
                const cleanTitle = isEvLot
                  ? currentSheetLot.title
                  : currentSheetLot.title
                    .replace(/Ultra-Fast Hub/gi, "Executive Parking")
                    .replace(/Charging Lot/gi, "Parking Area");
                const cleanDescription = isEvLot
                  ? currentSheetLot.description
                  : currentSheetLot.description
                    .replace(/equipped with \d+\s*kW DC hyperchargers/gi, "front-row bays near entrance")
                    .replace(/with \d+\s*kW fast plugs/gi, "with covered stalls")
                    .replace(/with \d+\s*kW AC stations &/gi, "with");

                return (
                  <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text }}>
                      {cleanTitle}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                      {cleanDescription}
                    </Text>
                  </View>
                );
              })()}

              {/* 2-Column Bays & Cars Grid */}
              <ScrollView style={styles.sheetBaysScroll} showsVerticalScrollIndicator={false}>
                {(() => {
                  const isEvLot = Boolean(selectedParkForSheet?.is_electric_station);
                  const formatSpotLabel = (rawType?: string) => {
                    if (isEvLot) return rawType || "Available";
                    if (!rawType) return "Available";
                    const sanitized = rawType
                      .replace(/\b\d+\s*k\s*w\b/gi, "")
                      .replace(/\b(ac|dc)\b/gi, "")
                      .replace(/Covered\s*/gi, "Covered")
                      .trim();
                    return sanitized || "Standard Bay";
                  };

                  return (
                    <View style={styles.sheetBaysTwoCols}>
                      {/* Column 1 */}
                      <View style={styles.sheetBayColumn}>
                        {currentSheetLot.leftColumn.map((spot) => {
                          if (spot.isOccupied) {
                            return (
                              <View key={spot.id} style={styles.occupiedBayGraphicCard}>
                                <HorizontalUltraRealisticCar color={spot.carColor} />
                              </View>
                            );
                          }
                          const isSelected = selectedSheetBay === spot.bayNumber;
                          const isEvSpot = selectedSheetZone === "Zone A" || spot.bayNumber.toLowerCase().startsWith("ev");
                          const isHcSpot = selectedSheetZone === "Zone E" || spot.bayNumber.toLowerCase().startsWith("h");
                          const isSpotDisabled = (isEvSpot && !isVehicleElectric) || (isHcSpot && !isVehicleHandicap);

                          return (
                            <TouchableOpacity
                              key={spot.id}
                              style={[
                                styles.bayAvailableCard,
                                {
                                  backgroundColor: "transparent",
                                  borderColor: isSelected
                                    ? theme.text
                                    : isSpotDisabled
                                      ? "rgba(239, 68, 68, 0.45)"
                                      : theme.border,
                                  borderWidth: isSelected ? 2.5 : 1,
                                  opacity: isSpotDisabled ? 0.55 : 1,
                                },
                              ]}
                              onPress={() => {
                                if (isSpotDisabled) {
                                  Alert.alert(
                                    "Restricted Bay Warning",
                                    `Bay ${spot.bayNumber} is an ${isEvSpot ? "EV" : "Accessible"} designated lot bay.\n\nNon-authorized parking incurs an immediate ${isEvSpot ? "5,000 RWF" : "10,000 RWF"} Municipal Fine.\n\nDo you want to select this bay?`,
                                    [
                                      { text: "Cancel", style: "cancel" },
                                      {
                                        text: "Select Bay (Fine Applies)",
                                        style: "destructive",
                                        onPress: () => setSelectedSheetBay(spot.bayNumber),
                                      },
                                    ]
                                  );
                                } else {
                                  setSelectedSheetBay(spot.bayNumber);
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.bayNumberBold, { color: theme.text }]}>
                                {spot.bayNumber}
                              </Text>
                              <Text style={[styles.bayStatusSub, { color: isSelected ? theme.text : theme.textSecondary }]}>
                                {formatSpotLabel(spot.spotType)}
                              </Text>
                              {isSpotDisabled && (
                                <View style={styles.disabledBayBadge}>
                                  <Ionicons name="lock-closed" size={8} color="#EF4444" />
                                  <Text style={styles.disabledBayBadgeText}>{isEvSpot ? "EV ONLY" : "PERMIT REQ"}</Text>
                                </View>
                              )}
                              {isSelected && (
                                <View style={[styles.selectedCheckDot, { backgroundColor: theme.text, top: 4, right: 4 }]}>
                                  <Ionicons name="checkmark" size={10} color={theme.background} />
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Column 2 */}
                      <View style={styles.sheetBayColumn}>
                        {currentSheetLot.rightColumn.map((spot) => {
                          if (spot.isOccupied) {
                            return (
                              <View key={spot.id} style={styles.occupiedBayGraphicCard}>
                                <HorizontalUltraRealisticCar color={spot.carColor} />
                              </View>
                            );
                          }
                          const isSelected = selectedSheetBay === spot.bayNumber;
                          const isEvSpot = selectedSheetZone === "Zone A" || spot.bayNumber.toLowerCase().startsWith("ev");
                          const isHcSpot = selectedSheetZone === "Zone E" || spot.bayNumber.toLowerCase().startsWith("h");
                          const isSpotDisabled = (isEvSpot && !isVehicleElectric) || (isHcSpot && !isVehicleHandicap);

                          return (
                            <TouchableOpacity
                              key={spot.id}
                              style={[
                                styles.bayAvailableCard,
                                {
                                  backgroundColor: "transparent",
                                  borderColor: isSelected
                                    ? theme.text
                                    : isSpotDisabled
                                      ? "rgba(239, 68, 68, 0.45)"
                                      : theme.border,
                                  borderWidth: isSelected ? 2.5 : 1,
                                  opacity: isSpotDisabled ? 0.55 : 1,
                                },
                              ]}
                              onPress={() => {
                                if (isSpotDisabled) {
                                  Alert.alert(
                                    "Restricted Bay Warning",
                                    `Bay ${spot.bayNumber} is an ${isEvSpot ? "EV" : "Accessible"} designated lot bay.\n\nNon-authorized parking incurs an immediate ${isEvSpot ? "5,000 RWF" : "10,000 RWF"} Municipal Fine.\n\nDo you want to select this bay?`,
                                    [
                                      { text: "Cancel", style: "cancel" },
                                      {
                                        text: "Select Bay (Fine Applies)",
                                        style: "destructive",
                                        onPress: () => setSelectedSheetBay(spot.bayNumber),
                                      },
                                    ]
                                  );
                                } else {
                                  setSelectedSheetBay(spot.bayNumber);
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.bayNumberBold, { color: theme.text }]}>
                                {spot.bayNumber}
                              </Text>
                              <Text style={[styles.bayStatusSub, { color: isSelected ? theme.text : theme.textSecondary }]}>
                                {formatSpotLabel(spot.spotType)}
                              </Text>
                              {isSpotDisabled && (
                                <View style={styles.disabledBayBadge}>
                                  <Ionicons name="lock-closed" size={8} color="#EF4444" />
                                  <Text style={styles.disabledBayBadgeText}>{isEvSpot ? "EV ONLY" : "PERMIT REQ"}</Text>
                                </View>
                              )}
                              {isSelected && (
                                <View style={[styles.selectedCheckDot, { backgroundColor: theme.text, top: 4, right: 4 }]}>
                                  <Ionicons name="checkmark" size={10} color={theme.background} />
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })()}
              </ScrollView>

              {/* Sticky Continue Button with Circle Arrow */}
              <TouchableOpacity
                style={styles.sheetContinueBtn}
                onPress={() => setConfirmBookingSheetVisible(true)}
                activeOpacity={0.88}
              >
                <Text style={styles.sheetContinueBtnText}>Continue</Text>
                <View style={styles.sheetContinueCircleArrow}>
                  <Ionicons name="arrow-forward" size={18} color="#09090B" />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* CONFIRM BOOKING BOTTOM SHEET (Matches right screen in screenshot) */}
        <Modal
          visible={confirmBookingSheetVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setConfirmBookingSheetVisible(false)}
        >
          <View style={styles.sheetModalBackdrop}>
            <View style={[styles.confirmSheetBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              {/* Top Handle Bar */}
              <View style={styles.confirmHandleBar} />

              {/* Header: Title, Subtitle, Close X */}
              <View style={styles.confirmHeaderRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.confirmHeaderTitle, { color: theme.text }]}>Confirm booking</Text>
                  <Text style={[styles.confirmHeaderSubtitle, { color: theme.textSecondary }]}>
                    {selectedParkForSheet?.name || "Kigali Marina Parking"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.circularCloseBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                  onPress={() => setConfirmBookingSheetVisible(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* Summary Boxes Row: Parking zone & Parking place */}
              <View style={styles.confirmSummaryRow}>
                <View style={[styles.confirmSummaryBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.confirmSummaryLabel, { color: theme.textSecondary }]}>Parking zone</Text>
                  <Text style={[styles.confirmSummaryValue, { color: theme.text }]}>{selectedSheetZone}</Text>
                </View>

                <View style={[styles.confirmSummaryBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Text style={[styles.confirmSummaryLabel, { color: theme.textSecondary }]}>Parking place</Text>
                  <Text style={[styles.confirmSummaryValue, { color: theme.text }]}>{selectedSheetBay}</Text>
                </View>
              </View>

              {/* Timeframe Selector Section */}
              <View style={styles.confirmTimeframeSection}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text style={[styles.confirmTimeframeLabel, { color: theme.textSecondary }]}>Select Timeframe</Text>
                  <View style={[styles.exitEstPill, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Ionicons name="time-outline" size={11} color={theme.text} />
                    <Text style={[styles.exitEstText, { color: theme.text }]}>
                      Exit ~ {new Date(Date.now() + durationHours * 3600 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>

                {/* Quick Hours Pills */}
                <View style={styles.timeframePillsRow}>
                  {[1, 2, 3, 4, 6, 8].map((h) => {
                    const isSelected = durationHours === h;
                    return (
                      <TouchableOpacity
                        key={h}
                        style={[
                          styles.timeframeChip,
                          {
                            backgroundColor: "transparent",
                            borderColor: isSelected ? theme.text : theme.border,
                            borderWidth: isSelected ? 2 : 1,
                          },
                        ]}
                        onPress={() => setDurationHours(h)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.timeframeChipText,
                            {
                              color: isSelected ? theme.text : theme.textSecondary,
                              fontWeight: isSelected ? "800" : "600",
                            },
                          ]}
                        >
                          {h}h
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Stepper with Duration & Cost Preview */}
                <View style={[styles.timeframeStepperRow, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <TouchableOpacity
                    style={styles.stepperActionBtn}
                    onPress={() => setDurationHours((prev) => Math.max(1, prev - 1))}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="remove" size={18} color={theme.text} />
                  </TouchableOpacity>

                  <View style={{ alignItems: "center" }}>
                    <Text style={[styles.stepperDurationText, { color: theme.text }]}>
                      {durationHours} {durationHours === 1 ? "Hour" : "Hours"}
                    </Text>
                    <Text style={[styles.stepperCostSubtext, { color: theme.textSecondary }]}>
                      Est. Total: {((selectedParkForSheet?.hourly_rate || 300) * durationHours).toLocaleString()} RWF
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.stepperActionBtn}
                    onPress={() => setDurationHours((prev) => prev + 1)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={18} color={theme.text} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Municipal Contravention Fine Warning Box (if applicable) */}
              {(() => {
                const isConfirmEv =
                  selectedSheetZone === "Zone A" ||
                  Boolean(selectedParkForSheet?.is_electric_station) ||
                  selectedSheetBay.toLowerCase().startsWith("ev");
                const isConfirmHc =
                  selectedSheetZone === "Zone E" ||
                  Boolean(selectedParkForSheet?.is_handicap_facility) ||
                  selectedSheetBay.toLowerCase().startsWith("h");
                const confirmFineAmount = (isConfirmEv && !isVehicleElectric) ? 5000 : (isConfirmHc && !isVehicleHandicap) ? 10000 : 0;
                const confirmFineReason = (isConfirmEv && !isVehicleElectric) ? "Unauthorized Non-EV in EV Bay" : (isConfirmHc && !isVehicleHandicap) ? "Unauthorized Vehicle in Accessible Bay" : "";
                const baseBookingCost = (selectedParkForSheet?.hourly_rate || 300) * durationHours;
                const totalBookingCost = baseBookingCost + confirmFineAmount;

                return (
                  <>
                    {confirmFineAmount > 0 && (
                      <View style={styles.sheetFineWarningBox}>
                        <Ionicons name="warning" size={18} color="#EF4444" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sheetFineWarningTitle}>
                            +{confirmFineAmount.toLocaleString()} RWF Municipal Fine Applied
                          </Text>
                          <Text style={styles.sheetFineWarningSub}>
                            {confirmFineReason}. Billed directly to session cost.
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Payment Section */}
                    <View style={styles.confirmPaymentSection}>
                      <Text style={[styles.confirmPaymentLabel, { color: theme.textSecondary }]}>Payment</Text>
                      <View style={[styles.confirmPaymentBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View style={styles.paymentCardGlyph}>
                            <View style={[styles.mastercardCircle, { backgroundColor: "#EF4444" }]} />
                            <View style={[styles.mastercardCircle, { backgroundColor: "#F59E0B", marginLeft: -8 }]} />
                          </View>
                          <Text style={[styles.paymentMethodText, { color: theme.text }]}>MasterCard ••••2456</Text>
                        </View>

                        <TouchableOpacity
                          style={[styles.paymentEditBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                          onPress={() =>
                            Alert.alert(
                              "Payment Methods",
                              "Default: MasterCard ••••2456\nAlternative: MTN Mobile Money (+250 788 ••• 12)\nAirtel Money"
                            )
                          }
                          activeOpacity={0.7}
                        >
                          <Ionicons name="pencil-outline" size={15} color={theme.text} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Bottom Row: Rate & Confirm Button */}
                    <View style={styles.confirmFooterRow}>
                      <View>
                        <Text style={[styles.confirmRateNumber, { color: theme.text }]}>
                          {totalBookingCost.toLocaleString()} RWF
                        </Text>
                        <Text style={[styles.confirmRateUnit, { color: theme.textSecondary }]}>
                          {confirmFineAmount > 0
                            ? `Base: ${baseBookingCost.toLocaleString()} + Fine: ${confirmFineAmount.toLocaleString()} RWF`
                            : `${durationHours}h @ ${selectedParkForSheet?.hourly_rate || 300} RWF/hr`}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[styles.confirmFinalBtn, confirmFineAmount > 0 && { backgroundColor: "#EF4444" }]}
                        onPress={handleConfirmSheetBooking}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.confirmFinalBtnText}>
                          {confirmFineAmount > 0 ? "Accept Fine & Start" : "Confirm & Start"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}
            </View>
          </View>
        </Modal>

        {/* CENTER MENU QR SCANNER CAMERA MODAL */}
        <Modal
          visible={qrScannerVisible}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setQrScannerVisible(false)}
        >
          <SafeAreaView style={styles.scannerFullscreen} edges={["top", "bottom"]}>
            {/* Top Scanner Controls */}
            <View style={styles.scannerTopHeader}>
              <TouchableOpacity
                style={styles.scannerCircleBtn}
                onPress={() => setQrScannerVisible(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={{ alignItems: "center" }}>
                <Text style={styles.scannerHeaderTitle}>Parking QR Scanner</Text>
                <Text style={styles.scannerHeaderSub}>Scan bay code to verify & book</Text>
              </View>

              <TouchableOpacity
                style={[styles.scannerCircleBtn, scannerTorch && { backgroundColor: "#FFFFFF" }]}
                onPress={() => setScannerTorch(!scannerTorch)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={scannerTorch ? "flash" : "flash-outline"}
                  size={20}
                  color={scannerTorch ? "#09090B" : "#FFFFFF"}
                />
              </TouchableOpacity>
            </View>

            {/* Camera Viewport */}
            <View style={styles.scannerCameraContainer}>
              {cameraPermission?.granted ? (
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  facing="back"
                  enableTorch={scannerTorch}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={scannedSpaceInfo ? undefined : handleBarcodeScanned}
                />
              ) : (
                <View style={styles.scannerPermissionBox}>
                  <Ionicons name="camera-outline" size={48} color="#A1A1AA" />
                  <Text style={styles.scannerPermissionText}>Camera access required to scan bay QR tokens</Text>
                  <TouchableOpacity
                    style={styles.scannerPermissionBtn}
                    onPress={requestCameraPermission}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.scannerPermissionBtnText}>Enable Camera</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Targeting Reticle Frame */}
              <View style={styles.reticleFrame} pointerEvents="none">
                <View style={[styles.reticleCorner, styles.reticleTopLeft]} />
                <View style={[styles.reticleCorner, styles.reticleTopRight]} />
                <View style={[styles.reticleCorner, styles.reticleBottomLeft]} />
                <View style={[styles.reticleCorner, styles.reticleBottomRight]} />
                <View style={styles.reticleCenterGlow} />
              </View>
            </View>

            {/* Quick-Scan Simulator Test Chips (Instant verification on any environment) */}
            <View style={styles.scannerSimChipsContainer}>
              <Text style={styles.scannerSimChipsLabel}>Quick-Test Simulator Scans:</Text>
              <View style={styles.scannerSimChipsRow}>
                {["127", "123", "131", "A15"].map((code) => (
                  <TouchableOpacity
                    key={code}
                    style={styles.scannerSimChip}
                    onPress={() => handleSimulateScan(code)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="qr-code" size={13} color="#FFFFFF" />
                    <Text style={styles.scannerSimChipText}>Bay {code}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Scanned Spot Info Card (Displayed when space scanned) */}
            {scannedSpaceInfo && (() => {
              const isEvSpot =
                scannedSpaceInfo.zoneName === "Zone A" ||
                scannedSpaceInfo.spaceNumber.toLowerCase().startsWith("ev") ||
                scannedSpaceInfo.locationName.toLowerCase().includes("ev");
              const isHandicapSpot =
                scannedSpaceInfo.zoneName === "Zone E" ||
                scannedSpaceInfo.spaceNumber.toLowerCase().startsWith("h") ||
                scannedSpaceInfo.locationName.toLowerCase().includes("accessible");
              const isScannedDisabled = (isEvSpot && !isVehicleElectric) || (isHandicapSpot && !isVehicleHandicap);
              const scanFine = (isEvSpot && !isVehicleElectric) ? 5000 : (isHandicapSpot && !isVehicleHandicap) ? 10000 : 0;
              const scanFineReason = (isEvSpot && !isVehicleElectric) ? "Unauthorized Non-EV in EV Bay" : (isHandicapSpot && !isVehicleHandicap) ? "Unauthorized Vehicle in Accessible Bay" : "";

              return (
                <View style={styles.scannedInfoCard}>
                  <View style={styles.scannedInfoTopRow}>
                    <View>
                      <Text style={styles.scannedSpotNumber}>Bay {scannedSpaceInfo.spaceNumber}</Text>
                      <Text style={styles.scannedSpotLocation}>
                        {scannedSpaceInfo.zoneName} • {scannedSpaceInfo.locationName}
                      </Text>
                    </View>
                    <View style={[styles.scannedStatusPill, isScannedDisabled && { backgroundColor: "rgba(239, 68, 68, 0.2)" }]}>
                      <Text style={[styles.scannedStatusPillText, isScannedDisabled && { color: "#EF4444" }]}>
                        {isScannedDisabled ? "RESTRICTED" : "Available"}
                      </Text>
                    </View>
                  </View>

                  {isScannedDisabled && (
                    <View style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", borderRadius: 10, padding: 8, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.3)" }}>
                      <Ionicons name="warning" size={16} color="#EF4444" />
                      <Text style={{ color: "#EF4444", fontSize: 11, fontWeight: "800", flex: 1 }}>
                        +{scanFine.toLocaleString()} RWF Municipal Fine Applied ({scanFineReason})
                      </Text>
                    </View>
                  )}

                  <View style={styles.scannedDetailsRow}>
                    <Text style={styles.scannedRateText}>{scannedSpaceInfo.hourlyRate} RWF / hour</Text>
                    <Text style={styles.scannedTokenText}>Code: {scannedSpaceInfo.token}</Text>
                  </View>

                  <View style={styles.scannedActionsRow}>
                    <TouchableOpacity
                      style={[styles.scannedParkNowBtn, { backgroundColor: isScannedDisabled ? "#EF4444" : "#FFFFFF" }]}
                      onPress={handleParkScannedSpot}
                      activeOpacity={0.88}
                    >
                      <Text style={[styles.scannedParkNowBtnText, { color: isScannedDisabled ? "#FFFFFF" : "#09090B" }]}>
                        {isScannedDisabled ? "Accept Fine & Park" : "Park Here & Start Tracker"}
                      </Text>
                      <Ionicons name="checkmark-circle" size={18} color={isScannedDisabled ? "#FFFFFF" : "#09090B"} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.scannedRescanBtn}
                      onPress={() => setScannedSpaceInfo(null)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.scannedRescanBtnText}>Scan Other</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}
          </SafeAreaView>
        </Modal>

        {/* ALL PARKING PLACES & EV STATIONS SYSTEM MAP MODAL (Full Edge-to-Edge Screenshot Layout) */}
        <Modal
          visible={showMapView}
          animationType="slide"
          onRequestClose={() => setShowMapView(false)}
        >
          <View style={[styles.screenWrapper, { backgroundColor: theme.background }]}>
            {/* Edge-to-Edge Map: Full Screen with rate bubbles, route polyline, and user radar */}
            <View style={StyleSheet.absoluteFillObject}>
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFillObject}
                initialRegion={KIGALI_REGION}
                showsUserLocation={false}
                customMapStyle={theme.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
              >
                {/* User Location Radar Marker */}
                <Marker coordinate={USER_COORDS} anchor={{ x: 0.5, y: 0.5 }}>
                  <View
                    style={[
                      styles.radarOuterCircle,
                      {
                        backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(9, 9, 11, 0.10)",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.radarInnerCircle,
                        {
                          backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(9, 9, 11, 0.22)",
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.userDotCenter,
                          {
                            backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B",
                            borderColor: theme.surface,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </Marker>

                {/* Stepped Dotted Route to Selected Location */}
                {selectedMapLocation && (
                  <>
                    <Polyline
                      coordinates={getSteppedRoute(USER_COORDS, {
                        latitude: Number(selectedMapLocation.latitude),
                        longitude: Number(selectedMapLocation.longitude),
                      })}
                      strokeColor={theme.isDark ? "#FFFFFF" : "#09090B"}
                      strokeWidth={3}
                      lineDashPattern={[6, 6]}
                    />
                    {/* Distance Badge Midway on Route */}
                    <Marker
                      coordinate={{
                        latitude: (USER_COORDS.latitude + Number(selectedMapLocation.latitude)) / 2,
                        longitude: (USER_COORDS.longitude + Number(selectedMapLocation.longitude)) / 2,
                      }}
                      anchor={{ x: 0.5, y: 0.5 }}
                    >
                      <View
                        style={[
                          styles.distanceBadgePill,
                          {
                            backgroundColor: theme.isDark ? "#18181B" : "#09090B",
                            borderColor: theme.border,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Text style={styles.distanceBadgeText}>0.5 km</Text>
                      </View>
                    </Marker>
                  </>
                )}

                {/* Rate Bubble Markers for All Parking Places in System (Filtered by vehicle eligibility) */}
                {(mapCategory === "all" || mapCategory === "car" || mapCategory === "truck" || mapCategory === "bike" || mapCategory === "bus") &&
                  eligibleLocations
                    .filter((loc) => {
                      if (!mapSearch) return true;
                      return (
                        loc.name.toLowerCase().includes(mapSearch.toLowerCase()) ||
                        loc.address.toLowerCase().includes(mapSearch.toLowerCase())
                      );
                    })
                    .map((loc) => {
                      const isSelected = selectedMapLocation?.id === loc.id;
                      return (
                        <Marker
                          key={loc.id}
                          coordinate={{ latitude: Number(loc.latitude), longitude: Number(loc.longitude) }}
                          onPress={() => setSelectedMapLocation(loc)}
                          anchor={{ x: 0.5, y: 1.0 }}
                        >
                          <View style={styles.markerContainer}>
                            <View
                              style={[
                                styles.rateBubble,
                                {
                                  backgroundColor: isSelected ? theme.pillActiveBg : theme.surface,
                                  borderColor: isSelected ? theme.pillActiveBg : theme.borderStrong,
                                  borderWidth: 1.5,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.rateBubbleText,
                                  {
                                    color: isSelected ? theme.pillActiveText : theme.text,
                                  },
                                ]}
                              >
                                {loc.hourly_rate || 300} RWF/h
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.pinStemDot,
                                {
                                  backgroundColor: isSelected ? theme.pillActiveBg : theme.textSecondary,
                                  borderColor: theme.surface,
                                },
                              ]}
                            />
                          </View>
                        </Marker>
                      );
                    })}

                {/* Rate Bubble Markers for EV Stations: ONLY shown if vehicle is electric */}
                {(mapCategory === "all" || mapCategory === "ev") && isVehicleElectric &&
                  FALLBACK_EV_STATIONS
                    .filter((ev) => {
                      if (!mapSearch) return true;
                      return (
                        ev.name.toLowerCase().includes(mapSearch.toLowerCase()) ||
                        ev.address.toLowerCase().includes(mapSearch.toLowerCase())
                      );
                    })
                    .map((ev) => {
                      const isSelected = selectedMapLocation?.id === ev.id;
                      const evAsLoc: ParkingLocation = {
                        id: ev.id,
                        name: ev.name,
                        address: ev.address,
                        city: "Kigali",
                        country: "Rwanda",
                        latitude: ev.latitude,
                        longitude: ev.longitude,
                        layout_topology: "perpendicular",
                        total_spots: ev.chargers.length * 2,
                        available_spots: ev.chargers.filter((c) => c.status === "available").length,
                        hourly_rate: 250,
                        daily_rate: 1500,
                        currency: "RWF",
                        qr_code_identifier: ev.id,
                        is_active: true,
                        status: "active",
                      };

                      return (
                        <Marker
                          key={`ev-${ev.id}`}
                          coordinate={{ latitude: ev.latitude, longitude: ev.longitude }}
                          onPress={() => setSelectedMapLocation(evAsLoc)}
                          anchor={{ x: 0.5, y: 1.0 }}
                        >
                          <View style={styles.markerContainer}>
                            <View
                              style={[
                                styles.rateBubble,
                                {
                                  backgroundColor: isSelected ? theme.pillActiveBg : theme.surface,
                                  borderColor: isSelected ? theme.pillActiveBg : theme.borderStrong,
                                  borderWidth: 1.5,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.rateBubbleText,
                                  {
                                    color: isSelected ? theme.pillActiveText : theme.text,
                                  },
                                ]}
                              >
                                {ev.tariff.replace(" RWF/kWh", " R/kWh")}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.pinStemDot,
                                {
                                  backgroundColor: isSelected ? theme.pillActiveBg : theme.textSecondary,
                                  borderColor: theme.surface,
                                },
                              ]}
                            />
                          </View>
                        </Marker>
                      );
                    })}
              </MapView>
            </View>

            {/* Floating Top Search Bar + Vehicle Filter Pills (Snug to Status Bar in App Colors) */}
            <View
              style={[
                styles.floatingTopContainer,
                {
                  top: insets.top > 0 ? insets.top : (Platform.OS === "ios" ? 44 : 12),
                },
              ]}
              pointerEvents="box-none"
            >
              <View
                style={[
                  styles.screenshotSearchBar,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    shadowColor: theme.cardShadow,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.searchBackBtn}
                  onPress={() => setShowMapView(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={20} color={theme.text} />
                </TouchableOpacity>

                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Search in Kigali"
                  placeholderTextColor={theme.textSecondary}
                  value={mapSearch}
                  onChangeText={setMapSearch}
                />

                <TouchableOpacity style={styles.searchIconBtn} activeOpacity={0.7}>
                  <Ionicons name="search" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* Horizontal Vehicle/Place Filter Pills in App Colors */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryPillsScroll}
                contentContainerStyle={styles.categoryPillsContent}
              >
                {[
                  { id: "car", label: "Car", icon: "car-sport" },
                  { id: "ev", label: "EV Hub", icon: "flash" },
                  { id: "bike", label: "Bike", icon: "bicycle" },
                  { id: "bus", label: "Bus", icon: "bus" },
                  { id: "truck", label: "Truck", icon: "cube" },
                  { id: "all", label: "All Spots", icon: "grid" },
                ].map((cat) => {
                  const isActive = mapCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor: isActive ? theme.pillActiveBg : theme.surface,
                          borderColor: isActive ? theme.pillActiveBg : theme.border,
                          shadowColor: theme.cardShadow,
                        },
                      ]}
                      onPress={() => setMapCategory(cat.id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={15}
                        color={isActive ? theme.pillActiveText : theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.categoryPillText,
                          {
                            color: isActive ? theme.pillActiveText : theme.text,
                            fontWeight: isActive ? "800" : "600",
                          },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Floating Bottom Card matching the user's screenshot */}
            {selectedMapLocation && (
              <View
                style={[
                  styles.screenshotBottomCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    shadowColor: theme.cardShadow,
                  },
                ]}
              >
                {/* Header Row: Title, Address, Bookmark */}
                <View style={styles.bottomCardHeaderRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.bottomCardTitle, { color: theme.text }]} numberOfLines={1}>
                      {selectedMapLocation.name}
                    </Text>
                    <Text style={[styles.bottomCardAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                      {selectedMapLocation.address}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.bookmarkBtn,
                      {
                        backgroundColor: mapBookmarked[selectedMapLocation.id]
                          ? theme.pillActiveBg
                          : theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() =>
                      setMapBookmarked((prev) => ({
                        ...prev,
                        [selectedMapLocation.id]: !prev[selectedMapLocation.id],
                      }))
                    }
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={mapBookmarked[selectedMapLocation.id] ? "bookmark" : "bookmark-outline"}
                      size={20}
                      color={mapBookmarked[selectedMapLocation.id] ? theme.pillActiveText : theme.text}
                    />
                  </TouchableOpacity>
                </View>

                {/* Stats Row: Price • 4 min • Available Spots */}
                <View style={styles.cardStatsRow}>
                  <View style={styles.statBadgeItem}>
                    <Ionicons name="cash-outline" size={14} color={theme.textSecondary} />
                    <Text style={[styles.statBadgeText, { color: theme.text }]}>
                      {selectedMapLocation.hourly_rate} RWF /hr
                    </Text>
                  </View>
                  <Text style={[styles.statDotSeparator, { color: theme.textSecondary }]}>•</Text>
                  <View style={styles.statBadgeItem}>
                    <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                    <Text style={[styles.statBadgeText, { color: theme.text }]}>
                      4 min
                    </Text>
                  </View>
                  <Text style={[styles.statDotSeparator, { color: theme.textSecondary }]}>•</Text>
                  <View style={styles.statBadgeItem}>
                    <Ionicons name="car-outline" size={14} color={theme.textSecondary} />
                    <Text style={[styles.statBadgeText, { color: theme.text }]}>
                      {selectedMapLocation.available_spots || 28} Available
                    </Text>
                  </View>
                </View>

                {/* Aerial Parking Photo with Parked Cars and Pagination Dots */}
                <View style={styles.aerialPhotoContainer}>
                  <Image
                    source={{
                      uri:
                        LOCATION_IMAGES[selectedMapLocation.id] ||
                        "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=800&q=80",
                    }}
                    style={styles.aerialPhotoImg}
                    resizeMode="cover"
                  />
                  {/* Carousel Pagination Dots */}
                  <View style={styles.carouselDotsContainer}>
                    <View style={[styles.carouselDot, { backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B", width: 14 }]} />
                    <View style={[styles.carouselDot, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.4)" : "rgba(9,9,11,0.3)" }]} />
                    <View style={[styles.carouselDot, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.4)" : "rgba(9,9,11,0.3)" }]} />
                    <View style={[styles.carouselDot, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.4)" : "rgba(9,9,11,0.3)" }]} />
                    <View style={[styles.carouselDot, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.4)" : "rgba(9,9,11,0.3)" }]} />
                  </View>
                </View>

                {/* Choose Place Button in App Colors */}
                <TouchableOpacity
                  style={[
                    styles.choosePlaceBtn,
                    {
                      backgroundColor: theme.primaryBtnBg,
                      shadowColor: theme.cardShadow,
                    },
                  ]}
                  onPress={() => {
                    setShowMapView(false);
                    setSelectedParkForSheet(selectedMapLocation);
                    setSelectedSheetZone("Zone C");
                    setSelectedSheetBay("127");
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.choosePlaceBtnText, { color: theme.primaryBtnText }]}>Choose Place</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>

        {/* MAP LOCATION / STATION BOTTOM SHEET MODAL (Opened upon clicking station/area pin on map) */}
        <Modal
          visible={mapStationSheetVisible && !!selectedMapLocation}
          animationType="slide"
          transparent
          onRequestClose={() => setMapStationSheetVisible(false)}
        >
          <View style={styles.sheetModalBackdrop}>
            <View style={[styles.confirmSheetBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.confirmHandleBar} />

              <View style={styles.sheetHeaderRow}>
                <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                  <Text style={[styles.sheetMainTitle, { color: theme.text }]} numberOfLines={1}>
                    {selectedMapLocation?.name || "Parking Station"}
                  </Text>
                  <Text style={[styles.sheetSubTitle, { color: theme.textSecondary }]} numberOfLines={1}>
                    {selectedMapLocation?.address || "Kigali, Rwanda"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.circularCloseBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                  onPress={() => setMapStationSheetVisible(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color={theme.text} />
                </TouchableOpacity>
              </View>

              {/* Photo & Station Quick Metrics */}
              <View style={styles.mapSheetImageRow}>
                <Image
                  source={{ uri: LOCATION_IMAGES[selectedMapLocation?.id || ""] || DEFAULT_PARKING_IMAGE }}
                  style={styles.mapSheetThumb}
                />
                <View style={styles.mapSheetInfoCol}>
                  <View style={styles.mapSheetBadgeRow}>
                    <View style={[styles.mapSheetBadge, { backgroundColor: "#09090B" }]}>
                      <Ionicons name="car" size={12} color="#FFFFFF" />
                      <Text style={[styles.mapSheetBadgeText, { color: "#FFFFFF" }]}>
                        {selectedMapLocation?.available_spots || 24} spots free
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.mapSheetRateText, { color: theme.text }]}>
                    {selectedMapLocation?.hourly_rate || 300} RWF / hour
                  </Text>
                  <Text style={[styles.mapSheetSubText, { color: theme.textSecondary }]}>
                    Monitored 24/7 • EV Charger Ready • Covered Parking
                  </Text>
                </View>
              </View>

              {/* Actions: View Parking Bays / Reserve */}
              <View style={styles.mapSheetActionRow}>
                <TouchableOpacity
                  style={[styles.mapSheetActionBtnSecondary, { borderColor: theme.border, backgroundColor: theme.background }]}
                  onPress={() => {
                    setMapStationSheetVisible(false);
                    if (selectedMapLocation) {
                      setSelectedParkForSheet(selectedMapLocation);
                      setSelectedSheetZone("Zone C");
                      setSelectedSheetBay("127");
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="grid-outline" size={16} color={theme.text} />
                  <Text style={[styles.mapSheetActionBtnSecondaryText, { color: theme.text }]}>
                    View Parking Bays
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.mapSheetActionBtnPrimary, { backgroundColor: "#09090B" }]}
                  onPress={() => {
                    setMapStationSheetVisible(false);
                    if (selectedMapLocation) {
                      setSelectedParkForSheet(selectedMapLocation);
                      setConfirmBookingSheetVisible(true);
                    }
                  }}
                  activeOpacity={0.88}
                >
                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                  <Text style={[styles.mapSheetActionBtnPrimaryText, { color: "#FFFFFF" }]}>
                    Reserve Spot
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>

      {/* Real-time Dynamic Island & Lock Screen Live Activity Widget (iOS Only, Anchored on Hardware Bridge) */}
      <DynamicIslandParking
        active={Boolean(activeTicket)}
        bayNumber={activeTicket?.spaceNumber || ""}
        locationName={activeTicket?.locationName || ""}
        plate={activeTicket?.plate || selectedVehicle?.masked_plate || "RAD ••• B"}
        elapsedSeconds={elapsedSeconds}
        totalSeconds={totalParkingSeconds}
        remainingSeconds={remainingSeconds}
        progressPercent={progressPercent}
        onExtend={() => handleExtendParkingTime(1)}
        onEndSession={handleEndParkingSession}
      />

      {/* 1-Second Full-Screen Black and White Gradient AI Scanning Wave (No Card) */}
      {isAiScanning && (
        <Animated.View
          style={[
            styles.aiScanOverlay,
            {
              opacity: aiOverlayOpacity,
            },
          ]}
          pointerEvents="none"
        >
          {/* Sweeping Black & White Gradient Holographic Laser Wave */}
          <Animated.View
            style={[
              styles.aiScanBwWave,
              {
                transform: [
                  {
                    translateY: aiScanAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-260, SCREEN_HEIGHT + 260],
                    }),
                  },
                ],
              },
            ]}
          >
            <Svg width={SCREEN_WIDTH} height={260}>
              <Defs>
                <LinearGradient id="aiBwBeamGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
                  <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.15" />
                  <Stop offset="48%" stopColor="#FFFFFF" stopOpacity="0.75" />
                  <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="1" />
                  <Stop offset="52%" stopColor="#FFFFFF" stopOpacity="0.75" />
                  <Stop offset="75%" stopColor="#FFFFFF" stopOpacity="0.15" />
                  <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width={SCREEN_WIDTH} height={260} fill="url(#aiBwBeamGrad)" />
            </Svg>
            {/* Luminous razor-thin pure white laser line */}
            <View style={styles.aiScanBwLaserLine} />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
  },
  screenWrapper: {
    flex: 1,
  },

  /* SCREEN 1: PARKING SPOT STYLES */
  spotHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: "transparent",
    borderBottomWidth: 0,
  },
  spotHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  circularNavBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  floorPillsRow: {
    paddingVertical: 12,
  },
  floorPillsScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  floorPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  floorPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  topologySwitcherRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  topologyPillsGroup: {
    flexDirection: "row",
    gap: 6,
  },
  topologyPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  topologyPillText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  aerial3DToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  aerial3DToggleText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  slotGridScroll: {
    flex: 1,
  },
  slotGridContent: {
    paddingHorizontal: 20,
    paddingBottom: 220,
  },
  bayIndicatorsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionPillBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionPillText: {
    fontSize: 14,
    fontWeight: "900",
  },
  entryArrowBox: {
    alignItems: "center",
  },
  entryArrowText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  bayLayoutTwoCols: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  bayColumn: {
    flex: 1,
    gap: 14,
  },
  driveAisle: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  driveAisleDashedLine: {
    width: 1,
    height: "100%",
    borderStyle: "dashed",
    borderWidth: 1,
  },
  occupiedBayWrapper: {
    height: 80,
    borderRadius: 14,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  bayLabelMuted: {
    position: "absolute",
    top: 6,
    left: 8,
    fontSize: 10,
    fontWeight: "800",
  },
  freeBaySlot: {
    height: 80,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  freeBaySlotText: {
    fontSize: 14,
    fontWeight: "900",
  },
  selectedCheckDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Top Down Car Vector */
  topDownCarBox: {
    width: 44,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  carWheelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 42,
  },
  carWheel: {
    width: 6,
    height: 12,
    borderRadius: 3,
    backgroundColor: "#18181B",
  },
  carBodyMain: {
    width: 32,
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginVertical: -2,
  },
  carGlassFront: {
    width: 24,
    height: 8,
    borderRadius: 3,
  },
  carRoof: {
    width: 22,
    height: 18,
    borderRadius: 4,
  },
  carGlassRear: {
    width: 20,
    height: 6,
    borderRadius: 2,
  },

  /* Spot Bottom Floating Sheet */
  spotBottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D4D4D8",
    alignSelf: "center",
    marginBottom: 12,
  },
  spotSheetTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 14,
  },
  timeSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 18,
  },
  timeCol: {
    flex: 1,
    minWidth: 0,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 4,
  },
  timeChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  timeChipText: {
    fontSize: 11,
    fontWeight: "800",
  },
  durationCenterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginTop: 14,
    flexShrink: 0,
  },
  durationCenterText: {
    fontSize: 11,
    fontWeight: "900",
  },
  fullWidthPillBtn: {
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  fullWidthPillInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fullWidthPillBtnText: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  circleArrowIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  /* SCREEN 3: PARK DETAILS STYLES */
  detailsContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  detailsTopBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  detailsSearchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  detailsSearchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 0,
  },
  detailsCarPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detailsCarPillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  parkCardHead: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  parkProfileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  parkAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  parkProfileTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  parkRatingText: {
    fontSize: 12,
    fontWeight: "900",
  },
  parkReviewsText: {
    fontSize: 11,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verifiedPillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  addressCallRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addressText: {
    fontSize: 11,
    lineHeight: 16,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  segmentedTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  segmentedTabBtn: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  segmentedTabText: {
    fontSize: 12,
    fontWeight: "800",
  },
  mediaGalleryBox: {
    height: 180,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
    marginBottom: 20,
  },
  mediaGalleryImg: {
    width: "100%",
    height: "100%",
  },
  mediaPlayBtn: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -24 }, { translateY: -24 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  horizontalLotCard: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 12,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  horizontalLotImg: {
    width: 80,
    height: 80,
    borderRadius: 14,
  },
  lotCardTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  lotCardTypes: {
    fontSize: 10,
    marginTop: 2,
  },
  lotCardAddr: {
    fontSize: 10,
    marginTop: 4,
  },
  tariffBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tariffBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  ratingStarText: {
    fontSize: 11,
    fontWeight: "900",
  },
  spotsAvailablePill: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  spotsAvailableText: {
    fontSize: 10,
    fontWeight: "800",
  },

  /* SCREEN 2: HOME DISCOVERY STYLES */
  homeScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 110,
  },
  homeTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  avatarCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  locationSelectorGroup: {
    flex: 1,
    marginLeft: 12,
  },
  myLocationSub: {
    fontSize: 10,
    fontWeight: "700",
  },
  myLocationMain: {
    fontSize: 14,
    fontWeight: "900",
  },
  unreadBadgeDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#000000",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    gap: 8,
  },
  homeSearchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  aiModePillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    minWidth: 104,
  },
  aiModePillText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#09090B",
  },

  /* Category 4-Card Row */
  categoryCardsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  categoryCard: {
    flex: 1,
    minWidth: 0,
    height: 84,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 8,
    gap: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryCardLabel: {
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 12,
    maxWidth: "100%",
  },

  /* Dark Luxury Balance & Parking Tracker Card */
  darkLuxuryBalanceCard: {
    backgroundColor: "#09090B", // Pure rich carbon luxury
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  balanceTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
    zIndex: 2,
  },
  balanceSubLabel: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  hourlyRatePill: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  hourlyRatePillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  balanceNumber: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  balancePlusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  watermarkLetterBox: {
    position: "absolute",
    right: 50,
    top: 6,
    opacity: 0.08,
  },
  watermarkLetter: {
    color: "#FFFFFF",
    fontSize: 90,
    fontWeight: "900",
  },
  balanceDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    marginBottom: 14,
  },
  balanceTrackerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trackerLabel: {
    color: "#E4E4E7",
    fontSize: 11,
    fontWeight: "800",
  },
  trackerDigits: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  trackerProgressBarBg: {
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
  },
  trackerProgressBarActive: {
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
  activeSessionInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  activeSessionInfoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  activeSessionSpotText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  activeSessionDurationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activeSessionDurationText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  liveBlinkingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  trackerCountdownText: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  trackerActionButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  trackerActionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  trackerActionBtnSecondaryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  trackerActionBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
  },
  trackerActionBtnPrimaryText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800",
  },
  contraventionFineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  contraventionFineTitle: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  contraventionFineSub: {
    color: "#FCA5A5",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 1,
  },
  sheetFineWarningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  sheetFineWarningTitle: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "800",
  },
  sheetFineWarningSub: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
    opacity: 0.9,
  },
  disabledBayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  disabledBayBadgeText: {
    color: "#EF4444",
    fontSize: 8,
    fontWeight: "800",
  },

  /* Dropdown Map */
  homeMapContainer: {
    height: 180,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 20,
  },
  mapPinMonochrome: {
    backgroundColor: "#09090B",
    borderColor: "#FFFFFF",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  mapPinLetter: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  mapPinBadge: {
    color: "#A1A1AA",
    fontSize: 10,
    fontWeight: "800",
  },

  /* Section Headers */
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  sectionTitleBold: {
    fontSize: 16,
    fontWeight: "900",
  },
  sectionSubMuted: {
    fontSize: 11,
    marginTop: 2,
  },
  seeAllLink: {
    fontSize: 12,
    fontWeight: "800",
  },

  /* Top Rated Park Card */
  topRatedCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  topRatedCardRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 12,
  },
  topRatedCardImg: {
    width: 90,
    height: 90,
    borderRadius: 16,
  },
  topRatedTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  topRatedTypes: {
    fontSize: 10,
    marginTop: 2,
  },
  topRatedAddress: {
    fontSize: 11,
  },
  ratingNumber: {
    fontSize: 11,
    fontWeight: "900",
    marginLeft: 2,
  },
  reviewCount: {
    fontSize: 10,
  },
  topRatedBottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  openSpotsText: {
    fontSize: 11,
    fontWeight: "800",
  },
  openCountBadge: {
    fontSize: 11,
    fontWeight: "900",
  },

  /* Nearby Park Card */
  nearbyCard: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 12,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  nearbyCardImg: {
    width: 72,
    height: 72,
    borderRadius: 14,
  },
  nearbyCardTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  nearbyStarText: {
    fontSize: 11,
    fontWeight: "800",
  },
  nearbyCardTypes: {
    fontSize: 10,
  },
  nearbyCardAddress: {
    fontSize: 10,
  },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContentBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: "900",
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  auditResultBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  auditResultStatus: {
    fontSize: 13,
    fontWeight: "900",
  },
  auditResultText: {
    fontSize: 11,
  },

  /* =========================================================================
      SCREENSHOT-ALIGNED HOMESCREEN & MODAL STYLES
  ========================================================================== */

  /* Horizontal Car Graphic */
  horizCarBox: {
    width: 130,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
  },
  horizCarWheelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 96,
    height: 5,
  },
  horizWheel: {
    width: 20,
    height: 5,
    borderRadius: 2,
    backgroundColor: "#09090B",
  },
  horizCarBody: {
    width: 124,
    height: 44,
    borderRadius: 13,
    backgroundColor: "#27272A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginVertical: -2,
  },
  horizCarGlassLeft: {
    width: 14,
    height: 30,
    borderRadius: 5,
    backgroundColor: "#09090B",
  },
  horizCarRoof: {
    width: 56,
    height: 34,
    borderRadius: 7,
    backgroundColor: "#99C31C",
  },
  horizCarGlassRight: {
    width: 12,
    height: 28,
    borderRadius: 5,
    backgroundColor: "#09090B",
  },

  /* Parking Nearby Section */
  nearbySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 12,
  },
  nearbySectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  viewOnMapPillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  viewOnMapPillText: {
    fontSize: 11,
    fontWeight: "800",
  },

  /* Zone Pills */
  zonePillsScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  zonePillChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  zonePillChipText: {
    fontSize: 12,
    fontWeight: "800",
  },

  /* Nearby Horizontal Cards */
  nearbyHorizontalCardsScroll: {
    gap: 14,
    paddingBottom: 18,
  },
  nearbyScreenshotCard: {
    width: 236,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  nearbyCardImgContainer: {
    width: "100%",
    height: 128,
    position: "relative",
  },
  nearbyScreenshotCardImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  freePlacesBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "#09090B",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  freePlacesBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  nearbyCardInfoBox: {
    padding: 12,
    gap: 4,
  },
  nearbyCardName: {
    fontSize: 14,
    fontWeight: "900",
  },
  nearbyCardAddressText: {
    fontSize: 11,
  },
  nearbyCardRateText: {
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
  },

  /* Recent Parking Section */
  recentSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 12,
  },
  recentSectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  seeAllPillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  seeAllPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  recentListContainer: {
    gap: 10,
  },
  recentParkCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  recentParkImg: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  recentParkInfoCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  recentParkTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  recentParkAddr: {
    fontSize: 11,
  },
  recentStatusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#27272A",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  recentStatusBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  /* Spot Selection Bottom Sheet Modal */
  sheetModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  spotSelectionSheetBox: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    maxHeight: "88%",
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingHorizontal: 20,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetMainTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  sheetSubTitle: {
    fontSize: 12,
    marginTop: 2,
  },
  circularCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetZonePillsWrapper: {
    marginBottom: 16,
  },
  sheetZonePillsRow: {
    gap: 8,
  },
  sheetZonePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  sheetZonePillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  sheetBaysScroll: {
    maxHeight: 380,
    marginBottom: 16,
  },
  sheetBaysTwoCols: {
    flexDirection: "row",
    gap: 14,
  },
  sheetBayColumn: {
    flex: 1,
    gap: 12,
  },
  bayAvailableCard: {
    height: 60,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bayNumberBold: {
    fontSize: 15,
    fontWeight: "900",
  },
  bayStatusSub: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 1,
  },
  occupiedBayGraphicCard: {
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetContinueBtn: {
    backgroundColor: "#18181B",
    borderRadius: 32,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    paddingHorizontal: 16,
  },
  sheetContinueBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  sheetContinueCircleArrow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    right: 7,
  },

  /* Confirm Booking Bottom Sheet */
  confirmSheetBox: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    paddingHorizontal: 20,
  },
  confirmHandleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D4D4D8",
    alignSelf: "center",
    marginBottom: 14,
  },
  confirmHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  confirmHeaderTitle: {
    fontSize: 19,
    fontWeight: "900",
  },
  confirmHeaderSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  confirmSummaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  confirmSummaryBox: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  confirmSummaryLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  confirmSummaryValue: {
    fontSize: 18,
    fontWeight: "900",
  },
  confirmPaymentSection: {
    marginBottom: 22,
    gap: 8,
  },
  confirmPaymentLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  confirmPaymentBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  paymentCardGlyph: {
    flexDirection: "row",
    alignItems: "center",
  },
  mastercardCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  paymentMethodText: {
    fontSize: 13,
    fontWeight: "800",
  },
  paymentEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confirmRateNumber: {
    fontSize: 20,
    fontWeight: "900",
  },
  confirmRateUnit: {
    fontSize: 11,
    marginTop: 2,
  },
  confirmFinalBtn: {
    backgroundColor: "#18181B",
    borderRadius: 26,
    paddingHorizontal: 36,
    paddingVertical: 14,
  },
  confirmFinalBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  /* Center QR Scanner Camera */
  scannerFullscreen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scannerTopHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  scannerCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  scannerHeaderTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  scannerHeaderSub: {
    color: "#A1A1AA",
    fontSize: 11,
    marginTop: 2,
  },
  scannerCameraContainer: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  scannerPermissionBox: {
    alignItems: "center",
    paddingHorizontal: 30,
    gap: 12,
  },
  scannerPermissionText: {
    color: "#FFFFFF",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
  },
  scannerPermissionBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scannerPermissionBtnText: {
    color: "#09090B",
    fontSize: 13,
    fontWeight: "900",
  },
  reticleFrame: {
    width: 250,
    height: 250,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  reticleCorner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: "#FFFFFF",
  },
  reticleTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  reticleTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  reticleBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  reticleBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  reticleCenterGlow: {
    width: 230,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  scannerSimChipsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "rgba(24, 24, 27, 0.9)",
  },
  scannerSimChipsLabel: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 8,
  },
  scannerSimChipsRow: {
    flexDirection: "row",
    gap: 8,
  },
  scannerSimChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#27272A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  scannerSimChipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  scannedInfoCard: {
    backgroundColor: "#18181B",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    gap: 12,
  },
  scannedInfoTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scannedSpotNumber: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  scannedSpotLocation: {
    color: "#A1A1AA",
    fontSize: 12,
    marginTop: 2,
  },
  scannedStatusPill: {
    backgroundColor: "#27272A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scannedStatusPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  scannedDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scannedRateText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
  },
  scannedTokenText: {
    color: "#71717A",
    fontSize: 11,
  },
  scannedActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  scannedParkNowBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  scannedParkNowBtnText: {
    color: "#09090B",
    fontSize: 13,
    fontWeight: "900",
  },
  scannedRescanBtn: {
    backgroundColor: "#27272A",
    borderRadius: 22,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  scannedRescanBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  /* MAP STATION BOTTOM SHEET STYLES */
  mapSheetImageRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  mapSheetThumb: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  mapSheetInfoCol: {
    flex: 1,
    justifyContent: "space-between",
    minWidth: 0,
  },
  mapSheetBadgeRow: {
    flexDirection: "row",
  },
  mapSheetBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  mapSheetBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  mapSheetRateText: {
    fontSize: 14,
    fontWeight: "900",
  },
  mapSheetSubText: {
    fontSize: 10,
  },
  mapSheetActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  mapSheetActionBtnSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  mapSheetActionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: "800",
  },
  mapSheetActionBtnPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  mapSheetActionBtnPrimaryText: {
    fontSize: 12,
    fontWeight: "900",
  },
  /* Screenshot Map Styles */
  radarOuterCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(34, 197, 94, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  radarInnerCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(34, 197, 94, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  userDotCenter: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#09090B",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  distanceBadgePill: {
    backgroundColor: "#09090B",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  distanceBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  markerContainer: {
    alignItems: "center",
  },
  rateBubble: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  rateBubbleActive: {
    backgroundColor: "#09090B",
  },
  rateBubbleInactive: {
    backgroundColor: "#18181B",
  },
  rateBubbleText: {
    fontSize: 12,
    fontWeight: "800",
  },
  rateBubbleTextActive: {
    color: "#FFFFFF",
  },
  rateBubbleTextInactive: {
    color: "#FFFFFF",
  },
  pinStemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
  },
  pinStemDotActive: {
    backgroundColor: "#09090B",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  pinStemDotInactive: {
    backgroundColor: "#71717A",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  floatingTopContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 20,
  },
  screenshotSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  searchBackBtn: {
    padding: 6,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  searchIconBtn: {
    padding: 6,
  },
  categoryPillsScroll: {
    marginTop: 10,
  },
  categoryPillsContent: {
    gap: 8,
    paddingRight: 10,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryPillText: {
    fontSize: 13,
  },
  screenshotBottomCard: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 34 : 20,
    left: 16,
    right: 16,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 20,
  },
  bottomCardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bottomCardTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  bottomCardAddress: {
    fontSize: 12,
    marginTop: 3,
  },
  bookmarkBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  statBadgeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statDotSeparator: {
    color: "#A1A1AA",
    fontSize: 12,
  },
  aerialPhotoContainer: {
    height: 125,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
  },
  aerialPhotoImg: {
    width: "100%",
    height: "100%",
  },
  carouselDotsContainer: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
  carouselDotActive: {
    backgroundColor: "#FFFFFF",
    width: 14,
  },
  choosePlaceBtn: {
    backgroundColor: "#09090B",
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    shadowColor: "rgba(0, 0, 0, 0.25)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  choosePlaceBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  cardZoneBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cardZoneBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  cardEvStationBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#10B98144",
  },
  cardEvStationBadgeText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  evRecommendedPill: {
    alignSelf: "flex-start",
    backgroundColor: "#10B98118",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  evRecommendedPillText: {
    color: "#10B981",
    fontSize: 10,
    fontWeight: "700",
  },
  emptyFilteredStateCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 8,
  },
  emptyStateIconHalo: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyStateIconCore: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "400",
    textAlign: "center",
    paddingHorizontal: 10,
    marginBottom: 22,
  },
  emptyStateActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emptyStatePrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyStatePrimaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  emptyStateSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 20,
    borderWidth: 1,
  },
  emptyStateSecondaryBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyStateQuickJumpBox: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.15)",
    width: "100%",
    alignItems: "center",
  },
  emptyStateQuickJumpLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyStateChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  emptyStateChipPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  emptyStateChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  evGatewayCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  evGatewayContentRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  evGatewayIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#10B98118",
    alignItems: "center",
    justifyContent: "center",
  },
  evGatewayTextCol: {
    flex: 1,
  },
  evGatewayTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  evPillBadge: {
    backgroundColor: "#10B98122",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  evPillBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10B981",
  },
  evGatewaySubtitle: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  evGatewayActionBtn: {
    marginTop: 12,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  evGatewayActionText: {
    color: "#09090B",
    fontSize: 13,
    fontWeight: "800",
  },
  emptyRecentBox: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  emptyRecentText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  confirmTimeframeSection: {
    marginVertical: 14,
  },
  confirmTimeframeLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  exitEstPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  exitEstText: {
    fontSize: 11,
    fontWeight: "700",
  },
  timeframePillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  timeframeChip: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  timeframeChipText: {
    fontSize: 13,
    fontWeight: "700",
  },
  timeframeStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  stepperActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperDurationText: {
    fontSize: 14,
    fontWeight: "800",
  },
  stepperCostSubtext: {
    fontSize: 11,
    fontWeight: "600",
  },

  /* GEMINI AI RECOMMENDATIONS & FULLSCREEN SCAN OVERLAY */
  geminiAiRecommendationBanner: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  geminiAccentTopStripe: {
    height: 3,
    width: "100%",
    backgroundColor: "#9B72CB",
  },
  geminiBannerInner: {
    padding: 14,
  },
  geminiBannerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  geminiIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#9B72CB",
    justifyContent: "center",
    alignItems: "center",
  },
  geminiBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  geminiBannerSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  geminiActivePill: {
    backgroundColor: "rgba(155, 114, 203, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#9B72CB",
  },
  geminiActivePillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#9B72CB",
    letterSpacing: 0.5,
  },
  geminiStatsRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  geminiStatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  geminiStatChipText: {
    fontSize: 10,
    fontWeight: "700",
  },
  geminiCardAiBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  geminiCardAiBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  aiBalanceEstimatedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(155, 114, 203, 0.2)",
  },
  aiBalancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiBalancePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#10B981",
  },
  aiSavingsTag: {
    backgroundColor: "rgba(155, 114, 203, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiSavingsTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9B72CB",
  },
  aiScanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    zIndex: 99999,
    justifyContent: "center",
    alignItems: "center",
  },
  aiScanBwWave: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 260,
  },
  aiScanBwLaserLine: {
    position: "absolute",
    top: 130,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },

  /* FULL SCREEN NOTIFICATIONS MODAL STYLES */
  notificationsFullScreenContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  notifTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  notifHeaderLeftCol: {
    flexDirection: "row",
    alignItems: "center",
  },
  notifTitleBadgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 12,
  },
  notifHeaderTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  notifUnreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  notifUnreadBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  notifMarkAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  notifMarkAllText: {
    fontSize: 12,
    fontWeight: "700",
  },
  aiAreaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  aiAreaBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  aiRecommendedSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  aiRecommendedSubtitleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  notifFiltersContainer: {
    paddingVertical: 12,
  },
  notifFiltersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  notifFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  notifFilterChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  notifListContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  notifCard: {
    borderRadius: 18,
    padding: 16,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  notifCardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  notifIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  notifCategoryTag: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  notifUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  notifMessage: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
    marginBottom: 10,
  },
  notifActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  notifActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  notifActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  notifEmptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 30,
  },
  notifEmptyIconBox: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  notifEmptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  notifEmptySub: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
});