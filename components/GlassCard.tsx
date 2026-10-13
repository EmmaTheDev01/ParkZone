import React from "react";
import { Platform, StyleSheet, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "../hooks/useTheme";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  borderRadius?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  intensity = 50,
  borderRadius = 24,
}) => {
  const { isDark, cardBg, cardBorder, cardShadow, blurTint } = useTheme();

  return (
    <View
      style={[
        styles.outerShadow,
        {
          borderRadius,
          backgroundColor: cardBg,
          borderColor: cardBorder,
          shadowColor: cardShadow,
          shadowOpacity: isDark ? 0.45 : 0.06,
          shadowRadius: isDark ? 20 : 12,
        },
        style,
      ]}
    >
      <BlurView
        intensity={Platform.OS === "ios" ? intensity : 0}
        tint={blurTint}
        style={[styles.blurContainer, { borderRadius }]}
      >
        <View style={styles.innerContent}>{children}</View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerShadow: {
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  blurContainer: {
    overflow: "hidden",
    width: "100%",
  },
  innerContent: {
    padding: 20,
  },
});
