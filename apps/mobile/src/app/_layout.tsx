import { useEffect } from "react";
import type { ColorValue } from "react-native";
import { Tabs } from "expo-router/js-tabs";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { AppProvider, useApp } from "../state/app";
import { warmUp } from "../engine/status";
import { useColors } from "../theme";

const icon = (on: keyof typeof Ionicons.glyphMap, off: keyof typeof Ionicons.glyphMap) =>
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? on : off} color={color as string} size={size - 2} />;
  };

function AppTabs() {
  const c = useColors();
  const { settings } = useApp();

  // Load everything in the background so the first Generate/Listen doesn't wait for it.
  useEffect(() => {
    void warmUp(settings.target, settings.native);
  }, [settings.target, settings.native]);

  return (
    <>
      <StatusBar style="auto" />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: c.bg },
          tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.line },
          tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
          tabBarActiveTintColor: c.accent,
          tabBarInactiveTintColor: c.muted,
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Practice", tabBarIcon: icon("chatbubbles", "chatbubbles-outline") }} />
        <Tabs.Screen name="saved" options={{ title: "Saved", tabBarIcon: icon("bookmark", "bookmark-outline") }} />
        <Tabs.Screen name="setup" options={{ title: "Setup", tabBarIcon: icon("settings", "settings-outline") }} />
      </Tabs>
    </>
  );
}

export default function Layout() {
  return (
    <AppProvider>
      <AppTabs />
    </AppProvider>
  );
}
