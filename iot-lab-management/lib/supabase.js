import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";

const supabaseUrl = "https://enupmlxmajjwskvzgcdq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudXBtbHhtYWpqd3NrdnpnY2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDIxMDUsImV4cCI6MjA4OTMxODEwNX0.px5ah-o_guGnQ8lTP7oJIwZXJEDiAcicuQTo3A_4aqE";

const isWeb = Platform.OS === "web";

// จำการล็อกอินไว้ในเครื่อง (มือถือ = AsyncStorage / เว็บ = localStorage ค่าเริ่มต้นของ supabase-js)
// เดิมไม่ได้ตั้ง storage → บนมือถือปิดแอปแล้วต้องล็อกอินใหม่ทุกครั้ง
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isWeb ? undefined : AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // มือถือรับ token จาก Google เองใน lib/googleAuth.ts / เว็บให้ supabase-js อ่านจาก URL
    detectSessionInUrl: isWeb,
  },
});

// มือถือ: ต่ออายุ token เฉพาะตอนแอปเปิดอยู่ (ตามคำแนะนำของ Supabase สำหรับ React Native)
if (!isWeb) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// ใช้กับการอัปโหลดผ่าน REST ตรง (FileSystem.uploadAsync ในมือถือ)
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

export default supabase;
