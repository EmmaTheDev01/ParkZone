import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
  G,
  Text as SvgText,
} from "react-native-svg";
import { supabase } from "../lib/supabase";
import { useTheme } from "../../hooks/useTheme";
import {
  PARKING_HISTORY,
  PARKING_HISTORY_STORAGE_KEY,
  ParkingHistoryRecord,
} from "../recent_parkings";

const { width } = Dimensions.get("window");

export interface ActiveSessionData {
  id: string;
  plate: string;
  entryTime: Date;
  spaceNumber: string;
  locationName: string;
  durationHours: number;
  hourlyRate: number;
  violationFine?: number;
  violationReason?: string;
}

/**
 * Modern SVG Illustration: Empty Parking Bay (No Session)
 * Completely eliminates the "00:00:00" countdown dial and displays an
 * ambient, luxury vector artwork with glowing parking bay boundaries.
 */
const EmptySessionIllustration = ({ isDark }: { isDark: boolean }) => {
  return (
    <View style={svgStyles.container}>
      <Svg width={220} height={130} viewBox="0 0 220 130">
        <Defs>
          <LinearGradient id="groundGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={isDark ? "#27272A" : "#E4E4E7"} stopOpacity={0.6} />
            <Stop offset="100%" stopColor={isDark ? "#09090B" : "#F4F4F5"} stopOpacity={0.9} />
          </LinearGradient>
          <LinearGradient id="badgeGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={isDark ? "#3F3F46" : "#A1A1AA"} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={isDark ? "#18181B" : "#71717A"} stopOpacity={0.95} />
          </LinearGradient>
          <RadialGradient id="pulseGrad" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
            <Stop offset="100%" stopColor="#10B981" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Ambient Radar Glow Under Bay */}
        <Circle cx="110" cy="85" r="50" fill="url(#pulseGrad)" />

        {/* Isometric Parking Bay Base Platform */}
        <Path
          d="M 32 85 L 110 46 L 188 85 L 110 122 Z"
          fill="url(#groundGrad)"
          stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)"}
          strokeWidth={1.5}
        />

        {/* Crisp Dashed Bay Markings */}
        <Path
          d="M 52 75 L 105 49"
          stroke={isDark ? "#FFFFFF" : "#09090B"}
          strokeWidth={2}
          strokeDasharray="6,4"
          strokeOpacity={0.45}
        />
        <Path
          d="M 168 75 L 115 49"
          stroke={isDark ? "#FFFFFF" : "#09090B"}
          strokeWidth={2}
          strokeDasharray="6,4"
          strokeOpacity={0.45}
        />

        {/* Central Parking "P" Emblem Ground Inset */}
        <Circle
          cx="110" cy="84" r="20"
          fill="url(#badgeGrad)"
          stroke={isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"}
          strokeWidth={1.5}
        />
        <Path
          d="M 105 95 V 73 H 112 C 115.5 73 118 75.5 118 79 C 118 82.5 115.5 85 112 85 H 105"
          stroke="#FFFFFF"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Concentric Telemetry Radar Arcs (Standby Signal) */}
        <Path
          d="M 85 36 Q 110 24 135 36"
          stroke={isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)"}
          strokeWidth={1.8}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 94 43 Q 110 33 126 43"
          stroke={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 102 50 Q 110 44 118 50"
          stroke={isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.6)"}
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
        />

        {/* Modern Status Signal Pin */}
        <Circle cx="110" cy="18" r="7" fill="#10B981" opacity={0.2} />
        <Circle cx="110" cy="18" r="3.5" fill="#10B981" />

        {/* Minimalist Floating Accent Sparkles */}
        <Circle cx="45" cy="40" r="2" fill={isDark ? "#FFFFFF" : "#71717A"} opacity={0.5} />
        <Circle cx="175" cy="42" r="2.5" fill={isDark ? "#FFFFFF" : "#71717A"} opacity={0.4} />
      </Svg>
    </View>
  );
};

const svgStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
});

const Activities = () => {
  const theme = useTheme();
  const navigation = useNavigation();

  // Active Session & History Tickets
  const [activeTicket, setActiveTicket] = useState<ActiveSessionData | null>(null);
  const [parkingHistory, setParkingHistory] = useState<ParkingHistoryRecord[]>(PARKING_HISTORY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTick, setCurrentTick] = useState(Date.now());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"All" | "Completed" | "Active" | "Fines">("All");
  const [selectedInvoice, setSelectedInvoice] = useState<ParkingHistoryRecord | null>(null);

  // Hide tab bar when invoice modal is open
  useEffect(() => {
    if (selectedInvoice) {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: "none" } });
    } else {
      navigation.getParent()?.setOptions({ tabBarStyle: undefined });
    }
    return () => {
      navigation.getParent()?.setOptions({ tabBarStyle: undefined });
    };
  }, [selectedInvoice, navigation]);

  // Live timer interval for active session
  useEffect(() => {
    if (!activeTicket) return;
    const interval = setInterval(() => {
      setCurrentTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTicket]);

  // Elapsed seconds calculation
  const elapsedSeconds = useMemo(() => {
    if (!activeTicket) return 0;
    const entryMs = new Date(activeTicket.entryTime).getTime();
    return Math.max(0, Math.floor((currentTick - entryMs) / 1000));
  }, [activeTicket, currentTick]);

  const totalBookedSeconds = useMemo(() => {
    if (!activeTicket) return 3600;
    return Math.max(1, (activeTicket.durationHours || 1) * 3600);
  }, [activeTicket]);

  const isOverdue = elapsedSeconds > totalBookedSeconds;

  // Format seconds to HH:MM:SS
  const formatTimer = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  // Comprehensive Data Sync: Catches recent parkings from AsyncStorage and Supabase
  const loadData = useCallback(async () => {
    try {
      // 1. Load active ticket from AsyncStorage
      const rawActive = await AsyncStorage.getItem("@parkzone_active_ticket");
      if (rawActive) {
        const parsed = JSON.parse(rawActive);
        if (parsed && parsed.spaceNumber) {
          setActiveTicket({
            id: parsed.id || `ticket-${Date.now()}`,
            plate: parsed.plate || "RAD ••• B",
            entryTime: parsed.entryTime ? new Date(parsed.entryTime) : new Date(),
            spaceNumber: parsed.spaceNumber,
            locationName: parsed.locationName || "Kigali Marina Parking",
            durationHours: parsed.durationHours || 2,
            hourlyRate: parsed.hourlyRate || 300,
            violationFine: parsed.violationFine,
            violationReason: parsed.violationReason,
          });
        }
      } else {
        setActiveTicket(null);
      }

      // 2. Load recent parking history from AsyncStorage
      const rawHistory = await AsyncStorage.getItem(PARKING_HISTORY_STORAGE_KEY);
      let loadedRecords: ParkingHistoryRecord[] = [];
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedRecords = parsed;
        }
      }

      // Fallback to initial seeds if storage is blank
      if (loadedRecords.length === 0) {
        loadedRecords = PARKING_HISTORY;
        AsyncStorage.setItem(PARKING_HISTORY_STORAGE_KEY, JSON.stringify(PARKING_HISTORY)).catch(
          () => { }
        );
      }

      // 3. Optional Supabase tickets merge
      try {
        const { data: supaTickets } = await supabase
          .from("parking_tickets")
          .select(`
            id, ticket_number, vehicle_plate, entry_time, exit_time,
            status, hourly_rate, total_amount, payment_status,
            parking_locations:location_id (name, address),
            parking_spaces:space_id (space_number, zone_code)
          `)
          .order("created_at", { ascending: false })
          .limit(10);

        if (supaTickets && supaTickets.length > 0) {
          supaTickets.forEach((t: any) => {
            const exists = loadedRecords.some((r) => r.id === t.id || r.receiptNumber === t.ticket_number);
            if (!exists) {
              const supaRecord: ParkingHistoryRecord = {
                id: t.id,
                name: t.parking_locations?.name || "Kigali Hub",
                address: t.parking_locations?.address || "Kigali CBD",
                bayNumber: t.parking_spaces?.space_number || "Bay 01",
                zoneCode: t.parking_spaces?.zone_code || "Zone A",
                plate: t.vehicle_plate || "RAD 812 B",
                date: new Date(t.entry_time).toLocaleDateString([], { month: "short", day: "numeric" }),
                duration: "1h 30m",
                cost: t.total_amount || 300,
                currency: "RWF",
                status: t.status === "active" ? "Active" : "Completed",
                image: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=400&q=80",
                receiptNumber: t.ticket_number || `PZ-${Date.now().toString().slice(-6)}`,
              };
              loadedRecords.unshift(supaRecord);
            }
          });
        }
      } catch {
        // Supabase offline/unavailable, fallback gracefully
      }

      setParkingHistory(loadedRecords);
    } catch (err) {
      console.warn("loadData error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Sync whenever user focuses on the screen
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // End active parking session - avoids double payment for pre-paid sessions
  const handleEndParking = () => {
    if (!activeTicket) return;

    const prepaidHours = activeTicket.durationHours || 1;
    const elapsedHours = Math.max(1, Math.ceil(elapsedSeconds / 3600));
    const extraHours = Math.max(0, elapsedHours - prepaidHours);
    const overdueCost = extraHours * (activeTicket.hourlyRate || 300);

    if (overdueCost === 0) {
      Alert.alert(
        "Close Booking",
        `Spot: ${activeTicket.spaceNumber} (${activeTicket.locationName})\nElapsed Time: ${formatTimer(elapsedSeconds)}\nBooked Duration: ${prepaidHours} Hour(s) (Pre-paid)\nTotal Extra Due: 0 RWF\n\nYour session was already paid before booking.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Close Booking",
            onPress: async () => {
              try {
                await AsyncStorage.removeItem("@parkzone_active_ticket");
                setActiveTicket(null);
                const rawHistory = await AsyncStorage.getItem(PARKING_HISTORY_STORAGE_KEY);
                if (rawHistory) {
                  const history = JSON.parse(rawHistory);
                  const idx = history.findIndex((h: any) => h.id === activeTicket.id || h.status === "Active");
                  if (idx >= 0) {
                    history[idx].status = "Completed";
                    await AsyncStorage.setItem(PARKING_HISTORY_STORAGE_KEY, JSON.stringify(history));
                  }
                }
                loadData();
                Alert.alert("Booking Closed", "Parking session finished. Pre-paid booking covered this session in full.");
              } catch { }
            },
          },
        ]
      );
    } else {
      router.push({
        pathname: "/transaction_details",
        params: {
          id: activeTicket.id,
          name: activeTicket.locationName,
          bayNumber: activeTicket.spaceNumber,
          plate: activeTicket.plate,
          duration: `${elapsedHours} Hours (${extraHours}h Overdue)`,
          durationHours: elapsedHours.toString(),
          cost: overdueCost.toString(),
          currency: "RWF",
          receiptNumber: "309",
          entryTime: activeTicket.entryTime.toISOString(),
          violationFine: "",
          violationReason: `Overtime (+${extraHours}h)`,
          isOverdue: "true",
          overdueCost: overdueCost.toString(),
          prepaidHours: prepaidHours.toString(),
        },
      });
    }
  };

  const handleExtendTime = () => {
    if (!activeTicket) return;
    const updated = {
      ...activeTicket,
      durationHours: (activeTicket.durationHours || 2) + 1,
    };
    setActiveTicket(updated);
    AsyncStorage.setItem("@parkzone_active_ticket", JSON.stringify(updated)).catch(() => { });
    Alert.alert("Hold Extended", "Added +1 hour to your parking session.");
  };

  // Filtered recent parking history
  const filteredHistory = useMemo(() => {
    return parkingHistory.filter((item) => {
      // Filter tab check
      if (activeFilter === "Completed" && item.status !== "Completed" && item.status !== "Closed") {
        return false;
      }
      if (activeFilter === "Active" && item.status !== "Active") {
        return false;
      }
      if (activeFilter === "Fines" && !item.violationFine) {
        return false;
      }

      // Search query check
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesAddr = item.address.toLowerCase().includes(q);
        const matchesBay = item.bayNumber.toLowerCase().includes(q);
        const matchesPlate = item.plate.toLowerCase().includes(q);
        const matchesReceipt = item.receiptNumber.toLowerCase().includes(q);
        if (!matchesName && !matchesAddr && !matchesBay && !matchesPlate && !matchesReceipt) {
          return false;
        }
      }

      return true;
    });
  }, [parkingHistory, activeFilter, searchQuery]);

  // Render top active session or empty SVG state
  const renderActiveCard = () => {
    if (!activeTicket) {
      return (
        <View
          style={[
            styles.idleSessionCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.cardShadow,
            },
          ]}
        >
          {/* Custom Modern SVG Illustration (NO 00:00:00 counter!) */}
          <EmptySessionIllustration isDark={theme.isDark} />

          <Text style={[styles.idleTitle, { color: theme.text }]}>
            No Active Parking Session
          </Text>
          <Text style={[styles.idleSubtitle, { color: theme.textSecondary }]}>
            Your vehicle is not checked into any bay. Explore available lots or scan a space QR
            code to activate live telemetry.
          </Text>

          <View style={styles.idleActionsRow}>
            <TouchableOpacity
              style={[styles.idlePrimaryBtn, { backgroundColor: theme.primaryBtnBg }]}
              onPress={() => router.push("/(tabs)/home")}
              activeOpacity={0.85}
            >
              <Ionicons name="compass-outline" size={16} color={theme.primaryBtnText} />
              <Text style={[styles.idlePrimaryBtnText, { color: theme.primaryBtnText }]}>
                Explore Parking Lots
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.idleSecondaryBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
              onPress={() => router.push("/(tabs)/home")}
              activeOpacity={0.8}
            >
              <Ionicons name="qr-code-outline" size={15} color={theme.text} />
              <Text style={[styles.idleSecondaryBtnText, { color: theme.text }]}>Scan Bay QR</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Active Ticket Live Telemetry View
    const billedHours = Math.max(1, Math.ceil(elapsedSeconds / 3600));
    const baseCost = billedHours * (activeTicket.hourlyRate || 300);
    const fine = activeTicket.violationFine || 0;
    const totalCost = baseCost + fine;

    const remSecs = Math.max(0, totalBookedSeconds - elapsedSeconds);
    const cardProgress = Math.min(1.0, Math.max(0.06, elapsedSeconds / totalBookedSeconds));
    const cardSvgSize = 190;
    const cardStroke = 14;
    const cardRadius = (cardSvgSize - cardStroke * 2) / 2;
    const cardCircumference = 2 * Math.PI * cardRadius;
    const cardDashoffset = cardCircumference * (1 - cardProgress);

    const arriveStr = new Date(activeTicket.entryTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const exitMs = new Date(activeTicket.entryTime).getTime() + totalBookedSeconds * 1000;
    const exitStr = new Date(exitMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    return (
      <View style={styles.activeSessionCard}>
        {/* Header Badge */}
        <View style={styles.activeCardHeader}>
          <Text style={styles.activeCardTitleText}>Parking Session</Text>
          <View style={styles.liveIndicatorRow}>
            <View style={styles.livePulsingDot} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        </View>

        {/* Circular Progress Dial with Vertical Car in Center */}
        <View style={styles.activeDialWrapper}>
          <View style={[styles.activeSvgContainer, { width: cardSvgSize, height: cardSvgSize }]}>
            <Svg width={cardSvgSize} height={cardSvgSize} viewBox={`0 0 ${cardSvgSize} ${cardSvgSize}`}>
              <Circle
                cx={cardSvgSize / 2}
                cy={cardSvgSize / 2}
                r={cardRadius}
                stroke="#EEF2F6"
                strokeWidth={cardStroke}
                fill="none"
              />
              <Circle
                cx={cardSvgSize / 2}
                cy={cardSvgSize / 2}
                r={cardRadius}
                stroke={isOverdue ? "#EF4444" : "#000"}
                strokeWidth={cardStroke}
                strokeDasharray={cardCircumference}
                strokeDashoffset={cardDashoffset}
                strokeLinecap="round"
                fill="none"
                transform={`translate(${cardSvgSize}, 0) scale(-1, 1) rotate(-90 ${cardSvgSize / 2} ${cardSvgSize / 2})`}
              />
              <Circle
                cx={cardSvgSize / 2}
                cy={cardSvgSize / 2 - cardRadius}
                r={cardStroke / 2 - 1}
                fill="#000"
                stroke="#FFFFFF"
                strokeWidth={2.5}
              />
            </Svg>
          </View>

          {/* Large Bold Digital Timer */}
          <Text style={styles.activeTimerDigitsBold}>
            {isOverdue ? `+${formatTimer(elapsedSeconds - totalBookedSeconds)}` : formatTimer(remSecs)}
          </Text>
          <Text style={styles.activeTimerSubLabel}>Remaining Parking Time</Text>
        </View>

        {/* Slot Detail Box */}
        <View style={styles.activeSlotInnerCard}>
          <Text style={styles.activeSlotTitleText}>Slot {activeTicket.spaceNumber}</Text>

          <View style={styles.activeTimelineRow}>
            <View style={{ minWidth: 65 }}>
              <Text style={styles.activeTimelineLabel}>Arrive after</Text>
              <Text style={styles.activeTimelineTime}>{arriveStr}</Text>
            </View>

            <View style={styles.activeTimelineCenter}>
              <View style={styles.activeTimelineLine} />
              <View style={styles.activeTimelinePill}>
                <Text style={styles.activeTimelinePillText}>{activeTicket.durationHours} Hours</Text>
              </View>
              <View style={styles.activeTimelineLine} />
            </View>

            <View style={{ minWidth: 65, alignItems: "flex-end" }}>
              <Text style={styles.activeTimelineLabel}>Exit before</Text>
              <Text style={styles.activeTimelineTime}>{exitStr}</Text>
            </View>
          </View>

          {/* Municipal Violation Fine Warning Badge (if applicable) */}
          {activeTicket.violationFine ? (
            <View style={styles.activeViolationFineBanner}>
              <Ionicons name="warning" size={15} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeViolationFineTitle}>
                  +{activeTicket.violationFine.toLocaleString()} RWF Fine Applied
                </Text>
                <Text style={styles.activeViolationFineSub}>
                  {activeTicket.violationReason || "Restricted bay violation"}
                </Text>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.activeFindVehicleBtn}
            onPress={() => {
              Alert.alert(
                "Find My Vehicle",
                `Your vehicle (${activeTicket.plate}) is parked in Slot ${activeTicket.spaceNumber} at ${activeTicket.locationName}.`,
                [{ text: "OK" }]
              );
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="location-outline" size={16} color="#000" />
            <Text style={styles.activeFindVehicleBtnText}>Find My Vehicle</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons Row: Extend Time & End Parking */}
        <View style={styles.activeActionsRow}>
          <TouchableOpacity
            style={styles.activeExtendBtn}
            onPress={handleExtendTime}
            activeOpacity={0.85}
          >
            <Text style={styles.activeExtendBtnText}>Extend Time</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.activeEndBtn}
            onPress={handleEndParking}
            activeOpacity={0.85}
          >
            <Text style={styles.activeEndBtnText}>
              {isOverdue ? "Pay Overdue & Close" : "Close Booking"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render recent parking record item
  const renderHistoryItem = ({ item }: { item: ParkingHistoryRecord }) => {
    const isCompleted = item.status === "Completed" || item.status === "Closed";
    const hasFine = Boolean(item.violationFine);

    return (
      <TouchableOpacity
        style={[
          styles.historyCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            shadowColor: theme.cardShadow,
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
        <Image source={{ uri: item.image }} style={styles.historyThumbImg} />

        <View style={styles.historyCardCenter}>
          <View style={styles.historyTitleRow}>
            <Text style={[styles.historyLocationName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View
              style={[
                styles.historyStatusPill,
                {
                  backgroundColor: isCompleted
                    ? theme.isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.06)"
                    : "rgba(16, 185, 129, 0.15)",
                },
              ]}
            >
              <Text
                style={[
                  styles.historyStatusPillText,
                  { color: isCompleted ? theme.textSecondary : "#10B981" },
                ]}
              >
                {item.status}
              </Text>
            </View>
          </View>

          <Text style={[styles.historyAddressText, { color: theme.textSecondary }]} numberOfLines={1}>
            {item.address}
          </Text>

          {/* Bay and Plate Badges */}
          <View style={styles.historyBadgesRow}>
            <View style={[styles.historyBayBadge, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Ionicons name="car-outline" size={10} color={theme.text} />
              <Text style={[styles.historyBayBadgeText, { color: theme.text }]}>
                Bay {item.bayNumber}
              </Text>
            </View>

            <View style={[styles.historyBayBadge, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Text style={[styles.historyBayBadgeText, { color: theme.textSecondary }]}>
                {item.plate}
              </Text>
            </View>

            <Text style={[styles.historyDateText, { color: theme.textSecondary }]}>
              {item.date} • {item.duration}
            </Text>
          </View>

          {/* Municipal Violation Fine Badge (if recorded) */}
          {hasFine && (
            <View style={styles.historyFineBadge}>
              <Ionicons name="warning" size={11} color="#EF4444" />
              <Text style={styles.historyFineBadgeText}>
                +{item.violationFine?.toLocaleString()} RWF Fine ({item.violationReason})
              </Text>
            </View>
          )}
        </View>

        <View style={styles.historyCardRight}>
          <Text style={[styles.historyCostText, { color: theme.text }]}>
            {item.cost.toLocaleString()} {item.currency}
          </Text>
          <TouchableOpacity
            onPress={() => setSelectedInvoice(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.receiptBtnText, { color: theme.textSecondary }]}>
              Receipt ›
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={["top"]}>
      {/* Top App Bar Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.headerNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.push("/(tabs)/home")}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Parking History</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Active telemetry & recent receipts
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.headerNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <Ionicons name="reload-outline" size={17} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Filter and Search Bar */}
      <View style={styles.searchFilterWrapper}>
        <View style={[styles.searchBarBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={16} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by location, bay, plate, receipt..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills Row */}
        <View style={styles.filterPillsRow}>
          {(["All", "Completed", "Active", "Fines"] as const).map((cat) => {
            const isSelected = activeFilter === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected ? theme.pillActiveBg : theme.surface,
                    borderColor: isSelected ? theme.pillActiveBg : theme.border,
                  },
                ]}
                onPress={() => setActiveFilter(cat)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: isSelected ? theme.pillActiveText : theme.textSecondary },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Main List */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.text} />
        </View>
      ) : (
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View>
              {renderActiveCard()}
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Parking Sessions</Text>
                <Text style={[styles.historyCountText, { color: theme.textSecondary }]}>
                  {filteredHistory.length} {filteredHistory.length === 1 ? "record" : "records"}
                </Text>
              </View>
            </View>
          }
          renderItem={renderHistoryItem}
          ListEmptyComponent={
            <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Ionicons name="file-tray-outline" size={32} color={theme.textSecondary} style={{ marginBottom: 8 }} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No parking sessions found</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                {searchQuery
                  ? `No records matching "${searchQuery}".`
                  : "Completed parking stays and municipal receipts will appear here."}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.text}
              colors={[theme.text]}
            />
          }
        />
      )}

      {/* Itemized Digital Invoice Receipt Modal */}
      <Modal
        visible={!!selectedInvoice}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedInvoice(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Header */}
            <View style={styles.invoiceHeaderRow}>
              <View>
                <Text style={[styles.invoiceHeaderBrand, { color: theme.text }]}>PARKZONE RWANDA</Text>
                <Text style={[styles.invoiceHeaderSub, { color: theme.textSecondary }]}>
                  Official Digital Fiscal Receipt
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedInvoice(null)}
                style={[styles.invoiceCloseBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            {selectedInvoice && (
              <View style={styles.invoiceContent}>
                {/* Receipt Details Box */}
                <View style={[styles.invoiceMetaCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <View style={styles.invoiceRow}>
                    <Text style={[styles.invoiceLabel, { color: theme.textSecondary }]}>Receipt No:</Text>
                    <Text style={[styles.invoiceValue, { color: theme.text }]}>#{selectedInvoice.receiptNumber}</Text>
                  </View>
                  <View style={styles.invoiceRow}>
                    <Text style={[styles.invoiceLabel, { color: theme.textSecondary }]}>Location:</Text>
                    <Text style={[styles.invoiceValue, { color: theme.text }]}>{selectedInvoice.name}</Text>
                  </View>
                  <View style={styles.invoiceRow}>
                    <Text style={[styles.invoiceLabel, { color: theme.textSecondary }]}>Bay & Zone:</Text>
                    <Text style={[styles.invoiceValue, { color: theme.text }]}>
                      Bay {selectedInvoice.bayNumber} ({selectedInvoice.zoneCode})
                    </Text>
                  </View>
                  <View style={styles.invoiceRow}>
                    <Text style={[styles.invoiceLabel, { color: theme.textSecondary }]}>Vehicle Plate:</Text>
                    <Text style={[styles.invoiceValue, { color: theme.text }]}>{selectedInvoice.plate}</Text>
                  </View>
                  <View style={styles.invoiceRow}>
                    <Text style={[styles.invoiceLabel, { color: theme.textSecondary }]}>Date & Time:</Text>
                    <Text style={[styles.invoiceValue, { color: theme.text }]}>{selectedInvoice.date}</Text>
                  </View>
                  <View style={styles.invoiceRow}>
                    <Text style={[styles.invoiceLabel, { color: theme.textSecondary }]}>Duration:</Text>
                    <Text style={[styles.invoiceValue, { color: theme.text }]}>{selectedInvoice.duration}</Text>
                  </View>
                </View>

                {/* Charges Itemization */}
                <View style={styles.chargesSection}>
                  <View style={styles.invoiceRow}>
                    <Text style={[styles.invoiceLabel, { color: theme.textSecondary }]}>Base Parking Tariff:</Text>
                    <Text style={[styles.invoiceValue, { color: theme.text }]}>
                      {(selectedInvoice.cost - (selectedInvoice.violationFine || 0)).toLocaleString()} RWF
                    </Text>
                  </View>

                  {selectedInvoice.violationFine ? (
                    <View style={styles.invoiceRow}>
                      <Text style={[styles.invoiceLabel, { color: "#EF4444" }]}>
                        ⚠️ Contravention Fine ({selectedInvoice.violationReason}):
                      </Text>
                      <Text style={[styles.invoiceValue, { color: "#EF4444", fontWeight: "900" }]}>
                        +{selectedInvoice.violationFine.toLocaleString()} RWF
                      </Text>
                    </View>
                  ) : null}

                  <View style={[styles.invoiceDivider, { backgroundColor: theme.border }]} />

                  <View style={styles.invoiceRow}>
                    <Text style={[styles.invoiceTotalLabel, { color: theme.text }]}>TOTAL SETTLED:</Text>
                    <Text style={[styles.invoiceTotalValue, { color: theme.text }]}>
                      {selectedInvoice.cost.toLocaleString()} {selectedInvoice.currency}
                    </Text>
                  </View>
                </View>

                {/* Fiscal Verified Badge */}
                <View style={[styles.fiscalVerifiedBadge, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                  <Text style={[styles.fiscalVerifiedText, { color: theme.textSecondary }]}>
                    RRA Electronic Billing Machine (EBM) Verified • Authorized by City of Kigali
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.invoiceDoneBtn, { backgroundColor: theme.primaryBtnBg }]}
                  onPress={() => setSelectedInvoice(null)}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.invoiceDoneBtnText, { color: theme.primaryBtnText }]}>
                    Close Receipt
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Activities;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    fontWeight: "500",
    marginTop: 2,
  },
  searchFilterWrapper: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchBarBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    height: "100%",
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  // Idle Session Card (SVG graphic, no 00:00:00 counter)
  idleSessionCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  idleTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
  },
  idleSubtitle: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 16,
  },
  idleActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    width: "100%",
  },
  idlePrimaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    paddingVertical: 12,
  },
  idlePrimaryBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  idleSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  idleSecondaryBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  // Active Session Card
  activeSessionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  activeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  activeCardTitleText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  liveIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  livePulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#000",
  },
  liveBadgeText: {
    color: "#22C55E",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  activeDialWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 12,
  },
  activeSvgContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  activeCarCenterPosition: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  activeTimerDigitsBold: {
    fontSize: 36,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
    marginTop: 12,
  },
  activeTimerSubLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#94A3B8",
    marginTop: 4,
  },
  activeSlotInnerCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 14,
    marginBottom: 14,
  },
  activeSlotTitleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  activeTimelineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  activeTimelineLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#94A3B8",
    marginBottom: 3,
  },
  activeTimelineTime: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
  },
  activeTimelineCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  activeTimelineLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  activeTimelinePill: {
    borderWidth: 1.5,
    borderColor: "#000",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginHorizontal: 4,
  },
  activeTimelinePillText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#000",
  },
  activeViolationFineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  activeViolationFineTitle: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "800",
  },
  activeViolationFineSub: {
    color: "#F87171",
    fontSize: 10,
    marginTop: 1,
  },
  activeFindVehicleBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#000",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 10,
  },
  activeFindVehicleBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#000",
  },
  activeActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  activeExtendBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    borderRadius: 22,
    paddingVertical: 13,
  },
  activeExtendBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  activeEndBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    borderRadius: 22,
    paddingVertical: 13,
  },
  activeEndBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  // Section Header
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  historyCountText: {
    fontSize: 11,
    fontWeight: "700",
  },
  // History Item Card
  historyCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  historyThumbImg: {
    width: 58,
    height: 58,
    borderRadius: 12,
    marginRight: 12,
  },
  historyCardCenter: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  historyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  historyLocationName: {
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },
  historyStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  historyStatusPillText: {
    fontSize: 9,
    fontWeight: "800",
  },
  historyAddressText: {
    fontSize: 11,
    marginTop: 2,
  },
  historyBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
    flexWrap: "wrap",
  },
  historyBayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  historyBayBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  historyDateText: {
    fontSize: 10,
    fontWeight: "500",
  },
  historyFineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  historyFineBadgeText: {
    color: "#EF4444",
    fontSize: 9,
    fontWeight: "800",
  },
  historyCardRight: {
    alignItems: "flex-end",
  },
  historyCostText: {
    fontSize: 13,
    fontWeight: "900",
  },
  receiptBtnText: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  emptySub: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  // Invoice Receipt Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  invoiceHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  invoiceHeaderBrand: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  invoiceHeaderSub: {
    fontSize: 11,
    marginTop: 2,
  },
  invoiceCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  invoiceContent: {
    gap: 12,
  },
  invoiceMetaCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  invoiceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  invoiceLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  invoiceValue: {
    fontSize: 11,
    fontWeight: "800",
  },
  chargesSection: {
    gap: 8,
    marginTop: 4,
  },
  invoiceDivider: {
    height: 1,
    marginVertical: 4,
  },
  invoiceTotalLabel: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  invoiceTotalValue: {
    fontSize: 16,
    fontWeight: "900",
  },
  fiscalVerifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginVertical: 4,
  },
  fiscalVerifiedText: {
    fontSize: 10,
    fontWeight: "600",
    flex: 1,
    lineHeight: 14,
  },
  invoiceDoneBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  invoiceDoneBtnText: {
    fontSize: 13,
    fontWeight: "800",
  },
});