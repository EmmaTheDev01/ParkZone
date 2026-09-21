import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

const OtpVerified = () => {
  return (
    <SafeAreaView className="auth-screen">
      <View className="auth-content">
        <View className="forgot-password-page-container">
          <Text className="forgot-password-title">OTP Verified</Text>
          <Text className="forgot-password-subtext">
            Your verification code has been successfully confirmed.
          </Text>
        </View>

        <View className="forgot-password-submit-container" style={{ marginTop: 24 }}>
          <TouchableOpacity
            className="forgot-password-submit-button"
            onPress={() => router.replace("/(auth)/new_pass")}
          >
            <Text className="forgot-password-submit-button-text">Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default OtpVerified;
