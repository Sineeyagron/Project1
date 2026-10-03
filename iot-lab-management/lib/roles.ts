import { createContext, useContext } from "react";

// บทบาทผู้ใช้ (profiles.role) — สิทธิ์จริงอยู่ที่ RLS/RPC ในฐานข้อมูล ไฟล์นี้ใช้แค่ซ่อน/กันหน้าในแอป
// admin = ทุกอย่าง / ta = ผู้ช่วย admin (เฟส 4.1) / user = นักศึกษา

export type Role = "user" | "ta" | "admin";

export const ROLE_LABEL: Record<Role, string> = {
  user: "นักศึกษา",
  ta: "TA",
  admin: "ผู้ดูแลระบบ",
};

export const isStaffRole = (role?: string | null): role is "ta" | "admin" => role === "admin" || role === "ta";

// หน้าใน app/admin/ ที่ TA เข้าได้ (ที่เหลือ admin เท่านั้น: เพิ่ม/แก้/จำหน่ายของ, หมวด, ตั้งค่า, แต่งตั้ง TA, ระบบห้องคอม)
const TA_ROUTES = new Set([
  "/admin",
  "/admin/home",
  "/admin/requests", // อนุมัติ/ปฏิเสธคำขอ + ตรวจสภาพตอนคืน
  "/admin/lookup", // สแกนดูสถานะ
  "/admin/history", // ประวัติยืม
  "/admin/stock", // รายงานสต็อก (ดูอย่างเดียว)
  "/admin/report", // รายงานการยืม-คืน + ส่งออก
  "/admin/qrgen", // พิมพ์ป้าย QR
  "/admin/iotinspection", // ตรวจสภาพประจำเทอม
]);

// ตรวจเฉพาะหน้าใน /admin — หน้าอื่น (แจ้งเตือน, หน้านักศึกษา) เป็นของทุกคน ไม่ใช่เรื่องของด่านนี้
export const isAdminPath = (path: string) => path === "/admin" || path.startsWith("/admin/");

export function canAccess(role: string | null | undefined, path: string) {
  if (role === "admin") return true;
  if (role !== "ta") return false;
  return TA_ROUTES.has(path.replace(/\/+$/, "") || "/");
}

// บทบาทของคนที่ล็อกอิน แจกจาก app/admin/_layout.tsx ให้ทุกหน้าใน admin
export const RoleContext = createContext<{ role: Role | null; userId: string | null }>({ role: null, userId: null });
export const useRole = () => useContext(RoleContext);
