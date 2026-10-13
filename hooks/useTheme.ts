import { useColorScheme } from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemePreference = "system" | "light" | "dark";

export interface ThemeColors {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceTranslucent: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primaryBtnBg: string;
  primaryBtnText: string;
  arrowCircleBg: string;
  arrowCircleText: string;
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  pillActiveBg: string;
  pillActiveText: string;
  pillInactiveBg: string;
  pillInactiveText: string;
  inputBg: string;
  inputBorder: string;
  iconColor: string;
  blurTint: "light" | "dark";
  navBg: string;
  navBorder: string;
}

export function useTheme(): ThemeColors & {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
} {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>("light");

  useEffect(() => {
    AsyncStorage.getItem("@parkzone_theme_pref").then((saved) => {
      if (saved === "light" || saved === "dark") {
        setPreference(saved);
      } else if (saved === "system") {
        setPreference("system");
      } else {
        // Explicitly default to light mode
        setPreference("light");
      }
    });
  }, []);

  const setThemePreference = (pref: ThemePreference) => {
    setPreference(pref);
    AsyncStorage.setItem("@parkzone_theme_pref", pref);
  };

  // Light mode is the default:
  // Only dark if explicitly set to 'dark' or if user intentionally selected 'system' and system is dark
  const isDark =
    preference === "dark"
      ? true
      : preference === "system"
        ? systemScheme === "dark"
        : false;

  if (isDark) {
    return {
      isDark: true,
      themePreference: preference,
      setThemePreference,
      background: "#000000",
      surface: "#121215",
      surfaceTranslucent: "rgba(20, 20, 24, 0.75)",
      border: "rgba(255, 255, 255, 0.12)",
      borderStrong: "rgba(255, 255, 255, 0.24)",
      text: "#FFFFFF",
      textSecondary: "#A1A1AA",
      textMuted: "#71717A",
      primaryBtnBg: "#FFFFFF",
      primaryBtnText: "#000000",
      arrowCircleBg: "#000000",
      arrowCircleText: "#FFFFFF",
      cardBg: "rgba(20, 20, 24, 0.75)",
      cardBorder: "rgba(255, 255, 255, 0.14)",
      cardShadow: "#000000",
      pillActiveBg: "#FFFFFF",
      pillActiveText: "#000000",
      pillInactiveBg: "rgba(255, 255, 255, 0.08)",
      pillInactiveText: "#A1A1AA",
      inputBg: "rgba(255, 255, 255, 0.06)",
      inputBorder: "rgba(255, 255, 255, 0.16)",
      iconColor: "#FFFFFF",
      blurTint: "dark",
      navBg: "rgba(18, 18, 22, 0.92)",
      navBorder: "rgba(255, 255, 255, 0.16)",
    };
  }

  // Light Mode (Default as requested by user, respecting device theme)
  return {
    isDark: false,
    themePreference: preference,
    setThemePreference,
    background: "#F4F4F6",
    surface: "#FFFFFF",
    surfaceTranslucent: "#FFFFFF",
    border: "rgba(0, 0, 0, 0.07)",
    borderStrong: "rgba(0, 0, 0, 0.16)",
    text: "#09090B",
    textSecondary: "#71717A",
    textMuted: "#A1A1AA",
    primaryBtnBg: "#09090B",
    primaryBtnText: "#FFFFFF",
    arrowCircleBg: "#FFFFFF",
    arrowCircleText: "#09090B",
    cardBg: "#FFFFFF",
    cardBorder: "rgba(0, 0, 0, 0.06)",
    cardShadow: "rgba(0, 0, 0, 0.06)",
    pillActiveBg: "#09090B",
    pillActiveText: "#FFFFFF",
    pillInactiveBg: "#E4E4E7",
    pillInactiveText: "#52525B",
    inputBg: "#FFFFFF",
    inputBorder: "rgba(0, 0, 0, 0.10)",
    iconColor: "#09090B",
    blurTint: "light",
    navBg: "rgba(255, 255, 255, 0.92)",
    navBorder: "rgba(0, 0, 0, 0.08)",
  };
}
