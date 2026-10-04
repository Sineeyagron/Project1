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

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // ห้าม navigate ก่อน Root Layout mount (ดู CLAUDE.md) → setTimeout 0
        setTimeout(() => router.replace("/login"), 0);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!isStaffRole(profile?.role)) {
        setTimeout(() => router.replace("/home"), 0);
        return;
      }
      if (active) {
        setUserId(session.user.id);
        setRole(profile.role);
      }
    })();

    return () => { active = false; };
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
