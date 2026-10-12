import { useCallback, useEffect, useState } from "react";
import supabase from "./supabase";
import { currentUser } from "./session";
import { useRefreshOnFocus } from "./nav";
import { useRealtime } from "./realtime";

// แจ้งตัวนับทุกตัวในแอปให้โหลดใหม่ — เรียกหลังกด "อ่านแล้ว" (การอ่านไม่มีสัญญาณ Realtime ส่งมา
// เลขบนกระดิ่งแถบล่างเลยค้างเลขเดิมจนกว่าจะเปลี่ยนหน้า)
const listeners = new Set<() => void>();
export function refreshUnreadCount() {
  listeners.forEach((fn) => fn());
}
// ตัวนับอื่น (เช่น เลขแจ้งเตือนในเมนูซ้ายจอใหญ่) ขอรับสัญญาณเดียวกัน → คืนฟังก์ชันเลิกฟัง
export function onUnreadRefresh(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// จำนวนแจ้งเตือนที่ยังไม่อ่านของผู้ใช้ปัจจุบัน (นับอย่างเดียว ไม่ดึงข้อมูลแถว = เบามาก)
// ใช้ที่แถบเมนูล่าง = โหมดนักศึกษา → นับเฉพาะเรื่องของตัวเอง (for_staff = งานผู้ดูแล นับที่กระดิ่งแดชบอร์ด)
// โหลดใหม่เมื่อ: เปิดหน้า / กลับมาหน้านี้ / มีแจ้งเตือนใหม่ผ่าน Realtime / มีการกดอ่าน
export function useUnreadCount() {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    const user = await currentUser();
    if (!user) return;
    const { count: c } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("for_staff", false)
      .eq("read", false);
    setCount(c || 0);
  }, []);

  useEffect(() => {
    load();
    listeners.add(load);
    return () => { listeners.delete(load); };
  }, [load]);
  useRefreshOnFocus(() => { load(); });
  useRealtime("user", "notification", () => { load(); });

  return count;
}
