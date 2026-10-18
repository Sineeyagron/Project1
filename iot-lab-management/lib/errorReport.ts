import { Platform } from "react-native";
import Constants from "expo-constants";
import supabase from "./supabase";
import { isStandalone } from "./webPush";
import { currentUser } from "./session";

// ส่ง error ที่ไม่มีใครจับบนเครื่องผู้ใช้ไปเก็บที่ตาราง client_errors (RPC log_client_error — migration 20261019120000)
//   เว็บ: window "error" + "unhandledrejection" · มือถือ: ErrorUtils (ต่อจากตัวเดิม ไม่ทับ)
//   เบา: ต่อเครื่องไม่เกิน 10 รายการ/ครั้งที่เปิดแอป, ข้อความซ้ำส่งครั้งเดียว, ข้าม error เน็ตหลุด/เบราว์เซอร์ที่ไม่มีข้อมูล
//   ฐานข้อมูลกันซ้ำ/จำกัดจำนวนอีกชั้น · ยังไม่ล็อกอิน = ไม่บันทึก · ดูได้ที่ Supabase (เฉพาะ admin)
// ติดตั้งครั้งเดียวที่ app/_layout

const MAX_PER_SESSION = 10;
const IGNORE = [
  "ResizeObserver loop",
  "Script error",
  "Failed to fetch",
  "Network request failed",
  "NetworkError",
  "Load failed",
  "AbortError",
  "The user aborted",
];

let sent = 0;
const seen = new Set<string>();

function platformName() {
  if (Platform.OS !== "web") return Platform.OS;
  return isStandalone() ? "web-pwa" : "web";
}

export function reportError(error: unknown, context?: string) {
  try {
    const e = error as any;
    const raw = e?.message ?? (typeof e === "string" ? e : String(e));
    const message = (context ? `[${context}] ` : "") + String(raw || "unknown error");
    if (IGNORE.some((k) => message.includes(k))) return;
    if (seen.has(message) || sent >= MAX_PER_SESSION) return;
    seen.add(message);
    sent += 1;
    const url = Platform.OS === "web" && typeof location !== "undefined" ? location.pathname : undefined;
    // ยังไม่ล็อกอิน = ไม่ส่ง (เช็ก session ในเครื่อง ไม่ยิงเซิร์ฟเวอร์)
    currentUser()
      .then((user) => {
        if (!user) return;
        return supabase.rpc("log_client_error", {
          p_message: message,
          p_stack: typeof e?.stack === "string" ? e.stack : null,
          p_url: url ?? null,
          p_platform: platformName(),
          p_app_version: Constants.expoConfig?.version ?? null,
        });
      })
      .then(() => {}, () => {}); // ส่งไม่ได้ก็แล้วไป ห้ามทำให้แอปพังซ้ำ
  } catch {
    // ห้ามโยน error ออกจากตัวรายงาน error
  }
}

export function installErrorReporting() {
  const g = globalThis as any;
  if (g.__labhubErrors) return;
  g.__labhubErrors = true;

  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    window.addEventListener("error", (ev: ErrorEvent) => reportError(ev.error ?? ev.message));
    window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => reportError(ev.reason, "promise"));
    return;
  }

  const EU = g.ErrorUtils;
  if (!EU?.getGlobalHandler) return;
  const previous = EU.getGlobalHandler();
  EU.setGlobalHandler((error: any, isFatal?: boolean) => {
    reportError(error, isFatal ? "fatal" : undefined);
    previous?.(error, isFatal);
  });
}
