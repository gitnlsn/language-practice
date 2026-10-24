// The session bar (language · level · topic pills) and the bottom sheet that edits them.
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LEVELS, TOPICS, type Level, type Settings, type TargetLang } from "@viva-voz/core";
import { radius, serif, useColors } from "../theme";

type IconName = keyof typeof Ionicons.glyphMap;

export const LANGUAGES: Record<TargetLang, { name: string; hello: string }> = {
  fr: { name: "Français", hello: "Bonjour !" },
  es: { name: "Español", hello: "¡Hola!" },
};

const LEVEL_HINT: Record<Level, string> = {
  A1: "Starter",
  A2: "Basics",
  B1: "Getting by",
  B2: "Confident",
  C1: "Nuanced",
};

const TOPIC_ICON: Record<string, IconName> = {
  "ordering at a café or restaurant": "cafe-outline",
  "travel and directions": "map-outline",
  shopping: "bag-handle-outline",
  "work and meetings": "briefcase-outline",
  "family and friends": "people-outline",
  "health and the doctor": "medkit-outline",
  "weather and seasons": "partly-sunny-outline",
  "hobbies and weekends": "bicycle-outline",
  "home and daily routine": "home-outline",
  "feelings and opinions": "heart-outline",
  "small talk with a neighbour": "chatbubbles-outline",
  "phone calls and appointments": "call-outline",
};

export const topicIcon = (topic: string): IconName => TOPIC_ICON[topic] ?? (topic ? "pricetag-outline" : "shuffle-outline");
const shortTopic = (topic: string) => (topic ? topic.replace(/^(ordering at a |small talk with a )/, "").split(/ (and|or) /)[0] : "Any topic");
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type SheetSection = "language" | "level" | "topic";

function Pill(props: { icon?: IconName; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [styles.pill, { backgroundColor: c.surface, borderColor: c.line }, pressed && { opacity: 0.7 }]}
    >
      {props.icon && <Ionicons name={props.icon} size={16} color={c.accent} />}
      <Text style={[styles.pillText, { color: c.text }]} numberOfLines={1}>
        {props.label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={c.muted} />
    </Pressable>
  );
}

export function SessionBar({ settings, onOpen }: { settings: Settings; onOpen: (s: SheetSection) => void }) {
  return (
    <View style={styles.bar}>
      <Pill label={LANGUAGES[settings.target].name} onPress={() => onOpen("language")} />
      <Pill label={settings.level} onPress={() => onOpen("level")} />
      <Pill icon={topicIcon(settings.topic)} label={capital(shortTopic(settings.topic))} onPress={() => onOpen("topic")} />
    </View>
  );
}

export function SessionSheet(props: {
  open: SheetSection | null;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onGenerate: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { settings, onChange } = props;
  const [custom, setCustom] = useState("");
  const isPreset = !settings.topic || TOPICS.includes(settings.topic);

  return (
    <Modal visible={props.open != null} transparent animationType="slide" onRequestClose={props.onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={props.onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.bg, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.grabber, { backgroundColor: c.line }]} />
        <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
          <Text style={[styles.h, { color: c.text }]}>Language</Text>
          <View style={styles.row}>
            {(Object.keys(LANGUAGES) as TargetLang[]).map((t) => {
              const on = settings.target === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => onChange({ target: t })}
                  style={[styles.langCard, { backgroundColor: on ? c.accentSoft : c.surface, borderColor: on ? c.accent : c.line }]}
                >
                  <Text style={[styles.langHello, { color: on ? c.accent : c.text }]}>{LANGUAGES[t].hello}</Text>
                  <Text style={{ color: c.muted }}>{LANGUAGES[t].name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.h, { color: c.text }]}>Level</Text>
          <View style={styles.levels}>
            {LEVELS.map((l) => {
              const on = settings.level === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => onChange({ level: l })}
                  style={[styles.level, { backgroundColor: on ? c.accent : c.surface, borderColor: on ? c.accent : c.line }]}
                >
                  <Text style={[styles.levelCode, { color: on ? c.accentInk : c.text }]}>{l}</Text>
                  <Text style={[styles.levelHint, { color: on ? c.accentInk : c.muted }]} numberOfLines={1}>
                    {LEVEL_HINT[l]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.h, { color: c.text }]}>Topic</Text>
          <View style={styles.topics}>
            {["", ...TOPICS].map((t) => {
              const on = settings.topic === t;
              return (
                <Pressable
                  key={t || "any"}
                  onPress={() => onChange({ topic: t })}
                  style={[styles.topic, { backgroundColor: on ? c.accentSoft : c.surface, borderColor: on ? c.accent : c.line }]}
                >
                  <Ionicons name={topicIcon(t)} size={16} color={on ? c.accent : c.muted} />
                  <Text style={[styles.topicText, { color: on ? c.accent : c.text }]}>{t ? capital(t) : "Surprise me"}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={isPreset ? custom : settings.topic}
            onChangeText={(t) => (setCustom(t), onChange({ topic: t }))}
            placeholder="…or type your own topic"
            placeholderTextColor={c.muted}
            style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: !isPreset ? c.accent : c.line }]}
            returnKeyType="done"
          />
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          onPress={() => (props.onClose(), props.onGenerate())}
          style={({ pressed }) => [styles.go, { backgroundColor: c.accent }, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="sparkles" size={18} color={c.accentInk} />
          <Text style={[styles.goText, { color: c.accentInk }]}>Generate {settings.count} sentences</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, maxWidth: 200 },
  pillText: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88%", paddingHorizontal: 16 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 6 },
  sheetContent: { gap: 12, paddingVertical: 10 },
  h: { fontSize: 17, fontWeight: "700", marginTop: 6 },
  row: { flexDirection: "row", gap: 10 },
  langCard: { flex: 1, borderWidth: 1.5, borderRadius: radius, padding: 16, gap: 4 },
  langHello: { fontFamily: serif, fontSize: 24 },
  levels: { flexDirection: "row", gap: 6 },
  level: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center", gap: 2 },
  levelCode: { fontSize: 16, fontWeight: "700" },
  levelHint: { fontSize: 10 },
  topics: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  topic: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  topicText: { fontSize: 14 },
  input: { borderWidth: 1, borderRadius: radius, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  go: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, paddingVertical: 15, marginTop: 8 },
  goText: { fontSize: 16, fontWeight: "700" },
});
