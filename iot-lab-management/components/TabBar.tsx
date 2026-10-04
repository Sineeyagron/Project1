import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./AppText";
import { PressScale } from "./Motion";
import { StudentTab, goTab } from "../lib/nav";
import { useUnreadCount } from "../lib/unread";
import { BADGE_TEXT, C, gradient } from "../lib/theme";

// แถบเมนูล่างของนักศึกษา — แบบลอย (มุมโค้ง ห่างขอบจอ) พื้นขาวโปร่ง + เงานุ่ม
// แท็บที่เลือก = แคปซูลฟ้าอ่อนรองไอคอน+ชื่อ (เด้งเข้าตอนเปิดหน้า) / กระดิ่งมีเลขยังไม่อ่าน / กดแล้วยุบ+สั่นเบา ๆ
// การนำทางใช้ goTab เหมือนเดิม (stack = [หน้าแรก, แท็บ] ไม่ซ้อน)
const TABS: { key: StudentTab; label: string; icon: keyof typeof Ionicons.glyphMap; iconOn: keyof typeof Ionicons.glyphMap }[] = [
  { key: "/home", label: "ห้องเรียน", icon: "home-outline", iconOn: "home" },
  { key: "/equipment", label: "อุปกรณ์", icon: "cube-outline", iconOn: "cube" },
  { key: "/notifications", label: "แจ้งเตือน", icon: "notifications-outline", iconOn: "notifications" },
  { key: "/profile", label: "โปรไฟล์", icon: "person-outline", iconOn: "person" },
];

export default function TabBar({ current }: { current: StudentTab }) {
  const insets = useSafeAreaInsets();
  const unread = useUnreadCount();
  return (
    <View pointerEvents="box-none" style={[s.wrap, { paddingBottom: Math.max(insets.bottom - 6, 12) }]}>
      <View style={s.bar}>
        {TABS.map((tab) => (
          <TabItem
            key={tab.key}
            tab={tab}
            on={tab.key === current}
            badge={tab.key === "/notifications" ? unread : 0}
            onPress={() => goTab(tab.key, current)}
          />
        ))}
      </View>
    </View>
  );
}

function TabItem({ tab, on, badge, onPress }: { tab: (typeof TABS)[number]; on: boolean; badge: number; onPress: () => void }) {
  // แคปซูลของแท็บที่เลือกเด้งขยายเข้าตอนเปิดหน้า
  const pop = useRef(new Animated.Value(on ? 0.6 : 1)).current;
  useEffect(() => {
    if (on) Animated.spring(pop, { toValue: 1, speed: 14, bounciness: 9, useNativeDriver: Platform.OS !== "web" }).start();
  }, [on]);

  return (
    <PressScale style={s.item} onPress={on ? undefined : onPress} scaleTo={0.9} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={badge ? `${tab.label} ยังไม่อ่าน ${badge}` : tab.label}>
      {on ? (
        <Animated.View style={[s.pill, gradient("linear-gradient(160deg, #EAF2FF 0%, #D8E6FF 100%)"), { transform: [{ scale: pop }], opacity: pop }]} />
      ) : null}
      <View>
        <Ionicons name={on ? tab.iconOn : tab.icon} size={22} color={on ? C.primary : "#8090A8"} />
        {badge > 0 ? (
          <View style={s.badge} pointerEvents="none">
            <Text style={s.badgeText}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[s.text, on && s.textOn]} numberOfLines={1}>{tab.label}</Text>
    </PressScale>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  bar: {
    flexDirection: "row",
    padding: 6,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    boxShadow: "0 10px 30px rgba(30,64,175,0.16), 0 2px 6px rgba(15,23,42,0.06)",
    ...(Platform.OS === "web" ? ({ backdropFilter: "blur(14px)" } as any) : null),
  },
  item: { flex: 1, height: 56, alignItems: "center", justifyContent: "center", gap: 2 },
  pill: { position: "absolute", top: 2, bottom: 2, left: 4, right: 4, borderRadius: 20, backgroundColor: "#E3EDFF" },
  text: { color: "#8090A8", fontSize: 11.5, fontWeight: "500" },
  textOn: { color: C.primaryDark, fontWeight: "700" },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: C.error,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  badgeText: { ...BADGE_TEXT, color: "#FFFFFF", fontSize: 10, lineHeight: 12 },
});
