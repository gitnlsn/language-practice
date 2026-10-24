// The sticky player above the tab bar: Play all & repeat, speed, and practice mode.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PracticeMode } from "@viva-voz/core";
import { useColors } from "../theme";

const SPEEDS = [0.7, 0.85, 1];

export function PlayerBar(props: {
  playing: boolean;
  onPlayAll: () => void;
  speed: number;
  onSpeed: (s: number) => void;
  mode: PracticeMode;
  onMode: (m: PracticeMode) => void;
}) {
  const c = useColors();
  const nextSpeed = SPEEDS[(SPEEDS.indexOf(props.speed) + 1) % SPEEDS.length];
  const listen = props.mode === "listen";
  return (
    <View style={[styles.bar, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Pressable
        accessibilityRole="button"
        onPress={props.onPlayAll}
        style={({ pressed }) => [styles.main, { backgroundColor: props.playing ? c.turn : c.accent }, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name={props.playing ? "stop" : "repeat"} size={18} color={c.accentInk} />
        <Text style={[styles.mainText, { color: c.accentInk }]}>{props.playing ? "Stop" : "Play all & repeat"}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Speed ${props.speed}×, tap for ${nextSpeed}×`}
        onPress={() => props.onSpeed(nextSpeed)}
        style={({ pressed }) => [styles.small, { backgroundColor: c.surface2 }, pressed && { opacity: 0.7 }]}
      >
        <Text style={[styles.smallText, { color: c.text }]}>{props.speed}×</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listen ? "Mode: listen and repeat. Tap for translate and say" : "Mode: translate and say. Tap for listen and repeat"}
        onPress={() => props.onMode(listen ? "produce" : "listen")}
        style={({ pressed }) => [styles.small, styles.mode, { backgroundColor: c.surface2 }, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name={listen ? "headset" : "chatbubble-ellipses-outline"} size={17} color={c.text} />
        <Text style={[styles.modeText, { color: c.text }]}>{listen ? "Repeat" : "Translate"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 999,
    borderWidth: 1,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  main: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, paddingVertical: 12 },
  mainText: { fontSize: 15, fontWeight: "700" },
  small: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  smallText: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
  mode: { flexDirection: "row", gap: 5 },
  modeText: { fontSize: 14, fontWeight: "600" },
});
