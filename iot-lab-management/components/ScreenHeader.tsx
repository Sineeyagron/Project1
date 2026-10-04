import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { C, W } from "../lib/theme";

// หัวหน้าแบบเดียวกันทุกหน้า: ปุ่ม ← (widget เล็ก) + ชื่อหน้า + บรรทัดรอง + ปุ่มด้านขวา (ถ้ามี)
export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={s.wrap}>
      {onBack ? (
        <TouchableOpacity style={s.btn} onPress={onBack} activeOpacity={0.84} accessibilityLabel="ย้อนกลับ">
          <Ionicons name="chevron-back" size={21} color={C.ink} />
        </TouchableOpacity>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={s.sub} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// ปุ่มไอคอนเล็กแบบ widget สำหรับใส่ด้านขวาของหัว (รีเฟรช / กระดิ่ง / เพิ่ม ฯลฯ)
export function HeaderButton({
  icon,
  onPress,
  label,
  color = C.primaryDark,
  badge,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  label?: string;
  color?: string;
  badge?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity style={[s.btn, disabled && { opacity: 0.5 }]} onPress={onPress} disabled={disabled} activeOpacity={0.84} accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={color} />
      {badge ? <View style={s.badge} /> : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12 },
  btn: { ...W.small, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { color: C.ink, fontSize: 20, fontWeight: "700" },
  sub: { color: C.text2, fontSize: 12, marginTop: 1 },
  badge: { position: "absolute", top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: C.error, borderWidth: 2, borderColor: "#FFFFFF" },
});
