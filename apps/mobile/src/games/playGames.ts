// Google Play Games: sign-in, achievements, leaderboards and the cloud save. This is the only part of Eco that
// talks to the network, and only through Google Play Games. Everything here is optional: with no Play Games
// project ID in the build, no Google Play services, no signal, or no sign-in, the app works exactly the same.
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { Storage } from "expo-sqlite/kv-store";
import { addSentences, parseSettings, type Sentence, type Settings } from "@viva-voz/core";
import PlayGames, { type Player } from "../../modules/play-games";
import { getPlus, subscribePlus } from "../plus/plus";
import { ACHIEVEMENTS, CLOUD_SAVE, LEADERBOARDS, SAVE_NAME } from "./ids";
import { getProgress, mergeProgress, parseProgress, progressForCloud, subscribeProgress, totals, type Progress } from "./progress";

export interface GamesState {
  available: boolean;
  status: "off" | "checking" | "signedOut" | "signedIn";
  player: Player | null;
  syncing: boolean;
  lastSync: number | null;
  error: string | null;
}

let state: GamesState = {
  available: safe(() => PlayGames.isAvailable(), false),
  status: "off",
  player: null,
  syncing: false,
  lastSync: null,
  error: null,
};
const listeners = new Set<() => void>();
function update(patch: Partial<GamesState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const useGames = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => state,
  );

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
const message = (e: unknown) => String((e as Error)?.message ?? e);
// Shows up in Metro and in `adb logcat -s ReactNativeJS`; the native side logs under the EcoPlayGames tag.
const log = (...args: unknown[]) => console.log("[PlayGames]", ...args);

// ---- Hooks into the app state (set by <GamesBridge/> inside AppProvider) ----

export interface AppData {
  settings: Settings;
  sentences: Sentence[];
}
let app: { get: () => AppData; apply: (d: AppData) => void } | null = null;
export function bindApp(get: () => AppData, apply: (d: AppData) => void) {
  app = { get, apply };
  return () => void (app = null);
}

// Deleted sentence IDs, so a sync doesn't bring back something removed on this phone.
const REMOVED_KEY = "eco.removed";
let removed: string[] = safe(() => JSON.parse(Storage.getItemSync(REMOVED_KEY) ?? "[]"), []);
export function recordRemoved(id: string) {
  removed = [...removed.filter((x) => x !== id), id].slice(-1000);
  void Storage.setItem(REMOVED_KEY, JSON.stringify(removed));
  scheduleSave();
}

// ---- Sign-in ----

let started = false;
/** Call once at launch. Play Games signs returning players in on its own; this picks that up. */
export async function startGames() {
  if (started || !state.available) return;
  started = true;
  // Plus can arrive before or after sign-in: restored from Google Play on a new phone, or just bought. Sync then, so a new
  // phone gets its cloud save back straight away.
  let hadPlus = getPlus().active;
  subscribePlus(() => {
    const has = getPlus().active;
    if (has && !hadPlus) {
      log("Plus is now active: syncing");
      void syncSave();
    }
    hadPlus = has;
  });
  update({ status: "checking" });
  try {
    const ok = await PlayGames.isAuthenticated();
    log("start: isAuthenticated =", ok);
    await afterSignIn(ok);
  } catch (e) {
    log("start: failed", message(e));
    update({ status: "signedOut", error: message(e) });
  }
  subscribeProgress(() => {
    pushProgress();
    scheduleSave();
  });
  AppState.addEventListener("change", (s) => {
    // Android reports "background" whenever another screen covers the app, Google's own Play Games screens included.
    // Only back up when the player really leaves, not while those are open.
    log("app state", s, ownScreenOpen ? "(Play Games screen open)" : "");
    if (s === "active") {
      ownScreenOpen = false;
      pushProgress(); // retries anything that didn't go through, e.g. a score made offline
    }
    else if (s === "background" && !ownScreenOpen) void syncSave();
  });
}

let ownScreenOpen = false;

const RESTART = "Close and reopen Eco to reconnect Play Games.";

const signedOutError = (e: unknown) => /SIGN_IN_REQUIRED|Not signed in/.test(message(e));

/**
 * Google revoked this session (it does this when it refuses a cloud save, for one). Afterwards isAuthenticated() and
 * even signIn() keep answering true while every call fails with SIGN_IN_REQUIRED; only a fresh launch of the app gets
 * a working session (Google shows its profile picker again). So stop using Play Games until then and say so.
 */
function signedOut(reason: string) {
  log("signed out:", reason);
  sent.clear(); // resend achievements and scores after the next sign-in
  update({ status: "signedOut", player: null, syncing: false });
}

export async function signIn() {
  if (!state.available) return;
  update({ status: "checking", error: null });
  try {
    const ok = await PlayGames.signIn();
    log("signIn =", ok);
    await afterSignIn(ok);
  } catch (e) {
    log("signIn failed", message(e));
    update({ status: "signedOut", error: message(e) });
  }
}

async function afterSignIn(ok: boolean) {
  if (!ok) return update({ status: "signedOut" });
  update({ status: "signedIn", error: null });
  PlayGames.getPlayer()
    .then((player) => update({ player }))
    .catch(() => {});
  // Achievements and scores first, so a cloud save problem can never hold them back.
  pushProgress();
  await syncSave();
}

// ---- Achievements and leaderboards ----

// What was last sent per ID this session, so hearing a sentence only sends what changed.
const sent = new Map<string, number>();
function send(id: string, value: number, call: () => void) {
  if (!id || value <= 0 || sent.get(id) === value) return;
  try {
    call();
    sent.set(id, value);
  } catch (e) {
    // Not signed in any more, or Play Games isn't reachable; the next change tries again.
    log("send failed", id, value, message(e));
  }
}

function pushProgress() {
  if (state.status !== "signedIn") return;
  const t = totals();
  const unlock = (id: string, done: boolean) => done && send(id, 1, () => PlayGames.unlockAchievement(id));
  const steps = (id: string, n: number, max: number) => send(id, Math.min(n, max), () => PlayGames.setAchievementSteps(id, Math.min(n, max)));
  const score = (id: string, n: number) => {
    if (!id || n <= 0 || sent.get(id) === n) return;
    sent.set(id, n);
    PlayGames.submitScore(id, n).catch((e) => {
      sent.delete(id); // offline or signed out: try again on the next change or when the app comes back
      log("score not sent", id, n, message(e));
    });
  };

  unlock(ACHIEVEMENTS.firstSentence, t.sentences > 0);
  steps(ACHIEVEMENTS.sentences100, t.sentences, 100);
  steps(ACHIEVEMENTS.sentences1000, t.sentences, 1000);
  steps(ACHIEVEMENTS.streak7, t.bestStreak, 7);
  steps(ACHIEVEMENTS.streak30, t.bestStreak, 30);
  unlock(ACHIEVEMENTS.bothLanguages, t.bothLanguages);
  unlock(ACHIEVEMENTS.levelC1, t.levelC1);
  unlock(ACHIEVEMENTS.allTopics, t.allTopics);
  unlock(ACHIEVEMENTS.firstSave, t.saved);
  score(LEADERBOARDS.sentences, t.sentences);
  score(LEADERBOARDS.bestStreak, t.bestStreak);
}

async function showScreen(open: () => Promise<void>) {
  ownScreenOpen = true;
  try {
    await open();
  } catch (e) {
    ownScreenOpen = false;
    log("screen failed", message(e));
    if (signedOutError(e)) {
      signedOut("screen refused");
      return update({ error: RESTART });
    }
    update({ error: message(e) });
  }
}

export const showAchievements = () => showScreen(() => PlayGames.showAchievements());
export const showLeaderboards = () => showScreen(() => PlayGames.showLeaderboards());

// ---- Cloud save ----

interface CloudSave {
  v: 1;
  savedAt: number;
  settings: Settings;
  sentences: Sentence[];
  progress: Progress;
  removed: string[];
}

function parseSave(raw: string): CloudSave | null {
  try {
    const d = JSON.parse(raw);
    if (d?.v !== 1 || !Array.isArray(d.sentences)) return null;
    return {
      v: 1,
      savedAt: Number(d.savedAt) || 0,
      settings: parseSettings(JSON.stringify(d.settings ?? {})),
      sentences: d.sentences.filter((s: Sentence) => s && typeof s.id === "string" && typeof s.text === "string"),
      progress: parseProgress(d.progress),
      removed: Array.isArray(d.removed) ? d.removed.filter((x: unknown) => typeof x === "string") : [],
    };
  } catch {
    return null;
  }
}

const LAST_SAVE_KEY = "eco.cloudSavedAt";

/**
 * Merge this phone with every cloud copy, apply the result here, and write it back. Sentences are combined by ID
 * (the newest copy wins for saved/hard flags), deletions are kept, settings come from whichever was saved last,
 * and progress is merged field by field.
 */
let syncing: Promise<void> | null = null;
// When Google refuses the cloud save (Saved Games off for the project), it also signs the player out. So after a
// refusal, automatic backups pause for a while; the Back up button still tries.
const REFUSED_KEY = "eco.cloudRefusedAt";
const RETRY_AFTER = 6 * 60 * 60 * 1000;
const savesRefused = () => Date.now() - (Number(Storage.getItemSync(REFUSED_KEY)) || 0) < RETRY_AFTER;

export function syncSave({ manual = false } = {}): Promise<void> {
  // Cloud save is part of Eco Plus.
  const skip = !CLOUD_SAVE ? "CLOUD_SAVE off" : !getPlus().active ? "no Plus" : state.status !== "signedIn" ? `status ${state.status}` : !app ? "no app" : !manual && savesRefused() ? "paused after refusal" : null;
  if (skip) {
    log("backup skipped:", skip);
    return Promise.resolve();
  }
  log(manual ? "backup (button)" : "backup (automatic)");
  syncing ??= runSync().finally(() => (syncing = null));
  return syncing;
}

async function runSync() {
  if (!app) return;
  clearTimeout(saveTimer);
  update({ syncing: true });
  try {
    const cloud = (await PlayGames.openSave(SAVE_NAME)).map(parseSave).filter((s): s is CloudSave => !!s);
    log("backup: opened,", cloud.length, "cloud copies");
    const local = app.get();
    const localSavedAt = Number(Storage.getItemSync(LAST_SAVE_KEY)) || 0;

    // Oldest first, so newer copies overwrite older ones.
    const copies = [...cloud.map((c) => ({ at: c.savedAt, data: c })), { at: localSavedAt, data: null as CloudSave | null }].sort(
      (a, b) => a.at - b.at,
    );
    const gone = new Set([...removed, ...cloud.flatMap((c) => c.removed)]);
    const byId = new Map<string, Sentence>();
    let settings = local.settings;
    for (const { data } of copies) {
      const list = data ? data.sentences : local.sentences;
      for (const s of list) if (!gone.has(s.id)) byId.set(s.id, { ...byId.get(s.id), ...s });
      settings = data ? data.settings : local.settings;
    }
    for (const c of cloud) mergeProgress(c.progress);
    removed = [...gone].slice(-1000);
    void Storage.setItem(REMOVED_KEY, JSON.stringify(removed));

    const sentences = addSentences([], [...byId.values()].sort((a, b) => b.createdAt - a.createdAt));
    app.apply({ settings, sentences });

    const savedAt = Date.now();
    const out: CloudSave = { v: 1, savedAt, settings, sentences, progress: progressForCloud(), removed };
    const t = totals(getProgress());
    await PlayGames.commitSave(JSON.stringify(out), `${t.sentences} sentences heard · ${sentences.length} in history`);
    Storage.setItemSync(LAST_SAVE_KEY, String(savedAt));
    Storage.removeItemSync(REFUSED_KEY);
    clearTimeout(saveTimer); // applying the merge above counts as a change; it's already saved
    log("backup: saved", sentences.length, "sentences");
    update({ syncing: false, lastSync: savedAt, error: null });
  } catch (e) {
    log("backup failed", message(e));
    await PlayGames.closeSave().catch(() => {});
    if (signedOutError(e) || /Cannot use snapshots|Saved Game/.test(message(e))) {
      Storage.setItemSync(REFUSED_KEY, String(Date.now()));
      clearTimeout(saveTimer);
      signedOut("cloud save refused");
      update({ error: `Google refused the cloud save (Saved Games isn't on for this game yet) and disconnected Play Games. ${RESTART} Backups are paused for now.` });
      return;
    }
    update({ syncing: false, error: message(e) });
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Batch changes: back up a minute after the last one (and whenever the app goes to the background). */
export function scheduleSave() {
  if (!CLOUD_SAVE || !getPlus().active || state.status !== "signedIn" || savesRefused()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void syncSave(), 60_000);
}
