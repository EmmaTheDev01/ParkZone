import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Icons } from "../../constants/icons";
import { GlassBackground } from "../../components/GlassBackground";
import { GlassCard } from "../../components/GlassCard";

const OtpVerified = () => {
  return (
    <GlassBackground>
      <SafeAreaView style={styles.container}>
        <GlassCard style={styles.card} intensity={60}>
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Image
                source={Icons.logoImg}
                style={{ width: 34, height: 34, tintColor: "#000000" }}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={styles.securityTag}>
            <View style={styles.securityDot} />
            <Text style={styles.securityText}>DATA ENCRYPTION • VERIFIED</Text>
          </View>

          <Text style={styles.title}>Identity Verified</Text>
          <Text style={styles.subtitle}>
            Your security code was confirmed on the Kigali Smart Grid platform. You may now configure your new password.
          </Text>

          <TouchableOpacity
            style={styles.primaryPillBtn}
            onPress={() => router.replace("/(auth)/new_pass")}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryPillBtnText}>Set New Password</Text>
          </TouchableOpacity>
        </GlassCard>
      </SafeAreaView>
    </GlassBackground>
  );
};

export default OtpVerified;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  card: {
    width: "100%",
    alignItems: "center",
  },
  badgeContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
  },
  securityTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  securityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    marginRight: 6,
  },
  securityText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: "#A1A1AA",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  primaryPillBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    height: 52,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryPillBtnText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
});
