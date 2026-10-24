// Saved: saved / hard sentences and history, with "Practice these". Port of apps/web/src/ui/library.ts.
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { filterSentences, type LibraryFilter, type TargetLang } from "@viva-voz/core";
import { Deck } from "../components/Deck";
import { Segmented } from "../components/controls";
import { ScreenHeader } from "../components/ScreenHeader";
import { useApp } from "../state/app";
import { radius, serif, useColors } from "../theme";

const EMPTY: Record<LibraryFilter, { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }> = {
  favorite: { icon: "bookmark-outline", title: "Nothing saved yet", text: "Tap the bookmark on a sentence you want to keep." },
  hard: { icon: "flag-outline", title: "No hard sentences", text: "Flag the ones that trip you up, and practise them here." },
  all: { icon: "time-outline", title: "No history yet", text: "Sentences you generate will show up here." },
};

export default function Saved() {
  const c = useColors();
  const { sentences, setDeck } = useApp();
  const [filter, setFilter] = useState<LibraryFilter>("favorite");
  const [lang, setLang] = useState<TargetLang | "any">("any");
  const items = filterSentences(sentences, filter, lang);
  const empty = EMPTY[filter];

  const header = (
    <View style={styles.header}>
      <ScreenHeader
        title="Saved"
        right={
          items.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setDeck(items.slice(0, 20));
                router.navigate("/");
              }}
              style={({ pressed }) => [styles.practice, { backgroundColor: c.accent }, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="play" size={15} color={c.accentInk} />
              <Text style={[styles.practiceText, { color: c.accentInk }]}>Practice {Math.min(items.length, 20)}</Text>
            </Pressable>
          ) : null
        }
      >
        <Segmented<LibraryFilter>
          label="Show"
          options={[
            { value: "favorite", label: "Saved" },
            { value: "hard", label: "Hard" },
            { value: "all", label: "History" },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <Segmented<TargetLang | "any">
          label="Language"
          options={[
            { value: "any", label: "All" },
            { value: "fr", label: "Français" },
            { value: "es", label: "Español" },
          ]}
          value={lang}
          onChange={setLang}
        />
      </ScreenHeader>
    </View>
  );

  return (
    <Deck
      items={items}
      deletable
      header={header}
      empty={
        <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={[styles.emptyIcon, { backgroundColor: c.surface2 }]}>
            <Ionicons name={empty.icon} size={26} color={c.muted} />
          </View>
          <Text style={[styles.emptyTitle, { color: c.text }]}>{empty.title}</Text>
          <Text style={[styles.emptyText, { color: c.muted }]}>{empty.text}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 16 },
  practice: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  practiceText: { fontSize: 15, fontWeight: "700" },
  empty: { borderWidth: 1, borderRadius: radius + 6, padding: 24, alignItems: "center", gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontFamily: serif, fontSize: 22, fontWeight: "600" },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: "center" },
});
