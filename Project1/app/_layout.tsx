import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import * as Linking from "expo-linking";
import supabase from "../lib/supabase";

export default function Layout() {
  const router = useRouter();

  useEffect(() => {

    // ── วิธีที่ 1: onAuthStateChange ─────────────────────────────────────
    // Supabase SDK จะ "ฟัง" อยู่ตลอดว่ามี session เปลี่ยนแปลงไหม
    // เมื่อ user กดลิงก์รีเซ็ตรหัส → event จะเป็น "PASSWORD_RECOVERY"
    // ตอนนั้นเราแค่พาไปหน้า reset-password ได้เลย
    // วิธีนี้น่าเชื่อถือกว่า deep link เพราะ Supabase SDK จัดการ token เอง
    // ────────────────────────────────────────────────────────────────────
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("AUTH EVENT:", event);
        if (event === "PASSWORD_RECOVERY") {
          router.replace("/reset-password");
        }
      }
    );

    // ── วิธีที่ 2: Deep Link (fallback) ──────────────────────────────────
    // กรณีที่ onAuthStateChange ไม่ทำงาน ยังมี deep link เป็น backup
    // Supabase v2 ส่ง token มาใน hash (#) ไม่ใช่ query string (?)
    // เลยต้อง split('#') แล้ว parse เองด้วย URLSearchParams
    // ────────────────────────────────────────────────────────────────────
    const handleUrl = async (url: string) => {
      console.log("DEEPLINK:", url);

      const hashPart = url.split("#")[1];
      if (hashPart) {
        const hashParams = new URLSearchParams(hashPart);
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        if (access_token && refresh_token) {
          // set session ให้ Supabase รู้ว่า user คนนี้ผ่าน recovery แล้ว
          await supabase.auth.setSession({ access_token, refresh_token });

          // ถ้าเป็น recovery link → ไปหน้าเปลี่ยนรหัส
          if (type === "recovery") {
            router.replace("/reset-password");
          }
          return;
        }
      }

      // fallback: query string
      const parsed = Linking.parse(url);
      const access_token = parsed.queryParams?.access_token;
      const refresh_token = parsed.queryParams?.refresh_token;

      if (access_token && refresh_token) {
        const tokenA = Array.isArray(access_token) ? access_token[0] : access_token;
        const tokenR = Array.isArray(refresh_token) ? refresh_token[0] : refresh_token;
        await supabase.auth.setSession({ access_token: tokenA, refresh_token: tokenR });
        router.replace("/reset-password");
        return;
      }

      if (url.includes("reset-password")) {
        router.replace("/reset-password");
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    return () => {
      authListener.subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="home" />
      <Stack.Screen name="roommap" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="sittings" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="borrow" />
      <Stack.Screen name="forgot" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
