import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import supabase from "./supabase";

// ล็อกอินด้วย Google (เฟส 4.2) — ใช้ได้เฉพาะอีเมล @kkumail.com
// - hd=kkumail.com: หน้าเลือกบัญชีของ Google แสดงเฉพาะบัญชีโดเมนนี้ (แค่ช่วยผู้ใช้ ไม่ใช่ด่านจริง)
// - ด่านจริง: Auth Hook "before user created" ในฐานข้อมูล (hook_restrict_signup_domain) + เช็กซ้ำในแอปหลังล็อกอิน
// เว็บ: เปลี่ยนหน้าไป Google แล้วกลับมา /login (supabase-js อ่าน token จาก URL ให้เอง)
// มือถือ: เปิดหน้าล็อกอินในเบราว์เซอร์ของแอป แล้วรับ token กลับทาง deep link (Expo Go = exp://.../--/login)

export const ALLOWED_DOMAIN = "kkumail.com";

WebBrowser.maybeCompleteAuthSession();

// สวิตช์ "รับเฉพาะ @kkumail.com" อยู่ใน app_settings.allowed_email_domain (ว่าง = ทุกบัญชีใช้ได้ — ช่วงพัฒนา)
// เปิดตอน Final Project ที่หน้าตั้งค่าระบบ (+ เปิด Auth Hook ใน Supabase)
export async function getAllowedDomain(): Promise<string> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "allowed_email_domain").maybeSingle();
  return typeof data?.value === "string" ? data.value.trim().toLowerCase() : "";
}

export const isAllowedEmail = (email: string | null | undefined, domain: string) =>
  !domain || (!!email && email.trim().toLowerCase().endsWith(`@${domain}`));

// ข้อความ error จาก Supabase/Google → ภาษาไทยที่ผู้ใช้เข้าใจ
function friendlyError(raw: string) {
  const msg = decodeURIComponent(raw.replace(/\+/g, " "));
  if (/provider is not enabled|Unsupported provider/i.test(msg)) return "ระบบยังไม่ได้เปิดล็อกอินด้วย Google (ผู้ดูแลต้องตั้งค่าใน Supabase ก่อน)";
  if (/kkumail|domain|โดเมน/i.test(msg)) return `ใช้ได้เฉพาะอีเมล @${ALLOWED_DOMAIN} — ${msg}`;
  if (/access_denied/i.test(msg)) return "ยกเลิกการเข้าสู่ระบบ หรือ Google ไม่อนุญาต";
  return msg;
}

function readParams(url: string) {
  const out: Record<string, string> = {};
  const [beforeHash, hash = ""] = url.split("#");
  const query = beforeHash.split("?")[1] || "";
  for (const part of [query, hash]) {
    new URLSearchParams(part).forEach((v, k) => { out[k] = v; });
  }
  return out;
}

export async function signInWithGoogle(): Promise<{ ok?: boolean; cancelled?: boolean; error?: string }> {
  const queryParams = { hd: ALLOWED_DOMAIN, prompt: "select_account" };

  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login`, queryParams },
    });
    // สำเร็จ = เบราว์เซอร์ออกจากหน้านี้ไป Google แล้ว
    return error ? { error: friendlyError(error.message) } : { ok: true };
  }

  const redirectTo = Linking.createURL("/login");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return { error: friendlyError(error?.message || "เปิดหน้า Google ไม่ได้") };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return { cancelled: true };

  const params = readParams(result.url);
  if (params.error || params.error_description) {
    return { error: friendlyError(params.error_description || params.error) };
  }
  if (params.access_token && params.refresh_token) {
    const { error: setErr } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    return setErr ? { error: friendlyError(setErr.message) } : { ok: true };
  }
  if (params.code) {
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(params.code);
    return exErr ? { error: friendlyError(exErr.message) } : { ok: true };
  }
  return { error: "ไม่ได้รับข้อมูลการเข้าสู่ระบบจาก Google ลองใหม่อีกครั้ง" };
}

// อ่าน error ที่ Supabase ส่งกลับมาใน URL หลังล็อกอินบนเว็บ (เช่น โดเมนไม่ผ่าน)
export function webRedirectError(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const params = readParams(window.location.href);
  const raw = params.error_description || params.error;
  return raw ? friendlyError(raw) : null;
}
