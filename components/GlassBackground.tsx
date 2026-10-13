import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "../hooks/useTheme";

interface GlassBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const GlassBackground: React.FC<GlassBackgroundProps> = ({ children, style }) => {
  const { isDark, background } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: background }, style]}>
      {/* Subtle specular ambient orbs */}
      <View
        style={[
          styles.ambientBlobTopRight,
          {
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.07)"
              : "rgba(255, 255, 255, 0.8)",
          },
        ]}
      />
      <View
        style={[
          styles.ambientBlobTopLeft,
          {
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.04)"
              : "rgba(255, 255, 255, 0.6)",
          },
        ]}
      />
      <View
        style={[
          styles.ambientBlobCenter,
          {
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(0, 0, 0, 0.015)",
          },
        ]}
      />
      <View
        style={[
          styles.ambientBlobBottomLeft,
          {
            backgroundColor: isDark
              ? "rgba(255, 255, 255, 0.06)"
              : "rgba(255, 255, 255, 0.7)",
          },
        ]}
      />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  ambientBlobTopRight: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  ambientBlobTopLeft: {
    position: "absolute",
    top: 140,
    left: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  ambientBlobCenter: {
    position: "absolute",
    top: "45%",
    right: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  ambientBlobBottomLeft: {
    position: "absolute",
    bottom: -60,
    left: -50,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
});
