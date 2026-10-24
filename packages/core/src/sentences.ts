import type { Level, NativeLang, TargetLang } from "./settings";

export interface Sentence {
  id: string;
  target: TargetLang;
  text: string;
  native: NativeLang;
  translation: string;
  level: Level;
  topic: string;
  createdAt: number;
  favorite?: boolean;
  hard?: boolean;
  /** English original when the sentence was written in English and machine-translated (Android). */
  source?: string;
}

export const SENTENCES_KEY = "lp.sentences";
const MAX_HISTORY = 1000;

/** Prepend new sentences; trims old history, but never drops saved/hard sentences. Returns the new list. */
export function addSentences(list: Sentence[], items: Sentence[]): Sentence[] {
  list.unshift(...items);
  return list.length > MAX_HISTORY ? list.filter((s, i) => i < MAX_HISTORY || s.favorite || s.hard) : list;
}

export function recentTexts(list: Sentence[], target: TargetLang, n = 40): string[] {
  return list.filter((s) => s.target === target).slice(0, n).map((s) => s.text);
}

export type LibraryFilter = "favorite" | "hard" | "all";

export function filterSentences(list: Sentence[], filter: LibraryFilter, lang: TargetLang | "any"): Sentence[] {
  return list.filter((s) => (filter === "all" || s[filter]) && (lang === "any" || s.target === lang));
}
