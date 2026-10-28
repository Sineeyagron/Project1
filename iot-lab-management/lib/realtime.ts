import { useBroadcast } from "./broadcast";

// Realtime ของระบบยืม-คืน — ตัวจัดการช่อง (นับผู้ฟัง/ปิดช่อง) อยู่ที่ lib/broadcast.ts ที่ใช้ร่วมทั้งแอป
// ช่อง user:<id> = แจ้งเตือนใหม่ของเรา (event "notification") / ช่อง staff = คำขอใหม่/เปลี่ยนสถานะ (event "request")
// ช่อง lab = ผู้ดูแลเช็กอิน/เช็กเอาท์ (event "presence", F4) — ทุกคนที่ล็อกอินฟังได้
// หลายหน้าอาจฟังช่องเดียวกันพร้อมกัน (เช่น หน้าแรก admin + หน้าแจ้งเตือน) → ใช้ช่องร่วมกัน

// ฟังสัญญาณในหน้านั้น — onSignal ถูกเรียกเมื่อมีของใหม่ (ช่องหลุด/ฟังไม่ได้ → หน้ายังมีรีเฟรชสำรองของตัวเอง)
export function useRealtime(scope: "user" | "staff" | "lab", event: "notification" | "request" | "presence", onSignal: () => void) {
  useBroadcast(scope, event, onSignal);
}
