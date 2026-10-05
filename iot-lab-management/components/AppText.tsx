import React from "react";
import { StyleSheet, Text as RNText, TextInput as RNTextInput, TextInputProps, TextProps, TextStyle } from "react-native";

// ฟอนต์เดียวทั้งแอป: Noto Sans Thai (มีทั้งอักษรไทยและอังกฤษในชุดเดียว)
// ฟอนต์ที่โหลดเองแยกไฟล์ตามความหนา → แปลง fontWeight เป็นชื่อไฟล์ฟอนต์ให้อัตโนมัติ
// ทุกหน้า import { Text, TextInput } จากไฟล์นี้แทน react-native (ส่วนอื่นเหมือนเดิมทุกอย่าง)
const FAMILY: Record<string, string> = {
  "100": "NotoSansThai_400Regular",
  "200": "NotoSansThai_400Regular",
  "300": "NotoSansThai_400Regular",
  "400": "NotoSansThai_400Regular",
  normal: "NotoSansThai_400Regular",
  "500": "NotoSansThai_500Medium",
  "600": "NotoSansThai_600SemiBold",
  "700": "NotoSansThai_700Bold",
  bold: "NotoSansThai_700Bold",
  "800": "NotoSansThai_700Bold",
  "900": "NotoSansThai_700Bold",
};

function withFont(style: TextProps["style"], inherit: boolean, thai = true) {
  const flat = (StyleSheet.flatten(style) || {}) as TextStyle;
  // ตั้งฟอนต์อื่นไว้เจาะจง (เช่น monospace) → ไม่ยุ่ง
  if (flat.fontFamily) return style;
  // ข้อความซ้อนที่ไม่ได้กำหนดความหนา → ใช้ฟอนต์ของข้อความแม่
  if (inherit && flat.fontWeight == null) return style;
  const family = FAMILY[String(flat.fontWeight ?? "400")] ?? FAMILY["400"];
  // สระบน/วรรณยุกต์ภาษาไทยของ Noto Sans Thai สูงกว่าฟอนต์เดิม → lineHeight ที่ตั้งชิดไว้ทำให้ตัวอักษรโดนตัด
  // ขยายให้อย่างน้อย 1.5 เท่าของขนาดตัวอักษร เฉพาะข้อความที่มีภาษาไทย (ตัวเลข/อังกฤษไม่ต้อง จะได้ไม่ดันเลย์เอาต์)
  const size = flat.fontSize ?? 14;
  const fix = thai && typeof flat.lineHeight === "number" && flat.lineHeight < size * 1.5 ? { lineHeight: Math.ceil(size * 1.5) } : null;
  return [style, { fontFamily: family, fontWeight: "normal" as const }, fix];
}

// มีอักษรไทยในข้อความไหม (ไล่ดูลูกที่เป็นข้อความ/ตัวเลข)
function hasThai(children: React.ReactNode): boolean {
  let found = false;
  React.Children.forEach(children, (c) => {
    if (!found && typeof c === "string" && /[฀-๿]/.test(c)) found = true;
  });
  return found;
}

const InsideText = React.createContext(false);

export function Text(props: TextProps) {
  const inside = React.useContext(InsideText);
  const text = <RNText {...props} style={withFont(props.style, inside, hasThai(props.children))} />;
  return inside ? text : <InsideText.Provider value>{text}</InsideText.Provider>;
}

export function TextInput(props: TextInputProps) {
  return <RNTextInput {...props} style={withFont(props.style, false)} />;
}
