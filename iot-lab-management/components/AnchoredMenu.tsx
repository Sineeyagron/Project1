import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "./AppText";
import { W } from "../lib/theme";

// เมนูเล็กที่โผล่ใต้ปุ่มที่กด (แบบ pull-down menu ของ iOS) ไม่ใช้ Modal
// วิธีใช้: ปุ่มเรียก measureInWindow แล้วส่ง anchor มา / วาง <AnchoredMenu /> เป็นลูกตัวสุดท้ายของ View ชั้นนอกสุดของหน้า

export type Anchor = { x: number; y: number; width: number; height: number };

// วัดตำแหน่งปุ่มบนจอ (พิกัดหน้าต่าง)
export function measureAnchor(ref: React.RefObject<any>, done: (anchor: Anchor) => void) {
  ref.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
    done({ x, y, width, height });
  });
}

export default function AnchoredMenu({
  anchor,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  anchor: Anchor | null;
  title?: string;
  options: string[];
  selected?: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const { width: screenW } = useWindowDimensions();
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!anchor) return;
    appear.setValue(0);
    Animated.timing(appear, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  }, [anchor]);

  if (!anchor) return null;

  // ชิดขอบขวาของปุ่ม (ปุ่มเรียงอยู่ฝั่งขวาของหัวรายการ)
  const right = Math.max(12, screenW - (anchor.x + anchor.width));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="ปิดเมนู" />
      <Animated.View
        style={[
          s.menu,
          {
            top: anchor.y + anchor.height + 6,
            right,
            opacity: appear,
            transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          },
        ]}
      >
        {!!title && <Text style={s.title}>{title}</Text>}
        {options.map((label, i) => {
          const active = i === selected;
          return (
            <Pressable
              key={label}
              style={({ pressed }) => [s.row, i > 0 || title ? s.rowDivider : null, pressed && s.pressed]}
              onPress={() => {
                onClose();
                onSelect(i);
              }}
            >
              <Text style={[s.label, active && s.labelActive]}>{label}</Text>
              <Text style={s.check}>{active ? "✓" : ""}</Text>
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  menu: {
    ...W.card,
    position: "absolute",
    minWidth: 220,
    maxWidth: 280,
    overflow: "hidden",
  },
  title: { fontSize: 12, color: "#94a3b8", fontWeight: "700", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DCE6F5" },
  pressed: { backgroundColor: "#f1f5f9" },
  label: { fontSize: 15, color: "#172033", fontWeight: "500" },
  labelActive: { fontWeight: "800" },
  check: { width: 16, fontSize: 15, color: "#2563eb", fontWeight: "800", textAlign: "right" },
});
