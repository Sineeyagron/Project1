import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import supabase from "../../lib/supabase";

// ด่านตรวจทุกหน้าใน app/admin/ — ไม่ใช่ admin ให้กลับหน้าผู้ใช้
// (กันแค่ฝั่งแอปเพื่อ UX สิทธิ์จริงอยู่ที่ RLS ในฐานข้อมูล)
export default function AdminLayout() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

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

      if (profile?.role !== "admin") {
        setTimeout(() => router.replace("/home"), 0);
        return;
      }
      if (active) setAllowed(true);
    })();

    return () => { active = false; };
  }, []);

  if (!allowed) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#eef3f8" }}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
