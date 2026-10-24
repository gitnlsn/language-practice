// App state: settings and sentence history, persisted on the device (expo-sqlite key-value store), plus the
// deck currently loaded in Practice. Same keys and list rules as the web app (@viva-voz/core).
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Storage } from "expo-sqlite/kv-store";
import {
  addSentences,
  parseSettings,
  SENTENCES_KEY,
  SETTINGS_KEY,
  type Sentence,
  type Settings,
} from "@viva-voz/core";

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
  const [settings, setSettingsState] = useState(() => parseSettings(Storage.getItemSync(SETTINGS_KEY)));
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
      saveList((l) => l.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      setDeck((d) => d.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    },
    [saveList],
  );

  const removeSentence = useCallback(
    (id: string) => {
      saveList((l) => l.filter((s) => s.id !== id));
      setDeck((d) => d.filter((s) => s.id !== id));
    },
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
