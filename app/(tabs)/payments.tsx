import React, { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";

const Payments = () => {
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#ECECEC" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Payments & Tariffs</Text>
          <Text style={styles.headerSubtitle}>Kigali automated toll & parking billing</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.text}
            colors={[theme.text]}
          />
        }
      >
        {/* Daily Commuter Pass Card */}
        <View style={styles.passCard}>
          <View style={styles.passHeader}>
            <Text style={styles.passBadge}>DAILY COMMUTER</Text>
            <Text style={styles.passPrice}>2,000 RWF</Text>
          </View>
          <Text style={styles.passTitle}>All-Day Kigali Parking Pass</Text>
          <Text style={styles.passDesc}>
            Valid for unlimited check-ins across all municipal zones and off-street lots until 23:59.
          </Text>
          <TouchableOpacity
            style={styles.buyPassBtn}
            onPress={() =>
              Alert.alert(
                "Purchase Daily Pass",
                "Charge 2,000 RWF via primary MTN Mobile Money account?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Confirm Purchase",
                    onPress: () =>
                      Alert.alert(
                        "Pass Activated",
                        "Daily Commuter Pass active. Your registered vehicle will be auto-recognized at all gates."
                      ),
                  },
                ]
              )
            }
          >
            <Text style={styles.buyPassBtnText}>Activate Daily Pass (2,000 RWF)</Text>
          </TouchableOpacity>
        </View>

        {/* Standard Rates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MUNICIPAL TARIFF SCHEDULE</Text>

          <View style={styles.rateRow}>
            <View>
              <Text style={styles.rateName}>Hourly Parking</Text>
              <Text style={styles.rateSub}>First 15 mins grace period included</Text>
            </View>
            <Text style={styles.rateVal}>300 RWF / hr</Text>
          </View>

          <View style={styles.rateRow}>
            <View>
              <Text style={styles.rateName}>Overstay / Fine</Text>
              <Text style={styles.rateSub}>Vehicle parked without app check-in</Text>
            </View>
            <Text style={styles.rateVal}>3,000 RWF</Text>
          </View>

          <View style={styles.rateRow}>
            <View>
              <Text style={styles.rateName}>EV Fast Charging</Text>
              <Text style={styles.rateSub}>Tier 1 DC fast charging (up to 120 kW)</Text>
            </View>
            <Text style={styles.rateVal}>250 RWF / kWh</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Payments;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: "transparent",
    borderBottomWidth: 0,
    gap: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  headerTitle: {
    color: "#ECECEC",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: "#8E8E8E",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  passCard: {
    backgroundColor: "#212121",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#303030",
    padding: 20,
    marginBottom: 24,
  },
  passHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  passBadge: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    backgroundColor: "#2F2F2F",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#383838",
  },
  passPrice: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  passTitle: {
    color: "#ECECEC",
    fontSize: 17,
    fontWeight: "900",
  },
  passDesc: {
    color: "#8E8E8E",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  buyPassBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },
  buyPassBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "900",
  },
  section: {
    backgroundColor: "#212121",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#303030",
    padding: 18,
  },
  sectionTitle: {
    color: "#8E8E8E",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  rateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2F2F2F",
  },
  rateName: {
    color: "#ECECEC",
    fontSize: 13,
    fontWeight: "800",
  },
  rateSub: {
    color: "#8E8E8E",
    fontSize: 10,
    marginTop: 2,
  },
  rateVal: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
});
