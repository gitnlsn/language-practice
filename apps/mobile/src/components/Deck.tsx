// A list of sentence cards with single play, and "play all with pauses" (shadowing). Port of apps/web/src/ui/deck.ts.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useReducer, useRef, useState, type ReactElement } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { repeatPauseMs, type Sentence } from "@viva-voz/core";
import { useApp } from "../state/app";
import { speaker } from "../engine/speaker";
import { SentenceCard, type PlayState } from "./SentenceCard";

export interface DeckHandle {
  playAll: () => Promise<void>;
  stopAll: () => void;
}

interface Props {
  items: Sentence[];
  deletable?: boolean;
  onPlayAllChange?: (playing: boolean) => void;
  header?: ReactElement;
  empty?: ReactElement;
  footer?: ReactElement;
  /** Space kept clear at the bottom (e.g. for the floating player). */
  bottomInset?: number;
  /** Synthesize every sentence as soon as the set appears, rather than just the next couple. */
  preloadAll?: boolean;
}

export const Deck = forwardRef<DeckHandle, Props>(function Deck(props, ref) {
  const { onPlayAllChange, preloadAll } = props;
  const { settings, updateSentence, removeSentence } = useApp();
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState<{ id: string; state: PlayState } | null>(null);
  const [turn, setTurn] = useState<string | null>(null);
  const list = useRef<FlatList<Sentence>>(null);
  const runId = useRef(0);
  const speakId = useRef(0);
  const items = useRef(props.items);
  items.current = props.items;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Re-render when a sentence's audio is queued, ready or failed, to update its loading indicator.
  const [audioVersion, audioChanged] = useReducer((n: number) => n + 1, 0);
  useEffect(() => speaker.subscribe(audioChanged), []);

  const request = (item: Sentence, s = settingsRef.current) => ({
    text: item.text,
    lang: item.target,
    voice: s.voices[item.target],
    speed: s.speed,
  });
  const kokoro = settings.engine === "kokoro";

  /** Warm the Kokoro cache for the next couple of sentences so playback starts instantly. */
  const prefetch = useCallback((from: number) => {
    const s = settingsRef.current;
    if (s.engine !== "kokoro") return;
    for (const item of items.current.slice(from, from + 2)) speaker.synth(request(item, s)).catch(() => {});
  }, []);

  const stopAll = useCallback(() => {
    if (runId.current) onPlayAllChange?.(false);
    runId.current++;
    speakId.current++;
    setPlaying(null);
    setTurn(null);
    speaker.stop();
  }, [onPlayAllChange]);

  const focus = useCallback((i: number) => {
    setCurrent(i);
    list.current?.scrollToIndex({ index: i, viewPosition: 0.3, animated: true });
  }, []);

  const speak = useCallback(
    async (i: number) => {
      const item = items.current[i];
      if (!item) return;
      const s = settingsRef.current;
      const id = ++speakId.current;
      setPlaying({ id: item.id, state: "loading" });
      prefetch(i + 1);
      try {
        await speaker.speak(item.text, item.target, {
          engine: s.engine,
          voice: s.voices[item.target],
          speed: s.speed,
          onStart: () => id === speakId.current && setPlaying({ id: item.id, state: "speaking" }),
        });
      } finally {
        if (id === speakId.current) setPlaying(null);
      }
    },
    [prefetch],
  );

  /** Play the card, or stop it if it is already loading/speaking. */
  const toggle = useCallback(
    (i: number) => {
      const busy = playing?.id === items.current[i]?.id;
      stopAll();
      setCurrent(i);
      if (!busy) void speak(i);
    },
    [playing, speak, stopAll],
  );

  /** Shadowing: play each sentence, then leave a silent gap long enough to repeat it aloud. */
  const playAll = useCallback(async () => {
    stopAll();
    const run = ++runId.current;
    onPlayAllChange?.(true);
    for (let i = current; i < items.current.length && run === runId.current; i++) {
      focus(i);
      const started = Date.now();
      await speak(i);
      const spoken = Date.now() - started;
      if (run !== runId.current) break;
      setTurn(items.current[i].id);
      await new Promise((r) => setTimeout(r, repeatPauseMs(spoken)));
      if (run === runId.current) setTurn(null);
    }
    if (run === runId.current) onPlayAllChange?.(false);
  }, [current, focus, onPlayAllChange, speak, stopAll]);

  useImperativeHandle(ref, () => ({ playAll, stopAll }), [playAll, stopAll]);

  // New set of sentences (first one changed): start at the top. Sentences that stream in afterwards don't reset
  // the position.
  const firstId = props.items[0]?.id;
  useEffect(() => {
    setCurrent(0);
    // Bring the new sentences into view; on Practice they'd otherwise sit below the controls.
    if (firstId) list.current?.scrollToIndex({ index: 0, viewPosition: 0, animated: true });
  }, [firstId]);

  // Get the audio ready before it's asked for: the whole set on Practice, the first couple elsewhere. Runs again
  // when the set, voice or speed changes. Layout effect, so the cards never flash a play icon first.
  const voiceKey = props.items.map((item) => `${settings.voices[item.target]}|${item.text}`).join("\n");
  useLayoutEffect(() => {
    if (!kokoro) return;
    if (preloadAll) speaker.preload(items.current.map((item) => request(item)));
    else prefetch(0);
  }, [voiceKey, settings.speed, kokoro, preloadAll, prefetch]);

  // Leaving the tab stops playback, like switching views on the web.
  useFocusEffect(useCallback(() => () => stopAll(), [stopAll]));

  return (
    <FlatList
      ref={list}
      data={props.items}
      keyExtractor={(s) => s.id}
      contentContainerStyle={[styles.content, { paddingBottom: props.bottomInset ?? 48 }]}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListHeaderComponent={props.header}
      ListEmptyComponent={props.empty}
      ListFooterComponent={props.footer ? <View style={styles.footer}>{props.footer}</View> : undefined}
      extraData={audioVersion}
      onScrollToIndexFailed={() => {}}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item, index }) => (
        <SentenceCard
          sentence={item}
          index={index}
          mode={settings.mode}
          play={playing?.id === item.id ? playing.state : "idle"}
          preparing={kokoro && speaker.isPending(request(item, settings))}
          current={index === current}
          yourTurn={turn === item.id}
          onPlay={() => toggle(index)}
          onToggle={(key) => updateSentence(item.id, { [key]: !item[key] })}
          onDelete={props.deletable ? () => removeSentence(item.id) : undefined}
        />
      )}
    />
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  footer: { marginTop: 12 },
  gap: { height: 12 },
});
