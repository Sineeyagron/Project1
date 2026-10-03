import AsyncStorage from "@react-native-async-storage/async-storage";
import supabase from "./supabase";

// ช่อง "จดจำการเข้าสู่ระบบ" หน้า login
// ติ๊ก = จำไว้ (ค่าเริ่มต้น) / ไม่ติ๊ก = เปิดแอปครั้งหน้า (หรือรีโหลดหน้าเว็บ) ต้องล็อกอินใหม่
const REMEMBER_KEY = "labhub.remember";

export async function setRememberLogin(remember: boolean) {
  try {
    await AsyncStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  } catch {
    // เก็บค่าไม่ได้ = ใช้แบบจำไว้ตามปกติ
  }
}

// เรียกครั้งเดียวตอนเปิดแอป (app/_layout.tsx)
export async function applyRememberLogin() {
  try {
    if ((await AsyncStorage.getItem(REMEMBER_KEY)) === "0") {
      await AsyncStorage.removeItem(REMEMBER_KEY);
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch {
    // อ่านไม่ได้ = ไม่ทำอะไร
  }
}
