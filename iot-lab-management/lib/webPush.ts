import { Platform } from "react-native";
import supabase, { SUPABASE_URL } from "./supabase";

// PWA + Web Push (เว็บเท่านั้น — แอปมือถือทุกฟังก์ชันในไฟล์นี้ไม่ทำอะไร)
//   service worker = public/sw.js / ส่ง push = Edge Function send-push / ตาราง = push_subscriptions
//   iOS: Safari รับ push ได้เฉพาะตอนติดตั้งเป็นแอปหน้าจอโฮมแล้ว (iOS 16.4+)

export type PushState =
  | "unsupported" // เบราว์เซอร์นี้ไม่มี Web Push
  | "ios-install" // iPhone/iPad ที่ยังเปิดใน Safari → ต้อง "เพิ่มไปยังหน้าจอโฮม" ก่อน
  | "denied" // ผู้ใช้กดไม่อนุญาตไว้ (เปิดคืนได้ที่การตั้งค่าเบราว์เซอร์เท่านั้น)
  | "off"
  | "on";

const isWeb = Platform.OS === "web";
const FN_URL = `${SUPABASE_URL}/functions/v1/send-push`;

const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  isWeb && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);

const hasPush = () =>
  isWeb && typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// เรียกครั้งเดียวตอนเปิดแอป (app/_layout) — onOpen = แตะแจ้งเตือนตอนแอปเปิดอยู่ → เปลี่ยนหน้าแทนโหลดใหม่
export function registerServiceWorker(onOpen: (path: string) => void) {
  if (!isWeb || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
  navigator.serviceWorker.addEventListener("message", (e: MessageEvent) => {
    if (e.data?.type !== "labhub-open" || typeof e.data.url !== "string") return;
    const url = new URL(e.data.url, location.origin);
    if (url.origin === location.origin) onOpen(url.pathname + url.search);
  });
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function getPushState(): Promise<PushState> {
  if (!isWeb) return "unsupported";
  if (isIOS() && !isStandalone()) return "ios-install";
  if (!hasPush()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  try {
    return (await currentSubscription()) ? "on" : "off";
  } catch {
    return "off";
  }
}

function keyToBytes(base64url: string) {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((base64url.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// เปิดแจ้งเตือนบนเครื่องนี้ — คืนข้อความผิดพลาดภาษาไทย (null = สำเร็จ)
export async function enablePush(): Promise<string | null> {
  if (!hasPush()) return "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "ไม่ได้รับอนุญาตให้แจ้งเตือน — เปิดได้ที่การตั้งค่าของเบราว์เซอร์";

  let publicKey = "";
  try {
    const res = await fetch(FN_URL);
    publicKey = res.ok ? (await res.json()).publicKey : "";
  } catch {
    return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง";
  }
  if (!publicKey) return "ระบบแจ้งเตือนยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแล";

  try {
    const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    // กุญแจฝั่งเซิร์ฟเวอร์เปลี่ยน (สร้าง VAPID ใหม่) → สมัครใหม่
    const current = sub?.options.applicationServerKey;
    if (sub && current && btoa(String.fromCharCode(...new Uint8Array(current))) !== btoa(String.fromCharCode(...keyToBytes(publicKey)))) {
      await sub.unsubscribe();
      sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
    const json = sub.toJSON();
    const { error } = await supabase.rpc("save_push_subscription", {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys?.p256dh,
      p_auth: json.keys?.auth,
      p_user_agent: navigator.userAgent,
    });
    if (error) return "บันทึกการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง";
    return null;
  } catch {
    return "เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง";
  }
}

// ปิดแจ้งเตือนบนเครื่องนี้ (ลบแถวของตัวเอง + ยกเลิกในเบราว์เซอร์)
export async function disablePush() {
  if (!hasPush()) return;
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch {
    // ไม่เป็นไร — endpoint ที่เลิกใช้จะถูกลบเองตอนส่งครั้งถัดไป (410)
  }
}

// ออกจากระบบแล้ว (session หายแล้ว ลบแถวผ่าน RLS ไม่ได้) → ยกเลิกในเบราว์เซอร์อย่างเดียว
//   เครื่องนี้จะไม่ได้รับแจ้งเตือนของบัญชีเดิมอีก / แถวในตารางถูกลบเองเมื่อส่งแล้วได้ 410
export async function dropPushOnSignOut() {
  if (!hasPush()) return;
  try {
    await (await currentSubscription())?.unsubscribe();
  } catch {}
}
