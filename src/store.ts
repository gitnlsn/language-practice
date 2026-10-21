import { get, set } from "idb-keyval";
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
}

const KEY = "lp.sentences";
const MAX_HISTORY = 1000;

let cache: Sentence[] | null = null;

export async function all(): Promise<Sentence[]> {
  if (!cache) {
    try {
      cache = (await get<Sentence[]>(KEY)) ?? [];
    } catch {
      cache = [];
    }
  }
  return cache;
}

async function persist() {
  try {
    await set(KEY, cache);
  } catch {
    // IndexedDB unavailable (private mode): keep in memory only
  }
}

export async function add(items: Sentence[]) {
  const list = await all();
  list.unshift(...items);
  // Trim old history, but never drop saved/hard sentences.
  if (list.length > MAX_HISTORY) {
    cache = list.filter((s, i) => i < MAX_HISTORY || s.favorite || s.hard);
  }
  await persist();
}

export async function update(id: string, patch: Partial<Sentence>) {
  const s = (await all()).find((x) => x.id === id);
  if (s) Object.assign(s, patch);
  await persist();
}

export async function remove(id: string) {
  cache = (await all()).filter((x) => x.id !== id);
  await persist();
}

export async function recentTexts(target: TargetLang, n = 40): Promise<string[]> {
  return (await all()).filter((s) => s.target === target).slice(0, n).map((s) => s.text);
}
