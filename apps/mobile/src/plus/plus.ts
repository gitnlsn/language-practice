// Eco Plus: the subscription (Google Play Billing). Free covers A1–A2 and a few sets a day; Plus unlocks B1–C1,
// unlimited sets and the cloud save. Purchases are checked on the phone; Google Play keeps them cached, so Plus works
// offline. This and Play Games are the only parts of Eco that use the network, and only through Google Play.
import { useSyncExternalStore } from "react";
import { Storage } from "expo-sqlite/kv-store";
import type { Level } from "@viva-voz/core";
import PlayBilling, { type Purchase, type Subscription, type SubscriptionOffer } from "../../modules/play-billing";

/** IDs from Play Console → Monetizar → Assinaturas. */
export const PRODUCT = "eco_plus";
export const PLANS = { monthly: "monthly", yearly: "yearly-2" } as const;
export type Plan = keyof typeof PLANS;

export const FREE_LEVELS: Level[] = ["A1", "A2"];
export const FREE_SETS_PER_DAY = 3;

export interface PlanInfo {
  plan: Plan;
  /** Recurring price, e.g. "R$ 14,90". */
  price: string;
  priceMicros: number;
  /** Days free before the first charge, if this player qualifies for the trial. */
  trialDays: number;
  /** Best offer for this player (the trial if eligible, otherwise the base plan). */
  offerToken: string;
}

export interface PlusState {
  /** Has Plus. Remembered on the phone, so it's right before Google Play answers. */
  active: boolean;
  plans: PlanInfo[] | null;
  busy: boolean;
  error: string | null;
  paywallOpen: boolean;
  /** Why the paywall opened, shown as its subtitle. */
  reason: string | null;
}

const ACTIVE_KEY = "eco.plus";
let state: PlusState = {
  active: Storage.getItemSync(ACTIVE_KEY) === "1",
  plans: null,
  busy: false,
  error: null,
  paywallOpen: false,
  reason: null,
};
const listeners = new Set<() => void>();
function update(patch: Partial<PlusState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const getPlus = () => state;
export function subscribePlus(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}
export const usePlus = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => state,
  );

const message = (e: unknown) => String((e as Error)?.message ?? e);

export const isFreeLevel = (level: Level) => FREE_LEVELS.includes(level);

export function openPaywall(reason: string | null = null) {
  update({ paywallOpen: true, reason, error: null });
  if (!state.plans) void loadPlans();
}
export const closePaywall = () => update({ paywallOpen: false });

// ---- Sets per day (free) ----

const SETS_KEY = "eco.setsToday";
const today = () => new Date().toDateString();
function setsToday(): number {
  try {
    const d = JSON.parse(Storage.getItemSync(SETS_KEY) ?? "null");
    return d?.date === today() ? Number(d.count) || 0 : 0;
  } catch {
    return 0;
  }
}
export const setsLeftToday = () => Math.max(0, FREE_SETS_PER_DAY - setsToday());

/** Call before making a new set. False (and the paywall opens) when a free player has used today's sets. */
export function takeSet(): boolean {
  if (state.active) return true;
  const n = setsToday();
  if (n >= FREE_SETS_PER_DAY) {
    openPaywall(`You've used today's ${FREE_SETS_PER_DAY} free sets. Come back tomorrow, or get unlimited sets with Plus.`);
    return false;
  }
  Storage.setItemSync(SETS_KEY, JSON.stringify({ date: today(), count: n + 1 }));
  update({}); // new state object, so screens showing "sets left today" re-render
  return true;
}

// ---- Google Play Billing ----

function setActive(active: boolean) {
  if (active === state.active) return;
  Storage.setItemSync(ACTIVE_KEY, active ? "1" : "0");
  update({ active });
}

/** Grant Plus from Google Play's list, and confirm new purchases (Google refunds them after 3 days otherwise). */
async function applyPurchases(purchases: Purchase[]) {
  const ours = purchases.filter((p) => p.productIds.includes(PRODUCT) && p.state === "purchased");
  await Promise.all(ours.filter((p) => !p.acknowledged).map((p) => PlayBilling.acknowledge(p.token).catch(() => {})));
  return ours.length > 0;
}

/** Check Google Play for an active subscription. Keeps the remembered state if Google Play can't be reached. */
export async function refreshPlus() {
  try {
    setActive(await applyPurchases(await PlayBilling.getPurchases()));
  } catch {
    // No Google Play (or it's busy): keep what we knew.
  }
}

let started = false;
export function startPlus() {
  if (started) return;
  started = true;
  // Purchases that finish outside the purchase sheet, e.g. a pending payment that clears later.
  PlayBilling.addListener("onPurchasesUpdated", ({ purchases }) => {
    void applyPurchases(purchases).then((ok) => ok && setActive(true));
  });
  void refreshPlus();
}

const days = (period: string) => {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(period);
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 365 + (+(m[2] ?? 0)) * 30 + (+(m[3] ?? 0)) * 7 + +(m[4] ?? 0);
};

function planInfo(plan: Plan, offers: SubscriptionOffer[]): PlanInfo | null {
  const mine = offers.filter((o) => o.basePlanId === PLANS[plan]);
  const base = mine.find((o) => !o.offerId);
  if (!base) return null;
  // Google only returns offers this player is eligible for, so a trial here means they can use it.
  const trial = mine.find((o) => o.offerId && o.phases.some((p) => p.priceMicros === 0));
  const recurring = base.phases[base.phases.length - 1];
  const free = trial?.phases.find((p) => p.priceMicros === 0);
  return { plan, price: recurring.price, priceMicros: recurring.priceMicros, trialDays: free ? days(free.period) * Math.max(1, free.cycles) : 0, offerToken: (trial ?? base).offerToken };
}

export async function loadPlans() {
  update({ busy: true, error: null });
  try {
    const [sub] = (await PlayBilling.getSubscriptions([PRODUCT])) as Subscription[];
    if (!sub) throw new Error("Eco Plus isn't available right now.");
    const plans = (["yearly", "monthly"] as Plan[]).map((p) => planInfo(p, sub.offers)).filter((p): p is PlanInfo => !!p);
    update({ plans, busy: false });
  } catch (e) {
    update({ busy: false, error: `Couldn't reach Google Play. ${message(e)}` });
  }
}

export async function buy(info: PlanInfo) {
  update({ busy: true, error: null });
  try {
    const ok = await applyPurchases(await PlayBilling.purchase(PRODUCT, info.offerToken));
    if (ok) setActive(true);
    update({ busy: false, paywallOpen: !ok });
  } catch (e) {
    const cancelled = /cancelled/.test(message(e));
    update({ busy: false, error: cancelled ? null : message(e) });
  }
}

export async function restore() {
  update({ busy: true, error: null });
  try {
    const ok = await applyPurchases(await PlayBilling.getPurchases());
    setActive(ok);
    update({ busy: false, error: ok ? null : "No Eco Plus subscription found for this Google account.", paywallOpen: !ok && state.paywallOpen });
  } catch (e) {
    update({ busy: false, error: message(e) });
  }
}

export const manageSubscription = () => PlayBilling.openManageSubscriptions(PRODUCT);
