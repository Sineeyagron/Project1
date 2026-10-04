import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import * as Linking from "expo-linking";
import supabase from "../lib/supabase";
import { DialogHost } from "../lib/notify";
import { applyRememberLogin } from "../lib/session";
import { isAdminPath } from "../lib/roles";
import { useFonts, NotoSansThai_400Regular, NotoSansThai_500Medium, NotoSansThai_600SemiBold, NotoSansThai_700Bold } from "@expo-google-fonts/noto-sans-thai";
import { C } from "../lib/theme";

// หน้าที่เปิดได้โดยไม่ต้องล็อกอิน (หน้าอื่นทั้งหมดต้องล็อกอิน — หน้า /admin มีด่านของตัวเองใน app/admin/_layout.tsx)
const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/forgot", "/reset-password"]);

export default function Layout() {
  const router = useRouter();
  const pathname = usePathname();
  // ฟอนต์เดียวทั้งแอป (ไทย + อังกฤษ) — ดู components/AppText.tsx
  const [fontsLoaded, fontError] = useFonts({ NotoSansThai_400Regular, NotoSansThai_500Medium, NotoSansThai_600SemiBold, NotoSansThai_700Bold });

  // ด่านหน้านักศึกษา: ยังไม่ล็อกอิน (เช่น เปิดลิงก์ตรง / session หมดอายุ) → ไปหน้าล็อกอิน
  // เดิมเปิดได้แต่ข้อมูลว่างและ error 401 เพราะ RLS กันไว้
  useEffect(() => {
    if (PUBLIC_PATHS.has(pathname) || isAdminPath(pathname)) return;
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && !session) setTimeout(() => router.replace("/login"), 0);
    });
    return () => { active = false; };
  }, [pathname]);

  useEffect(() => {
    // ไม่ได้ติ๊ก "จดจำการเข้าสู่ระบบ" ตอนล็อกอินครั้งก่อน → ออกจากระบบตอนเปิดแอปใหม่
    applyRememberLogin();

    // ── วิธีที่ 1: onAuthStateChange ─────────────────────────────────────
    // Supabase SDK จะ "ฟัง" อยู่ตลอดว่ามี session เปลี่ยนแปลงไหม
    // เมื่อ user กดลิงก์รีเซ็ตรหัส → event จะเป็น "PASSWORD_RECOVERY"
    // ตอนนั้นเราแค่พาไปหน้า reset-password ได้เลย
    // วิธีนี้น่าเชื่อถือกว่า deep link เพราะ Supabase SDK จัดการ token เอง
    // ────────────────────────────────────────────────────────────────────
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setTimeout(() => router.replace("/reset-password"), 0);
          return;
        }
        // ถ้า logout → ไปหน้า login
        if (event === "SIGNED_OUT") {
          setTimeout(() => router.replace("/login"), 0);
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
            setTimeout(() => router.replace("/reset-password"), 0);
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
        setTimeout(() => router.replace("/reset-password"), 0);
        return;
      }

      // ลิงก์รีเซ็ตจากอีเมล → หน้าตั้งรหัสใหม่ (ยกเว้นโหมดเปลี่ยนรหัสจากหน้าโปรไฟล์ ไม่งั้นพารามิเตอร์หาย)
      if (url.includes("reset-password") && !url.includes("mode=change")) {
        setTimeout(() => router.replace("/reset-password"), 0);
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

  if (!fontsLoaded && !fontError) return null;

  return (
    <>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      {/* Auth */}
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot" />
      <Stack.Screen name="reset-password" />
      {/* User */}
      <Stack.Screen name="home" />
      <Stack.Screen name="equipment" />
      <Stack.Screen name="roommap" />
      <Stack.Screen name="lanstatus" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="sittings" />
      <Stack.Screen name="student-id" options={{ gestureEnabled: false }} />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="borrow" />
      <Stack.Screen name="scan" />
      {/* Admin — ทุกหน้าใน app/admin/ ผ่านด่านเช็กสิทธิ์ใน app/admin/_layout.tsx */}
      <Stack.Screen name="admin" />
    </Stack>
    {/* หน้าต่างแจ้งเตือน/ยืนยันของ notify() / confirmAction() บนเว็บ */}
    <DialogHost />
    </>
  );
}
