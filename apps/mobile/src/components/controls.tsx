// Segmented control, styled like the web app's pills.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "../theme";

export function Segmented<T extends string | number>(props: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  const c = useColors();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={props.label} style={[styles.segmented, { backgroundColor: c.surface2 }]}>
      {props.options.map((o) => {
        const on = o.value === props.value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => props.onChange(o.value)}
            style={[styles.segment, on && { backgroundColor: c.surface, borderColor: c.line }]}
          >
            <Text style={[styles.segmentText, { color: on ? c.text : c.muted }, on && styles.bold]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: "row", flexWrap: "wrap", borderRadius: 999, padding: 3, alignSelf: "flex-start" },
  segment: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: "transparent" },
  segmentText: { fontSize: 14 },
  bold: { fontWeight: "600" },
});
