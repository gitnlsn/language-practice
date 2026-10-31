// Sentences on Android, fully offline: a bank written ahead of time (assets/sentences/<lang>/<level>.json), each
// with its English and Brazilian Portuguese translation. No model runs on the phone to write or translate them.
import { TOPICS, type Level, type NativeLang, type TargetLang } from "@viva-voz/core";

interface Entry {
  text: string;
  en: string;
  pt: string;
}
type LevelBank = Record<string, Entry[]>;

// Loaded on first use; Metro needs each path spelled out.
const FILES: Record<TargetLang, Record<Level, () => LevelBank>> = {
  fr: {
    A1: () => require("../../assets/sentences/fr/A1.json"),
    A2: () => require("../../assets/sentences/fr/A2.json"),
    B1: () => require("../../assets/sentences/fr/B1.json"),
    B2: () => require("../../assets/sentences/fr/B2.json"),
    C1: () => require("../../assets/sentences/fr/C1.json"),
  },
  es: {
    A1: () => require("../../assets/sentences/es/A1.json"),
    A2: () => require("../../assets/sentences/es/A2.json"),
    B1: () => require("../../assets/sentences/es/B1.json"),
    B2: () => require("../../assets/sentences/es/B2.json"),
    C1: () => require("../../assets/sentences/es/C1.json"),
  },
};

export interface Picked {
  text: string;
  translation: string;
  topic: string;
}

export interface PickOptions {
  target: TargetLang;
  native: NativeLang;
  level: Level;
  /** One of TOPICS; anything else (including "") draws from every topic. */
  topic: string;
  count: number;
  /** Sentences already practised; they're only repeated once the rest of the pool is used up. */
  seen: Set<string>;
}

function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

export function pickSentences(o: PickOptions): Picked[] {
  const bank = FILES[o.target][o.level]();
  const topics = TOPICS.includes(o.topic) ? [o.topic] : TOPICS;
  const pool = topics.flatMap((topic) => (bank[topic] ?? []).map((e) => ({ ...e, topic })));
  const fresh = shuffle(pool.filter((e) => !o.seen.has(e.text)));
  const picked = fresh.length >= o.count ? fresh.slice(0, o.count) : [...fresh, ...shuffle(pool.filter((e) => o.seen.has(e.text))).slice(0, o.count - fresh.length)];
  return picked.map((e) => ({ text: e.text, translation: e[o.native], topic: e.topic }));
}
