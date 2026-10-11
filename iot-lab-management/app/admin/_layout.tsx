import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import supabase from "../../lib/supabase";
import { notify } from "../../lib/notify";
import { canAccess, isAdminPath, isStaffRole, Role, RoleContext } from "../../lib/roles";

// ด่านตรวจทุกหน้าใน app/admin/ — admin เข้าได้ทุกหน้า / TA เข้าได้เฉพาะหน้าที่อนุญาต (lib/roles.ts) / อื่นๆ กลับหน้าผู้ใช้
// (กันแค่ฝั่งแอปเพื่อ UX สิทธิ์จริงอยู่ที่ RLS ในฐานข้อมูล)
export default function AdminLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let loadedFor: string | null = null;

    const load = async (first = false) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      if (!session) {
        loadedFor = null;
        setRole(null);
        setUserId(null);
        // ออกจากระบบ = ปุ่มออกพาไป login เองแล้ว / เปิดมาไม่มี session = พาไปเอง
        // ห้าม navigate ก่อน Root Layout mount (ดู CLAUDE.md) → setTimeout 0
        if (first) setTimeout(() => router.replace("/login"), 0);
        return;
      }
      loadedFor = session.user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!active || loadedFor !== session.user.id) return;

      if (!isStaffRole(profile?.role)) {
        setRole(null);
        setTimeout(() => router.replace("/home"), 0);
        return;
      }
      setUserId(session.user.id);
      setRole(profile.role);
    };

    load(true);

    // layout นี้ค้างอยู่ตอนออกจากระบบ → เปลี่ยนบัญชี (เช่น TA → admin) ต้องโหลดบทบาทใหม่ ไม่งั้นใช้บทบาทเก่า
    // ห้าม await supabase ใน callback นี้ (ค้าง) → setTimeout 0
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return; // load(true) ข้างบนทำแล้ว
      if ((session?.user.id ?? null) !== loadedFor) setTimeout(() => load(), 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // TA เปิดหน้า admin ที่ไม่มีสิทธิ์ (เช่น ลิงก์เก่า / พิมพ์ URL เอง) → กลับหน้าแรก
  // layout นี้ยังค้างอยู่ใต้หน้าอื่น (แจ้งเตือน, หน้านักศึกษา) → ตรวจเฉพาะ path ที่ขึ้นต้นด้วย /admin
  const blocked = !!role && isAdminPath(pathname) && !canAccess(role, pathname);
  useEffect(() => {
    if (blocked) {
      notify("หน้านี้สำหรับผู้ดูแลระบบ", "บัญชี TA ใช้หน้านี้ไม่ได้");
      router.replace("/admin/home");
    }
  }, [blocked]);

  // ระหว่างรอเช็กสิทธิ์ / กำลังพากลับ ไม่แสดงหน้าที่ไม่มีสิทธิ์
  if (!role || blocked) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF1FC" }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <RoleContext.Provider value={{ role, userId }}>
      <Stack screenOptions={{ headerShown: false }} />
    </RoleContext.Provider>
  );
}
