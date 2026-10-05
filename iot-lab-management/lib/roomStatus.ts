// ชื่อ + สี + ไอคอน ของสถานะในระบบห้องคอม ใช้ร่วมกันทุกหน้าของระบบห้อง
// (แยกจาก lib/status.ts ของระบบยืม-คืนโดยตั้งใจ — สองระบบห้ามใช้กติการ่วมกัน)
// เดิมแต่ละหน้าตั้งเอง ชื่อไม่ตรงกัน เช่น เครื่องว่าง = "พร้อมใช้" / "ว่าง" / "ใช้งานได้"

export type RoomStatusStyle = { label: string; color: string; bg: string; border: string; icon: any };

const UNKNOWN: RoomStatusStyle = { label: "ไม่ทราบสถานะ", color: "#64748b", bg: "#f1f5f9", border: "#cbd5e1", icon: "help-circle-outline" };

// สถานะเครื่องคอม (computer_stations.status) และ LAN port (lan_ports.status) ใช้ชุดเดียวกัน
export const STATION_STATUS: Record<string, RoomStatusStyle> = {
  available: { label: "ใช้งานได้", color: "#16a34a", bg: "#dcfce7", border: "#86efac", icon: "checkmark-circle-outline" },
  repair: { label: "กำลังซ่อม", color: "#b45309", bg: "#fef3c7", border: "#fbbf24", icon: "construct-outline" },
  broken: { label: "เสีย", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5", icon: "close-circle-outline" },
};
export const LAN_STATUS = STATION_STATUS;

// เช็กลิสต์อุปกรณ์ต่อเครื่อง (station_equipment.status)
export const EQUIP_STATUS: Record<string, RoomStatusStyle> = {
  present: { label: "ครบ", color: "#16a34a", bg: "#dcfce7", border: "#86efac", icon: "checkmark-circle-outline" },
  missing: { label: "หาย", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5", icon: "alert-circle-outline" },
  broken: { label: "ชำรุด", color: "#b45309", bg: "#fef3c7", border: "#fbbf24", icon: "construct-outline" },
};

// งานซ่อม (repair_records.status)
export const REPAIR_STATUS: Record<string, RoomStatusStyle> = {
  pending: { label: "รอซ่อม", color: "#dc2626", bg: "#fee2e2", border: "#f87171", icon: "time-outline" },
  "in-repair": { label: "กำลังซ่อม", color: "#b45309", bg: "#fef3c7", border: "#facc15", icon: "hardware-chip-outline" },
  done: { label: "ซ่อมเสร็จแล้ว", color: "#16a34a", bg: "#dcfce7", border: "#34d399", icon: "checkmark-done-outline" },
};

// ผลตรวจประจำเทอม (equipment_inspections.condition)
export const CONDITION_STATUS: Record<string, RoomStatusStyle> = {
  good: { label: "ปกติ", color: "#10b981", bg: "#ecfdf5", border: "#d1fae5", icon: "checkmark" },
  damaged: { label: "ชำรุด", color: "#ef4444", bg: "#fff1f2", border: "#fee2e2", icon: "warning-outline" },
  missing: { label: "หาย", color: "#ef4444", bg: "#fff1f2", border: "#fee2e2", icon: "warning-outline" },
};

// อ่านสถานะแบบมีค่าสำรอง — ค่าแปลก/ค่าเก่าในฐานข้อมูลต้องไม่ทำให้หน้าพัง
export function roomStatus(map: Record<string, RoomStatusStyle>, key: string | null | undefined): RoomStatusStyle {
  return (key && map[key]) || UNKNOWN;
}

// เรียงกลุ่ม/เครื่องแบบตัวเลข (C2 มาก่อน C10)
export function naturalNo(name: string) {
  const match = String(name || "").match(/\d+/);
  return match ? Number(match[0]) : 999;
}
