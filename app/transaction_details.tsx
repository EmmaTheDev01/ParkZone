import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../hooks/useTheme";
import { PARKING_HISTORY_STORAGE_KEY } from "./recent_parkings";

const { width } = Dimensions.get("window");

interface PaymentMethodOption {
  id: string;
  name: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  isDefault?: boolean;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: "balance",
    name: "ParkZone Balance",
    subtitle: "Balance • 42,190 RWF",
    icon: "cash-outline",
    isDefault: true,
  },
  {
    id: "momo",
    name: "MTN Mobile Money",
    subtitle: "078 ••• •812 • Instant Pay",
    icon: "phone-portrait-outline",
  },
  {
    id: "airtel",
    name: "Airtel Money",
    subtitle: "073 ••• •441 • Instant Pay",
    icon: "flash-outline",
  },
  {
    id: "card",
    name: "Debit / Credit Card",
    subtitle: "Visa ending in •••• 4242",
    icon: "card-outline",
  },
];

export default function TransactionDetailsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams();

  // Route parameters or sensible fallbacks matching screenshot
  const sessionData = useMemo(() => {
    const rawCost = params.cost ? Number(params.cost) : 400;
    const rawFine = params.violationFine ? Number(params.violationFine) : 0;
    const rawHours = params.durationHours ? Number(params.durationHours) : 1;

    return {
      id: (params.id as string) || "session-active",
      name: (params.name as string) || "Toserba Yogya Car Parking",
      address: (params.address as string) || "2nd Floor / A Sector",
      bayNumber: (params.bayNumber as string) || "A-09",
      zoneCode: (params.zoneCode as string) || "Sector A",
      plate: (params.plate as string) || "RAD 812 B",
      date: (params.date as string) || "28 July 2023",
      duration: (params.duration as string) || "1 Hours",
      durationHours: rawHours,
      cost: isNaN(rawCost) ? 400 : rawCost,
      currency: (params.currency as string) || "RWF",
      receiptNumber: (params.receiptNumber as string) || "309",
      entryTime: (params.entryTime as string) || new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      violationFine: isNaN(rawFine) ? 0 : rawFine,
      violationReason: (params.violationReason as string) || "",
    };
  }, [params]);

  // Payment method selection
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodOption>(PAYMENT_METHODS[0]);
  const [methodPickerVisible, setMethodPickerVisible] = useState(false);

  // Voucher state
  const [voucherModalVisible, setVoucherModalVisible] = useState(false);
  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discountPercent: number } | null>(null);

  // Paying loading state
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Computations
  const isEvSession = useMemo(() => {
    return (
      sessionData.bayNumber.toLowerCase().includes("ev") ||
      sessionData.name.toLowerCase().includes("ev") ||
      sessionData.zoneCode.toLowerCase().includes("ev") ||
      Boolean(sessionData.violationReason?.toLowerCase().includes("ev"))
    );
  }, [sessionData]);

  const isOverdue = params.isOverdue === "true";
  const subtotal = sessionData.cost;
  const fine = sessionData.violationFine || 0;
  const discountAmount = appliedVoucher ? Math.round((subtotal * appliedVoucher.discountPercent) / 100) : 0;
  const totalAmount = isOverdue ? Math.max(0, subtotal + fine - discountAmount) : 0;

  // Timestamps
  const entryMs = useMemo(() => {
    const parsed = new Date(sessionData.entryTime).getTime();
    return isNaN(parsed) ? Date.now() - sessionData.durationHours * 3600 * 1000 : parsed;
  }, [sessionData.entryTime, sessionData.durationHours]);

  const arriveTimeStr = useMemo(() => {
    return new Date(entryMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [entryMs]);

  const exitTimeStr = useMemo(() => {
    const exitMs = entryMs + sessionData.durationHours * 3600 * 1000;
    return new Date(exitMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [entryMs, sessionData.durationHours]);

  // Handle Voucher Apply
  const handleApplyVoucher = () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;

    if (code === "PARKZONE10" || code === "PARK10" || code === "PROMO10") {
      setAppliedVoucher({ code, discountPercent: 10 });
      setVoucherModalVisible(false);
      Alert.alert("Voucher Applied", `10% discount applied with code "${code}".`);
    } else if (code === "KIGALI20" || code === "SAVE20") {
      setAppliedVoucher({ code, discountPercent: 20 });
      setVoucherModalVisible(false);
      Alert.alert("Voucher Applied", `20% VIP discount applied with code "${code}".`);
    } else {
      Alert.alert("Invalid Code", "Please check your promo voucher code and try again.");
    }
  };

  // Handle Book again
  const handleBookAgain = async () => {
    setIsProcessing(true);

    try {
      // 1. If overdue, deduct overdue amount from wallet
      if (isOverdue && totalAmount > 0) {
        const rawBal = await AsyncStorage.getItem("@parkzone_wallet_balance");
        const currentBal = parseInt((rawBal || "25000").replace(/,/g, ""), 10) || 0;
        const updatedBal = Math.max(0, currentBal - totalAmount);
        await AsyncStorage.setItem("@parkzone_wallet_balance", updatedBal.toLocaleString());
      }

      // 2. Clear active ticket from AsyncStorage
      await AsyncStorage.removeItem("@parkzone_active_ticket");

      // 3. Update parking history record to "Completed"
      const rawHistory = await AsyncStorage.getItem(PARKING_HISTORY_STORAGE_KEY);
      if (rawHistory) {
        const history = JSON.parse(rawHistory);
        const idx = history.findIndex((h: any) => h.id === sessionData.id);
        if (idx >= 0) {
          history[idx].status = "Completed";
          if (isOverdue) {
            history[idx].cost = (history[idx].cost || 0) + totalAmount;
          }
          await AsyncStorage.setItem(PARKING_HISTORY_STORAGE_KEY, JSON.stringify(history));
        } else {
          // Prepend as completed record
          history.unshift({
            id: sessionData.id,
            name: sessionData.name,
            address: sessionData.address,
            bayNumber: sessionData.bayNumber,
            zoneCode: sessionData.zoneCode,
            plate: sessionData.plate,
            date: "Today, Just Now",
            duration: sessionData.duration,
            cost: sessionData.cost,
            currency: sessionData.currency,
            status: "Completed",
            image: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=400&q=80",
            receiptNumber: `PZ-2026-${sessionData.receiptNumber}`,
            violationFine: fine > 0 ? fine : undefined,
            violationReason: sessionData.violationReason || undefined,
          });
          await AsyncStorage.setItem(PARKING_HISTORY_STORAGE_KEY, JSON.stringify(history));
        }
      }

      setIsProcessing(false);
      setPaymentSuccess(true);
      router.replace("/(tabs)/home");
    } catch {
      setIsProcessing(false);
      router.replace("/(tabs)/home");
    }
  };

  // Format currency
  const formatMoney = (val: number) => {
    if (sessionData.currency === "$") {
      return `$${val.toFixed(2)}`;
    }
    return `${val.toLocaleString()} ${sessionData.currency}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={["top", "bottom"]}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.text }]}>Transaction Details</Text>

        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Main Details Card (styled in app colors with dashed dividers) */}
        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.cardShadow,
            },
          ]}
        >
          {/* Top Location & Slot Row */}
          <View style={styles.locationHeaderRow}>
            <View style={[styles.slotBadge, { backgroundColor: theme.isDark ? "#FFFFFF" : "#09090B" }]}>
              <Text style={[styles.slotBadgeText, { color: theme.isDark ? "#09090B" : "#FFFFFF" }]}>
                {sessionData.bayNumber}
              </Text>
            </View>

            <View style={styles.locationInfoCol}>
              <Text style={[styles.locationNameText, { color: theme.text }]} numberOfLines={1}>
                {sessionData.name}
              </Text>
              <Text style={[styles.locationSectorText, { color: theme.textSecondary }]} numberOfLines={1}>
                {sessionData.address || `${sessionData.zoneCode} • Level 1`}
              </Text>
            </View>
          </View>

          {/* Dashed Divider */}
          <View style={[styles.dashedDivider, { borderColor: theme.border }]} />

          {/* Section 1: Booking Date & Parking No */}
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Booking Date</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{sessionData.date}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>No. Parking</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>#{sessionData.receiptNumber}</Text>
          </View>

          {/* Dashed Divider */}
          <View style={[styles.dashedDivider, { borderColor: theme.border }]} />

          {/* Section 2: Timing & Duration */}
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Arrive After</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{arriveTimeStr}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Exit Before</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{exitTimeStr}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>Duration</Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>{sessionData.duration}</Text>
          </View>

          {/* Dashed Divider */}
          <View style={[styles.dashedDivider, { borderColor: theme.border }]} />

          {/* Section 3: Subtotal & Breakdown */}
          {isEvSession && (
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.textSecondary, fontWeight: "600" }]}>
                Parking Tariff (EV Exemption)
              </Text>
              <Text style={[styles.metaValue, { color: theme.text }]}>0 RWF (FREE)</Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: theme.textSecondary }]}>
              {isEvSession ? "Energy Subtotal (Charging)" : isOverdue ? "Overstay Overdue Charge" : "Reservation Fee"}
            </Text>
            <Text style={[styles.metaValue, { color: theme.text }]}>
              {isOverdue ? formatMoney(subtotal) : `${formatMoney(subtotal)} (PRE-PAID)`}
            </Text>
          </View>

          {!isOverdue && (
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: "#22C55E", fontWeight: "600" }]}>
                Pre-paid Booking Status
              </Text>
              <Text style={[styles.metaValue, { color: "#22C55E", fontWeight: "600" }]}>
                PAID IN FULL
              </Text>
            </View>
          )}

          {fine > 0 && (
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: "#EF4444", fontWeight: "600" }]}>
                Municipal Contravention Fine
              </Text>
              <Text style={[styles.metaValue, { color: "#EF4444" }]}>+{formatMoney(fine)}</Text>
            </View>
          )}

          {appliedVoucher && isOverdue && (
            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.textSecondary, fontWeight: "600" }]}>
                Voucher ({appliedVoucher.code} -{appliedVoucher.discountPercent}%)
              </Text>
              <Text style={[styles.metaValue, { color: theme.text }]}>-{formatMoney(discountAmount)}</Text>
            </View>
          )}

          {/* Voucher Input Box (Tap to Add Voucher) */}
          {isOverdue && (
            <TouchableOpacity
              style={[
                styles.voucherBox,
                {
                  backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "#F4F4F6",
                  borderColor: appliedVoucher ? theme.text : theme.border,
                },
              ]}
              onPress={() => setVoucherModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.voucherBoxText,
                  { color: appliedVoucher ? theme.text : theme.textSecondary },
                ]}
              >
                {appliedVoucher
                  ? `Voucher "${appliedVoucher.code}" Applied (${appliedVoucher.discountPercent}% OFF)`
                  : "Tap to Add Voucher"}
              </Text>
              <Ionicons
                name={appliedVoucher ? "checkmark-circle" : "ticket-outline"}
                size={18}
                color={appliedVoucher ? theme.text : theme.textSecondary}
              />
            </TouchableOpacity>
          )}

          {/* Dashed Divider */}
          <View style={[styles.dashedDivider, { borderColor: theme.border }]} />

          {/* Section 4: Select a Payment Method */}
          <Text style={[styles.paymentMethodTitle, { color: theme.text }]}>
            {isOverdue && totalAmount > 0 ? "Select a Payment Method" : "Payment Status"}
          </Text>

          {isOverdue && totalAmount > 0 ? (
            <TouchableOpacity
              style={[
                styles.paymentDropdownBtn,
                {
                  backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "#F4F4F6",
                  borderColor: theme.border,
                },
              ]}
              onPress={() => setMethodPickerVisible(true)}
              activeOpacity={0.8}
            >
              <View style={styles.paymentMethodLeft}>
                <Ionicons name={selectedMethod.icon} size={20} color={theme.text} />
                <Text style={[styles.paymentMethodSubtitle, { color: theme.text }]}>
                  {selectedMethod.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.paymentDropdownBtn,
                {
                  backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : "#F4F4F6",
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.paymentMethodLeft}>
                <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                <Text style={[styles.paymentMethodSubtitle, { color: theme.text }]}>
                  Covered by Pre-paid Booking (0 RWF Due)
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Sticky Action: Total & Pay Now Button */}
      <View
        style={[
          styles.bottomFixedContainer,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            shadowColor: theme.cardShadow,
          },
        ]}
      >
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>Total Due</Text>
          <Text style={[styles.totalAmountText, { color: theme.text }]}>
            {isOverdue && totalAmount > 0 ? formatMoney(totalAmount) : "0 RWF (Pre-paid)"}
          </Text>
        </View>

        {/* Book again button in app black and white colors */}
        <TouchableOpacity
          style={[styles.payNowBtn, { backgroundColor: theme.primaryBtnBg }]}
          onPress={handleBookAgain}
          disabled={isProcessing}
          activeOpacity={0.88}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={theme.primaryBtnText} />
          ) : (
            <Text style={[styles.payNowBtnText, { color: theme.primaryBtnText }]}>
              {isOverdue && totalAmount > 0
                ? `Pay Overdue ${formatMoney(totalAmount)} & Close`
                : "Book again"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Payment Method Selector Modal */}
      <Modal
        visible={methodPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMethodPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitleText, { color: theme.text }]}>Payment Method</Text>
              <TouchableOpacity onPress={() => setMethodPickerVisible(false)}>
                <Ionicons name="close" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            {PAYMENT_METHODS.map((method) => {
              const isSelected = method.id === selectedMethod.id;
              return (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.methodOptionItem,
                    {
                      backgroundColor: isSelected
                        ? theme.isDark
                          ? "rgba(255, 255, 255, 0.12)"
                          : "rgba(9, 9, 11, 0.05)"
                        : theme.background,
                      borderColor: isSelected ? theme.text : theme.border,
                    },
                  ]}
                  onPress={() => {
                    setSelectedMethod(method);
                    setMethodPickerVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.methodOptionLeft}>
                    <Ionicons
                      name={method.icon}
                      size={22}
                      color={isSelected ? theme.text : theme.textSecondary}
                    />
                    <View>
                      <Text style={[styles.methodOptionName, { color: theme.text }]}>
                        {method.name}
                      </Text>
                      <Text style={[styles.methodOptionSub, { color: theme.textSecondary }]}>
                        {method.subtitle}
                      </Text>
                    </View>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={theme.text} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* Voucher Input Modal */}
      <Modal
        visible={voucherModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVoucherModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitleText, { color: theme.text }]}>Add Promo Voucher</Text>
              <TouchableOpacity onPress={() => setVoucherModalVisible(false)}>
                <Ionicons name="close" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.voucherHintText, { color: theme.textSecondary }]}>
              Enter promo voucher code (e.g. PARKZONE10 for 10% off, KIGALI20 for 20% off):
            </Text>

            <TextInput
              style={[
                styles.voucherInputBox,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
              placeholder="Enter voucher code..."
              placeholderTextColor={theme.textMuted}
              value={voucherInput}
              onChangeText={setVoucherInput}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={styles.voucherActionsRow}>
              {appliedVoucher && (
                <TouchableOpacity
                  style={[styles.removeVoucherBtn, { borderColor: theme.border }]}
                  onPress={() => {
                    setAppliedVoucher(null);
                    setVoucherInput("");
                    setVoucherModalVisible(false);
                  }}
                >
                  <Text style={[styles.removeVoucherBtnText, { color: "#EF4444" }]}>Remove</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.applyVoucherBtn, { backgroundColor: theme.primaryBtnBg }]}
                onPress={handleApplyVoucher}
                activeOpacity={0.85}
              >
                <Text style={[styles.applyVoucherBtnText, { color: theme.primaryBtnText }]}>Apply Code</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPlaceholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 150,
  },
  detailsCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  locationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  slotBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  slotBadgeText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  locationInfoCol: {
    flex: 1,
  },
  locationNameText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  locationSectorText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 3,
  },
  dashedDivider: {
    height: 1,
    borderWidth: 0.8,
    borderStyle: "dashed",
    marginVertical: 14,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  metaLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  voucherBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
  },
  voucherBoxText: {
    fontSize: 13,
    fontWeight: "600",
  },
  paymentMethodTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
  },
  paymentDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  paymentMethodLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  paymentMethodSubtitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  bottomFixedContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 28 : 20,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  totalAmountText: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  payNowBtn: {
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  payNowBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContentCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalTitleText: {
    fontSize: 17,
    fontWeight: "800",
  },
  methodOptionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  methodOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  methodOptionName: {
    fontSize: 14,
    fontWeight: "800",
  },
  methodOptionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  voucherHintText: {
    fontSize: 13,
    marginBottom: 14,
  },
  voucherInputBox: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 16,
  },
  voucherActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  removeVoucherBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  removeVoucherBtnText: {
    fontSize: 14,
    fontWeight: "800",
  },
  applyVoucherBtn: {
    flex: 2,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  applyVoucherBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
