// Practice: the session (language · level · topic) on top, the sentences in the middle, the player at the bottom.
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LANG_NAMES, recentTexts, type Sentence } from "@viva-voz/core";
import { Deck, type DeckHandle } from "../components/Deck";
import { PlayerBar } from "../components/PlayerBar";
import { ScreenHeader } from "../components/ScreenHeader";
import { SessionBar, SessionSheet, type SheetSection } from "../components/SessionSheet";
import { generateSentences } from "../engine/generate";
import { useEngineStatus } from "../engine/status";
import { useApp } from "../state/app";
import { radius, serif, useColors } from "../theme";

export default function Practice() {
  const c = useColors();
  const { settings, setSettings, sentences, addToHistory, deck, setDeck } = useApp();
  const engine = useEngineStatus();
  const [sheet, setSheet] = useState<SheetSection | null>(null);
  const [progress, setProgress] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [playingAll, setPlayingAll] = useState(false);
  const deckRef = useRef<DeckHandle>(null);

  async function generate() {
    if (busy) return;
    const { target, native, level, count } = settings;
    const topic = settings.topic.trim();
    deckRef.current?.stopAll();
    setBusy(true);
    setDeck([]);
    setProgress({ text: "Writing sentences…" });
    const now = Date.now();
    const made: Sentence[] = [];
    try {
      // The model writes English; avoid repeating the English behind recent sentences.
      const avoid = sentences.filter((s) => s.target === target && s.source).slice(0, 40).map((s) => s.source!);
      const { items } = await generateSentences(
        { target, native, level, topic, count, avoid: avoid.length ? avoid : recentTexts(sentences, target) },
        (g) => {
          made.push({ id: `${now}-${made.length}`, target, native, level, topic, createdAt: now, ...g });
          setDeck([...made]);
          setProgress({ text: `Translating ${Math.min(made.length + 1, count)} of ${count}…` });
        },
      );
      if (!items.length) throw new Error("No new sentences this time. Try again or pick another topic.");
      addToHistory(made);
      setProgress(null);
    } catch (e: any) {
      if (made.length) addToHistory(made);
      setProgress({ text: String(e?.message ?? e), error: true });
    } finally {
      setBusy(false);
    }
  }

  const preparing = engine.writer.status !== "ready" && engine.writer.status !== "error";

  const header = (
    <View style={styles.header}>
      <ScreenHeader
        title="Eco"
        right={
          deck.length > 0 || busy ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Generate a new set"
              disabled={busy}
              onPress={() => void generate()}
              style={({ pressed }) => [styles.newSet, { backgroundColor: c.accent }, (pressed || busy) && { opacity: 0.6 }]}
            >
              <Ionicons name="sparkles" size={16} color={c.accentInk} />
              <Text style={[styles.newSetText, { color: c.accentInk }]}>New</Text>
            </Pressable>
          ) : null
        }
      >
        <SessionBar settings={settings} onOpen={setSheet} />
      </ScreenHeader>

      {progress && (
        <View style={[styles.status, { backgroundColor: progress.error ? c.badSoft : c.surface2 }]} accessibilityLiveRegion="polite">
          {progress.error ? <Ionicons name="alert-circle-outline" size={18} color={c.bad} /> : <ActivityIndicator size="small" color={c.accent} />}
          <Text style={[styles.statusText, { color: progress.error ? c.bad : c.text }]}>{progress.text}</Text>
        </View>
      )}
    </View>
  );

  // While writing, show placeholders for the sentences still to come.
  const placeholders = busy
    ? Array.from({ length: Math.max(0, settings.count - deck.length) }, (_, i) => (
        <View key={i} style={[styles.skeleton, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={[styles.skelDot, { backgroundColor: c.surface2 }]} />
          <View style={styles.skelLines}>
            <View style={[styles.skelLine, { backgroundColor: c.surface2, width: "85%" }]} />
            <View style={[styles.skelLine, { backgroundColor: c.surface2, width: "55%" }]} />
          </View>
        </View>
      ))
    : null;

  const empty = busy ? (
    <View style={styles.skeletons}>{placeholders}</View>
  ) : (
    <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={[styles.emptyIcon, { backgroundColor: c.accentSoft }]}>
        <Ionicons name="chatbubbles-outline" size={28} color={c.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: c.text }]}>Ready when you are</Text>
      <Text style={[styles.emptyText, { color: c.muted }]}>
        {settings.count} {LANG_NAMES[settings.target]} sentences at {settings.level}
        {settings.topic ? ` about ${settings.topic}` : " on a surprise topic"}. Listen, repeat, and copy them by hand.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void generate()}
        style={({ pressed }) => [styles.cta, { backgroundColor: c.accent }, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="sparkles" size={18} color={c.accentInk} />
        <Text style={[styles.ctaText, { color: c.accentInk }]}>Generate sentences</Text>
      </Pressable>
      {preparing && <Text style={[styles.hint, { color: c.muted }]}>Getting the sentence writer ready… the first set may take a little longer.</Text>}
    </View>
  );

  return (
    <View style={styles.fill}>
      <Deck
        ref={deckRef}
        items={deck}
        header={header}
        empty={empty}
        footer={deck.length > 0 && busy ? <View style={styles.skeletons}>{placeholders}</View> : undefined}
        bottomInset={deck.length > 0 ? 96 : 24}
        onPlayAllChange={setPlayingAll}
      />
      {deck.length > 0 && (
        <PlayerBar
          playing={playingAll}
          onPlayAll={() => (playingAll ? deckRef.current?.stopAll() : void deckRef.current?.playAll())}
          speed={settings.speed}
          onSpeed={(speed) => setSettings({ speed })}
          mode={settings.mode}
          onMode={(mode) => setSettings({ mode })}
        />
      )}
      <SessionSheet open={sheet} settings={settings} onChange={setSettings} onClose={() => setSheet(null)} onGenerate={() => void generate()} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { gap: 14, marginBottom: 16 },
  newSet: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  newSetText: { fontSize: 15, fontWeight: "700" },
  status: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  statusText: { fontSize: 14, flexShrink: 1 },
  empty: { borderWidth: 1, borderRadius: radius + 6, padding: 24, alignItems: "center", gap: 10 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontFamily: serif, fontSize: 24, fontWeight: "600" },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  cta: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 14, marginTop: 8 },
  ctaText: { fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 13, textAlign: "center", marginTop: 4 },
  skeletons: { gap: 12 },
  skeleton: { flexDirection: "row", gap: 14, borderWidth: 1, borderRadius: radius + 4, padding: 16 },
  skelDot: { width: 48, height: 48, borderRadius: 24 },
  skelLines: { flex: 1, gap: 10, paddingTop: 6 },
  skelLine: { height: 14, borderRadius: 7 },
});
