// Practice: the session (language · level · topic) on top, the sentences in the middle, the player at the bottom.
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LANG_NAMES, type Sentence } from "@viva-voz/core";
import { Deck, type DeckHandle } from "../components/Deck";
import { PlayerBar } from "../components/PlayerBar";
import { ScreenHeader } from "../components/ScreenHeader";
import { SessionBar, SessionSheet, type SheetSection } from "../components/SessionSheet";
import { pickSentences } from "../engine/bank";
import { useApp } from "../state/app";
import { radius, serif, useColors } from "../theme";

export default function Practice() {
  const c = useColors();
  const { settings, setSettings, sentences, addToHistory, deck, setDeck } = useApp();
  const [sheet, setSheet] = useState<SheetSection | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [playingAll, setPlayingAll] = useState(false);
  const deckRef = useRef<DeckHandle>(null);

  function generate() {
    const { target, native, level, count, topic } = settings;
    deckRef.current?.stopAll();
    const seen = new Set(sentences.filter((s) => s.target === target).map((s) => s.text));
    const picked = pickSentences({ target, native, level, topic, count, seen });
    if (!picked.length) {
      setMessage("No sentences for this choice. Pick another topic.");
      return;
    }
    const now = Date.now();
    const made: Sentence[] = picked.map((p, i) => ({ id: `${now}-${i}`, target, native, level, createdAt: now, ...p }));
    setMessage(null);
    setDeck(made);
    addToHistory(made);
  }

  const header = (
    <View style={styles.header}>
      <ScreenHeader
        title="Eco"
        right={
          deck.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get a new set"
              onPress={generate}
              style={({ pressed }) => [styles.newSet, { backgroundColor: c.accent }, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="sparkles" size={16} color={c.accentInk} />
              <Text style={[styles.newSetText, { color: c.accentInk }]}>New</Text>
            </Pressable>
          ) : null
        }
      >
        <SessionBar settings={settings} onOpen={setSheet} />
      </ScreenHeader>

      {message && (
        <View style={[styles.status, { backgroundColor: c.badSoft }]} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle-outline" size={18} color={c.bad} />
          <Text style={[styles.statusText, { color: c.bad }]}>{message}</Text>
        </View>
      )}
    </View>
  );

  const empty = (
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
        onPress={generate}
        style={({ pressed }) => [styles.cta, { backgroundColor: c.accent }, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="sparkles" size={18} color={c.accentInk} />
        <Text style={[styles.ctaText, { color: c.accentInk }]}>Get sentences</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.fill}>
      <Deck
        ref={deckRef}
        items={deck}
        header={header}
        empty={empty}
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
      <SessionSheet open={sheet} settings={settings} onChange={setSettings} onClose={() => setSheet(null)} onGenerate={generate} />
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
});
