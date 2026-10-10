import supabase from "./supabase";

// ชื่อคนในหน้าระบบห้อง (ผู้แจ้ง / ผู้ซ่อม / ผู้เปลี่ยนสถานะ): "ชื่อ · รหัส นศ." (ไม่มีชื่อ → ส่วนหน้า @ ของอีเมล)
// ของระบบห้องเอง — ห้าม import lib/people.ts ของระบบยืม-คืน (แยกระบบเด็ดขาด)
export async function fetchRoomPeople(ids: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (ids.length === 0) return map;
  const { data } = await supabase.from("profiles").select("id, email, full_name, student_id").in("id", ids);
  (data || []).forEach((p: any) => {
    const name = p.full_name || (p.email || "").split("@")[0] || "-";
    map[p.id] = p.student_id ? `${name} · ${p.student_id}` : name;
  });
  return map;
}
