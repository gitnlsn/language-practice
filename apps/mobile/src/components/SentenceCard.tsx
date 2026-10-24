// One sentence card. In "listen" mode the translation starts hidden; in "produce" mode the sentence does.
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PracticeMode, Sentence } from "@viva-voz/core";
import { radius, serif, useColors } from "../theme";

export type PlayState = "idle" | "loading" | "speaking";

function IconAction(props: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: !!props.active }}
      onPress={props.onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconAction, pressed && { opacity: 0.5 }]}
    >
      <Ionicons name={props.icon} size={21} color={props.color} />
    </Pressable>
  );
}

export function SentenceCard(props: {
  sentence: Sentence;
  index: number;
  mode: PracticeMode;
  play: PlayState;
  current: boolean;
  yourTurn: boolean;
  onPlay: () => void;
  onToggle: (key: "favorite" | "hard") => void;
  onDelete?: () => void;
}) {
  const c = useColors();
  const s = props.sentence;
  // Revealed for this sentence in this mode only; switching mode (or sentence) hides it again.
  const key = `${props.mode}|${s.id}`;
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const revealed = revealedKey === key;
  const setRevealed = (on: boolean) => setRevealedKey(on ? key : null);

  const hiddenSide = props.mode === "listen" ? "translation" : "target";
  const busy = props.play !== "idle";

  const hidden = (label: string) => (
    <Pressable
      onPress={() => setRevealed(true)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.veil, { backgroundColor: c.surface2 }, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name="eye-outline" size={15} color={c.muted} />
      <Text style={[styles.veilText, { color: c.muted }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: props.yourTurn ? c.turn : props.current ? c.accent : c.line },
        (props.current || props.yourTurn) && styles.focused,
      ]}
    >
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={busy ? "Stop" : "Listen"}
          onPress={props.onPlay}
          hitSlop={6}
          style={({ pressed }) => [
            styles.play,
            { backgroundColor: busy ? c.accent : c.accentSoft },
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          {props.play === "loading" ? (
            <ActivityIndicator color={c.accentInk} />
          ) : (
            <Ionicons name={busy ? "stop" : "play"} size={22} color={busy ? c.accentInk : c.accent} style={!busy && styles.playNudge} />
          )}
        </Pressable>

        <View style={styles.body}>
          {hiddenSide === "target" && !revealed ? (
            hidden("Say it, then tap to check")
          ) : (
            <Text style={[styles.target, { color: c.text }]} selectable>
              {s.text}
            </Text>
          )}
          {hiddenSide === "translation" && !revealed ? (
            hidden("Show translation")
          ) : (
            <Text style={[styles.translation, { color: c.muted }]} selectable>
              {s.translation}
            </Text>
          )}
        </View>
      </View>

      {props.yourTurn && (
        <View style={[styles.turn, { backgroundColor: c.warnSoft }]}>
          <Ionicons name="mic-outline" size={16} color={c.turn} />
          <Text style={[styles.turnText, { color: c.turn }]}>Your turn — say it aloud</Text>
        </View>
      )}

      <View style={[styles.actions, { borderTopColor: c.line }]}>
        <Text style={[styles.num, { color: c.muted }]}>{String(props.index + 1).padStart(2, "0")}</Text>
        <View style={styles.spacer} />
        <IconAction
          icon={revealed ? "eye-off-outline" : "eye-outline"}
          label={revealed ? "Hide" : "Reveal"}
          color={c.muted}
          onPress={() => setRevealed(!revealed)}
        />
        <IconAction
          icon={s.hard ? "flag" : "flag-outline"}
          label="Mark as hard"
          active={!!s.hard}
          color={s.hard ? c.turn : c.muted}
          onPress={() => props.onToggle("hard")}
        />
        <IconAction
          icon={s.favorite ? "bookmark" : "bookmark-outline"}
          label="Save"
          active={!!s.favorite}
          color={s.favorite ? c.accent : c.muted}
          onPress={() => props.onToggle("favorite")}
        />
        {props.onDelete && <IconAction icon="trash-outline" label="Delete" color={c.muted} onPress={props.onDelete} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius + 4, paddingTop: 16, paddingHorizontal: 16 },
  focused: { borderWidth: 2, paddingTop: 15, paddingHorizontal: 15 },
  top: { flexDirection: "row", gap: 14 },
  play: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  playNudge: { marginLeft: 3 },
  body: { flex: 1, gap: 10, paddingTop: 2 },
  target: { fontFamily: serif, fontSize: 22, lineHeight: 30 },
  translation: { fontSize: 15, lineHeight: 22 },
  veil: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  veilText: { fontSize: 13 },
  turn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12 },
  turnText: { fontSize: 14, fontWeight: "600" },
  actions: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingVertical: 4 },
  num: { fontVariant: ["tabular-nums"], fontSize: 12, letterSpacing: 0.5 },
  spacer: { flex: 1 },
  iconAction: { padding: 10 },
});
