import { useCallback, useEffect, useState } from "react";
import supabase from "./supabase";
import { useRealtime } from "./realtime";
import { useRefreshOnFocus } from "./nav";

// F4 ผู้ดูแลอยู่ที่ IoT Lab ไหม (ระบบยืม-คืน) — เช็กอิน/เช็กเอาท์ผ่าน RPC, รายชื่อผ่าน lab_presence()
// อัปเดตสดด้วยสัญญาณช่อง "lab" (ไม่มี polling) · 17:00 ไทยฐานข้อมูลเช็กเอาท์ทุกคนเอง

export type PresentStaff = { user_id: string; role: string; name: string; checked_in_at: string };

export const PRESENCE_ROLE: Record<string, string> = { ta: "TA", admin: "Admin" };

export function usePresence() {
  const [list, setList] = useState<PresentStaff[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("lab_presence");
    if (error) setError(error.message);
    else {
      setError("");
      setList((data || []) as PresentStaff[]);
    }
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(() => { load(); });
  useRealtime("lab", "presence", () => { load(); });

  return { list, loaded, error, reload: load };
}

export async function staffCheckIn() {
  return supabase.rpc("staff_check_in");
}

export async function staffCheckOut() {
  return supabase.rpc("staff_check_out");
}

// เวลาเช็กอิน HH:mm (เวลาไทย)
export function checkinTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
