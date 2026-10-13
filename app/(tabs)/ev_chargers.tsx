import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { EvChargerTelemetry, fetchEvChargers } from "../services/parking";
import { Icons } from "../../constants/icons";
import { useTheme } from "../../hooks/useTheme";
import { HorizontalUltraRealisticCar } from "../../components/UltraRealisticCar";
import { MAP_STYLE_LIGHT, MAP_STYLE_DARK } from "../../constants/mapStyles";

const { width } = Dimensions.get("window");

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
    { latitude: start.latitude + dLat * 0.22, longitude: start.longitude },
    { latitude: start.latitude + dLat * 0.22, longitude: start.longitude + dLon * 0.4 },
    { latitude: start.latitude + dLat * 0.58, longitude: start.longitude + dLon * 0.4 },
    { latitude: start.latitude + dLat * 0.58, longitude: start.longitude + dLon * 0.8 },
    { latitude: start.latitude + dLat * 0.86, longitude: start.longitude + dLon * 0.8 },
    { latitude: start.latitude + dLat * 0.86, longitude: end.longitude },
    end,
  ];
};

export interface StationItem {
  id: string;
  name: string;
  address: string;
  distance: string;
  latitude: number;
  longitude: number;
  tariff: string;
  image?: string;
  chargers: EvChargerTelemetry[];
}

export const FALLBACK_EV_STATIONS: StationItem[] = [
  {
    id: "ev-kigali-heights",
    name: "Kigali Heights EV Superhub",
    address: "KG 7 Ave, Kimihurura, Kigali",
    distance: "0.4 km",
    latitude: -1.9536,
    longitude: 30.0606,
    tariff: "250 RWF/kWh",
    image: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=600&q=80",
    chargers: [
      {
        id: "ch-kh-01",
        location_id: "ev-kigali-heights",
        station_identifier: "KH-DC-120",
        connector_type: "CCS2 DC Ultra-Fast",
        max_output_kw: 120,
        price_per_kwh: 250,
        status: "available",
        current_power_draw_kw: 0.0,
      },
      {
        id: "ch-kh-02",
        location_id: "ev-kigali-heights",
        station_identifier: "KH-DC-60",
        connector_type: "CCS2 DC Fast",
        max_output_kw: 60,
        price_per_kwh: 250,
        status: "charging",
        current_power_draw_kw: 48.5,
      },
      {
        id: "ch-kh-03",
        location_id: "ev-kigali-heights",
        station_identifier: "KH-AC-22",
        connector_type: "Type 2 AC",
        max_output_kw: 22,
        price_per_kwh: 180,
        status: "available",
        current_power_draw_kw: 0.0,
      },
    ],
  },
  {
    id: "ev-cbd-boulevard",
    name: "KN 4 Ave CBD Boulevard Hub",
    address: "KN 4 Ave, Nyarugenge, Kigali",
    distance: "1.2 km",
    latitude: -1.9482,
    longitude: 30.0588,
    tariff: "260 RWF/kWh",
    image: "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=600&q=80",
    chargers: [
      {
        id: "ch-cbd-01",
        location_id: "ev-cbd-boulevard",
        station_identifier: "CBD-DC-150",
        connector_type: "CCS2 DC Ultra-Fast",
        max_output_kw: 150,
        price_per_kwh: 260,
        status: "available",
        current_power_draw_kw: 0.0,
      },
      {
        id: "ch-cbd-02",
        location_id: "ev-cbd-boulevard",
        station_identifier: "CBD-AC-22",
        connector_type: "Type 2 AC",
        max_output_kw: 22,
        price_per_kwh: 180,
        status: "available",
        current_power_draw_kw: 0.0,
      },
    ],
  },
  {
    id: "ev-kimihurura",
    name: "Kimihurura Culture Hub",
    address: "KG 674 St, Kimihurura, Kigali",
    distance: "1.8 km",
    latitude: -1.9589,
    longitude: 30.0762,
    tariff: "240 RWF/kWh",
    image: "https://images.unsplash.com/photo-1558441719-8b489c63f7bc?auto=format&fit=crop&w=600&q=80",
    chargers: [
      {
        id: "ch-kmh-01",
        location_id: "ev-kimihurura",
        station_identifier: "KMH-DC-90",
        connector_type: "Dual CCS2 Fast",
        max_output_kw: 90,
        price_per_kwh: 240,
        status: "available",
        current_power_draw_kw: 0.0,
      },
      {
        id: "ch-kmh-02",
        location_id: "ev-kimihurura",
        station_identifier: "KMH-AC-22",
        connector_type: "Type 2 AC",
        max_output_kw: 22,
        price_per_kwh: 180,
        status: "charging",
        current_power_draw_kw: 19.2,
      },
    ],
  },
  {
    id: "ev-jumeirah",
    name: "Jumeirah / Al Wasl Hub",
    address: "Al Wasl Rd 56, Gasabo, Kigali",
    distance: "2.3 km",
    latitude: -1.9441,
    longitude: 30.0619,
    tariff: "250 RWF/kWh",
    image: "https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=600&q=80",
    chargers: [
      {
        id: "ch-jum-01",
        location_id: "ev-jumeirah",
        station_identifier: "JUM-DC-60",
        connector_type: "CCS2 DC Fast",
        max_output_kw: 60,
        price_per_kwh: 250,
        status: "available",
        current_power_draw_kw: 0.0,
      },
      {
        id: "ch-jum-02",
        location_id: "ev-jumeirah",
        station_identifier: "JUM-AC-22",
        connector_type: "Type 2 AC",
        max_output_kw: 22,
        price_per_kwh: 180,
        status: "available",
        current_power_draw_kw: 0.0,
      },
    ],
  },
  {
    id: "ev-chuk",
    name: "CHUK Medical Concession Hub",
    address: "KN 1 Rd, Kiyovu, Kigali",
    distance: "2.7 km",
    latitude: -1.9512,
    longitude: 30.0581,
    tariff: "220 RWF/kWh",
    image: "https://images.unsplash.com/photo-1620896727255-a2f0bfbc05f0?auto=format&fit=crop&w=600&q=80",
    chargers: [
      {
        id: "ch-chuk-01",
        location_id: "ev-chuk",
        station_identifier: "CHUK-DC-80",
        connector_type: "CCS2 DC Fast",
        max_output_kw: 80,
        price_per_kwh: 220,
        status: "available",
        current_power_draw_kw: 0.0,
      },
      {
        id: "ch-chuk-02",
        location_id: "ev-chuk",
        station_identifier: "CHUK-AC-22",
        connector_type: "Type 2 AC",
        max_output_kw: 22,
        price_per_kwh: 160,
        status: "charging",
        current_power_draw_kw: 17.0,
      },
    ],
  },
  {
    id: "ev-bk-arena",
    name: "BK Arena Sports Mega Hub",
    address: "KG 17 Ave, Remera, Kigali",
    distance: "3.5 km",
    latitude: -1.9553,
    longitude: 30.113,
    tariff: "250 RWF/kWh",
    image: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80",
    chargers: [
      {
        id: "ch-bka-01",
        location_id: "ev-bk-arena",
        station_identifier: "BKA-DC-150",
        connector_type: "CCS2 DC Ultra-Fast",
        max_output_kw: 150,
        price_per_kwh: 250,
        status: "available",
        current_power_draw_kw: 0.0,
      },
      {
        id: "ch-bka-02",
        location_id: "ev-bk-arena",
        station_identifier: "BKA-DC-100",
        connector_type: "CCS2 DC Fast",
        max_output_kw: 100,
        price_per_kwh: 250,
        status: "available",
        current_power_draw_kw: 0.0,
      },
      {
        id: "ch-bka-03",
        location_id: "ev-bk-arena",
        station_identifier: "BKA-AC-22",
        connector_type: "Type 2 AC",
        max_output_kw: 22,
        price_per_kwh: 180,
        status: "available",
        current_power_draw_kw: 0.0,
      },
    ],
  },
];

export interface ParkingLotSpot {
  id: string;
  bayNumber: string;
  isOccupied: boolean;
  carColor?: string;
  spotType?: string;
}

export const ZONE_PARKING_LOTS: Record<
  string,
  {
    title: string;
    description: string;
    leftColumn: ParkingLotSpot[];
    rightColumn: ParkingLotSpot[];
  }
> = {
  "Zone A": {
    title: "Executive & Ultra-Fast Hub",
    description: "Front-row bays equipped with 150 kW DC hyperchargers",
    leftColumn: [
      { id: "A-101", bayNumber: "101", isOccupied: false, spotType: "150kW DC" },
      { id: "A-102", bayNumber: "102", isOccupied: true, carColor: "crimson" },
      { id: "A-103", bayNumber: "103", isOccupied: false, spotType: "150kW DC" },
      { id: "A-104", bayNumber: "104", isOccupied: false, spotType: "150kW DC" },
      { id: "A-105", bayNumber: "105", isOccupied: false, spotType: "150kW DC" },
      { id: "A-106", bayNumber: "106", isOccupied: true, carColor: "pearl" },
    ],
    rightColumn: [
      { id: "A-107", bayNumber: "107", isOccupied: true, carColor: "sapphire" },
      { id: "A-108", bayNumber: "108", isOccupied: false, spotType: "150kW DC" },
      { id: "A-109", bayNumber: "109", isOccupied: false, spotType: "150kW DC" },
      { id: "A-110", bayNumber: "110", isOccupied: true, carColor: "amber" },
      { id: "A-111", bayNumber: "111", isOccupied: false, spotType: "150kW DC" },
      { id: "A-112", bayNumber: "112", isOccupied: true, carColor: "emerald" },
    ],
  },
  "Zone B": {
    title: "Level 1 Covered Bays",
    description: "Weather-protected garage bays with 50 kW fast plugs",
    leftColumn: [
      { id: "B-201", bayNumber: "201", isOccupied: true, carColor: "silver" },
      { id: "B-202", bayNumber: "202", isOccupied: false, spotType: "Covered 50kW" },
      { id: "B-203", bayNumber: "203", isOccupied: false, spotType: "Covered 50kW" },
      { id: "B-204", bayNumber: "204", isOccupied: true, carColor: "carbon" },
      { id: "B-205", bayNumber: "205", isOccupied: false, spotType: "Covered 50kW" },
      { id: "B-206", bayNumber: "206", isOccupied: false, spotType: "Covered 50kW" },
    ],
    rightColumn: [
      { id: "B-207", bayNumber: "207", isOccupied: false, spotType: "Covered 50kW" },
      { id: "B-208", bayNumber: "208", isOccupied: true, carColor: "champagne" },
      { id: "B-209", bayNumber: "209", isOccupied: false, spotType: "Covered 50kW" },
      { id: "B-210", bayNumber: "210", isOccupied: true, carColor: "obsidian" },
      { id: "B-211", bayNumber: "211", isOccupied: false, spotType: "Covered 50kW" },
      { id: "B-212", bayNumber: "212", isOccupied: false, spotType: "Covered 50kW" },
    ],
  },
  "Zone C": {
    title: "Central Plaza Charging Lot",
    description: "Main parking court with 22 kW AC stations & wide lanes",
    leftColumn: [
      { id: "C-123", bayNumber: "123", isOccupied: false, spotType: "22kW AC" },
      { id: "C-124", bayNumber: "124", isOccupied: true, carColor: "obsidian" },
      { id: "C-125", bayNumber: "125", isOccupied: false, spotType: "22kW AC" },
      { id: "C-126", bayNumber: "126", isOccupied: false, spotType: "22kW AC" },
      { id: "C-127", bayNumber: "127", isOccupied: false, spotType: "22kW AC" },
      { id: "C-128", bayNumber: "128", isOccupied: false, spotType: "22kW AC" },
    ],
    rightColumn: [
      { id: "C-129", bayNumber: "129", isOccupied: true, carColor: "titanium" },
      { id: "C-130", bayNumber: "130", isOccupied: true, carColor: "crimson" },
      { id: "C-131", bayNumber: "131", isOccupied: false, spotType: "22kW AC" },
      { id: "C-132", bayNumber: "132", isOccupied: false, spotType: "22kW AC" },
      { id: "C-133", bayNumber: "133", isOccupied: true, carColor: "glacier" },
      { id: "C-134", bayNumber: "134", isOccupied: false, spotType: "22kW AC" },
    ],
  },
  "Zone D": {
    title: "East Deck Fleet & SUV Stalls",
    description: "Oversized parking spaces designed for large SUVs & trucks",
    leftColumn: [
      { id: "D-401", bayNumber: "401", isOccupied: false, spotType: "Wide Stall" },
      { id: "D-402", bayNumber: "402", isOccupied: true, carColor: "emerald" },
      { id: "D-403", bayNumber: "403", isOccupied: true, carColor: "sapphire" },
      { id: "D-404", bayNumber: "404", isOccupied: false, spotType: "Wide Stall" },
      { id: "D-405", bayNumber: "405", isOccupied: false, spotType: "Wide Stall" },
      { id: "D-406", bayNumber: "406", isOccupied: true, carColor: "amber" },
    ],
    rightColumn: [
      { id: "D-407", bayNumber: "407", isOccupied: false, spotType: "Wide Stall" },
      { id: "D-408", bayNumber: "408", isOccupied: false, spotType: "Wide Stall" },
      { id: "D-409", bayNumber: "409", isOccupied: true, carColor: "pearl" },
      { id: "D-410", bayNumber: "410", isOccupied: false, spotType: "Wide Stall" },
      { id: "D-411", bayNumber: "411", isOccupied: true, carColor: "silver" },
      { id: "D-412", bayNumber: "412", isOccupied: false, spotType: "Wide Stall" },
    ],
  },
  "Zone E": {
    title: "Rooftop Solar Deck",
    description: "Scenic rooftop spots powered by on-site solar canopies",
    leftColumn: [
      { id: "E-501", bayNumber: "501", isOccupied: true, carColor: "crimson" },
      { id: "E-502", bayNumber: "502", isOccupied: true, carColor: "champagne" },
      { id: "E-503", bayNumber: "503", isOccupied: false, spotType: "Solar Canopy" },
      { id: "E-504", bayNumber: "504", isOccupied: false, spotType: "Solar Canopy" },
      { id: "E-505", bayNumber: "505", isOccupied: true, carColor: "titanium" },
      { id: "E-506", bayNumber: "506", isOccupied: false, spotType: "Solar Canopy" },
    ],
    rightColumn: [
      { id: "E-507", bayNumber: "507", isOccupied: false, spotType: "Solar Canopy" },
      { id: "E-508", bayNumber: "508", isOccupied: true, carColor: "sapphire" },
      { id: "E-509", bayNumber: "509", isOccupied: false, spotType: "Solar Canopy" },
      { id: "E-510", bayNumber: "510", isOccupied: false, spotType: "Solar Canopy" },
      { id: "E-511", bayNumber: "511", isOccupied: true, carColor: "carbon" },
      { id: "E-512", bayNumber: "512", isOccupied: false, spotType: "Solar Canopy" },
    ],
  },
};

type LayoutMode = "grid" | "map" | "list";

const EVChargers = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();

  const [stations, setStations] = useState<StationItem[]>(FALLBACK_EV_STATIONS);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "fast" | "ac">("all");
  const [activeCategory, setActiveCategory] = useState<string>("car");
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>({});
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("map");
  const [selectedStation, setSelectedStation] = useState<StationItem | null>(FALLBACK_EV_STATIONS[0] || null);

  // BottomSheet and Charging Spot Selection State (matching user screenshot)
  const [sheetStation, setSheetStation] = useState<StationItem | null>(null);
  const [selectedZone, setSelectedZone] = useState("Zone C");
  const [selectedBay, setSelectedBay] = useState("127");
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  const mapRef = useRef<MapView>(null);

  const handleSelectZone = (zone: string) => {
    setSelectedZone(zone);
    const lot = ZONE_PARKING_LOTS[zone];
    if (lot) {
      const firstAvailable =
        lot.leftColumn.find((s) => !s.isOccupied) ||
        lot.rightColumn.find((s) => !s.isOccupied);
      if (firstAvailable) {
        setSelectedBay(firstAvailable.bayNumber);
      }
    }
  };

  const currentLot = ZONE_PARKING_LOTS[selectedZone] || ZONE_PARKING_LOTS["Zone C"];

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadChargers();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChargers();
    setRefreshing(false);
  };

  const loadChargers = async () => {
    setLoading(true);
    try {
      const { data: locs, error } = await supabase
        .from("parking_locations")
        .select("id, name, address, latitude, longitude")
        .eq("is_active", true);

      if (locs && locs.length > 0) {
        const loadedStations: StationItem[] = [];
        for (const loc of locs) {
          const chargers = await fetchEvChargers(loc.id);
          if (chargers.length > 0) {
            loadedStations.push({
              id: loc.id,
              name: loc.name,
              address: loc.address,
              distance: "0.8 km",
              latitude: Number(loc.latitude) || -1.9536,
              longitude: Number(loc.longitude) || 30.0606,
              tariff: "250 RWF/kWh",
              chargers,
            });
          }
        }

        // Merge with full fallback EV Superhubs so all stations across Kigali are always visible
        const mergedMap = new Map<string, StationItem>();
        FALLBACK_EV_STATIONS.forEach((st) => mergedMap.set(st.name.toLowerCase(), st));
        loadedStations.forEach((st) => mergedMap.set(st.name.toLowerCase(), st));

        const finalStations = Array.from(mergedMap.values());
        setStations(finalStations);
        if (finalStations.length > 0) {
          setSelectedStation(finalStations[0]);
        }
      } else {
        setStations(FALLBACK_EV_STATIONS);
        setSelectedStation(FALLBACK_EV_STATIONS[0]);
      }
    } catch (e) {
      console.warn("loadChargers error:", e);
      setStations(FALLBACK_EV_STATIONS);
      setSelectedStation(FALLBACK_EV_STATIONS[0]);
    } finally {
      setLoading(false);
    }
  };

  const filteredStations = stations.filter((st) => {
    const matchesSearch =
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.address.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeCategory === "fast") {
      return st.chargers.some((c) => c.max_output_kw >= 100);
    }
    if (activeCategory === "ac") {
      return st.chargers.some((c) => c.max_output_kw <= 22);
    }
    return true;
  });

  const handleReservePlug = (stationName: string, charger: EvChargerTelemetry) => {
    if (charger.status !== "available") {
      Alert.alert(
        "Plug In-Use",
        `This ${charger.connector_type} charger is currently drawing ${charger.current_power_draw_kw} kW. Estimated free in ~14 minutes.`
      );
      return;
    }

    Alert.alert(
      "Reserve EV Charger",
      `Station: ${stationName}\nPlug: ${charger.station_identifier} (${charger.connector_type})\nOutput: ${charger.max_output_kw} kW\nTariff: ${charger.price_per_kwh} RWF / kWh\n\n15-minute arrival hold will be activated.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Hold (100 RWF)",
          onPress: () => {
            Alert.alert("Plug Reserved", "Charger bay locked for 15 minutes. Follow turn-by-turn navigation upon arrival.");
          },
        },
      ]
    );
  };

  const handleFocusRoute = (station: StationItem) => {
    setSelectedStation(station);
    mapRef.current?.animateToRegion(
      {
        latitude: (USER_COORDS.latitude + station.latitude) / 2,
        longitude: (USER_COORDS.longitude + station.longitude) / 2,
        latitudeDelta: Math.max(Math.abs(USER_COORDS.latitude - station.latitude) * 2.4, 0.035),
        longitudeDelta: Math.max(Math.abs(USER_COORDS.longitude - station.longitude) * 2.4, 0.035),
      },
      450
    );
  };

  const handleSelectLocation = (station: StationItem) => {
    setSelectedStation(station);
    setSheetStation(station);
    mapRef.current?.animateToRegion(
      {
        latitude: station.latitude,
        longitude: station.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      400
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Edge-to-Edge Map: Full Screen with rate bubbles, route polyline, and user radar */}
      <View style={StyleSheet.absoluteFillObject}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={KIGALI_REGION}
          showsUserLocation={false}
          customMapStyle={theme.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        >
          {/* User Location Radar Marker in App Colors */}
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

          {/* Stepped Route to Selected Station in App Colors */}
          {selectedStation && (
            <>
              <Polyline
                coordinates={getSteppedRoute(USER_COORDS, {
                  latitude: selectedStation.latitude,
                  longitude: selectedStation.longitude,
                })}
                strokeColor={theme.isDark ? "#FFFFFF" : "#09090B"}
                strokeWidth={4.5}
                lineCap="round"
                lineJoin="round"
              />

              {/* Start / Origin Marker (black circle with inner white dot) */}
              <Marker coordinate={USER_COORDS} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.originMarkerBadge}>
                  <View style={[styles.originMarkerOuter, { backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B" }]}>
                    <View style={[styles.originMarkerInner, { backgroundColor: theme.isDark ? "#09090B" : "#FFFFFF" }]} />
                  </View>
                </View>
              </Marker>

              {/* Destination Marker (circular halo with black navigation chevron badge) */}
              <Marker
                coordinate={{
                  latitude: selectedStation.latitude,
                  longitude: selectedStation.longitude,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.destMarkerHaloWrap}>
                  <View
                    style={[
                      styles.destMarkerHaloCircle,
                      {
                        backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(9, 9, 11, 0.15)",
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.destMarkerInnerCircle,
                        { backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B" },
                      ]}
                    >
                      <Ionicons
                        name="navigate"
                        size={14}
                        color={theme.isDark ? "#09090B" : "#FFFFFF"}
                      />
                    </View>
                  </View>
                </View>
              </Marker>
            </>
          )}

          {/* EV Station Badges (Black circle with EV pump/bolt icon & anchor dot beneath) */}
          {filteredStations.map((st) => {
            const isSelected = selectedStation?.id === st.id;

            return (
              <Marker
                key={st.id}
                coordinate={{ latitude: st.latitude, longitude: st.longitude }}
                onPress={() => handleSelectLocation(st)}
                anchor={{ x: 0.5, y: 0.9 }}
              >
                <View style={styles.evPinWrapper}>
                  <View
                    style={[
                      styles.evPinBadge,
                      {
                        backgroundColor: isSelected
                          ? "#10B981"
                          : theme.isDark
                          ? "#18181B"
                          : "#09090B",
                        borderColor: theme.surface,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons name="ev-station" size={17} color="#FFFFFF" />
                  </View>
                  <View
                    style={[
                      styles.evPinStemDot,
                      {
                        backgroundColor: isSelected
                          ? "#10B981"
                          : theme.isDark
                          ? "#FFFFFF"
                          : "#09090B",
                      },
                    ]}
                  />
                </View>
              </Marker>
            );
          })}
        </MapView>
      </View>

      {/* Top Floating Bar: Back Button on left, Search Pill with Pin & Target on right */}
      <View
        style={[
          styles.floatingTopBar,
          {
            top: insets.top > 0 ? insets.top + 6 : (Platform.OS === "ios" ? 48 : 16),
          },
        ]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={[styles.topBackCircleBtn, { backgroundColor: theme.isDark ? "#27272A" : "#09090B" }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View
          style={[
            styles.topSearchCapsule,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.cardShadow,
            },
          ]}
        >
          <Ionicons name="location-outline" size={18} color={theme.text} />
          <TextInput
            style={[styles.topSearchCapsuleInput, { color: theme.text }]}
            placeholder="San Francisco, CA"
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            style={styles.gpsCrosshairBtn}
            onPress={() => {
              mapRef.current?.animateToRegion(
                {
                  ...USER_COORDS,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                },
                500
              );
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="navigate-circle-outline" size={21} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Section: Nearby Station header + Horizontal Carousel */}
      <View
        style={[
          styles.bottomCarouselContainer,
          {
            paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 24,
          },
        ]}
      >
        <Text style={[styles.nearbySectionTitle, { color: theme.text }]}>
          Nearby Station
        </Text>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filteredStations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.nearbyCarouselList}
          snapToInterval={width * 0.82 + 14}
          decelerationRate="fast"
          renderItem={({ item }) => {
            const isSelected = selectedStation?.id === item.id;
            return (
              <TouchableOpacity
                style={[
                  styles.nearbyStationCard,
                  {
                    width: width * 0.82,
                    backgroundColor: theme.surface,
                    borderColor: isSelected
                      ? theme.isDark
                        ? "#FFFFFF"
                        : "#09090B"
                      : theme.border,
                    borderWidth: isSelected ? 1.8 : 1,
                    shadowColor: theme.cardShadow,
                  },
                ]}
                onPress={() => handleSelectLocation(item)}
                activeOpacity={0.88}
              >
                {/* Station Thumbnail Image */}
                <Image
                  source={{
                    uri:
                      item.image ||
                      "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=400&q=80",
                  }}
                  style={styles.nearbyThumbImg}
                />

                {/* Right Info Column */}
                <View style={styles.nearbyInfoCol}>
                  <Text style={[styles.nearbyTitleText, { color: theme.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>

                  <View style={styles.nearbyMetricsRow}>
                    <View style={styles.metricItemCol}>
                      <Text style={[styles.metricLabelText, { color: theme.textSecondary }]}>
                        Distance
                      </Text>
                      <Text style={[styles.metricValText, { color: theme.text }]}>
                        {item.distance || "0.4 mi"}
                      </Text>
                    </View>

                    <View style={styles.metricItemCol}>
                      <Text style={[styles.metricLabelText, { color: theme.textSecondary }]}>
                        Rate
                      </Text>
                      <Text style={[styles.metricValText, { color: theme.text }]}>
                        {item.tariff ? item.tariff.replace(" RWF/kWh", " RWF/kWh") : "$0.41 p/kwh"}
                      </Text>
                    </View>
                  </View>

                  {/* Black Pill Button: Map Direction */}
                  <TouchableOpacity
                    style={[
                      styles.mapDirectionBtn,
                      { backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B" },
                    ]}
                    onPress={() => handleFocusRoute(item)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.mapDirectionBtnText,
                        { color: theme.isDark ? "#09090B" : "#FFFFFF" },
                      ]}
                    >
                      Map Direction
                    </Text>
                    <Ionicons
                      name="git-branch-outline"
                      size={14}
                      color={theme.isDark ? "#09090B" : "#FFFFFF"}
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* BottomSheet Modal for Location Charging Spots (matching user screenshot) */}
      <Modal
        visible={!!sheetStation}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setSheetStation(null);
          setConfirmModalVisible(false);
        }}
      >
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => {
              setSheetStation(null);
              setConfirmModalVisible(false);
            }}
          />

          <View style={[styles.sheetModalContainer, { backgroundColor: theme.surface }]}>
            {/* Drag Handle */}
            <View style={styles.sheetHandleBar} />

            {/* Header: Title, Address, and Circular Close Button ( X ) */}
            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.sheetStationTitle, { color: theme.text }]} numberOfLines={1}>
                  {sheetStation?.name || "EV Charging Station"}
                </Text>
                <Text style={[styles.sheetStationAddress, { color: theme.textSecondary }]} numberOfLines={1}>
                  {sheetStation?.address || "Kigali, Rwanda"}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.sheetCloseBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => {
                  setSheetStation(null);
                  setConfirmModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Horizontal Zone Selector Pills: Zone A, Zone B, Zone C, Zone D, Zone E */}
            <View style={styles.zonePillsWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zonePillsContainer}>
                {["Zone A", "Zone B", "Zone C", "Zone D", "Zone E"].map((zone) => {
                  const isActive = selectedZone === zone;
                  return (
                    <TouchableOpacity
                      key={zone}
                      style={[
                        styles.zonePill,
                        {
                          backgroundColor: "transparent",
                          borderColor: isActive ? theme.text : theme.border,
                          borderWidth: isActive ? 2 : 1,
                        },
                      ]}
                      onPress={() => handleSelectZone(zone)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.zonePillText,
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
            </View>

            {/* Zone Description Subheader */}
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: theme.text }}>
                {currentLot.title}
              </Text>
              <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                {currentLot.description}
              </Text>
            </View>

            {/* 2-Column Slot Grid showing Available Spots and Parked Cars in this Zone */}
            <ScrollView
              style={styles.spotsScroll}
              contentContainerStyle={styles.spotsContent}
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
              <View style={styles.spotsTwoColGrid}>
                {/* Left Column */}
                <View style={styles.spotsColumn}>
                  {currentLot.leftColumn.map((spot) => {
                    if (spot.isOccupied) {
                      return (
                        <View
                          key={spot.id}
                          style={[
                            styles.spotOccupiedBox,
                            { backgroundColor: theme.background, borderColor: theme.border },
                          ]}
                        >
                          <HorizontalUltraRealisticCar color={spot.carColor} />
                        </View>
                      );
                    }
                    const isSelected = selectedBay === spot.bayNumber;
                    return (
                      <TouchableOpacity
                        key={spot.id}
                        style={[
                          styles.spotAvailableCard,
                          {
                            backgroundColor: theme.background,
                            borderColor: isSelected ? "#10B981" : theme.border,
                            borderWidth: isSelected ? 2.5 : 1,
                          },
                        ]}
                        onPress={() => setSelectedBay(spot.bayNumber)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.spotNumberText, { color: theme.text }]}>
                          {spot.bayNumber}
                        </Text>
                        <Text style={[styles.spotAvailableText, { color: isSelected ? "#10B981" : theme.textSecondary }]}>
                          {spot.spotType || "Available"}
                        </Text>
                        {isSelected && (
                          <View style={[styles.selectedCheckDot, { backgroundColor: "#10B981" }]}>
                            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Right Column */}
                <View style={styles.spotsColumn}>
                  {currentLot.rightColumn.map((spot) => {
                    if (spot.isOccupied) {
                      return (
                        <View
                          key={spot.id}
                          style={[
                            styles.spotOccupiedBox,
                            { backgroundColor: theme.background, borderColor: theme.border },
                          ]}
                        >
                          <HorizontalUltraRealisticCar color={spot.carColor} />
                        </View>
                      );
                    }
                    const isSelected = selectedBay === spot.bayNumber;
                    return (
                      <TouchableOpacity
                        key={spot.id}
                        style={[
                          styles.spotAvailableCard,
                          {
                            backgroundColor: theme.background,
                            borderColor: isSelected ? "#10B981" : theme.border,
                            borderWidth: isSelected ? 2.5 : 1,
                          },
                        ]}
                        onPress={() => setSelectedBay(spot.bayNumber)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.spotNumberText, { color: theme.text }]}>
                          {spot.bayNumber}
                        </Text>
                        <Text style={[styles.spotAvailableText, { color: isSelected ? "#10B981" : theme.textSecondary }]}>
                          {spot.spotType || "Available"}
                        </Text>
                        {isSelected && (
                          <View style={[styles.selectedCheckDot, { backgroundColor: "#10B981" }]}>
                            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Bottom Sticky Continue Button with Right Arrow Circle */}
            <View style={[styles.sheetStickyBottomBar, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
              <TouchableOpacity
                style={[styles.sheetContinuePillBtn, { backgroundColor: theme.primaryBtnBg }]}
                onPress={() => setConfirmModalVisible(true)}
                activeOpacity={0.88}
              >
                <Text style={[styles.sheetContinueBtnText, { color: theme.primaryBtnText }]}>Continue</Text>
                <View style={[styles.circleArrowBtnBox, { backgroundColor: theme.background }]}>
                  <Ionicons name="arrow-forward" size={16} color={theme.text} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Sub-sheet / Nested Confirm Booking Sheet (3rd screen in reference screenshot) */}
            {confirmModalVisible && (
              <View style={styles.confirmSubSheetOverlay}>
                <View style={[styles.confirmSubSheetCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.sheetHandleBar} />

                  <View style={styles.confirmHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.confirmHeaderTitle, { color: theme.text }]}>Confirm booking</Text>
                      <Text style={[styles.confirmHeaderSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                        {sheetStation?.name}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.sheetCloseBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={() => setConfirmModalVisible(false)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={18} color={theme.text} />
                    </TouchableOpacity>
                  </View>

                  {/* Two Badges: Parking zone & Parking place */}
                  <View style={styles.confirmBadgesRow}>
                    <View style={[styles.confirmBadgeBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Text style={[styles.confirmBadgeLabel, { color: theme.textSecondary }]}>Parking zone</Text>
                      <Text style={[styles.confirmBadgeValue, { color: theme.text }]}>{selectedZone}</Text>
                    </View>

                    <View style={[styles.confirmBadgeBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <Text style={[styles.confirmBadgeLabel, { color: theme.textSecondary }]}>Parking place</Text>
                      <Text style={[styles.confirmBadgeValue, { color: theme.text }]}>{selectedBay}</Text>
                    </View>
                  </View>

                  {/* Payment Row */}
                  <View style={styles.confirmPaymentSection}>
                    <Text style={[styles.confirmPaymentLabel, { color: theme.textSecondary }]}>Payment</Text>
                    <View style={[styles.confirmPaymentCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Ionicons name="card-outline" size={20} color={theme.text} />
                        <Text style={[styles.confirmPaymentText, { color: theme.text }]}>MTN MoMo / Card ••••2456</Text>
                      </View>
                      <Ionicons name="pencil-outline" size={16} color={theme.textSecondary} />
                    </View>
                  </View>

                  {/* Price & Confirm Button Row */}
                  <View style={styles.confirmBottomActionRow}>
                    <View>
                      <Text style={[styles.confirmPriceNumber, { color: theme.text }]}>{sheetStation?.tariff || "250 RWF/kWh"}</Text>
                      <Text style={[styles.confirmPriceUnit, { color: theme.textSecondary }]}>per kWh draw</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.confirmFinalBtn, { backgroundColor: theme.primaryBtnBg }]}
                      onPress={() => {
                        setConfirmModalVisible(false);
                        const sName = sheetStation?.name || "Kigali EV Charging Hub";
                        const sBay = selectedBay || "EV-01";
                        setSheetStation(null);
                        router.push({
                          pathname: "/ev_charging",
                          params: {
                            name: sName,
                            bayNumber: sBay,
                            kwh: "72",
                            soc: "71",
                            rate: "250",
                            currency: "RWF",
                          },
                        });
                      }}
                      activeOpacity={0.88}
                    >
                      <Text style={[styles.confirmFinalBtnText, { color: theme.primaryBtnText }]}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default EVChargers;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingHeaderContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  floatingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? 14 : 8,
    paddingBottom: 10,
    backgroundColor: "transparent",
  },
  headerTitleCenter: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: "transparent",
  },
  headerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerBrandLogo: {
    width: 26,
    height: 26,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  liveFeedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  liveFeedText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  /* View Mode Switcher */
  layoutToggleWrapper: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  layoutToggleContainer: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
  },
  layoutToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 11,
    gap: 6,
  },
  layoutToggleBtnActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  layoutToggleText: {
    fontSize: 12,
    fontWeight: "800",
  },

  /* Search */
  searchWrapper: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },

  /* Filters */
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: "800",
  },

  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Map Mode */
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  evMapPin: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  evMapPinText: {
    fontSize: 11,
    fontWeight: "900",
  },
  evPinCountBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  evPinCountText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  mapBottomCard: {
    position: "absolute",
    bottom: 28,
    left: 16,
    right: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  mapCardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  mapCardTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  mapCardAddress: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  mapCardTariffBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mapCardTariffText: {
    fontSize: 10,
    fontWeight: "800",
  },
  mapPlugsScroll: {
    flexDirection: "row",
  },
  mapPlugItem: {
    width: 145,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    marginRight: 10,
  },
  mapPlugId: {
    fontSize: 12,
    fontWeight: "800",
  },
  mapPlugStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  mapPlugSpecs: {
    fontSize: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  mapPlugReserveBtn: {
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
  },
  mapPlugReserveText: {
    fontSize: 10,
    fontWeight: "800",
  },

  /* Grid Layout Mode */
  gridContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 110,
  },
  gridRow: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  gridCard: {
    width: (width - 44) / 2,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  gridCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  gridPowerBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  gridPowerText: {
    fontSize: 10,
    fontWeight: "900",
  },
  gridStatusPill: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  gridStatusPillText: {
    fontSize: 9,
    fontWeight: "900",
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: "800",
    minHeight: 34,
    marginBottom: 2,
  },
  gridAddress: {
    fontSize: 10,
    marginBottom: 8,
  },
  gridMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  gridDistance: {
    fontSize: 10,
    fontWeight: "600",
  },
  gridTariff: {
    fontSize: 9,
    fontWeight: "800",
  },
  gridPlugsRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  gridPlugChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  gridPlugChipText: {
    fontSize: 8,
    fontWeight: "800",
  },
  gridCtaBtn: {
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: "center",
  },
  gridCtaBtnText: {
    fontSize: 11,
    fontWeight: "800",
  },

  /* List Mode */
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 110,
  },
  stationCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  stationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  stationName: {
    fontSize: 15,
    fontWeight: "900",
  },
  stationAddress: {
    fontSize: 11,
    marginTop: 2,
  },
  stationKwhBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  stationKwhText: {
    fontSize: 10,
    fontWeight: "800",
  },
  chargersContainer: {
    flexDirection: "row",
    gap: 8,
  },
  chargerBox: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
  },
  chargerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  chargerIdentifier: {
    fontSize: 11,
    fontWeight: "900",
  },
  statusIndicator: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 8,
    fontWeight: "900",
  },
  chargerSpecs: {
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 2,
  },
  chargerTelemetry: {
    fontSize: 9,
    marginBottom: 8,
  },
  reserveBtn: {
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center",
  },
  reserveBtnText: {
    fontSize: 10,
    fontWeight: "800",
  },

  emptyContainer: {
    marginTop: 50,
    alignItems: "center",
    paddingHorizontal: 30,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: "center",
  },

  /* Header Back Button */
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Horizontal Top Down Car Vector */
  horizCarBox: {
    width: 78,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  horizCarWheelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 60,
  },
  horizWheel: {
    width: 12,
    height: 6,
    borderRadius: 3,
  },
  horizCarBody: {
    width: 72,
    height: 30,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 5,
    marginVertical: -1,
  },
  horizCarGlass: {
    width: 7,
    height: 22,
    borderRadius: 2,
  },
  horizCarRoof: {
    width: 28,
    height: 22,
    borderRadius: 4,
  },

  /* BottomSheet Modal Styles */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheetModalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "88%",
    minHeight: "65%",
    paddingTop: 12,
    position: "relative",
  },
  sheetHandleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#A1A1AA",
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sheetStationTitle: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  sheetStationAddress: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  sheetCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Zone Pills */
  zonePillsWrapper: {
    marginBottom: 14,
  },
  zonePillsContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  zonePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  zonePillText: {
    fontSize: 12,
    fontWeight: "700",
  },

  /* 2-Column Slot Grid */
  spotsScroll: {
    flexGrow: 0,
    maxHeight: 340,
    paddingHorizontal: 20,
  },
  spotsContent: {
    paddingBottom: 16,
  },
  spotsTwoColGrid: {
    flexDirection: "row",
    gap: 14,
  },
  spotsColumn: {
    flex: 1,
    gap: 12,
  },
  spotAvailableCard: {
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  selectedCheckDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  spotNumberText: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  spotAvailableText: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },
  spotOccupiedBox: {
    height: 58,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Bottom Sticky Continue Bar */
  sheetStickyBottomBar: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 34 : 18,
  },
  sheetContinuePillBtn: {
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    position: "relative",
  },
  sheetContinueBtnText: {
    fontSize: 16,
    fontWeight: "800",
  },
  circleArrowBtnBox: {
    position: "absolute",
    right: 8,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Nested Confirm Booking Sub-sheet */
  confirmSubSheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  confirmSubSheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  confirmHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  confirmBadgesRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  confirmBadgeBox: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
  },
  confirmBadgeLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  confirmBadgeValue: {
    fontSize: 18,
    fontWeight: "900",
  },
  confirmPaymentSection: {
    marginBottom: 20,
  },
  confirmPaymentLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  confirmPaymentCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  confirmPaymentText: {
    fontSize: 13,
    fontWeight: "700",
  },
  confirmBottomActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  confirmPriceNumber: {
    fontSize: 22,
    fontWeight: "900",
  },
  confirmPriceUnit: {
    fontSize: 11,
    fontWeight: "600",
  },
  confirmFinalBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmFinalBtnText: {
    fontSize: 15,
    fontWeight: "800",
  },
  /* Screenshot Map Styles */
  radarOuterCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(9, 9, 11, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  radarInnerCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(9, 9, 11, 0.22)",
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
  screenshotSearchInput: {
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
  /* Reference Screenshot Map UI Styles */
  originMarkerBadge: {
    alignItems: "center",
    justifyContent: "center",
  },
  originMarkerOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  originMarkerInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  destMarkerHaloWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  destMarkerHaloCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  destMarkerInnerCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  evPinWrapper: {
    alignItems: "center",
  },
  evPinBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  evPinStemDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  floatingTopBar: {
    position: "absolute",
    left: 18,
    right: 18,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topBackCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  topSearchCapsule: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  topSearchCapsuleInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  gpsCrosshairBtn: {
    padding: 4,
  },
  bottomCarouselContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  nearbySectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  nearbyCarouselList: {
    paddingHorizontal: 20,
    gap: 14,
  },
  nearbyStationCard: {
    borderRadius: 24,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  nearbyThumbImg: {
    width: 90,
    height: 90,
    borderRadius: 18,
  },
  nearbyInfoCol: {
    flex: 1,
    justifyContent: "space-between",
  },
  nearbyTitleText: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  nearbyMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 10,
  },
  metricItemCol: {
    minWidth: 50,
  },
  metricLabelText: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 2,
  },
  metricValText: {
    fontSize: 12,
    fontWeight: "800",
  },
  mapDirectionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  mapDirectionBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
});
