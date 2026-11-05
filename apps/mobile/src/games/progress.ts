// Practice progress kept on the phone: sentences heard, days practised, languages, levels and topics. Play Games
// achievements and leaderboards are derived from it, and it travels in the cloud save. Every field merges without
// losing data, so two phones can sync in any order.
import { useSyncExternalStore } from "react";
import { Storage } from "expo-sqlite/kv-store";
import { TARGETS, TOPICS, type Sentence } from "@viva-voz/core";

const KEY = "eco.progress";
const DEVICE_KEY = "eco.device";
const MAX_DAYS = 400;
const MAX_RECENT = 200;

export interface Progress {
  v: 1;
  /** Sentences heard, per phone (summed for the total, so syncing never double-counts). */
  heard: Record<string, number>;
  /** Local dates (YYYY-MM-DD) with practice, oldest first. */
  days: string[];
  bestStreak: number;
  /** "fr|A1", "fr|travel and directions", … */
  levels: string[];
  topics: string[];
  saved: boolean;
  /** Recently heard sentence IDs, so replaying a card doesn't count twice. Local only. */
  recent: string[];
}

const empty = (): Progress => ({ v: 1, heard: {}, days: [], bestStreak: 0, levels: [], topics: [], saved: false, recent: [] });

export const deviceId: string = (() => {
  let id = Storage.getItemSync(DEVICE_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    Storage.setItemSync(DEVICE_KEY, id);
  }
  return id;
})();

/** Accepts anything (stored or from the cloud) and returns a valid Progress. */
export function parseProgress(raw: unknown): Progress {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<Progress>;
  const strings = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : []);
  const heard: Record<string, number> = {};
  for (const [k, n] of Object.entries(p.heard ?? {})) if (typeof n === "number" && n > 0) heard[k] = Math.floor(n);
  return {
    v: 1,
    heard,
    days: strings(p.days),
    bestStreak: typeof p.bestStreak === "number" ? p.bestStreak : 0,
    levels: strings(p.levels),
    topics: strings(p.topics),
    saved: p.saved === true,
    recent: strings(p.recent),
  };
}

function load(): Progress {
  try {
    return parseProgress(JSON.parse(Storage.getItemSync(KEY) ?? "null"));
  } catch {
    return empty();
  }
}

let progress = load();
const listeners = new Set<() => void>();

function set(next: Progress) {
  progress = next;
  void Storage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export const getProgress = () => progress;
export function subscribeProgress(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
export const useProgress = () => useSyncExternalStore(subscribeProgress, getProgress);

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

function localDate(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const dayNumber = (s: string) => Math.round(Date.parse(`${s}T00:00:00Z`) / 86_400_000);

/** Longest run of consecutive days, and the run that ends today or yesterday. */
export function streaks(days: string[]) {
  const nums = [...new Set(days.map(dayNumber))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  nums.forEach((n, i) => {
    run = i > 0 && n === nums[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  const today = dayNumber(localDate());
  const last = nums[nums.length - 1];
  const current = last === today || last === today - 1 ? run : 0;
  return { best, current };
}

export function totals(p: Progress = progress) {
  const s = streaks(p.days);
  const heardLangs = new Set(p.levels.map((l) => l.split("|")[0]));
  const topicsDone = Math.max(0, ...TARGETS.map((t) => TOPICS.filter((topic) => p.topics.includes(`${t}|${topic}`)).length));
  return {
    sentences: Object.values(p.heard).reduce((a, b) => a + b, 0),
    currentStreak: s.current,
    bestStreak: Math.max(p.bestStreak, s.best),
    bothLanguages: TARGETS.every((t) => heardLangs.has(t)),
    levelC1: p.levels.some((l) => l.endsWith("|C1")),
    allTopics: topicsDone >= TOPICS.length,
    topicsDone,
    saved: p.saved,
  };
}

/** Call when a sentence starts playing. */
export function recordHeard(s: Pick<Sentence, "id" | "target" | "level" | "topic">) {
  const p = progress;
  if (p.recent.includes(s.id)) return;
  const days = union(p.days, [localDate()]).slice(-MAX_DAYS);
  set({
    ...p,
    heard: { ...p.heard, [deviceId]: (p.heard[deviceId] ?? 0) + 1 },
    days,
    bestStreak: Math.max(p.bestStreak, streaks(days).best),
    levels: union(p.levels, [`${s.target}|${s.level}`]),
    topics: s.topic ? union(p.topics, [`${s.target}|${s.topic}`]) : p.topics,
    recent: [...p.recent, s.id].slice(-MAX_RECENT),
  });
}

export function recordSaved() {
  if (!progress.saved) set({ ...progress, saved: true });
}

/** Combine with progress from the cloud save (other phones). */
export function mergeProgress(other: Progress) {
  const p = progress;
  const heard = { ...p.heard };
  for (const [k, n] of Object.entries(other.heard)) heard[k] = Math.max(heard[k] ?? 0, n);
  const days = union(p.days, other.days).sort().slice(-MAX_DAYS);
  set({
    ...p,
    heard,
    days,
    bestStreak: Math.max(p.bestStreak, other.bestStreak, streaks(days).best),
    levels: union(p.levels, other.levels),
    topics: union(p.topics, other.topics),
    saved: p.saved || other.saved,
  });
}

/** What goes in the cloud save (the replay guard stays on the phone). */
export const progressForCloud = (): Progress => ({ ...progress, recent: [] });
