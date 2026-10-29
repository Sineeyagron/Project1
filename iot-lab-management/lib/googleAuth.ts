import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import supabase from "./supabase";

// ล็อกอินด้วย Google (เฟส 4.2) — อีเมล มข.: นักศึกษา @kkumail.com / อาจารย์-บุคลากร @kku.ac.th
// - hd=<โดเมน>: พิมพ์อีเมล มข. ไว้แล้ว → หน้าเลือกบัญชีของ Google แสดงเฉพาะโดเมนนั้น (แค่ช่วยผู้ใช้ ไม่ใช่ด่านจริง)
// - ด่านจริง: Auth Hook "before user created" ในฐานข้อมูล (hook_restrict_signup_domain) + เช็กซ้ำในแอปหลังล็อกอิน
// เว็บ: เปลี่ยนหน้าไป Google แล้วกลับมา /login (supabase-js อ่าน token จาก URL ให้เอง)
// มือถือ: เปิดหน้าล็อกอินในเบราว์เซอร์ของแอป แล้วรับ token กลับทาง deep link (Expo Go = exp://.../--/login)

export const ALLOWED_DOMAIN = "kkumail.com"; // นักศึกษา
export const STAFF_DOMAIN = "kku.ac.th"; // อาจารย์/บุคลากร มข. (ทุกคณะ) — เข้าครั้งแรกเป็นผู้ใช้ทั่วไป admin ตั้งสิทธิ์ให้เอง
export const UNI_DOMAINS = [ALLOWED_DOMAIN, STAFF_DOMAIN];

const domainOf = (email: string | null | undefined) => {
  const e = (email || "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  return at > 0 ? e.slice(at + 1) : "";
};
export const isUniEmail = (email: string | null | undefined) => UNI_DOMAINS.includes(domainOf(email));
export const isStaffEmail = (email: string | null | undefined) => domainOf(email) === STAFF_DOMAIN;

WebBrowser.maybeCompleteAuthSession();

// โดเมนที่รับ = app_settings.allowed_email_domain ("kkumail.com,kku.ac.th" — ใช้จริงแล้ว ไม่มีสวิตช์ในแอป แก้ได้จาก SQL เท่านั้น)
// ว่าง = ทุกบัญชีใช้ได้ · ฝั่งเซิร์ฟเวอร์กันซ้ำด้วย Auth Hook hook_restrict_signup_domain
export async function getAllowedDomains(): Promise<string[]> {
  const { data } = await supabase.from("app_settings").select("value").eq("key", "allowed_email_domain").maybeSingle();
  return typeof data?.value === "string" ? parseDomains(data.value) : [];
}
export const parseDomains = (value: string) => value.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);

// โดเมนพิมพ์ผิดไม่เกิน 2 ตัวอักษรจาก kkumail.com (เช่น kkmail.com, kkumial.com, kkumail.co) → อีเมลที่แก้แล้ว / ไม่ใช่ = null
//   ใช้เสนอแก้ในหน้า login — gmail.com / hotmail.com / kku.ac.th ห่างเกิน 2 ตัว จึงไม่ถูกเสนอ
export function uniEmailTypoFix(email: string): string | null {
  const e = email.trim().toLowerCase().replace(/\s+/g, "");
  const at = e.lastIndexOf("@");
  if (at <= 0) return null;
  const domain = e.slice(at + 1);
  if (!domain.includes(".") || domain === ALLOWED_DOMAIN) return null;
  return editDistance(domain, ALLOWED_DOMAIN) <= 2 ? `${e.slice(0, at)}@${ALLOWED_DOMAIN}` : null;
}

function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

export const isAllowedEmail = (email: string | null | undefined, domains: string[]) =>
  domains.length === 0 || domains.includes(domainOf(email));

// ข้อความ error จาก Supabase/Google → ภาษาไทยที่ผู้ใช้เข้าใจ
function friendlyError(raw: string) {
  const msg = decodeURIComponent(raw.replace(/\+/g, " "));
  if (/provider is not enabled|Unsupported provider/i.test(msg)) return "ระบบยังไม่ได้เปิดล็อกอินด้วย Google (ผู้ดูแลต้องตั้งค่าใน Supabase ก่อน)";
  if (/kkumail|kku\.ac\.th|domain|โดเมน/i.test(msg)) return `ใช้ได้เฉพาะอีเมล มข. (@${ALLOWED_DOMAIN}, @${STAFF_DOMAIN}) — ${msg}`;
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

// loginHint = อีเมล มข. ที่พิมพ์ในหน้า login แล้ว → Google กรอกอีเมลให้ ใส่แค่รหัส
//   ไม่ได้พิมพ์ = ไม่ล็อกโดเมน (มีทั้ง นศ. และบุคลากร) ให้เลือกบัญชีเอง — ด่านจริงอยู่ที่ Auth Hook
export async function signInWithGoogle(loginHint?: string): Promise<{ ok?: boolean; cancelled?: boolean; error?: string }> {
  const queryParams: Record<string, string> = loginHint
    ? { hd: domainOf(loginHint) || ALLOWED_DOMAIN, login_hint: loginHint }
    : { prompt: "select_account" };

  if (Platform.OS === "web") {
    // จำไว้ว่ากำลังไป Google — ขากลับ supabase-js อ่าน token แล้วลบออกจาก URL ก่อนหน้า login แสดงได้ (รอฟอนต์)
    //   หน้า login เลยเช็กป้ายนี้ + session แทนการดู URL (oauthReturned)
    try { sessionStorage.setItem(OAUTH_FLAG, "1"); } catch {}
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
const OAUTH_FLAG = "labhub.oauth";

// เว็บ: เพิ่งกลับมาจาก Google ใช่ไหม (ใช้ครั้งเดียว) — ดูทั้งป้ายที่ตั้งก่อนออกไป และ token/code ที่อาจยังอยู่ใน URL
export function oauthReturned(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  let flag = false;
  try {
    flag = sessionStorage.getItem(OAUTH_FLAG) === "1";
    sessionStorage.removeItem(OAUTH_FLAG);
  } catch {}
  return flag || /access_token|[?&]code=/.test(window.location.href);
}

export function webRedirectError(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const params = readParams(window.location.href);
  const raw = params.error_description || params.error;
  return raw ? friendlyError(raw) : null;
}
