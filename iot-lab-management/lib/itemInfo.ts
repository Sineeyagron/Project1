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

// วันนี้ + N ปี เป็น ปปปป-ดด-วว
export const addYears = (years: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};
