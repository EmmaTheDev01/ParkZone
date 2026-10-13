import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../hooks/useTheme";
import { PARKING_HISTORY_STORAGE_KEY } from "./recent_parkings";

const { width } = Dimensions.get("window");

export interface ParkingSessionDetails {
  id: string;
  name: string;
  address?: string;
  bayNumber: string;
  zoneCode?: string;
  plate?: string;
  date?: string;
  duration?: string;
  durationHours?: number;
  cost?: number;
  currency?: string;
  status?: "Active" | "Completed" | "Closed";
  receiptNumber?: string;
  entryTime?: Date | string;
  violationFine?: number;
  violationReason?: string;
}

export default function ParkingSessionScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams();

  // Session state initialized from route params or fallback
  const [session, setSession] = useState<ParkingSessionDetails>(() => {
    const rawCost = params.cost ? Number(params.cost) : 400;
    const rawFine = params.violationFine ? Number(params.violationFine) : undefined;
    const rawHours = params.durationHours ? Number(params.durationHours) : undefined;

    return {
      id: (params.id as string) || "session-active",
      name: (params.name as string) || "Downtown Boulevard",
      address: (params.address as string) || "321 Downtown Boulevard, Business Bay",
      bayNumber: (params.bayNumber as string) || "A-09",
      zoneCode: (params.zoneCode as string) || "Zone A",
      plate: (params.plate as string) || "RAD 812 B",
      date: (params.date as string) || "Today, 10:00 AM",
      duration: (params.duration as string) || "1h 00m",
      durationHours: rawHours,
      cost: isNaN(rawCost) ? 400 : rawCost,
      currency: (params.currency as string) || "RWF",
      status: ((params.status as string) || "Active") as "Active" | "Completed" | "Closed",
      receiptNumber: (params.receiptNumber as string) || "PZ-2026-9901",
      entryTime: (params.entryTime as string) || new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      violationFine: rawFine,
      violationReason: (params.violationReason as string) || undefined,
    };
  });

  const [currentTick, setCurrentTick] = useState(Date.now());
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);

  // Live timer interval if session is Active
  useEffect(() => {
    if (session.status !== "Active") return;
    const interval = setInterval(() => {
      setCurrentTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [session.status]);

  // Parse entry time & calculate duration
  const entryMs = useMemo(() => {
    if (!session.entryTime) return Date.now() - 40 * 60 * 1000;
    const parsed = new Date(session.entryTime).getTime();
    return isNaN(parsed) ? Date.now() - 40 * 60 * 1000 : parsed;
  }, [session.entryTime]);

  const durationHours = useMemo(() => {
    if (session.durationHours && session.durationHours > 0) return session.durationHours;
    if (session.duration) {
      const match = session.duration.match(/(\d+)\s*h(?:our)?/i);
      if (match) return parseInt(match[1], 10);
      const numMatch = parseFloat(session.duration);
      if (!isNaN(numMatch) && numMatch > 0) return numMatch;
    }
    return 1;
  }, [session.durationHours, session.duration]);

  const totalSeconds = Math.max(1, durationHours * 3600);
  const elapsedSeconds = Math.max(0, Math.floor((currentTick - entryMs) / 1000));
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const isActive = session.status === "Active";
  const isOverdue = isActive && elapsedSeconds > totalSeconds;

  // Circular gauge progress (0 to 1)
  const progress = useMemo(() => {
    if (!isActive) return 1.0;
    return Math.min(1.0, Math.max(0.06, elapsedSeconds / totalSeconds));
  }, [isActive, elapsedSeconds, totalSeconds]);

  // Digital countdown string HH:MM:SS
  const formatTimerDigits = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(hrs)}:${pad(mins)}:${pad(s)}`;
  };

  // Timestamps
  const arriveTimeStr = useMemo(() => {
    return new Date(entryMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [entryMs]);

  const exitTimeStr = useMemo(() => {
    const exitMs = entryMs + totalSeconds * 1000;
    return new Date(exitMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [entryMs, totalSeconds]);

  // Svg ring dimensions matching the reference design
  const svgSize = Math.min(width * 0.72, 260);
  const strokeWidth = 16;
  const radius = (svgSize - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const activeColor = isOverdue ? "#EF4444" : (theme.isDark ? "#FFFFFF" : "#09090B");
  const trackColor = theme.isDark ? "rgba(255, 255, 255, 0.10)" : "#E4E4E7";

  // Handle Extend Time
  const handleExtendTime = async () => {
    const newHours = durationHours + 1;
    setSession((prev) => ({
      ...prev,
      durationHours: newHours,
      duration: `${newHours}h 00m`,
      cost: (prev.cost || 400) + 300,
    }));

    try {
      // Update active ticket in AsyncStorage if it matches
      const rawActive = await AsyncStorage.getItem("@parkzone_active_ticket");
      if (rawActive) {
        const parsed = JSON.parse(rawActive);
        parsed.durationHours = newHours;
        await AsyncStorage.setItem("@parkzone_active_ticket", JSON.stringify(parsed));
      }
    } catch { }

    Alert.alert(
      "Parking Extended",
      `Your session in Slot ${session.bayNumber} has been extended by 1 hour (+300 RWF).\nNew departure time: ${exitTimeStr}`,
      [{ text: "OK" }]
    );
  };

  // Handle End Parking -> Close booking directly if within prepaid duration, or pay overdue if exceeded
  const handleEndParking = () => {
    const elapsedHours = Math.max(1, Math.ceil(elapsedSeconds / 3600));
    const extraHours = Math.max(0, elapsedHours - durationHours);
    const overdueCost = extraHours * 300;

    if (overdueCost === 0) {
      Alert.alert(
        "Close Booking",
        `Spot: ${session.bayNumber} (${session.name})\nElapsed Time: ${formatTimerDigits(elapsedSeconds)}\nBooked Duration: ${durationHours} Hour(s) (Pre-paid)\nTotal Extra Due: 0 RWF\n\nYour session was already paid before booking.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Close Booking",
            onPress: async () => {
              try {
                await AsyncStorage.removeItem("@parkzone_active_ticket");
                const rawHistory = await AsyncStorage.getItem(PARKING_HISTORY_STORAGE_KEY);
                if (rawHistory) {
                  const history = JSON.parse(rawHistory);
                  const idx = history.findIndex((h: any) => h.id === session.id || h.status === "Active");
                  if (idx >= 0) {
                    history[idx].status = "Completed";
                    await AsyncStorage.setItem(PARKING_HISTORY_STORAGE_KEY, JSON.stringify(history));
                  }
                }
                Alert.alert("Booking Closed", "Parking session finished. Pre-paid booking covered this session in full.");
                router.replace("/(tabs)/home");
              } catch {
                router.replace("/(tabs)/home");
              }
            },
          },
        ]
      );
    } else {
      router.push({
        pathname: "/transaction_details",
        params: {
          id: session.id,
          name: session.name,
          address: session.address,
          bayNumber: session.bayNumber,
          zoneCode: session.zoneCode,
          plate: session.plate,
          date: session.date,
          duration: `${elapsedHours} Hours (${extraHours}h Overdue)`,
          durationHours: elapsedHours.toString(),
          cost: overdueCost.toString(),
          currency: session.currency || "RWF",
          receiptNumber: session.receiptNumber || "309",
          entryTime: session.entryTime?.toString(),
          violationFine: "",
          violationReason: `Overtime (+${extraHours}h)`,
          isOverdue: "true",
          overdueCost: overdueCost.toString(),
          prepaidHours: durationHours.toString(),
        },
      });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
      {/* Header Row: Centered "Parking Session" with subtle back button */}
      <View style={styles.topHeaderRow}>
        <TouchableOpacity
          style={[styles.headerNavBtn, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>

        <Text style={[styles.screenHeaderTitle, { color: theme.text }]}>Parking Session</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Circular Progress Dial */}
        <View style={styles.dialWrapper}>
          <View style={[styles.svgRingContainer, { width: svgSize, height: svgSize }]}>
            <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
              {/* Background Circular Track */}
              <Circle
                cx={svgSize / 2}
                cy={svgSize / 2}
                r={radius}
                stroke={trackColor}
                strokeWidth={strokeWidth}
                fill="none"
              />

              {/* Active Progress Arc */}
              <Circle
                cx={svgSize / 2}
                cy={svgSize / 2}
                r={radius}
                stroke={activeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                transform={`translate(${svgSize}, 0) scale(-1, 1) rotate(-90 ${svgSize / 2} ${svgSize / 2})`}
              />

              {/* Top Anchor Bead */}
              <Circle
                cx={svgSize / 2}
                cy={svgSize / 2 - radius}
                r={strokeWidth / 2 - 1}
                fill={activeColor}
                stroke={theme.surface}
                strokeWidth={3}
              />
            </Svg>
          </View>

          {/* Large Bold Digital Timer Digits */}
          <Text style={[styles.timerDigitsBold, { color: theme.text }]}>
            {isActive
              ? isOverdue
                ? `+${formatTimerDigits(elapsedSeconds - totalSeconds)}`
                : formatTimerDigits(remainingSeconds)
              : session.duration || "00:20:15"}
          </Text>

          <Text style={[styles.timerSubLabel, { color: theme.textSecondary }]}>
            Remaining Parking Time
          </Text>
        </View>

        {/* Slot & Schedule Detail Card */}
        <View style={[styles.slotScheduleCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.cardShadow }]}>
          {/* Card Title */}
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.slotTitleText, { color: theme.text }]}>
              Slot {session.bayNumber}
            </Text>
          </View>

          {/* Timeline Row: Arrive after <---> [1 Hours] <---> Exit before */}
          <View style={styles.timelineRow}>
            <View style={styles.timelineCol}>
              <Text style={[styles.timelineColLabel, { color: theme.textSecondary }]}>Arrive after</Text>
              <Text style={[styles.timelineColTime, { color: theme.text }]}>{arriveTimeStr}</Text>
            </View>

            <View style={styles.timelineCenterDivider}>
              <View style={[styles.timelineDottedLine, { backgroundColor: theme.border }]} />
              <View style={[styles.timelinePill, { borderColor: theme.borderStrong, backgroundColor: theme.background }]}>
                <Text style={[styles.timelinePillText, { color: theme.text }]}>
                  {durationHours} {durationHours === 1 ? "Hour" : "Hours"}
                </Text>
              </View>
              <View style={[styles.timelineDottedLine, { backgroundColor: theme.border }]} />
            </View>

            <View style={[styles.timelineCol, { alignItems: "flex-end" }]}>
              <Text style={[styles.timelineColLabel, { color: theme.textSecondary }]}>Exit before</Text>
              <Text style={[styles.timelineColTime, { color: theme.text }]}>{exitTimeStr}</Text>
            </View>
          </View>

          {/* Fine Banner if applicable */}
          {session.violationFine ? (
            <View style={styles.fineWarningBox}>
              <Ionicons name="warning" size={15} color="#EF4444" />
              <View style={{ flex: 1 }}>
                <Text style={styles.fineWarningTitle}>
                  +{session.violationFine.toLocaleString()} RWF Municipal Fine Applied
                </Text>
                <Text style={styles.fineWarningSub}>
                  {session.violationReason || "Designated slot contravention"}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Find My Vehicle Button */}
          <TouchableOpacity
            style={[styles.findVehicleBtn, { borderColor: theme.borderStrong, backgroundColor: theme.background }]}
            onPress={() => {
              Alert.alert(
                "Find My Vehicle",
                `Your vehicle (${session.plate || "RAD 812 B"}) is parked at Slot ${session.bayNumber} in ${session.name}.\n\nFollow level markers to Zone ${session.zoneCode || "A"}.`,
                [
                  { text: "Dismiss", style: "cancel" },
                  {
                    text: "Open Map Navigator",
                    onPress: () => router.push("/(tabs)/home"),
                  },
                ]
              );
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="location-outline" size={17} color={theme.text} />
            <Text style={[styles.findVehicleBtnText, { color: theme.text }]}>Find My Vehicle</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Action Buttons: Extend Time & End Parking */}
      <View style={[styles.bottomActionsRow, { backgroundColor: theme.surface, borderTopColor: theme.border, borderTopWidth: 1 }]}>
        {isActive ? (
          <>
            <TouchableOpacity
              style={[
                styles.extendTimeBtn,
                {
                  backgroundColor: theme.isDark ? "rgba(255,255,255,0.10)" : "#F4F4F6",
                  borderColor: theme.borderStrong,
                  borderWidth: 1,
                },
              ]}
              onPress={handleExtendTime}
              activeOpacity={0.85}
            >
              <Text style={[styles.extendTimeBtnText, { color: theme.text }]}>Extend Time</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.endParkingBtn,
                {
                  backgroundColor: isOverdue ? "#EF4444" : theme.primaryBtnBg,
                },
              ]}
              onPress={handleEndParking}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.endParkingBtnText,
                  { color: isOverdue ? "#FFFFFF" : theme.primaryBtnText },
                ]}
              >
                {isOverdue ? "Pay Overdue & Close" : "Close Booking"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.extendTimeBtn, { backgroundColor: theme.primaryBtnBg }]}
              onPress={() => setReceiptModalVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="receipt-outline" size={16} color={theme.primaryBtnText} />
              <Text style={[styles.extendTimeBtnText, { color: theme.primaryBtnText }]}>View Receipt</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.endParkingBtn,
                { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
              ]}
              onPress={() => router.back()}
              activeOpacity={0.8}
            >
              <Text style={[styles.endParkingBtnText, { color: theme.text }]}>Back</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Fiscal Receipt Modal */}
      <Modal
        visible={receiptModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiptModalVisible(false)}
      >
        <View style={styles.receiptOverlay}>
          <View style={[styles.receiptCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.receiptHeader}>
              <View>
                <Text style={[styles.receiptHeaderBrand, { color: theme.text }]}>PARKZONE RWANDA</Text>
                <Text style={[styles.receiptHeaderSub, { color: theme.textSecondary }]}>
                  Official Digital Fiscal Receipt
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setReceiptModalVisible(false)}
                style={[styles.receiptCloseBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
              >
                <Ionicons name="close" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.receiptBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: theme.textSecondary }]}>Receipt No:</Text>
                <Text style={[styles.receiptVal, { color: theme.text }]}>#{session.receiptNumber}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: theme.textSecondary }]}>Location:</Text>
                <Text style={[styles.receiptVal, { color: theme.text }]}>{session.name}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: theme.textSecondary }]}>Slot:</Text>
                <Text style={[styles.receiptVal, { color: theme.text }]}>
                  {session.bayNumber} ({session.zoneCode || "Zone A"})
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: theme.textSecondary }]}>Vehicle:</Text>
                <Text style={[styles.receiptVal, { color: theme.text }]}>{session.plate}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: theme.textSecondary }]}>Duration:</Text>
                <Text style={[styles.receiptVal, { color: theme.text }]}>{session.duration}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: theme.textSecondary }]}>Total Paid:</Text>
                <Text style={[styles.receiptVal, { color: "#10B981", fontWeight: "800" }]}>
                  {session.cost?.toLocaleString()} {session.currency || "RWF"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.receiptDoneBtn, { backgroundColor: theme.primaryBtnBg }]}
              onPress={() => setReceiptModalVisible(false)}
            >
              <Text style={[styles.receiptDoneBtnText, { color: theme.primaryBtnText }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  topHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 4 : 8,
    paddingBottom: 8,
  },
  headerNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 40,
  },
  screenHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },
  scrollContent: {
    paddingBottom: 24,
    alignItems: "center",
  },
  dialWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  svgRingContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  carCenterPosition: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  timerDigitsBold: {
    fontSize: 44,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
    marginTop: 16,
  },
  timerSubLabel: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#94A3B8",
    marginTop: 4,
  },
  slotScheduleCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 18,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  cardHeaderRow: {
    marginBottom: 16,
  },
  slotTitleText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  timelineCol: {
    minWidth: 70,
  },
  timelineColLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
    marginBottom: 4,
  },
  timelineColTime: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  timelineCenterDivider: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  timelineDottedLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  timelinePill: {
    borderWidth: 1.5,
    borderColor: "#000",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 4,
  },
  timelinePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000",
  },
  fineWarningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  fineWarningTitle: {
    color: "#EF4444",
    fontSize: 11,
    fontWeight: "800",
  },
  fineWarningSub: {
    color: "#F87171",
    fontSize: 10,
    marginTop: 1,
  },
  findVehicleBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#000",
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    paddingVertical: 12,
  },
  findVehicleBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#050505ff",
  },
  bottomActionsRow: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 16 : 20,
  },
  extendTimeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#000",
    borderRadius: 25,
    paddingVertical: 14,
  },
  extendTimeBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  endParkingBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    borderRadius: 25,
    paddingVertical: 14,
  },
  endParkingBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  receiptOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  receiptCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  receiptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  receiptHeaderBrand: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  receiptHeaderSub: {
    fontSize: 11,
    marginTop: 2,
  },
  receiptCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  receiptBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    marginBottom: 16,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  receiptLabel: {
    fontSize: 12,
  },
  receiptVal: {
    fontSize: 12,
    fontWeight: "700",
  },
  receiptDoneBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  receiptDoneBtnText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
