import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../AppText";

// ป้ายเล็กบนแถบหัวสีฟ้าของหน้าระบบห้องคอม (ผังห้อง, สถานะ LAN) — ตัวอักษรขาวบนพื้นขาวโปร่ง
export default function HeroChip({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.chip}>
      <Ionicons name={icon} size={12} color="#FFFFFF" />
      <Text style={s.txt}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)" },
  txt: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "600" },
});
