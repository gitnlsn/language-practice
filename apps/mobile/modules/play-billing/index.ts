import { requireNativeModule, type EventSubscription } from "expo";

export interface PricingPhase {
  /** Formatted for the player, e.g. "R$ 14,90". */
  price: string;
  priceMicros: number;
  currency: string;
  /** ISO 8601, e.g. "P1M", "P1Y", "P7D". */
  period: string;
  cycles: number;
  /** 1 = infinite, 2 = finite (e.g. a trial), 3 = non-recurring. */
  recurrence: number;
}

export interface SubscriptionOffer {
  basePlanId: string;
  /** Null for the base plan itself. */
  offerId: string | null;
  offerToken: string;
  tags: string[];
  phases: PricingPhase[];
}

export interface Subscription {
  productId: string;
  name: string;
  title: string;
  description: string;
  offers: SubscriptionOffer[];
}

export interface Purchase {
  productIds: string[];
  token: string;
  orderId: string | null;
  state: "purchased" | "pending" | "unknown";
  acknowledged: boolean;
  autoRenewing: boolean;
  time: number;
}

interface PlayBillingNative {
  getSubscriptions(productIds: string[]): Promise<Subscription[]>;
  /** Opens Google Play's purchase sheet. Rejects with "cancelled" if the player backs out. */
  purchase(productId: string, offerToken: string): Promise<Purchase[]>;
  /** Active subscriptions, from Google Play's cache on the phone (works offline). */
  getPurchases(): Promise<Purchase[]>;
  /** Required within 3 days of a purchase, or Google refunds it. */
  acknowledge(token: string): Promise<void>;
  openManageSubscriptions(productId?: string | null): void;
  addListener(event: "onPurchasesUpdated", listener: (e: { purchases: Purchase[] }) => void): EventSubscription;
}

export default requireNativeModule<PlayBillingNative>("PlayBilling");
