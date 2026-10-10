import supabase from "./supabase";

// กฎการยืม-คืน (F1) — ข้อความเก็บใน app_settings.borrow_rules (Admin แก้ได้ที่หน้าตั้งค่าระบบ)
// ตัวแปร {max} {days} {expiry} แทนด้วยค่าจาก app_settings ตอนแสดงผล ใช้ร่วม: ป๊อปอัปยืนยัน (scan) / โปรไฟล์ / ตั้งค่า

export const DEFAULT_RULES = [
  "ยืมพร้อมกันได้สูงสุด {max} ชิ้น (นับรวมคำขอที่รออนุมัติ)",
  "เลือกระยะยืมได้ {days} วัน",
  "ต้องถ่ายรูปและระบุสภาพทุกครั้งที่ยืมและคืน",
  "คำขอรอผู้ดูแลอนุมัติภายใน {expiry} นาที ไม่มีคนตอบ: ขอยืม = หมดอายุ / ขอคืน = คืนอัตโนมัติ (ผู้ดูแลตรวจย้อนหลัง)",
  "คืนแล้วของชำรุด อาจมีค่าเสียหาย",
  "ยืมต่อได้ 1 ครั้ง ต้องขอภายในวันครบกำหนด วันที่เพิ่มนับต่อจากวันครบกำหนดเดิม",
];

export const RULE_KEYS = ["borrow_rules", "max_active_borrows", "borrow_day_options", "request_expiry_minutes"];

export type RuleVars = { max: number; days: number[]; expiry: number };

const asJson = (v: any) => {
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return v; } }
  return v;
};

// แถว app_settings (key, value) → ข้อความกฎดิบ (ยังไม่แทนตัวแปร) / ไม่มีหรือผิดรูป = ค่าตั้งต้น
export function rulesFromRows(rows: any[]): string[] {
  const v = asJson(rows.find((r) => r.key === "borrow_rules")?.value);
  const list = Array.isArray(v) ? v.filter((t) => typeof t === "string" && t.trim()) : [];
  return list.length ? list : DEFAULT_RULES;
}

export function varsFromRows(rows: any[]): RuleVars {
  const num = (key: string, fallback: number) => {
    const n = Number(rows.find((r) => r.key === key)?.value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const d = asJson(rows.find((r) => r.key === "borrow_day_options")?.value);
  const days = Array.isArray(d) && d.length ? d.map(Number).filter((n) => n > 0) : [3, 5, 7];
  return { max: num("max_active_borrows", 3), days, expiry: num("request_expiry_minutes", 30) };
}

export function fillRule(text: string, vars: RuleVars) {
  return text
    .replace(/\{max\}/g, String(vars.max))
    .replace(/\{days\}/g, vars.days.join(" / "))
    .replace(/\{expiry\}/g, String(vars.expiry));
}

// โหลดกฎที่แทนตัวแปรแล้ว (โหลดไม่ได้ = ใช้ค่าตั้งต้น ไม่ให้ป๊อปอัปว่าง)
export async function fetchBorrowRules(): Promise<string[]> {
  const { data } = await supabase.from("app_settings").select("key, value").in("key", RULE_KEYS);
  const rows = data || [];
  const vars = varsFromRows(rows);
  return rulesFromRows(rows).map((t) => fillRule(t, vars));
}
