import { useCallback, useEffect, useState } from "react";
import supabase from "./supabase";
import { currentUser } from "./session";
import { useRefreshOnFocus } from "./nav";
import { useRealtime } from "./realtime";

// จำนวนแจ้งเตือนที่ยังไม่อ่านของผู้ใช้ปัจจุบัน (นับอย่างเดียว ไม่ดึงข้อมูลแถว = เบามาก)
// โหลดใหม่เมื่อ: เปิดหน้า / กลับมาหน้านี้ / มีแจ้งเตือนใหม่ผ่าน Realtime
export function useUnreadCount() {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    const user = await currentUser();
    if (!user) return;
    const { count: c } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setCount(c || 0);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(() => { load(); });
  useRealtime("user", "notification", () => { load(); });

  return count;
}
