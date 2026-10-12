import { Platform, useWindowDimensions } from "react-native";

// แบบจอใหญ่ (คอม) สำหรับหน้า admin/TA — เจ้าของโปรเจกต์เลือก 12 ต.ค. 2569
//   แอปมือถือคือหลัก: มือถือทุกแบบ (แอป + PWA) ใช้หน้าตาเดิมเสมอ / จอใหญ่ = ของเสริมเฉพาะหน้า admin
//   ตัดสินจาก "ความกว้างจอบนเว็บ" ที่นี่ที่เดียว — ห้ามเช็กเองในแต่ละหน้า
export const DESKTOP_MIN_WIDTH = 1024;
// ความกว้างแอปแบบมือถือเมื่อเปิดบนจอกว้าง (หน้า นศ. + หน้า admin ที่ยังไม่มีแบบจอใหญ่)
export const PHONE_COLUMN_WIDTH = 480;
// หน้า admin ที่ยังไม่มีแบบจอใหญ่ของตัวเอง: แสดงแบบมือถือแต่กว้างขึ้นให้อ่านสบายบนคอม
export const ADMIN_COLUMN_WIDTH = 760;

export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= DESKTOP_MIN_WIDTH;
}

// หน้า admin ที่ทำแบบจอใหญ่แล้ว (ใช้เต็มพื้นที่ขวาของเมนู) — หน้าอื่นแสดงแบบมือถือกลางพื้นที่ไปก่อน
export const ADMIN_DESKTOP_READY = new Set(["/admin", "/admin/home", "/admin/requests", "/admin/items", "/admin/users"]);
export const isDesktopReady = (path: string) => ADMIN_DESKTOP_READY.has(path.replace(/\/+$/, "") || "/");
