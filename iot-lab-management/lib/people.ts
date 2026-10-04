// แสดงตัวผู้ยืมในหน้าผู้ดูแล: "ชื่อ-นามสกุล · รหัส นศ." (ไม่มีชื่อ → อีเมล)
// ชื่อ/รูปมาจาก Google, รหัส นศ. นักศึกษากรอกเอง (migration profile_student_id)
export const PERSON_COLS = "email, full_name, student_id";

export type Person = { email?: string | null; full_name?: string | null; student_id?: string | null } | null | undefined;

export function who(p: Person) {
  if (!p) return "-";
  const name = p.full_name || p.email || "-";
  return p.student_id ? `${name} · ${p.student_id}` : name;
}
