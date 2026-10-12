import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import supabase from "../lib/supabase";
import { DialogHost } from "../lib/notify";
import { applyRememberLogin } from "../lib/session";
import { dropPushOnSignOut, registerServiceWorker } from "../lib/webPush";
import { installPullToRefresh } from "../lib/webPullRefresh";
import { captureInstallPrompt } from "../lib/installApp";
import { isAdminPath } from "../lib/roles";
import { useFonts, NotoSansThai_400Regular, NotoSansThai_500Medium, NotoSansThai_600SemiBold, NotoSansThai_700Bold } from "@expo-google-fonts/noto-sans-thai";
import { C } from "../lib/theme";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { PHONE_COLUMN_WIDTH, useIsDesktop } from "../lib/layout";
import type { NativeStackNavigationOptions } from "expo-router";

// หน้าที่เปิดได้โดยไม่ต้องล็อกอิน (หน้าอื่นทั้งหมดต้องล็อกอิน — หน้า /admin มีด่านของตัวเองใน app/admin/_layout.tsx)
const PUBLIC_PATHS = new Set(["/", "/login"]);

// แผ่นมาตรฐานของ iOS (UISheetPresentationController ผ่าน react-native-screens): ขีดจับ + ปัดลงปิด
//   iOS เลื่อนแผ่น/จางฉากเทาเอง → 120Hz แม้ใน Expo Go (แผ่นที่เลื่อนด้วย Animated ถูกจำกัด 60Hz = รู้สึกหน่วง) — เจ้าของโปรเจกต์เลือก 11 ต.ค. 2569
//   ความสูง: แต่ละแผ่นตั้งเองให้พอดีเนื้อหา (lib/sheetFit) — ค่าตรงนี้เป็นค่าเริ่มต้นเผื่อไว้
const SHEET: NativeStackNavigationOptions = {
  presentation: "formSheet",
  sheetAllowedDetents: [0.6],
  sheetGrabberVisible: true,
  sheetCornerRadius: 28,
  contentStyle: { backgroundColor: C.surface },
};

export default function Layout() {
  const router = useRouter();
  const pathname = usePathname();
  // จอใหญ่ + หน้า admin = ใช้เต็มจอ (มีเมนูซ้ายของ app/admin/_layout) / ที่เหลือ = แท่งแบบมือถือกลางจอ
  //   แผ่น (sheet-host) เปิดทับหน้าเดิม → ใช้ค่าของหน้าเดิม ไม่ให้พื้นหลังหดตอนเปิดแผ่น
  const isDesktop = useIsDesktop();
  const lastPage = useRef(pathname);
  if (pathname !== "/sheet-host") lastPage.current = pathname;
  const wide = isDesktop && isAdminPath(lastPage.current);
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
    // เว็บ/PWA: service worker (cache + Web Push) — แตะแจ้งเตือนตอนแอปเปิดอยู่ → ไปหน้านั้น (มือถือไม่ทำอะไร)
    registerServiceWorker((path) => router.push(path as any));
    // เว็บ: ลากลงเพื่อรีเฟรช (RefreshControl ของ React Native ไม่ทำงานบนเว็บ)
    installPullToRefresh();
    // เว็บ Android: เก็บสิทธิ์เปิดหน้าต่างติดตั้งไว้ให้ปุ่ม "ติดตั้งแอป" หน้า login
    captureInstallPrompt();

    // ออกจากระบบ → หน้า login (ระบบลืมรหัสผ่าน/ลิงก์รีเซ็ตทางอีเมลถอดออกแล้ว 12 ต.ค. 2569)
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      // เครื่องนี้เลิกรับแจ้งเตือนของบัญชีที่ออกไป (เว็บเท่านั้น)
      dropPushOnSignOut();
      setTimeout(() => router.replace("/login"), 0);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (!fontsLoaded && !fontError) return null;

  // KeyboardProvider: ติดตามแป้นพิมพ์ฝั่ง native ทีละเฟรม (แผ่นเลื่อน/หน้าต่างเด้ง/หน้าเลื่อน หลบแป้นได้ลื่น — react-native-keyboard-controller)
  return (
    <KeyboardProvider>
    {/* เว็บจอกว้าง (คอม) → ล็อกแอปเป็นแท่งกว้างแบบจอมือถือไว้กลางจอ / มือถือจริงแคบกว่าอยู่แล้ว ไม่เปลี่ยน */}
    <View style={frame.outer}>
    <View style={[frame.app, wide && frame.wide]}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      {/* Auth */}
      <Stack.Screen name="login" />
      {/* เปลี่ยนรหัสผ่าน (จากหน้าโปรไฟล์ ต้องล็อกอิน) */}
      <Stack.Screen name="reset-password" />
      {/* User */}
      <Stack.Screen name="home" />
      <Stack.Screen name="equipment" />
      <Stack.Screen name="roommap" />
      <Stack.Screen name="lanstatus" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="student-id" options={{ gestureEnabled: false }} />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="borrow" />
      <Stack.Screen name="scan" />
      {/* แผ่นรายละเอียดรุ่น (หน้าอุปกรณ์) + แผ่นขอยืมแบบนัดรับ (F2) */}
      <Stack.Screen name="equipment-sheet" options={SHEET} />
      <Stack.Screen name="pickup-sheet" options={SHEET} />
      {/* แผ่นของ <BottomSheet> ทุกตัว (components/BottomSheet → lib/sheetHost) */}
      <Stack.Screen name="sheet-host" options={SHEET} />
      {/* Admin — ทุกหน้าใน app/admin/ ผ่านด่านเช็กสิทธิ์ใน app/admin/_layout.tsx */}
      <Stack.Screen name="admin" />
    </Stack>
    {/* ป๊อปอัปของ notify() / confirmAction() ทั้งแอป (ในหน้าต่าง Modal มี DialogHost ของตัวเอง) */}
    <DialogHost />
    </View>
    </View>
    </KeyboardProvider>
  );
}

// แอปออกแบบสำหรับจอมือถือ — บนเว็บจอกว้างไม่ยืดเต็มจอ (เจ้าของโปรเจกต์เลือก 12 ต.ค. 2569)
const frame = StyleSheet.create({
  outer: Platform.OS === "web"
    ? { flex: 1, alignItems: "center", backgroundColor: "#D5E2F7" }
    : { flex: 1 },
  app: Platform.OS === "web"
    ? { flex: 1, width: "100%", maxWidth: PHONE_COLUMN_WIDTH, overflow: "hidden", backgroundColor: C.bg, boxShadow: "0 0 32px rgba(23,32,51,0.12)" }
    : { flex: 1 },
  wide: { maxWidth: "100%" as any, boxShadow: "none" },
});
