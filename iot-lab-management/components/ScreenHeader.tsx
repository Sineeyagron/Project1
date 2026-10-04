import React, { forwardRef } from "react";
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { BADGE_TEXT, C, W } from "../lib/theme";

// หัวหน้าแบบเดียวกันทุกหน้า (หน้าที่มีปุ่มย้อนกลับ): แถบหัวบางเต็มความกว้าง
// [ปุ่ม ←] [ชื่อหน้า + บรรทัดรอง อยู่กลาง] [ปุ่มขวา 1 ปุ่ม หรือช่องว่าง]
// ช่องซ้าย/ขวากว้างเท่ากันเสมอ ชื่อหน้าจึงอยู่กลางจอทุกหน้าแม้ไม่มีปุ่มขวา
// bleed = ระยะ padding ของกล่องแม่ (ใส่เมื่อหัวอยู่ในกล่องที่มี paddingHorizontal เพื่อให้แถบยืดเต็มจอ)
export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  bleed = 0,
  style,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  bleed?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[s.wrap, bleed ? { marginHorizontal: -bleed } : null, style]}>
      <View style={s.side}>
        {onBack ? (
          <TouchableOpacity style={s.btn} onPress={() => onBack()} activeOpacity={0.84} accessibilityLabel="ย้อนกลับ">
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={s.center}>
        <Text style={s.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{title}</Text>
        {subtitle ? <Text style={s.sub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={[s.side, s.sideRight]}>{right}</View>
    </View>
  );
}

// ปุ่มไอคอนเล็กแบบ widget สำหรับใส่ด้านขวาของหัว (รีเฟรช / กระดิ่ง / เพิ่ม ฯลฯ)
// badge = จุดแดง / count = ป้ายตัวเลขแดงมุมขวาบน — วางเป็นชั้นแยกทับบนปุ่ม (ถ้าอยู่ในปุ่ม พื้นไล่สีของปุ่มบน iOS จะทับ)
export const HeaderButton = forwardRef<View, {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  label?: string;
  color?: string;
  badge?: boolean;
  count?: number;
  disabled?: boolean;
}>(function HeaderButton({ icon, onPress, label, color = C.primaryDark, badge, count, disabled }, ref) {
  const n = count ?? 0;
  return (
    <View style={{ zIndex: 2 }}>
      <TouchableOpacity
        ref={ref}
        style={[s.btn, disabled && { opacity: 0.5 }]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.84}
        accessibilityLabel={n > 0 && label ? `${label} ยังไม่อ่าน ${n}` : label}
      >
        <Ionicons name={icon} size={20} color={color} />
      </TouchableOpacity>
      {n > 0 ? (
        <View style={s.count} pointerEvents="none">
          <Text style={s.countText}>{n > 99 ? "99+" : n}</Text>
        </View>
      ) : badge ? (
        <View style={s.badge} pointerEvents="none" />
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  wrap: {
    ...W.headerBar,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 10,
    marginBottom: 8,
  },
  side: { width: 38, minHeight: 38, justifyContent: "center" },
  sideRight: { alignItems: "flex-end" },
  center: { flex: 1, minWidth: 0, alignItems: "center" },
  btn: { ...W.iconBtn, alignItems: "center", justifyContent: "center" },
  title: { color: C.ink, fontSize: 19, fontWeight: "700", textAlign: "center" },
  sub: { color: C.text2, fontSize: 12, marginTop: 1, textAlign: "center" },
  count: { position: "absolute", zIndex: 3, top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: C.error, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#FFFFFF" },
  countText: { ...BADGE_TEXT, color: "#FFFFFF", fontSize: 11, lineHeight: 13 },
  badge: { position: "absolute", zIndex: 3, top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: C.error, borderWidth: 2, borderColor: "#FFFFFF" },
});
