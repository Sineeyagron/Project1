import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { isStandalone } from "./webPush";

// ชวนติดตั้ง LabHub ลงหน้าจอโฮม (เว็บมือถือเท่านั้น) — แถบลอยล่างจอ components/InstallBanner ที่หน้า login
//   iPhone (Safari/Chrome): เว็บสั่งติดตั้งเองไม่ได้ → บอกวิธี "แชร์ → เพิ่มไปยังหน้าจอโฮม"
//   Android (Chrome ฯลฯ): เก็บ event beforeinstallprompt ไว้ → ปุ่ม "ติดตั้งแอป" เรียกหน้าต่างติดตั้งของระบบ
//   ไม่แสดง: ติดตั้งแล้ว (เปิดจากไอคอน) / คอม / เบราว์เซอร์ในแอป LINE, Facebook, IG (ติดตั้งจากในนั้นไม่ได้)

export type InstallMode = "ios" | "android" | null;

let deferred: any = null;
let installedNow = false;
let dismissed = false; // กด × = ซ่อนจนเปิดเว็บครั้งหน้า
const listeners = new Set<() => void>();
const notifyAll = () => listeners.forEach((fn) => fn());

// เรียกครั้งเดียวตอนเปิดแอป (app/_layout) — Chrome ยิง event นี้ครั้งเดียวตั้งแต่โหลดหน้า ต้องจับไว้ก่อนเข้าหน้า login
export function captureInstallPrompt() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    if (isAndroid()) e.preventDefault(); // มือถือ: ไม่ให้แถบติดตั้งของ Chrome เด้งเอง — ใช้ปุ่มในการ์ดแทน
    deferred = e;
    notifyAll();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    notifyAll();
  });
}

const ua = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);
const isIOS = () => /iPhone|iPad|iPod/.test(ua()) || (ua().includes("Macintosh") && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/i.test(ua());
const inAppBrowser = () => /\bLine\/|FBAN|FBAV|FB_IAB|Instagram|Messenger|TikTok|MicroMessenger/i.test(ua());

function currentMode(): InstallMode {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  if (dismissed || installedNow || isStandalone() || inAppBrowser()) return null;
  if (isIOS()) return "ios";
  if (deferred && isAndroid()) return "android"; // คอมไม่แสดง (Chrome คอมมีปุ่มติดตั้งที่แถบที่อยู่เว็บอยู่แล้ว)
  return null;
}

export function useInstallMode(): InstallMode {
  const [mode, setMode] = useState<InstallMode>(currentMode);
  useEffect(() => {
    const fn = () => setMode(currentMode());
    listeners.add(fn);
    fn();
    return () => { listeners.delete(fn); };
  }, []);
  return mode;
}

export function dismissInstall() {
  dismissed = true;
  notifyAll();
}

// iPhone: ขั้นตอนตามรุ่น Safari + ชื่อเมนูตามภาษาเครื่อง (เมนูของ Safari เป็นภาษาเครื่อง ไม่ใช่ภาษาแอป)
//   Safari 26+ (iOS 26): ไม่มีปุ่มแชร์ที่แถบล่าง → แตะ ≡ ในช่องที่อยู่เว็บก่อน / รุ่นเก่า: ปุ่มแชร์อยู่แถบล่าง
export function iosSteps() {
  const th = (typeof navigator !== "undefined" ? navigator.language || "" : "").toLowerCase().startsWith("th");
  const safariMajor = Number((ua().match(/Version\/(\d+)/) || [])[1] || 0);
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua());
  return {
    // false = กดปุ่มแชร์ได้เลย (Safari รุ่นเก่า / Chrome iPhone มีปุ่มแชร์ที่แถบ)
    menuFirst: !otherBrowser && safariMajor >= 26,
    share: th ? "แชร์" : "Share",
    add: th ? "เพิ่มไปยังหน้าจอโฮม" : "Add to Home Screen",
  };
}

// Android: เปิดหน้าต่างติดตั้งของระบบ (ใช้ event ได้ครั้งเดียว)
export async function promptInstall() {
  const e = deferred;
  if (!e) return;
  deferred = null;
  try {
    e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === "accepted") installedNow = true;
  } catch {}
  notifyAll();
}
