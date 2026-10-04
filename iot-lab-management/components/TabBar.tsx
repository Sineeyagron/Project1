import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { StudentTab, goTab } from "../lib/nav";
import { C, W } from "../lib/theme";

// แถบเมนูล่างของนักศึกษา (หน้าตาเดียวกันทุกหน้า) — การนำทางใช้ goTab เหมือนเดิม
const TABS: { key: StudentTab; label: string; icon: keyof typeof Ionicons.glyphMap; iconOn: keyof typeof Ionicons.glyphMap }[] = [
  { key: "/home", label: "ห้องเรียน", icon: "home-outline", iconOn: "home" },
  { key: "/equipment", label: "อุปกรณ์", icon: "cube-outline", iconOn: "cube" },
  { key: "/notifications", label: "แจ้งเตือน", icon: "notifications-outline", iconOn: "notifications" },
  { key: "/profile", label: "โปรไฟล์", icon: "person-outline", iconOn: "person" },
];

export default function TabBar({ current }: { current: StudentTab }) {
  return (
    <View style={s.bar}>
      {TABS.map((tab) => {
        const on = tab.key === current;
        return (
          <TouchableOpacity key={tab.key} style={s.item} onPress={() => goTab(tab.key, current)} activeOpacity={0.82}>
            <Ionicons name={on ? tab.iconOn : tab.icon} size={23} color={on ? C.primary : C.faint} />
            <Text style={[s.text, on && s.textOn]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    ...W.nav,
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: 8,
  },
  item: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 3 },
  text: { color: C.faint, fontSize: 12 },
  textOn: { color: C.primary, fontWeight: "600" },
});
