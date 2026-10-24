import { get, set } from "idb-keyval";
import { addSentences, recentTexts as recent, SENTENCES_KEY, type Sentence, type TargetLang } from "@viva-voz/core";

export type { Sentence };

let cache: Sentence[] | null = null;

export async function all(): Promise<Sentence[]> {
  if (!cache) {
    try {
      cache = (await get<Sentence[]>(SENTENCES_KEY)) ?? [];
    } catch {
      cache = [];
    }
  }
  return cache;
}

async function persist() {
  try {
    await set(SENTENCES_KEY, cache);
  } catch {
    // IndexedDB unavailable (private mode): keep in memory only
  }
}

export async function add(items: Sentence[]) {
  cache = addSentences(await all(), items);
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
  return recent(await all(), target, n);
}
