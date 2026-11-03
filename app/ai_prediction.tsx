import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../hooks/useTheme";
import {
  CarTelemetry,
  subscribeCarTelemetry,
  calculatePowerPrediction,
  sendPredictionToCar,
  PredictionInput,
} from "./services/carTelemetry";

const { width } = Dimensions.get("window");

export default function AiPredictionScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [telemetry, setTelemetry] = useState<CarTelemetry | null>(null);

  // Prediction Parameters
  const [targetDistanceKm, setTargetDistanceKm] = useState<number>(45);
  const [averageSpeedKmH, setAverageSpeedKmH] = useState<number>(60);
  const [topography, setTopography] = useState<"flat" | "rolling_hills" | "mountainous">(
    "rolling_hills"
  );
  const [drivingMode, setDrivingMode] = useState<"eco" | "normal" | "sport">("normal");
  const [climateLoad, setClimateLoad] = useState<"off" | "mild" | "heavy">("mild");
  const [customSoc, setCustomSoc] = useState<number | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeCarTelemetry((data) => {
      setTelemetry(data);
    });
    return () => unsub();
  }, []);

  const activeSoc = customSoc !== null ? customSoc : telemetry?.batterySoc ?? 70;
  const batteryCapacity = telemetry?.batteryCapacityKwh ?? 60.48;

  // Memoized AI Prediction Computation
  const prediction = useMemo(() => {
    const input: PredictionInput = {
      targetDistanceKm,
      averageSpeedKmH,
      topography,
      drivingMode,
      climateLoad,
      ambientTempC: telemetry?.ambientTemperatureC ?? 24,
      batteryCapacityKwh: batteryCapacity,
      currentSocPct: activeSoc,
    };
    return calculatePowerPrediction(input);
  }, [
    targetDistanceKm,
    averageSpeedKmH,
    topography,
    drivingMode,
    climateLoad,
    activeSoc,
    batteryCapacity,
    telemetry?.ambientTemperatureC,
  ]);

  const handlePushToCar = () => {
    sendPredictionToCar(prediction);
    setSyncNotice("AI power prediction synced to vehicle system and Android Auto.");
    setTimeout(() => {
      setSyncNotice(null);
    }, 3500);
  };

  const distancePresets = [
    { label: "15 km", value: 15, desc: "Kigali CBD" },
    { label: "45 km", value: 45, desc: "Bugesera" },
    { label: "120 km", value: 120, desc: "Huye Hub" },
    { label: "160 km", value: 160, desc: "Rubavu" },
  ];

  const speedPresets = [
    { label: "40 km/h", value: 40, sub: "Urban" },
    { label: "60 km/h", value: 60, sub: "Arterial" },
    { label: "80 km/h", value: 80, sub: "Express" },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top", "bottom"]}
    >
      <StatusBar
        barStyle={theme.isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />

      {/* Screen Header */}
      <View style={[styles.headerRow, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.backNavBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleCenter}>
          <Text style={[styles.headerMainTitle, { color: theme.text }]}>
            AI Range Prediction
          </Text>
          <Text style={[styles.headerSubTitle, { color: theme.textSecondary }]}>
            Power per Distance Engine
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/android_auto")}
          style={[
            styles.headerRightBtn,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="alpha-a-circle-outline" size={18} color={theme.text} />
          <Text style={[styles.headerRightBtnText, { color: theme.text }]}>
            Auto HUD
          </Text>
        </TouchableOpacity>
      </View>

      {syncNotice && (
        <View
          style={[
            styles.syncBanner,
            {
              backgroundColor: theme.evGreenSoft,
              borderBottomColor: theme.evGreenBorder,
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color={theme.evGreen} />
          <Text style={[styles.syncBannerText, { color: theme.evGreen }]}>
            {syncNotice}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main AI Forecast Result Hero Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.heroHeaderRow}>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.aiTagBadge,
                  {
                    backgroundColor: theme.surfaceMuted,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Ionicons name="sparkles" size={11} color={theme.evGreen} />
                <Text style={[styles.aiTagBadgeText, { color: theme.text }]}>
                  AI FORECAST
                </Text>
              </View>
              <Text style={[styles.targetDistanceTag, { color: theme.textSecondary }]}>
                {targetDistanceKm} km trip
              </Text>
            </View>

            <View
              style={[
                styles.feasibilityBadge,
                {
                  backgroundColor: prediction.isReachableWithoutStop
                    ? theme.evGreenSoft
                    : theme.surfaceMuted,
                  borderColor: prediction.isReachableWithoutStop
                    ? theme.evGreenBorder
                    : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.feasibilityText,
                  {
                    color: prediction.isReachableWithoutStop
                      ? theme.evGreen
                      : theme.textSecondary,
                  },
                ]}
              >
                {prediction.isReachableWithoutStop
                  ? "DIRECT TRIP"
                  : "STOP NEEDED"}
              </Text>
            </View>
          </View>

          {/* Primary Metric: Power per Distance */}
          <View style={styles.heroMetricContainer}>
            <Text style={[styles.heroMetricLabel, { color: theme.textSecondary }]}>
              PREDICTED POWER CONSUMPTION
            </Text>
            <View style={styles.heroMetricRow}>
              <Text style={[styles.heroMetricValue, { color: theme.text }]}>
                {prediction.predictedPowerPerDistanceWhPerKm}
              </Text>
              <Text style={[styles.heroMetricUnit, { color: theme.textSecondary }]}>
                Wh / km
              </Text>
            </View>
          </View>

          {/* Forecast Metric Grid */}
          <View style={styles.metricGrid}>
            <View
              style={[
                styles.metricCell,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                TOTAL ENERGY
              </Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {prediction.totalEnergyRequiredKwh} kWh
              </Text>
            </View>

            <View
              style={[
                styles.metricCell,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                ARRIVAL SOC
              </Text>
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      prediction.estimatedSocAtArrivalPct > 20
                        ? theme.evGreen
                        : theme.text,
                  },
                ]}
              >
                {prediction.estimatedSocAtArrivalPct}%
              </Text>
            </View>

            <View
              style={[
                styles.metricCell,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                MAX RANGE
              </Text>
              <Text style={[styles.metricValue, { color: theme.text }]}>
                {prediction.maxCruisingRangeKm} km
              </Text>
            </View>

            <View
              style={[
                styles.metricCell,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
                BUFFER MARGIN
              </Text>
              <Text
                style={[
                  styles.metricValue,
                  {
                    color:
                      prediction.bufferMarginKm >= 15
                        ? theme.evGreen
                        : theme.textSecondary,
                  },
                ]}
              >
                {prediction.bufferMarginKm > 0 ? "+" : ""}
                {prediction.bufferMarginKm} km
              </Text>
            </View>
          </View>

          {/* Loss Vector Breakdown */}
          <View
            style={[
              styles.lossVectorSection,
              {
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.lossSectionTitle, { color: theme.textSecondary }]}>
              CONSUMPTION LOSS BREAKDOWN
            </Text>

            <View style={styles.lossBarItem}>
              <View style={styles.lossLabelRow}>
                <Text style={[styles.lossName, { color: theme.textSecondary }]}>
                  Aerodynamic Drag
                </Text>
                <Text style={[styles.lossValue, { color: theme.text }]}>
                  {prediction.aerodynamicLossWhPerKm} Wh/km
                </Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        100,
                        (prediction.aerodynamicLossWhPerKm / 120) * 100
                      )}%`,
                      backgroundColor: theme.text,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.lossBarItem}>
              <View style={styles.lossLabelRow}>
                <Text style={[styles.lossName, { color: theme.textSecondary }]}>
                  Rolling Resistance
                </Text>
                <Text style={[styles.lossValue, { color: theme.text }]}>
                  {prediction.rollingLossWhPerKm} Wh/km
                </Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        100,
                        (prediction.rollingLossWhPerKm / 120) * 100
                      )}%`,
                      backgroundColor: theme.textSecondary,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.lossBarItem}>
              <View style={styles.lossLabelRow}>
                <Text style={[styles.lossName, { color: theme.textSecondary }]}>
                  Topography & Gradient
                </Text>
                <Text style={[styles.lossValue, { color: theme.text }]}>
                  {prediction.elevationLossWhPerKm} Wh/km
                </Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        100,
                        (prediction.elevationLossWhPerKm / 120) * 100
                      )}%`,
                      backgroundColor: theme.evGreen,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.lossBarItem}>
              <View style={styles.lossLabelRow}>
                <Text style={[styles.lossName, { color: theme.textSecondary }]}>
                  Climate & Auxiliary HVAC
                </Text>
                <Text style={[styles.lossValue, { color: theme.text }]}>
                  {prediction.auxiliaryLossWhPerKm} Wh/km
                </Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        100,
                        (prediction.auxiliaryLossWhPerKm / 120) * 100
                      )}%`,
                      backgroundColor: theme.borderStrong,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* AI Insights & Route Recommendations */}
          <View
            style={[
              styles.aiInsightsContainer,
              {
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="sparkles" size={14} color={theme.evGreen} />
              <Text style={[styles.aiInsightsTitle, { color: theme.text }]}>
                AI Route Optimization
              </Text>
            </View>
            {prediction.aiInsights.map((insight, index) => (
              <View key={index} style={styles.insightItemRow}>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={theme.evGreen}
                  style={{ marginTop: 2 }}
                />
                <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                  {insight}
                </Text>
              </View>
            ))}
          </View>

          {/* Push to Car Action Button */}
          <TouchableOpacity
            style={[
              styles.pushToCarButton,
              { backgroundColor: theme.primaryBtnBg },
            ]}
            onPress={handlePushToCar}
            activeOpacity={0.8}
          >
            <Ionicons
              name="send-outline"
              size={16}
              color={theme.primaryBtnText}
            />
            <Text
              style={[
                styles.pushToCarButtonText,
                { color: theme.primaryBtnText },
              ]}
            >
              Sync Prediction to In-Car System
            </Text>
          </TouchableOpacity>
        </View>

        {/* Prediction Input Configuration Parameters */}
        <View style={styles.configSection}>
          <Text style={[styles.configSectionHeading, { color: theme.textSecondary }]}>
            PREDICTION PARAMETERS
          </Text>

          {/* Target Distance Selector */}
          <View
            style={[
              styles.paramCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.paramLabel, { color: theme.text }]}>
              Target Trip Distance
            </Text>
            <View style={styles.presetRow}>
              {distancePresets.map((p) => {
                const isSelected = targetDistanceKm === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isSelected
                          ? theme.pillActiveBg
                          : theme.surfaceMuted,
                        borderColor: isSelected
                          ? theme.pillActiveBg
                          : theme.border,
                      },
                    ]}
                    onPress={() => setTargetDistanceKm(p.value)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        {
                          color: isSelected
                            ? theme.pillActiveText
                            : theme.text,
                        },
                      ]}
                    >
                      {p.label}
                    </Text>
                    <Text
                      style={[
                        styles.presetChipSub,
                        {
                          color: isSelected
                            ? theme.pillActiveText
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      {p.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Distance Stepper */}
            <View
              style={[
                styles.stepperRow,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.border,
                },
              ]}
            >
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: theme.surface }]}
                onPress={() => setTargetDistanceKm((prev) => Math.max(5, prev - 5))}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={16} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.stepperValue, { color: theme.text }]}>
                {targetDistanceKm} km
              </Text>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: theme.surface }]}
                onPress={() => setTargetDistanceKm((prev) => prev + 5)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Cruising Speed Selector */}
          <View
            style={[
              styles.paramCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.paramLabel, { color: theme.text }]}>
              Average Cruising Speed
            </Text>
            <View style={styles.presetRow}>
              {speedPresets.map((sp) => {
                const isSelected = averageSpeedKmH === sp.value;
                return (
                  <TouchableOpacity
                    key={sp.value}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isSelected
                          ? theme.pillActiveBg
                          : theme.surfaceMuted,
                        borderColor: isSelected
                          ? theme.pillActiveBg
                          : theme.border,
                      },
                    ]}
                    onPress={() => setAverageSpeedKmH(sp.value)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        {
                          color: isSelected
                            ? theme.pillActiveText
                            : theme.text,
                        },
                      ]}
                    >
                      {sp.label}
                    </Text>
                    <Text
                      style={[
                        styles.presetChipSub,
                        {
                          color: isSelected
                            ? theme.pillActiveText
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      {sp.sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Topography Selector */}
          <View
            style={[
              styles.paramCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.paramLabel, { color: theme.text }]}>
              Route Topography & Gradient
            </Text>
            <View style={styles.presetRow}>
              {[
                { key: "flat", label: "Flat Plateau", sub: "0% Grade" },
                { key: "rolling_hills", label: "Kigali Hills", sub: "+3.5% Grade" },
                { key: "mountainous", label: "Mountain Pass", sub: "+7.0% Grade" },
              ].map((top) => {
                const isSelected = topography === top.key;
                return (
                  <TouchableOpacity
                    key={top.key}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isSelected
                          ? theme.pillActiveBg
                          : theme.surfaceMuted,
                        borderColor: isSelected
                          ? theme.pillActiveBg
                          : theme.border,
                      },
                    ]}
                    onPress={() => setTopography(top.key as any)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        {
                          color: isSelected
                            ? theme.pillActiveText
                            : theme.text,
                        },
                      ]}
                    >
                      {top.label}
                    </Text>
                    <Text
                      style={[
                        styles.presetChipSub,
                        {
                          color: isSelected
                            ? theme.pillActiveText
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      {top.sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Driving Mode Selector */}
          <View
            style={[
              styles.paramCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.paramLabel, { color: theme.text }]}>
              Driving Dynamics Mode
            </Text>
            <View style={styles.presetRow}>
              {[
                { key: "eco", label: "Eco Regen", desc: "Max Range" },
                { key: "normal", label: "Normal", desc: "Balanced" },
                { key: "sport", label: "Sport", desc: "Performance" },
              ].map((m) => {
                const isSelected = drivingMode === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isSelected
                          ? theme.pillActiveBg
                          : theme.surfaceMuted,
                        borderColor: isSelected
                          ? theme.pillActiveBg
                          : theme.border,
                      },
                    ]}
                    onPress={() => setDrivingMode(m.key as any)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        {
                          color: isSelected
                            ? theme.pillActiveText
                            : theme.text,
                        },
                      ]}
                    >
                      {m.label}
                    </Text>
                    <Text
                      style={[
                        styles.presetChipSub,
                        {
                          color: isSelected
                            ? theme.pillActiveText
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      {m.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Climate & HVAC Load */}
          <View
            style={[
              styles.paramCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.paramLabel, { color: theme.text }]}>
              Cabin Climate Load
            </Text>
            <View style={styles.presetRow}>
              {[
                { key: "off", label: "HVAC Off", desc: "Vent" },
                { key: "mild", label: "Mild 22°C", desc: "Normal AC" },
                { key: "heavy", label: "Max 18°C", desc: "High Cooling" },
              ].map((c) => {
                const isSelected = climateLoad === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[
                      styles.presetChip,
                      {
                        backgroundColor: isSelected
                          ? theme.pillActiveBg
                          : theme.surfaceMuted,
                        borderColor: isSelected
                          ? theme.pillActiveBg
                          : theme.border,
                      },
                    ]}
                    onPress={() => setClimateLoad(c.key as any)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        {
                          color: isSelected
                            ? theme.pillActiveText
                            : theme.text,
                        },
                      ]}
                    >
                      {c.label}
                    </Text>
                    <Text
                      style={[
                        styles.presetChipSub,
                        {
                          color: isSelected
                            ? theme.pillActiveText
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      {c.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleCenter: {
    alignItems: "center",
  },
  headerMainTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerSubTitle: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
  headerRightBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  headerRightBtnText: {
    fontSize: 10,
    fontWeight: "700",
  },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  syncBannerText: {
    fontSize: 11,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  heroHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiTagBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  aiTagBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  targetDistanceTag: {
    fontSize: 11,
    fontWeight: "500",
  },
  feasibilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  feasibilityText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  heroMetricContainer: {
    alignItems: "center",
    paddingVertical: 6,
  },
  heroMetricLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  heroMetricRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 4,
  },
  heroMetricValue: {
    fontSize: 52,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  heroMetricUnit: {
    fontSize: 14,
    fontWeight: "600",
  },
  metricGrid: {
    flexDirection: "row",
    gap: 8,
  },
  metricCell: {
    flex: 1,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  lossVectorSection: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  lossSectionTitle: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  lossBarItem: {
    gap: 4,
  },
  lossLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  lossName: {
    fontSize: 11,
    fontWeight: "500",
  },
  lossValue: {
    fontSize: 11,
    fontWeight: "600",
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  aiInsightsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  aiInsightsTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  insightItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  insightText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  pushToCarButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  pushToCarButtonText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  configSection: {
    gap: 12,
  },
  configSectionHeading: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginLeft: 4,
  },
  paramCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  paramLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
  },
  presetChip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  presetChipSub: {
    fontSize: 9,
    fontWeight: "500",
    marginTop: 2,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontSize: 12,
    fontWeight: "700",
  },
});
