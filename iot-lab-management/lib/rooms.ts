import supabase from "./supabase";

// ห้องคอมของระบบห้อง (ตาราง rooms) — ทุกหน้าของระบบห้องอ่านรายชื่อห้องจากที่นี่
// (เดิมแต่ละหน้าเดาห้องจากเครื่อง/LAN ที่มีอยู่ หรือเขียน "CP9524", "SC9604" ตายตัว)
// ห้ามใช้ร่วมกับ borrow_locations ของระบบยืม-คืน

export type Room = {
  id: string; // รหัสห้อง เช่น CP9524
  building: string;
  floor: string | null;
  sort_order: number;
  active: boolean;
};

// รหัสห้อง: ตัวพิมพ์ใหญ่/ตัวเลข/ขีด 2–20 ตัว (ตรงกับ CHECK ในฐานข้อมูล)
export const ROOM_CODE_RE = /^[A-Z0-9-]{2,20}$/;

// "อาคารคอมพิวเตอร์ ชั้น 5"
export function roomPlace(room?: Room | null) {
  if (!room) return "ห้องปฏิบัติการ";
  const text = [room.building, room.floor ? `ชั้น ${room.floor}` : ""].filter(Boolean).join(" ");
  return text || "ห้องปฏิบัติการ";
}

// ห้องที่เปิดอยู่ (ค่าเริ่มต้น) หรือทุกห้อง (หน้าจัดการห้องของ Admin)
export async function fetchRooms(includeInactive = false) {
  let query = supabase.from("rooms").select("*").order("sort_order").order("id");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  return { rooms: (data as Room[]) || [], error };
}
