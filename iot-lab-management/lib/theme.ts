import { Platform, ViewStyle } from "react-native";

// ธีมกลางของ LabHub (ตาม docs/DESIGN.md + การ์ดสไตล์ widget ที่เจ้าของโปรเจกต์เลือก)
// ทุกหน้าใช้สี/การ์ด/ปุ่มจากไฟล์นี้ — อยากปรับหน้าตาทั้งแอป แก้ที่นี่ที่เดียว

export const C = {
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  primaryLight: "#3B82F6",
  primarySoft: "#DBEAFE",
  primaryTint: "#EEF5FF",
  ink: "#172033",
  text2: "#475569",
  muted: "#475569",
  faint: "#64748B",
  border: "#D3E0F5",
  surface: "#FFFFFF",
  bg: "#EAF1FC",
  success: "#10B981",
  successInk: "#047857",
  successBg: "#ECFDF5",
  warning: "#F59E0B",
  warningInk: "#B45309",
  warningBg: "#FFFBEB",
  error: "#EF4444",
  errorInk: "#B91C1C",
  errorBg: "#FEF2F2",
};

// ไล่สีพื้นหลัง: มือถือใช้ experimental_backgroundImage / เว็บใช้ CSS backgroundImage
// (มี backgroundColor สำรองไว้เสมอ ถ้าเครื่องไหนไม่รองรับจะเห็นสีพื้นแทน)
export function gradient(css: string): ViewStyle {
  return (Platform.OS === "web" ? { backgroundImage: css } : { experimental_backgroundImage: css }) as ViewStyle;
}

const CARD_SHADOW = "inset 0 1px 0 #FFFFFF, inset 0 -2px 0 rgba(37,99,235,0.04), 0 2px 4px rgba(15,23,42,0.06), 0 9px 18px rgba(37,99,235,0.115)";
const SMALL_SHADOW = "inset 0 1px 0 #FFFFFF, 0 1px 2px rgba(15,23,42,0.05), 0 6px 14px rgba(37,99,235,0.13)";

export const W = {
  // พื้นหลังทั้งหน้า (ฟ้าสดด้านบน ค่อย ๆ จางลง)
  page: {
    flex: 1,
    backgroundColor: C.bg,
    ...gradient("linear-gradient(180deg, #C7DBFF 0%, #DDE9FF 30%, #EAF1FC 62%)"),
  } as ViewStyle,
  // การ์ด widget (ใช้ทุกหน้า): มุมโค้ง 22 พื้นไล่ขาว→ฟ้าที่ขอบล่าง ขอบขาวบาง ไฮไลต์ขอบบน + เงาสองชั้นแบบพอดี
  card: {
    borderRadius: 22,
    backgroundColor: "#F4F8FF",
    ...gradient("linear-gradient(165deg, #FFFFFF 0%, #F3F7FF 55%, #E7EFFC 100%)"),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    boxShadow: CARD_SHADOW,
  } as ViewStyle,
  // ปุ่มเล็ก / ช่องเล็ก (← รีเฟรช กระดิ่ง แท็บ) แบบ widget
  small: {
    borderRadius: 15,
    backgroundColor: "#F7FAFF",
    ...gradient("linear-gradient(160deg, #FFFFFF 0%, #EEF4FF 100%)"),
    boxShadow: SMALL_SHADOW,
  } as ViewStyle,
  // ปุ่มไอคอนมุมหัว (← รีเฟรช กระดิ่ง เพิ่ม ออกจากระบบ) ขนาดเดียวกันทุกหน้า
  iconBtn: {
    borderRadius: 13,
    backgroundColor: "#F7FAFF",
    ...gradient("linear-gradient(160deg, #FFFFFF 0%, #EEF4FF 100%)"),
    boxShadow: SMALL_SHADOW,
    width: 38,
    height: 38,
  } as ViewStyle,
  // แถบหัวหน้าบาง ๆ (หน้าเครื่องมือผู้ดูแล): เต็มความกว้าง พื้นขาวโปร่งไล่สีจาง + เส้นบางด้านล่าง แยกหัวข้อออกจากเนื้อหา
  headerBar: {
    backgroundColor: "rgba(255,255,255,0.6)",
    ...gradient("linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.5) 100%)"),
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(148,163,184,0.45)",
    boxShadow: "0 2px 8px rgba(37,99,235,0.05)",
  } as ViewStyle,
  // ปุ่มหลักสีน้ำเงิน
  primary: {
    borderRadius: 15,
    backgroundColor: C.primary,
    ...gradient("linear-gradient(135deg, #1D4ED8 0%, #2563EB 55%, #3B82F6 100%)"),
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 4px rgba(29,78,216,0.2), 0 10px 22px rgba(37,99,235,0.30)",
  } as ViewStyle,
  // ปุ่มหลักแบบสีเดียว (ใช้กับปุ่มที่เปลี่ยนสีตามสถานะ เช่น ปิดใช้งาน — ไล่สีจะทับสีสถานะ)
  primarySolid: {
    borderRadius: 15,
    backgroundColor: C.primary,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 4px rgba(29,78,216,0.18), 0 8px 18px rgba(37,99,235,0.26)",
  } as ViewStyle,
  // ช่องกรอก / ช่องค้นหา
  input: {
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: C.border,
    boxShadow: "0 4px 12px rgba(37,99,235,0.08)",
  } as ViewStyle,
  // แถบเมนูล่าง
  nav: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderTopWidth: 1,
    borderTopColor: C.border,
    boxShadow: "0 -6px 20px rgba(37,99,235,0.08)",
  } as ViewStyle,
  // หน้าต่างเด้งจากด้านล่าง / modal
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    boxShadow: "0 -12px 32px rgba(23,32,51,0.18)",
  } as ViewStyle,
  // ช่องสถิติแบบ widget สีอ่อน (ฟ้า / เขียว / ส้ม / แดง)
  statBlue: { borderRadius: 22, backgroundColor: "#E3EDFF", ...gradient("linear-gradient(160deg, #F2F7FF 0%, #E3EDFF 100%)"), borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", boxShadow: CARD_SHADOW } as ViewStyle,
  statGreen: { borderRadius: 22, backgroundColor: "#E1F7EE", ...gradient("linear-gradient(160deg, #F2FCF8 0%, #E1F7EE 100%)"), borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", boxShadow: CARD_SHADOW } as ViewStyle,
  statAmber: { borderRadius: 22, backgroundColor: "#FFF2D6", ...gradient("linear-gradient(160deg, #FFF9EC 0%, #FFF2D6 100%)"), borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", boxShadow: CARD_SHADOW } as ViewStyle,
  statRed: { borderRadius: 22, backgroundColor: "#FFE4E4", ...gradient("linear-gradient(160deg, #FFF4F4 0%, #FFE4E4 100%)"), borderWidth: 1, borderColor: "rgba(255,255,255,0.9)", boxShadow: CARD_SHADOW } as ViewStyle,
};

// ใส่ในสไตล์สถานะที่เปลี่ยนสีพื้น (เช่น การ์ดที่ถูกเลือก) เพื่อล้างไล่สีของการ์ด ให้เห็นสีสถานะชัด
export const NG = (Platform.OS === "web" ? { backgroundImage: undefined } : { experimental_backgroundImage: undefined }) as {};

// วงกลมไอคอนสีทึบมีแสงเรือง (ใช้ในช่องสถิติ / ผลคำขอ)
export function iconDot(color: string, size = 34): ViewStyle {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 4px 10px ${color}55`,
  };
}

// สีอ่อนทึบจากสีหลัก (ผสมขาว) — ใช้ไล่สีพื้นการ์ดตามสถานะ ไม่ให้โปร่งจนเห็นพื้นหลังแล้วหม่น
export function tint(hex: string, white = 0.88) {
  const n = parseInt(hex.replace("#", ""), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * white);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}
