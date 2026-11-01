import { Platform } from "react-native";

// เปิดลิงก์ตรงตอนยังไม่ล็อกอิน (เช่น สแกน QR ที่แปะคอมด้วยกล้องมือถือ) → ล็อกอินเสร็จพากลับหน้านั้น
// เว็บเท่านั้น: เก็บใน localStorage เพราะล็อกอิน Google พาออกนอกเว็บแล้วโหลดหน้าใหม่ (ตัวแปรในหน่วยความจำหาย)
// เก็บไว้ไม่เกิน 30 นาที กันลิงก์เก่าค้างแล้วพาไปผิดที่ตอนล็อกอินครั้งหลัง
const KEY = "labhub.returnTo";
const MAX_AGE = 30 * 60 * 1000;

export function saveReturnTo() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  const path = window.location.pathname + window.location.search;
  if (!path.startsWith("/") || path.startsWith("//") || path === "/" || path.startsWith("/login")) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {}
}

// อ่านแล้วลบทิ้ง (ใช้ได้ครั้งเดียว) — ไม่มี/หมดอายุ = null
export function takeReturnTo(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw);
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || Date.now() - at > MAX_AGE) return null;
    return path;
  } catch {
    return null;
  }
}
