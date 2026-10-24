// Setup: practice preferences, voice, what's loaded, and credits. Everything is bundled; nothing to download.
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KOKORO_VOICES, LANG_NAMES, SAMPLE, TARGETS, type Engine, type NativeLang } from "@viva-voz/core";
import { Segmented } from "../components/controls";
import { ScreenHeader } from "../components/ScreenHeader";
import { speaker } from "../engine/speaker";
import { useEngineStatus, type Part, type PartState } from "../engine/status";
import { useApp } from "../state/app";
import { radius, useColors, type Colors } from "../theme";

type IconName = keyof typeof Ionicons.glyphMap;

const PARTS: { part: Part; icon: IconName; title: string; detail: string }[] = [
  { part: "files", icon: "folder-open-outline", title: "Model files", detail: "Unpacked once on first launch (about 1.4 GB)" },
  { part: "voice", icon: "mic-outline", title: "Natural voice", detail: "Kokoro 82M with eSpeak NG pronunciation" },
  { part: "writer", icon: "create-outline", title: "Sentence writer", detail: "Qwen2.5 1.5B writes in English" },
  { part: "translators", icon: "language-outline", title: "Translators", detail: "Opus-MT into French, Spanish and Portuguese" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.muted }]}>{title}</Text>
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.line }]}>{children}</View>
    </View>
  );
}

function Row({ icon, title, detail, right, first }: { icon: IconName; title: string; detail?: ReactNode; right?: ReactNode; first?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.row, !first && { borderTopColor: c.line, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.rowIcon, { backgroundColor: c.accentSoft }]}>
        <Ionicons name={icon} size={18} color={c.accent} />
      </View>
      <View style={styles.grow}>
        <Text style={[styles.rowTitle, { color: c.text }]}>{title}</Text>
        {detail != null && (typeof detail === "string" ? <Text style={[styles.rowDetail, { color: c.muted }]}>{detail}</Text> : detail)}
      </View>
      {right}
    </View>
  );
}

function Badge({ s, c }: { s: PartState; c: Colors }) {
  if (s.status === "ready") return <Ionicons name="checkmark-circle" size={22} color={c.ok} accessibilityLabel="Ready" />;
  const [label, fg, bg] =
    s.status === "loading" ? ["Loading", c.warn, c.warnSoft] : s.status === "error" ? ["Error", c.bad, c.badSoft] : ["Waiting", c.muted, c.surface2];
  return <Text style={[styles.badge, { color: fg, backgroundColor: bg }]}>{label}</Text>;
}

export default function Setup() {
  const c = useColors();
  const { settings, setSettings } = useApp();
  const engine = useEngineStatus();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ScreenHeader title="Setup" />

      <Section title="PRACTICE">
        <Row
          first
          icon="swap-horizontal-outline"
          title="Translate to"
          detail={
            <View style={styles.control}>
              <Segmented<NativeLang>
                label="Translate to"
                options={[
                  { value: "pt", label: "Português" },
                  { value: "en", label: "English" },
                ]}
                value={settings.native}
                onChange={(native) => setSettings({ native })}
              />
            </View>
          }
        />
        <Row
          icon="layers-outline"
          title="Sentences per set"
          detail={
            <View style={styles.control}>
              <Segmented<number>
                label="Sentences per set"
                options={[3, 5, 8, 10].map((n) => ({ value: n, label: String(n) }))}
                value={settings.count}
                onChange={(count) => setSettings({ count })}
              />
            </View>
          }
        />
      </Section>

      <Section title="VOICE">
        <Row
          first
          icon="volume-high-outline"
          title="Engine"
          detail={
            <View style={styles.control}>
              <Segmented<Engine>
                label="Engine"
                options={[
                  { value: "kokoro", label: "Natural" },
                  { value: "system", label: "System" },
                ]}
                value={settings.engine}
                onChange={(engine) => setSettings({ engine })}
              />
            </View>
          }
        />
        {TARGETS.map((t) => (
          <Row
            key={t}
            icon="person-outline"
            title={`${LANG_NAMES[t]} voice`}
            detail={
              <View style={styles.control}>
                <Segmented
                  label={`${LANG_NAMES[t]} voice`}
                  options={KOKORO_VOICES[t].map((v) => ({ value: v.id, label: v.label }))}
                  value={settings.voices[t]}
                  onChange={(v) => setSettings({ voices: { ...settings.voices, [t]: v } })}
                />
              </View>
            }
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Test ${LANG_NAMES[t]} voice`}
                onPress={() => void speaker.speak(SAMPLE[t], t, { engine: settings.engine, voice: settings.voices[t], speed: settings.speed })}
                style={({ pressed }) => [styles.test, { backgroundColor: c.accentSoft }, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="play" size={18} color={c.accent} style={{ marginLeft: 2 }} />
              </Pressable>
            }
          />
        ))}
      </Section>

      <Section title="ON THIS PHONE">
        {PARTS.map(({ part, icon, title, detail }, i) => {
          const s = engine[part];
          return <Row key={part} first={i === 0} icon={icon} title={title} detail={s.status === "error" ? s.message : detail} right={<Badge s={s} c={c} />} />;
        })}
        <Text style={[styles.note, { color: c.muted, borderTopColor: c.line }]}>Everything runs offline. Nothing is sent anywhere.</Text>
      </Section>

      <Text style={[styles.credits, { color: c.muted }]}>
        Kokoro 82M (Apache 2.0) · eSpeak NG (GPL-3.0) · Qwen2.5 1.5B Instruct (Apache 2.0) · Opus-MT by Helsinki-NLP, University of
        Helsinki (CC-BY 4.0) · ONNX Runtime (MIT) · llama.cpp via llama.rn (MIT)
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 48, gap: 20 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, marginLeft: 4 },
  panel: { borderWidth: 1, borderRadius: radius + 4, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  grow: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowDetail: { fontSize: 13, lineHeight: 18 },
  control: { marginTop: 6 },
  test: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  badge: { fontSize: 12, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  note: { fontSize: 13, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  credits: { fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: 8 },
});
