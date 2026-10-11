import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import supabase from "../lib/supabase";
import { DialogHost } from "../lib/notify";
import { applyRememberLogin } from "../lib/session";
import { isAdminPath } from "../lib/roles";
import { useFonts, NotoSansThai_400Regular, NotoSansThai_500Medium, NotoSansThai_600SemiBold, NotoSansThai_700Bold } from "@expo-google-fonts/noto-sans-thai";
import { C } from "../lib/theme";
import { KeyboardProvider } from "react-native-keyboard-controller";
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

    // ออกจากระบบ → หน้า login (ระบบลืมรหัสผ่าน/ลิงก์รีเซ็ตทางอีเมลถอดออกแล้ว 12 ต.ค. 2569)
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setTimeout(() => router.replace("/login"), 0);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (!fontsLoaded && !fontError) return null;

  // KeyboardProvider: ติดตามแป้นพิมพ์ฝั่ง native ทีละเฟรม (แผ่นเลื่อน/หน้าต่างเด้ง/หน้าเลื่อน หลบแป้นได้ลื่น — react-native-keyboard-controller)
  return (
    <KeyboardProvider>
    <View style={{ flex: 1 }}>
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
      {/* Admin — ทุกหน้าใน app/admin/ ผ่านด่านเช็กสิทธิ์ใน app/admin/_layout.tsx */}
      <Stack.Screen name="admin" />
    </Stack>
    {/* ป๊อปอัปของ notify() / confirmAction() ทั้งแอป (ในหน้าต่าง Modal มี DialogHost ของตัวเอง) */}
    <DialogHost />
    </View>
    </KeyboardProvider>
  );
}
