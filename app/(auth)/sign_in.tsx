import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Icons } from "../../constants/icons";
import { signIn } from "../services/auth";
import { GlassBackground } from "../../components/GlassBackground";
import { useTheme } from "../../hooks/useTheme";

export default function SignIn() {
  const theme = useTheme();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [secureText, setSecureText] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isIdFocused, setIsIdFocused] = useState(false);
  const [isPassFocused, setIsPassFocused] = useState(false);

  const handleSignIn = async () => {
    if (!identifier.trim() || !password) {
      setErrorMessage("Please enter both email/phone and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await signIn(identifier, password);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      router.replace("/(tabs)/home");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to sign in. Please verify your credentials.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = () => {
    router.replace("/(tabs)/home");
  };

  return (
    <GlassBackground>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header Content matching reference */}
            <View style={styles.headerSection}>
              <Text style={[styles.mainHeading, { color: theme.text }]}>
                Welcome Back!
              </Text>
              <Text style={[styles.subHeading, { color: theme.textSecondary }]}>
                Bring smart parking with you across Kigali.{" "}
                <Text
                  style={[styles.faqLink, { color: theme.text }]}
                  onPress={() =>
                    Alert.alert(
                      "ParkZone FAQ",
                      "ParkZone operates official City of Kigali municipal parking zones and fast EV charging hubs."
                    )
                  }
                >
                  FAQ about us
                </Text>
              </Text>
            </View>

            {/* Error Message Banner */}
            {errorMessage && (
              <View
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: theme.isDark ? "rgba(239, 68, 68, 0.12)" : "rgba(239, 68, 68, 0.08)",
                    borderColor: "rgba(239, 68, 68, 0.3)",
                  },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={17} color="#EF4444" style={{ marginRight: 8 }} />
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            )}

            {/* Input 1: Email Address / Phone Pill */}
            <View
              style={[
                styles.inputPill,
                {
                  backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
                  borderColor: isIdFocused
                    ? theme.isDark
                      ? "#FFFFFF"
                      : "#09090B"
                    : theme.isDark
                    ? "rgba(255, 255, 255, 0.14)"
                    : "rgba(0, 0, 0, 0.12)",
                },
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={isIdFocused ? theme.text : theme.textMuted}
                style={styles.inputLeftIcon}
              />
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder="Email Address or Phone"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={identifier}
                onFocus={() => setIsIdFocused(true)}
                onBlur={() => setIsIdFocused(false)}
                onChangeText={(text) => {
                  setIdentifier(text);
                  setErrorMessage(null);
                }}
              />
            </View>

            {/* Input 2: Password Pill */}
            <View
              style={[
                styles.inputPill,
                {
                  backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)",
                  borderColor: isPassFocused
                    ? theme.isDark
                      ? "#FFFFFF"
                      : "#09090B"
                    : theme.isDark
                    ? "rgba(255, 255, 255, 0.14)"
                    : "rgba(0, 0, 0, 0.12)",
                  marginTop: 14,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={isPassFocused ? theme.text : theme.textMuted}
                style={styles.inputLeftIcon}
              />
              <TextInput
                style={[styles.textInput, { color: theme.text }]}
                placeholder="Enter your password"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={secureText}
                value={password}
                onFocus={() => setIsPassFocused(true)}
                onBlur={() => setIsPassFocused(false)}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrorMessage(null);
                }}
              />
              <TouchableOpacity
                onPress={() => setSecureText(!secureText)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.eyeToggleBtn}
              >
                <Ionicons
                  name={secureText ? "eye-off-outline" : "eye-outline"}
                  size={19}
                  color={theme.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Remember Me & Forgot Password Row */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberGroup}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkboxBox,
                    {
                      backgroundColor: rememberMe
                        ? theme.text
                        : theme.isDark
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.05)",
                      borderColor: rememberMe
                        ? theme.text
                        : theme.isDark
                        ? "rgba(255, 255, 255, 0.25)"
                        : "rgba(0, 0, 0, 0.25)",
                    },
                  ]}
                >
                  {rememberMe && (
                    <Ionicons
                      name="checkmark"
                      size={13}
                      color={theme.isDark ? "#09090B" : "#FFFFFF"}
                    />
                  )}
                </View>
                <Text style={[styles.rememberLabel, { color: theme.textSecondary }]}>
                  Remember me
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => router.push("/(auth)/forgot_pass")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.forgotPasswordLabel, { color: theme.text }]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            </View>

            {/* Primary CTA: SIGN IN */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: theme.primaryBtnBg,
                  shadowColor: theme.isDark ? "#FFFFFF" : "#000000",
                },
              ]}
              onPress={handleSignIn}
              disabled={isLoading}
              activeOpacity={0.88}
            >
              {isLoading ? (
                <ActivityIndicator color={theme.primaryBtnText} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: theme.primaryBtnText }]}>
                  SIGN IN
                </Text>
              )}
            </TouchableOpacity>

            {/* OR Divider Row */}
            <View style={styles.orDividerRow}>
              <View style={[styles.orDividerLine, { backgroundColor: theme.border }]} />
              <Text style={[styles.orDividerText, { color: theme.textMuted }]}>or</Text>
              <View style={[styles.orDividerLine, { backgroundColor: theme.border }]} />
            </View>

            {/* Social Logins matching reference screenshot */}
            <TouchableOpacity
              style={[
                styles.socialPillBtn,
                {
                  backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.04)" : "#F4F4F6",
                  borderColor: theme.border,
                },
              ]}
              onPress={handleDemoSignIn}
              activeOpacity={0.8}
            >
              <Image
                source={Icons.googleIcon}
                style={{ width: 19, height: 19, marginRight: 10 }}
                resizeMode="contain"
              />
              <Text style={[styles.socialPillText, { color: theme.text }]}>Login with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.socialPillBtn,
                {
                  backgroundColor: theme.isDark ? "rgba(255, 255, 255, 0.04)" : "#F4F4F6",
                  borderColor: theme.border,
                  marginTop: 12,
                },
              ]}
              onPress={handleDemoSignIn}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-apple" size={20} color={theme.text} style={{ marginRight: 10 }} />
              <Text style={[styles.socialPillText, { color: theme.text }]}>Login with Apple</Text>
            </TouchableOpacity>

            {/* Footer Row: Don't have an account? Sign Up */}
            <View style={styles.footerRow}>
              <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                Don&apos;t have an account?{" "}
                <Text
                  style={[styles.footerLinkBold, { color: theme.text }]}
                  onPress={() => router.push("/(auth)/sign_up")}
                >
                  Sign Up
                </Text>
              </Text>
            </View>

            {/* Quick Demo Bypass */}
            <TouchableOpacity
              style={styles.demoLink}
              onPress={handleDemoSignIn}
              activeOpacity={0.7}
            >
              <Text style={[styles.demoLinkText, { color: theme.textMuted }]}>
                Explore as Guest Motorist ›
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 26,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: "center",
  },
  headerSection: {
    marginBottom: 32,
  },
  mainHeading: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  subHeading: {
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "400",
  },
  faqLink: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorBannerText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  inputPill: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  inputLeftIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "500",
  },
  eyeToggleBtn: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  rememberGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  rememberLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  forgotPasswordLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  primaryBtn: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
  orDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 24,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
  },
  orDividerText: {
    paddingHorizontal: 14,
    fontSize: 12,
    fontWeight: "500",
  },
  socialPillBtn: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  socialPillText: {
    fontSize: 14,
    fontWeight: "700",
  },
  footerRow: {
    marginTop: 32,
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    fontWeight: "500",
  },
  footerLinkBold: {
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  demoLink: {
    marginTop: 18,
    alignItems: "center",
  },
  demoLinkText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
