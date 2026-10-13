import React, { useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";

const Permits = () => {
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
          <Text style={styles.headerTitle}>Digital Permits</Text>
          <Text style={styles.headerSubtitle}>Official Kigali municipal parking authorizations</Text>
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
        {/* Active Permit Card */}
        <View style={styles.permitCard}>
          <View style={styles.permitHeader}>
            <Text style={styles.permitBadge}>AUTHORIZED</Text>
            <Text style={styles.permitNumber}>#PMT-2026-KGL</Text>
          </View>
          <Text style={styles.permitTitle}>Zone A & B Resident Permit</Text>
          <Text style={styles.permitSub}>Kigali CBD • Valid until Dec 31, 2026</Text>

          <View style={styles.divider} />

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Vehicle Plate:</Text>
            <Text style={styles.metaValue}>RAD 820 B</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Authority:</Text>
            <Text style={styles.metaValue}>City of Kigali Infrastructure Board</Text>
          </View>
        </View>

        {/* Request New Permit */}
        <TouchableOpacity
          style={styles.requestBtn}
          onPress={() =>
            Alert.alert(
              "Apply for Parking Permit",
              "Permit applications require proof of residency or business registration in Kigali.",
              [{ text: "OK" }]
            )
          }
        >
          <Text style={styles.requestBtnText}>+ Apply for Municipal Permit</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Permits;

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
  },
  permitCard: {
    backgroundColor: "#212121",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#303030",
    padding: 20,
    marginBottom: 20,
  },
  permitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  permitBadge: {
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
  permitNumber: {
    color: "#8E8E8E",
    fontSize: 11,
    fontWeight: "700",
  },
  permitTitle: {
    color: "#ECECEC",
    fontSize: 16,
    fontWeight: "900",
  },
  permitSub: {
    color: "#8E8E8E",
    fontSize: 12,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#2F2F2F",
    marginVertical: 14,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  metaLabel: {
    color: "#8E8E8E",
    fontSize: 12,
  },
  metaValue: {
    color: "#ECECEC",
    fontSize: 12,
    fontWeight: "700",
  },
  requestBtn: {
    backgroundColor: "#212121",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#383838",
  },
  requestBtnText: {
    color: "#ECECEC",
    fontSize: 13,
    fontWeight: "800",
  },
});