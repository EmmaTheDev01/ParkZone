import React, { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Icons } from "../../constants/icons";
import { GlassBackground } from "../../components/GlassBackground";
import { GlassCard } from "../../components/GlassCard";

export default function TermsService() {
  const [activeTab, setActiveTab] = useState<"Terms" | "Privacy">("Terms");

  return (
    <GlassBackground>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Legal & Privacy</Text>
            <Text style={styles.headerSubtitle}>City of Kigali Smart Mobility</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* Glass Segmented Control Tabs */}
        <View style={styles.tabWrapper}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "Terms" && styles.tabBtnActive]}
              onPress={() => setActiveTab("Terms")}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === "Terms" && styles.tabTextActive]}>
                Terms of Service
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "Privacy" && styles.tabBtnActive]}
              onPress={() => setActiveTab("Privacy")}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === "Privacy" && styles.tabTextActive]}>
                Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "Terms" ? (
            <GlassCard style={styles.glassCard} intensity={60}>
              <View style={styles.badgeRow}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>MUNICIPAL CONCESSION REGULATION</Text>
              </View>

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>1. Kigali Municipal Parking Operations</Text>
                <Text style={styles.paragraph}>
                  ParkZone provides digital parking access, real-time bay telemetry, and automated toll collection across authorized Kigali urban parking zones under City of Kigali concession.
                </Text>
              </View>

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>2. Tariff & Overstay Enforcement</Text>
                <Text style={styles.paragraph}>
                  • <Text style={styles.highlight}>Hourly Parking:</Text> 300 RWF per hour (with an initial 15-minute grace period upon bay entry).
                  {"\n"}• <Text style={styles.highlight}>Daily Commuter Cap:</Text> 2,000 RWF maximum charge per single calendar day.
                  {"\n"}• <Text style={styles.highlight}>Unregistered Parking / Fine:</Text> Vehicles parked without activating check-in within 15 minutes of camera entry are subject to a 3,000 RWF municipal enforcement penalty.
                </Text>
              </View>

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>3. EV Fast Charging Network</Text>
                <Text style={styles.paragraph}>
                  Fast EV charging points operate under dynamic tariffs (standard 250 RWF / kWh). Vehicles must vacate charger bays within 15 minutes of charging completion to prevent idle obstruction penalties.
                </Text>
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={styles.glassCard} intensity={60}>
              <View style={styles.badgeRow}>
                <View style={[styles.badgeDot, { backgroundColor: "#FFFFFF" }]} />
                <Text style={[styles.badgeText, { color: "#FFFFFF" }]}>DATA PROTECTION & PRIVACY</Text>
              </View>

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>1. Data Protection & Privacy Framework</Text>
                <Text style={styles.paragraph}>
                  In accordance with the regulatory standards relating to the protection of personal data and privacy, ParkZone enforces strict data minimization, cryptographic hashing, and pseudonymization across all sensor pipelines.
                </Text>
              </View>

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>2. Cryptographic Blind Indexing</Text>
                <Text style={styles.paragraph}>
                  Vehicle license plates are hashed at the client edge using HMAC SHA-256 with isolated, rotating municipal salt. Plain text registration numbers are never stored in databases or transmitted across unencrypted links.
                </Text>
              </View>

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionHeading}>3. ANPR Optical Telemetry</Text>
                <Text style={styles.paragraph}>
                  Roadside optical sensors only compute hash tokens to detect occupancy (Vacant vs Occupied) and trigger automated billing timers. Video frames and raw images are instantly purged post-tokenization.
                </Text>
              </View>
            </GlassCard>
          )}
        </ScrollView>
      </SafeAreaView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "300",
    marginTop: -2,
  },
  navBrandBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  navBrandLogo: {
    width: 22,
    height: 22,
    tintColor: "#FFFFFF",
  },
  headerTitleBox: {
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  tabWrapper: {
    paddingHorizontal: 22,
    paddingTop: 8,
    marginBottom: 8,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 24,
    padding: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  tabBtnActive: {
    backgroundColor: "#FFFFFF",
  },
  tabText: {
    color: "#A1A1AA",
    fontSize: 12.5,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#000000",
    fontWeight: "900",
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 40,
  },
  glassCard: {
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 18,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    marginRight: 6,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeading: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  paragraph: {
    color: "#A1A1AA",
    fontSize: 13,
    lineHeight: 20,
  },
  highlight: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
