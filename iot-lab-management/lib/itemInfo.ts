// ข้อมูลอายุ/ประกันของอุปกรณ์ ใช้ร่วมกันหลายหน้า (สแกนดูสถานะ, Stock Report)
// อายุนับจากวันที่เพิ่มเข้าระบบ (แผน 2.2)

export const WARRANTY_SOON_DAYS = 30;

const COLOR = { red: "#dc2626", orange: "#c2410c", green: "#16a34a", faint: "#94a3b8" };

export const thaiDate = (value?: string | null) =>
  value
    ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";

// วัน + เวลา (เช่น "28 ต.ค. 14:05") — ไม่มีค่า = ว่าง
export const thaiDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

// เรียงอุปกรณ์ตามชื่อรหัส แล้วตามเลขจริง (002 ก่อน 010)
export function compareItems(a: any, b: any) {
  const byPrefix = (a.item_prefix || a.name || "").localeCompare(b.item_prefix || b.name || "", "th");
  return byPrefix !== 0 ? byPrefix : (a.item_no || 0) - (b.item_no || 0);
}

// จำนวนเดือนเต็มนับจากวันที่เพิ่มเข้าระบบ
export function ageMonths(createdAt?: string | null) {
  if (!createdAt) return 0;
  const start = new Date(createdAt);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

export function ageText(createdAt?: string | null) {
  if (!createdAt) return "-";
  const months = ageMonths(createdAt);
  if (months < 1) {
    const days = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));
    return `${days} วัน`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} ปี` : "", m ? `${m} เดือน` : ""].filter(Boolean).join(" ");
}

export type WarrantyState = "none" | "expired" | "soon" | "ok";

// soonDays = เตือนก่อนหมดกี่วัน (app_settings.warranty_warn_days)
export function warrantyInfo(
  date?: string | null,
  soonDays = WARRANTY_SOON_DAYS
): { state: WarrantyState; days: number; text: string; color: string } {
  if (!date) return { state: "none", days: 0, text: "ไม่มีข้อมูลประกัน", color: COLOR.faint };
  const end = new Date(`${date}T23:59:59`);
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);
  if (days < 0) return { state: "expired", days, text: `หมดประกันแล้ว (${thaiDate(date)})`, color: COLOR.red };
  if (days <= soonDays)
    return { state: "soon", days, text: `เหลืออีก ${days} วัน (${thaiDate(date)})`, color: COLOR.orange };
  return { state: "ok", days, text: `ถึง ${thaiDate(date)} · เหลือ ${days} วัน`, color: COLOR.green };
}

// วันที่แบบ ปปปป-ดด-วว (ค.ศ.) สำหรับช่องวันหมดประกัน
export const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
};

// ── ช่องกรอกวันหมดประกันแบบ วว/ดด/ปปปป (ปี พ.ศ.) — ฐานข้อมูลเก็บ ปปปป-ดด-วว (ค.ศ.) เหมือนเดิม ──
//   ใช้ร่วมกัน: หน้าเพิ่มอุปกรณ์ (admin/scan) + แก้ประกัน (admin/items) ผ่าน components/borrow/WarrantyDateField
const PART_MAX = [2, 2, 4];

// จัดรูประหว่างพิมพ์: ใส่ / ให้เอง (พิมพ์ 31122570 → 31/12/2570), รับเลขไทย, พิมพ์ / . - เองก็ได้
export function maskThaiDate(text: string) {
  const s = text.replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50));
  const parts = [""];
  for (const ch of s) {
    const i = parts.length - 1;
    if (/\d/.test(ch)) {
      if (parts[i].length < PART_MAX[i]) parts[i] += ch;
      else if (i < 2) parts.push(ch);
    } else if (/[/.\-\s]/.test(ch) && parts[i] && i < 2) {
      parts.push("");
    }
  }
  return parts.join("/");
}

// วว/ดด/ปปปป → ปปปป-ดด-วว (ค.ศ.) / ปีเกิน 2400 = พ.ศ. (พิมพ์ ค.ศ. ก็รับ) / ไม่ใช่วันที่จริง = null
export function parseThaiDate(text: string): string | null {
  const v = text.trim();
  if (isValidDate(v)) return v;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  let y = Number(m[3]);
  if (y > 2400) y -= 543;
  if (y < 1900 || y > 2300) return null;
  const iso = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isValidDate(iso) ? iso : null;
}

// ปปปป-ดด-วว (ค.ศ.) → วว/ดด/ปปปป (พ.ศ.) สำหรับใส่ในช่องกรอก
export function toThaiDateInput(iso?: string | null) {
  if (!iso || !isValidDate(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${Number(y) + 543}`;
}

// วันนี้ + N ปี เป็น ปปปป-ดด-วว
export const addYears = (years: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};
