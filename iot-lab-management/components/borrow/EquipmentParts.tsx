import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { C, gradient } from "../../lib/theme";

// ชิ้นส่วนที่ใช้ร่วมระหว่างหน้าอุปกรณ์ (app/equipment.tsx) กับแผ่นรายละเอียดรุ่น (app/equipment-sheet.tsx) — ระบบยืม-คืน

export const OTHER = "อื่นๆ"; // ของที่ยังไม่มีหมวด (ก่อนมีตาราง categories)

export type Unit = {
  id: string;
  item_code: string | null;
  name: string;
  status: string;
  image_url: string | null;
  description: string | null;
  due_date?: string;
  item_no: number | null;
  location?: string;
};
export type Group = {
  key: string;
  name: string;
  category: string;
  image: string | null;
  description: string | null;
  location: string;
  units: Unit[];
  available: number; // ว่างให้ยืมจริง = ชิ้นสถานะว่าง − ชิ้นที่กันไว้ให้คำขอนัดรับ
  held: number; // กันไว้ให้คำขอนัดรับ (รอนัด + นัดแล้ว) — RPC pickup_holds
  nextDue: string | null; // ชิ้นที่ถูกยืมและจะคืนเร็วสุด
};

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Microcontroller: "hardware-chip-outline",
  SBC: "server-outline",
  Sensor: "pulse-outline",
  Actuator: "flash-outline",
  Module: "cube-outline",
  Kit: "color-wand-outline",
  Cable: "git-branch-outline",
  Other: "ellipsis-horizontal-outline",
  [OTHER]: "ellipsis-horizontal-outline",
};
export const iconFor = (category: string) => TYPE_ICONS[category] || "cube-outline";

// สีประจำหมวด (ไอคอนไล่สี + พื้นอ่อน) — ดูปราดเดียวแยกหมวดได้ / หมวดใหม่ที่ไม่มีในนี้ใช้สีฟ้า
const CAT_TONE: Record<string, { from: string; to: string; soft: string }> = {
  Microcontroller: { from: "#7C8CFF", to: "#4F46E5", soft: "#EEF0FF" },
  SBC: { from: "#B58CFF", to: "#7C3AED", soft: "#F4EEFF" },
  Sensor: { from: "#4FD1B5", to: "#0F9D84", soft: "#E6F8F3" },
  Actuator: { from: "#FFB45C", to: "#EA6A1F", soft: "#FFF1E4" },
  Module: { from: "#6AA8FF", to: "#2563EB", soft: "#EAF2FF" },
  Kit: { from: "#FF8FC0", to: "#DB2777", soft: "#FDECF4" },
  Cable: { from: "#94A3B8", to: "#475569", soft: "#EEF2F7" },
};
export const toneOf = (category: string) => CAT_TONE[category] || { from: "#8FA6C8", to: "#5B6B85", soft: "#EEF2F7" };

export const formatDue = (value: string) => new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

// โทนตามจำนวนว่าง: มีว่าง = เขียว / ไม่มีแต่จะคืน = เหลือง / ซ่อมหมด = แดง
export function availTone(g: Group) {
  if (g.available > 0) return { fg: C.successInk, bg: C.successBg, bar: C.success };
  if (g.nextDue) return { fg: C.warningInk, bg: C.warningBg, bar: C.warning };
  return { fg: C.errorInk, bg: C.errorBg, bar: C.error };
}

// รูปอุปกรณ์ / ถ้าไม่มีรูป = ไอคอนหมวดบนพื้นสีของหมวด (ขนาดเท่ากันทุกการ์ด)
export function Thumb({ image, category, size }: { image: string | null; category: string; size: number }) {
  const tone = toneOf(category);
  const box = { width: size, height: size, borderRadius: size * 0.28 };
  // expo-image: ถอดรหัสรูปนอกเธรดวาดจอ + ย่อเท่าขนาดที่แสดง + แคช — รูปจากกล้อง (1–4 พันพิกเซล) ด้วย Image เดิม
  //   ถอดรหัสบนเธรดหลักตอนแผ่นรายละเอียดเปิด = แผ่นสะดุด 1–2 เฟรม เฉพาะรุ่นที่มีรูป (วัดจากคลิปจริง 11 ต.ค.)
  if (image)
    return <Image source={{ uri: image }} style={[box, { backgroundColor: tone.soft }]} contentFit="cover" cachePolicy="memory-disk" transition={0} />;
  return (
    <View style={[box, { backgroundColor: tone.soft, alignItems: "center", justifyContent: "center" }]}>
      <View
        style={[
          { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.2, alignItems: "center", justifyContent: "center", backgroundColor: tone.to },
          gradient(`linear-gradient(145deg, ${tone.from} 0%, ${tone.to} 100%)`),
          { boxShadow: `0 4px 10px ${tone.to}40` },
        ]}
      >
        <Ionicons name={iconFor(category)} size={size * 0.34} color="#FFFFFF" />
      </View>
    </View>
  );
}

// รุ่นที่เลือกไว้ส่งให้แผ่นรายละเอียด (app/equipment-sheet) — แผ่นเป็นหน้าแยกของ router จึงส่งผ่านตัวแปรนี้แทน props
let selected: Group | null = null;
export const setSelectedGroup = (g: Group) => {
  selected = g;
};
export const getSelectedGroup = () => selected;

// สิ่งที่ต้องทำต่อหลังแผ่นปิด (หน้าอุปกรณ์อ่านตอนกลับมาโฟกัส) — กด "เปิดกล้องสแกน" ในแผ่น:
//   ต้องปิดแผ่นก่อนแล้วค่อยไปหน้าสแกน ไม่งั้นหน้าสแกนจะไปซ้อนอยู่ในแผ่น
let pendingAction: "scan" | null = null;
export const setPendingAction = (a: "scan" | null) => {
  pendingAction = a;
};
export const takePendingAction = () => {
  const a = pendingAction;
  pendingAction = null;
  return a;
};
