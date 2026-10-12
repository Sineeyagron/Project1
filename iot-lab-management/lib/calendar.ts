// ปฏิทินเลือกช่วงวันที่ — ตรรกะล้วน (ไม่มี UI ทดสอบแยกได้) ใช้กับ components/RangeCalendarSheet.tsx
// วันที่ทั้งหมดเป็นสตริง "YYYY-MM-DD" (ค.ศ.) ตามที่ฐานข้อมูล/รายงานใช้อยู่ · แสดงผลเป็นเดือนไทย พ.ศ.
// คำนวณด้วย Date.UTC ทั้งหมด — ไม่ขึ้นกับเขตเวลาของเครื่อง (กันวันเลื่อน)

export const TH_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const TH_WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const pad = (n: number) => String(n).padStart(2, "0");
export const isoOf = (year: number, month0: number, day: number) => `${year}-${pad(month0 + 1)}-${pad(day)}`;
export const parseIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month0: m - 1, day: d };
};

// "2026-09-12" → "12 ก.ย. 2569"
export function thaiShort(iso: string | null) {
  if (!iso) return "-";
  const { year, month0, day } = parseIso(iso);
  return `${day} ${TH_MONTHS_SHORT[month0]} ${year + 543}`;
}

// ช่องของเดือนหนึ่ง เริ่มวันอาทิตย์: null = ช่องว่างก่อนวันที่ 1
export function monthCells(year: number, month0: number): (string | null)[] {
  const lead = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(isoOf(year, month0, d));
  return cells;
}

export function shiftMonth(year: number, month0: number, delta: number) {
  const t = new Date(Date.UTC(year, month0 + delta, 1));
  return { year: t.getUTCFullYear(), month0: t.getUTCMonth() };
}

// จำนวนวันรวมทั้งหัวและท้าย ("2026-09-12" → "2026-10-11" = 30)
export const daysInclusive = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;

export type DateRange = { start: string; end: string };
export type EditSide = "start" | "end";

// กติกาการแตะ (รอบ 3 — เจ้าของโปรเจกต์เลือก 11 ต.ค. 2569): แก้ช่องที่เลือกค้างไว้
//   แตะช่องไหน (วันเริ่ม/วันสิ้นสุด) ก็แก้ช่องนั้นอย่างเดียว ไม่เด้งไปอีกช่องเอง — จะแก้อีกช่องต้องแตะช่องนั้นก่อน
//   แตะวันเดียวกันซ้ำ 2 ครั้งติดกัน = เลือก 1 วัน (ทั้งสองช่องเป็นวันนั้น)
//   เลือกแล้วช่วงกลับด้าน → อีกฝั่งเลื่อนตามมาเป็นวันเดียวกัน (ไม่สลับ — ช่องที่ไม่ได้แตะต้องไม่เปลี่ยนเป็นวันอื่นเอง)
// lastTap = วันที่แตะครั้งก่อน (ล้างเมื่อเปิดปฏิทินใหม่ / สลับช่อง)
export function pickDay(range: DateRange, editing: EditSide, day: string, lastTap: string | null): { range: DateRange; lastTap: string } {
  if (day === lastTap) return { range: { start: day, end: day }, lastTap: day };
  if (editing === "start") return { range: { start: day, end: day > range.end ? day : range.end }, lastTap: day };
  return { range: { start: day < range.start ? day : range.start, end: day }, lastTap: day };
}

// สถานะของช่องวันหนึ่ง สำหรับวาดแถบช่วง
export function dayRole(day: string, range: DateRange): "single" | "start" | "end" | "inside" | "none" {
  const { start, end } = range;
  if (start === end) return day === start ? "single" : "none";
  if (day === start) return "start";
  if (day === end) return "end";
  return day > start && day < end ? "inside" : "none";
}

// ตาราง 12 เดือน: future = เลยวันล่าสุดที่เลือกได้ (กดไม่ได้) / inRange = มีวันในช่วงที่เลือก
export function monthState(year: number, month0: number, range: DateRange, maxDate: string) {
  const first = isoOf(year, month0, 1);
  const last = isoOf(year, month0, new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate());
  return { future: first > maxDate, inRange: first <= range.end && last >= range.start };
}
