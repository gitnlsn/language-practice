// The web app's palette (apps/web/src/style.css), light and dark.
import { useColorScheme } from "react-native";

const light = {
  bg: "#f6f3ee",
  surface: "#fffdf9",
  surface2: "#efeae2",
  text: "#22201c",
  muted: "#6f6a61",
  line: "#e2dcd2",
  accent: "#2f5bd3",
  accentInk: "#ffffff",
  accentSoft: "#e4ebfb",
  ok: "#1f7a4d",
  okSoft: "#dcf1e5",
  warn: "#9a5b00",
  warnSoft: "#fbedd5",
  bad: "#b3261e",
  badSoft: "#f9e0de",
  turn: "#d97706",
};

const dark: typeof light = {
  bg: "#161514",
  surface: "#1f1e1c",
  surface2: "#2a2826",
  text: "#ece8e1",
  muted: "#a39d93",
  line: "#34312d",
  accent: "#8aa8ff",
  accentInk: "#0f1424",
  accentSoft: "#24304f",
  ok: "#6fd3a0",
  okSoft: "#173426",
  warn: "#f0b45c",
  warnSoft: "#3a2c14",
  bad: "#ff8f86",
  badSoft: "#3d1c1a",
  turn: "#f59e0b",
};

export type Colors = typeof light;

export const useColors = (): Colors => (useColorScheme() === "dark" ? dark : light);

export const radius = 14;
export const serif = "serif";
