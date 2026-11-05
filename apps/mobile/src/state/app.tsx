// App state: settings and sentence history, persisted on the device (expo-sqlite key-value store), plus the
// deck currently loaded in Practice. Same keys and list rules as the web app (@viva-voz/core).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Storage } from "expo-sqlite/kv-store";
import {
  addSentences,
  parseSettings,
  SENTENCES_KEY,
  SETTINGS_KEY,
  TOPICS,
  type Sentence,
  type Settings,
} from "@viva-voz/core";
import { bindApp, recordRemoved, scheduleSave } from "../games/playGames";
import { recordSaved } from "../games/progress";

function loadSettings(): Settings {
  const s = parseSettings(Storage.getItemSync(SETTINGS_KEY));
  // Sentences come from a fixed bank, so a custom topic saved by an earlier version falls back to "any topic".
  return TOPICS.includes(s.topic) ? s : { ...s, topic: "" };
}

function loadSentences(): Sentence[] {
  try {
    return JSON.parse(Storage.getItemSync(SENTENCES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

interface AppState {
  settings: Settings;
  setSettings: (patch: Partial<Settings>) => void;
  sentences: Sentence[];
  addToHistory: (items: Sentence[]) => void;
  updateSentence: (id: string, patch: Partial<Sentence>) => void;
  removeSentence: (id: string) => void;
  /** The sentences on the Practice tab (fresh ones, or a set loaded from Saved). */
  deck: Sentence[];
  setDeck: (items: Sentence[]) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState(loadSettings);
  const [sentences, setSentences] = useState(loadSentences);
  const [deck, setDeck] = useState<Sentence[]>([]);

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((s) => {
      const next = { ...s, ...patch };
      void Storage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const saveList = useCallback((update: (list: Sentence[]) => Sentence[]) => {
    setSentences((list) => {
      const next = update(list);
      void Storage.setItem(SENTENCES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addToHistory = useCallback((items: Sentence[]) => saveList((l) => addSentences([...l], items)), [saveList]);

  const updateSentence = useCallback(
    (id: string, patch: Partial<Sentence>) => {
      if (patch.favorite) recordSaved();
      saveList((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      setDeck((d) => d.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    [saveList],
  );

  const removeSentence = useCallback(
    (id: string) => {
      recordRemoved(id);
      saveList((l) => l.filter((s) => s.id !== id));
      setDeck((d) => d.filter((s) => s.id !== id));
    },
    [saveList],
  );

  // Play Games cloud save: lets it read this phone's data and apply the merged result, and backs up after changes.
  const latest = useRef({ settings, sentences });
  useEffect(() => {
    latest.current = { settings, sentences };
    scheduleSave();
  }, [settings, sentences]);
  useEffect(
    () =>
      bindApp(
        () => latest.current,
        (d) => {
          setSettingsState(d.settings);
          void Storage.setItem(SETTINGS_KEY, JSON.stringify(d.settings));
          saveList(() => d.sentences);
        },
      ),
    [saveList],
  );

  const value = useMemo(
    () => ({ settings, setSettings, sentences, addToHistory, updateSentence, removeSentence, deck, setDeck }),
    [settings, setSettings, sentences, addToHistory, updateSentence, removeSentence, deck],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
