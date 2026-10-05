import supabase from "./supabase";

// แสดงตัวผู้ยืมในหน้าผู้ดูแล: "ชื่อ-นามสกุล · รหัส นศ." (ไม่มีชื่อ → อีเมล)
// ชื่อ/รูปมาจาก Google, รหัส นศ. นักศึกษากรอกเอง (migration profile_student_id)
export const PERSON_COLS = "email, full_name, student_id";

export type Person = { email?: string | null; full_name?: string | null; student_id?: string | null } | null | undefined;

export function who(p: Person) {
  if (!p) return "-";
  const name = p.full_name || p.email || "-";
  return p.student_id ? `${name} · ${p.student_id}` : name;
}

// ฐานข้อมูลที่ยังไม่ได้รัน migration profile_student_id ไม่มีคอลัมน์ full_name/student_id
// → query ทั้งก้อน error (42703) แล้วหน้าผู้ดูแลว่างเปล่า / ลองใหม่แบบอีเมลอย่างเดียว ให้ใช้งานต่อได้
export const isMissingColumn = (error: any) => error?.code === "42703" || /column .* does not exist/i.test(error?.message || "");

// ดึงข้อมูลคนตาม id (อีเมล + ชื่อ + รหัส นศ. ถ้ามี) — ใช้ในหน้าประวัติ / สแกนดูสถานะ / รายงาน
export async function fetchPeople(ids: string[]) {
  if (ids.length === 0) return [] as any[];
  const first = await supabase.from("profiles").select(`id, ${PERSON_COLS}`).in("id", ids);
  if (!first.error) return first.data || [];
  if (!isMissingColumn(first.error)) return [];
  const fallback = await supabase.from("profiles").select("id, email").in("id", ids);
  return fallback.data || [];
}
