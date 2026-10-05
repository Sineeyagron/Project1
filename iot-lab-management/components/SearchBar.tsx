import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Platform, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput } from "./AppText";
import { C } from "../lib/theme";

// ช่องค้นหาแบบเดียวกันทุกหน้า (สไตล์ iOS):
//   โฟกัส = ขอบฟ้า + เงาเรือง / ปุ่ม "ยกเลิก" เลื่อนเข้ามาทางขวา (ล้างคำ + ปิดคีย์บอร์ด)
//   มีคำค้น = ปุ่ม ✕ ล้างในช่อง / ไม่ได้โฟกัสและว่าง = แสดง accessory (เช่น ปุ่มสแกน) ถ้ามี
//   onFocusChange → ให้หน้าซ่อนชิปหมวดระหว่างพิมพ์ได้
// ไม่ใช้ scrim ทับ เพราะทุกหน้ากรองรายการด้านล่างทันทีที่พิมพ์ (ผลค้นหาอยู่ใต้ช่องนี้เลย)

const CANCEL_W = 64;

export default function SearchBar({
  value,
  onChangeText,
  placeholder = "ค้นหา",
  onFocusChange,
  onSubmit,
  accessory,
  style,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocusChange?: (focused: boolean) => void;
  onSubmit?: () => void;
  accessory?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  // สถานะโฟกัสจริงตอนนี้ + หน้ายังอยู่ไหม — กันตัวหน่วง blur มาทับตอนกลับมาโฟกัสเร็ว ๆ หรือหลังปิดหน้าไปแล้ว
  const focusedRef = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const animate = (to: number) =>
    Animated.timing(anim, { toValue: to, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();

  const onFocus = () => {
    focusedRef.current = true;
    setFocused(true);
    onFocusChange?.(true);
    animate(1);
  };
  // หน่วงนิดหนึ่งก่อนหดปุ่ม "ยกเลิก": เว็บเสียโฟกัสตั้งแต่กดเมาส์ลง ถ้าหดทันที ปุ่มหลบก่อนการกดจะจบ = กดไม่ติด
  const onBlur = () => {
    focusedRef.current = false;
    setTimeout(() => {
      if (!alive.current || focusedRef.current) return;
      setFocused(false);
      onFocusChange?.(false);
      animate(0);
    }, 150);
  };
  const cancel = () => {
    onChangeText("");
    Keyboard.dismiss();
  };

  return (
    <View style={[s.row, style]}>
      <View style={[s.box, focused && s.boxFocused]}>
        <Ionicons name="search-outline" size={19} color={focused ? C.primary : C.faint} />
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.faint}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          onFocus={onFocus}
          onBlur={onBlur}
          onSubmitEditing={() => { onSubmit?.(); Keyboard.dismiss(); }}
          accessibilityLabel={placeholder}
        />
        {value ? (
          <TouchableOpacity style={s.clear} onPress={() => onChangeText("")} hitSlop={8} accessibilityLabel="ล้างคำค้นหา">
            <Ionicons name="close" size={15} color="#FFFFFF" />
          </TouchableOpacity>
        ) : !focused && accessory ? (
          accessory
        ) : null}
      </View>
      {/* ปุ่ม "ยกเลิก" เลื่อนเข้ามาตอนโฟกัส */}
      <Animated.View
        style={{ width: anim.interpolate({ inputRange: [0, 1], outputRange: [0, CANCEL_W] }), opacity: anim, overflow: "hidden" }}
        // เว็บ: คลิกเมาส์จริงที่เกิดระหว่างช่องค้นหากำลังเสียโฟกัส ตัวจัดการกดของ React Native Web ไม่รับ → ใช้ pointerdown ตรง ๆ
        {...(Platform.OS === "web" ? ({ onPointerDown: cancel } as any) : null)}
      >
        {/* มือถือ: onPressIn ทำงานตั้งแต่นิ้วแตะ */}
        <TouchableOpacity onPressIn={Platform.OS === "web" ? undefined : cancel} style={s.cancel} accessibilityLabel="ยกเลิกการค้นหา">
          <Text style={s.cancelText} numberOfLines={1}>ยกเลิก</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  box: {
    flex: 1,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1.5,
    borderColor: "#DCE6F5",
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  },
  boxFocused: {
    backgroundColor: "#FFFFFF",
    borderColor: C.primary,
    boxShadow: "0 0 0 4px rgba(37,99,235,0.14), 0 6px 16px rgba(37,99,235,0.12)",
  },
  // outlineWidth 0 = เอากรอบโฟกัสของเบราว์เซอร์ออก (เว็บเท่านั้น — กล่องมีขอบฟ้าของตัวเองแล้ว)
  input: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 0, height: "100%", outlineWidth: 0, outlineStyle: "none" } as any,
  clear: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#94A3B8", marginRight: 6 },
  cancel: { width: CANCEL_W, height: 50, alignItems: "flex-end", justifyContent: "center" },
  cancelText: { color: C.primaryDark, fontSize: 15, fontWeight: "600" },
});
