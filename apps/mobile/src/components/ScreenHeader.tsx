// Large-title header shared by the tabs (the navigator's own header is hidden).
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { serif, useColors } from "../theme";

export function ScreenHeader({ title, right, children }: { title: string; right?: ReactNode; children?: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={styles.row}>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, paddingBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontFamily: serif, fontSize: 32, fontWeight: "600" },
});
