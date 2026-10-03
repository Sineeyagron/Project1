// ชื่อ + สีของสถานะ ใช้ร่วมกันทุกหน้า (เดิมแต่ละหน้าตั้งเอง ชื่อ/สีไม่ตรงกัน เช่น "จองอยู่" vs "รออนุมัติยืม",
// หน้า นศ. ถูกยืม = แดง แต่หน้า Admin ถูกยืม = ส้ม) — แก้ที่นี่ที่เดียว

export type StatusStyle = { label: string; color: string; bg: string; border: string };

// สถานะอุปกรณ์ (items.status)
export const ITEM_STATUS: Record<string, StatusStyle> = {
  available: { label: "ว่าง", color: "#16a34a", bg: "#dcfce7", border: "#22c55e" },
  reserved: { label: "รออนุมัติยืม", color: "#c2410c", bg: "#ffedd5", border: "#fb923c" },
  borrowed: { label: "ถูกยืม", color: "#b45309", bg: "#fef3c7", border: "#f59e0b" },
  repair: { label: "ซ่อมบำรุง", color: "#dc2626", bg: "#fee2e2", border: "#ef4444" },
  retired: { label: "จำหน่ายแล้ว", color: "#64748b", bg: "#e2e8f0", border: "#94a3b8" },
};

// สถานะการยืม (borrow_records.status)
export const RECORD_STATUS: Record<string, StatusStyle> = {
  borrowed: { label: "กำลังยืม", color: "#b45309", bg: "#fef3c7", border: "#f59e0b" },
  pending_return: { label: "รอยืนยันคืน", color: "#c2410c", bg: "#ffedd5", border: "#fb923c" },
  returned: { label: "คืนแล้ว", color: "#16a34a", bg: "#dcfce7", border: "#22c55e" },
};
