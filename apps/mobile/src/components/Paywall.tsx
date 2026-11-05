// The Eco Plus sheet: what Plus adds, the two plans with Google Play's prices, and the purchase button.
import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { buy, closePaywall, loadPlans, restore, usePlus, type Plan, type PlanInfo } from "../plus/plus";
import { radius, serif, useColors } from "../theme";

type IconName = keyof typeof Ionicons.glyphMap;

const BENEFITS: { icon: IconName; text: string }[] = [
  { icon: "trending-up-outline", text: "Levels B1, B2 and C1 in French and Spanish" },
  { icon: "infinite-outline", text: "Unlimited sets of sentences every day" },
  { icon: "cloud-upload-outline", text: "Back up your sentences to the cloud" },
];

const PLAN_NAME: Record<Plan, string> = { yearly: "Yearly", monthly: "Monthly" };
const PER: Record<Plan, string> = { yearly: "year", monthly: "month" };

export function Paywall() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const plus = usePlus();
  const [picked, setPicked] = useState<Plan>("yearly");

  const plans = plus.plans ?? [];
  const chosen = plans.find((p) => p.plan === picked) ?? plans[0];
  const monthly = plans.find((p) => p.plan === "monthly");
  const saving = (p: PlanInfo) =>
    p.plan === "yearly" && monthly ? Math.round((1 - p.priceMicros / (monthly.priceMicros * 12)) * 100) : 0;

  return (
    <Modal visible={plus.paywallOpen} transparent animationType="slide" onRequestClose={closePaywall} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={closePaywall} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: c.bg, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.grabber, { backgroundColor: c.line }]} />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.head}>
            <View style={[styles.badge, { backgroundColor: c.accent }]}>
              <Ionicons name="sparkles" size={22} color={c.accentInk} />
            </View>
            <Text style={[styles.title, { color: c.text }]}>Eco Plus</Text>
            {plus.reason && <Text style={[styles.reason, { color: c.muted }]}>{plus.reason}</Text>}
          </View>

          <View style={styles.benefits}>
            {BENEFITS.map((b) => (
              <View key={b.text} style={styles.benefit}>
                <Ionicons name={b.icon} size={20} color={c.accent} />
                <Text style={[styles.benefitText, { color: c.text }]}>{b.text}</Text>
              </View>
            ))}
          </View>

          {plus.busy && !plus.plans && <ActivityIndicator color={c.accent} style={styles.loading} />}

          <View style={styles.plans}>
            {plans.map((p) => {
              const on = p.plan === chosen?.plan;
              const off = saving(p);
              return (
                <Pressable
                  key={p.plan}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => setPicked(p.plan)}
                  style={[styles.plan, { backgroundColor: on ? c.accentSoft : c.surface, borderColor: on ? c.accent : c.line }]}
                >
                  <Ionicons name={on ? "radio-button-on" : "radio-button-off"} size={22} color={on ? c.accent : c.muted} />
                  <View style={styles.grow}>
                    <Text style={[styles.planName, { color: c.text }]}>{PLAN_NAME[p.plan]}</Text>
                    <Text style={{ color: c.muted }}>
                      {p.price}/{PER[p.plan]}
                      {p.trialDays ? ` · ${p.trialDays} days free` : ""}
                    </Text>
                  </View>
                  {off > 0 && <Text style={[styles.save, { color: c.ok, backgroundColor: c.okSoft }]}>Save {off}%</Text>}
                </Pressable>
              );
            })}
          </View>

          {plus.error && (
            <View style={[styles.error, { backgroundColor: c.badSoft }]}>
              <Text style={{ color: c.bad, flexShrink: 1 }}>{plus.error}</Text>
              {!plus.plans && (
                <Pressable accessibilityRole="button" onPress={() => void loadPlans()}>
                  <Text style={[styles.link, { color: c.accent }]}>Try again</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>

        <Pressable
          accessibilityRole="button"
          disabled={!chosen || plus.busy}
          onPress={() => chosen && void buy(chosen)}
          style={({ pressed }) => [styles.cta, { backgroundColor: c.accent }, (pressed || !chosen || plus.busy) && { opacity: 0.6 }]}
        >
          {plus.busy && plus.plans ? (
            <ActivityIndicator color={c.accentInk} />
          ) : (
            <Text style={[styles.ctaText, { color: c.accentInk }]}>
              {chosen?.trialDays ? `Start ${chosen.trialDays}-day free trial` : "Subscribe"}
            </Text>
          )}
        </Pressable>
        {chosen && (
          <Text style={[styles.fine, { color: c.muted }]}>
            {chosen.trialDays ? `Free for ${chosen.trialDays} days, then ${chosen.price}/${PER[chosen.plan]}. ` : `${chosen.price}/${PER[chosen.plan]}. `}
            Renews automatically. Cancel anytime in Google Play.
          </Text>
        )}
        <Pressable accessibilityRole="button" onPress={() => void restore()} style={styles.restore}>
          <Text style={[styles.link, { color: c.accent }]}>Restore purchase</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%", paddingHorizontal: 16 },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 6 },
  content: { gap: 18, paddingVertical: 10 },
  head: { alignItems: "center", gap: 8 },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: serif, fontSize: 28, fontWeight: "600" },
  reason: { fontSize: 15, lineHeight: 21, textAlign: "center" },
  benefits: { gap: 12 },
  benefit: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitText: { fontSize: 15, flexShrink: 1 },
  loading: { marginVertical: 12 },
  plans: { gap: 10 },
  plan: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderRadius: radius, padding: 14 },
  grow: { flex: 1, gap: 2 },
  planName: { fontSize: 16, fontWeight: "700" },
  save: { fontSize: 12, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  error: { borderRadius: 12, padding: 12, gap: 8 },
  cta: { alignItems: "center", justifyContent: "center", borderRadius: 999, paddingVertical: 15, marginTop: 8, minHeight: 52 },
  ctaText: { fontSize: 16, fontWeight: "700" },
  fine: { fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 10 },
  restore: { alignSelf: "center", padding: 10 },
  link: { fontSize: 14, fontWeight: "700" },
});
