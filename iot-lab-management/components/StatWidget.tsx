import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { C, W, iconDot } from "../lib/theme";

// ช่องสถิติแบบ widget: วงกลมไอคอนสีทึบ + ตัวเลขใหญ่ + ป้ายชื่อ (ใช้ร่วมกันทุกหน้า)
const TONES = {
  blue: { box: W.statBlue, color: C.primary },
  green: { box: W.statGreen, color: C.success },
  amber: { box: W.statAmber, color: C.warning },
  red: { box: W.statRed, color: C.error },
};

export default function StatWidget({
  tone,
  icon,
  label,
  value,
  style,
}: {
  tone: keyof typeof TONES;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | string;
  style?: ViewStyle;
}) {
  const t = TONES[tone];
  return (
    <View style={[s.card, t.box, style]}>
      <View style={iconDot(t.color, 30)}>
        <Ionicons name={icon} size={16} color="#FFFFFF" />
      </View>
      <View>
        <Text style={s.number}>{value}</Text>
        <Text style={s.label} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, padding: 12, gap: 10 },
  number: { color: C.ink, fontSize: 26, fontWeight: "700", lineHeight: 32 },
  label: { color: C.muted, fontSize: 12 },
});
