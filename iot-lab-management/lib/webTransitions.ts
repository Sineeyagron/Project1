import { Platform } from "react-native";
import { router } from "expo-router";

// เว็บ/PWA: เลื่อนเปลี่ยนหน้าแบบ iPhone — ไปหน้าใหม่ = หน้าใหม่เลื่อนเข้าจากขวา หน้าเดิมถอยซ้ายนิดหน่อย / ย้อนกลับ = กลับทาง
//   ใช้ View Transitions API: เบราว์เซอร์ถ่ายภาพหน้าเก่า-ใหม่แล้วให้ GPU เลื่อนภาพ (ไม่ render หน้าซ้ำระหว่างเลื่อน = ไม่หนัก)
//   เบราว์เซอร์ที่ไม่รองรับ (iOS < 18, Chrome < 111) / ตั้งค่าลดการเคลื่อนไหว / จอคอม ≥1024 → เปลี่ยนหน้าทันทีเหมือนเดิม
//   ไม่เลื่อน: replace (redirect, เมนูซ้ายจอคอม), dismissTo/dismissAll, แถบเมนูล่าง (goTab ห่อด้วย withoutTransition)
//   ปุ่มย้อนของเครื่อง (Android) / ปุ่ม back เบราว์เซอร์ = เลื่อนกลับ ยกเว้นเบราว์เซอร์ทำเอฟเฟกต์ของมันเองแล้ว (ปัดขอบจอใน Safari)
// ติดตั้งครั้งเดียวที่ app/_layout

const DURATION = 380;
const MAX_WAIT = 400; // รอหน้าใหม่ขึ้นนานสุด (ระหว่างรอ จอค้างภาพเดิม) — เกินนี้ปล่อยเลย

let suppressed = 0;
let busyUntil = 0; // ช่วงที่เราเปลี่ยนหน้าเอง → popstate ที่ตามมาจาก router.back ไม่ต้องเลื่อนซ้ำ

// เรียกนำทางโดยไม่เลื่อน (เช่น สลับแท็บล่าง — iPhone ไม่เลื่อนตอนสลับแท็บ)
export function withoutTransition(fn: () => void) {
  suppressed += 1;
  try {
    fn();
  } finally {
    suppressed -= 1;
  }
}

function canAnimate() {
  const d = document as any;
  return (
    typeof d.startViewTransition === "function" &&
    suppressed === 0 &&
    window.innerWidth < 1024 &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// รอจน URL เปลี่ยน (router อัปเดต URL หลังหน้าใหม่ขึ้นจอแล้ว) แล้วรออีก 1 รอบให้ React วาดเสร็จ
function waitForNavigation(before: string) {
  return new Promise<void>((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (location.href !== before || Date.now() - start > MAX_WAIT) setTimeout(resolve, 0);
      else setTimeout(tick, 8);
    };
    tick();
  });
}

// ปุ่มย้อนของเครื่อง: URL เปลี่ยนไปก่อนแล้ว → รอ DOM เปลี่ยนแทน (router สลับหน้าที่แสดง)
function waitForDom() {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      obs.disconnect();
      setTimeout(resolve, 0);
    };
    const obs = new MutationObserver(finish);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    setTimeout(finish, MAX_WAIT);
  });
}

function run(direction: "push" | "pop", navigate: () => void, wait: "url" | "dom" = "url") {
  if (!canAnimate()) {
    navigate();
    return;
  }
  const root = document.documentElement;
  const before = location.href;
  busyUntil = Date.now() + 1500;
  root.dataset.vt = direction;
  const t = (document as any).startViewTransition(() => {
    navigate();
    return wait === "url" ? waitForNavigation(before) : waitForDom();
  });
  t.finished.finally(() => {
    if (root.dataset.vt === direction) delete root.dataset.vt;
    busyUntil = Date.now() + 300;
  });
}

const CSS = `
::view-transition-group(root){animation-duration:${DURATION}ms;animation-timing-function:cubic-bezier(.32,.72,0,1)}
::view-transition-old(root),::view-transition-new(root){animation-duration:${DURATION}ms;animation-timing-function:cubic-bezier(.32,.72,0,1);mix-blend-mode:normal}
html[data-vt=push]::view-transition-old(root){animation-name:labhub-vt-under-out}
html[data-vt=push]::view-transition-new(root){animation-name:labhub-vt-in;box-shadow:-6px 0 20px rgba(15,23,42,.14)}
html[data-vt=pop]::view-transition-old(root){animation-name:labhub-vt-out;z-index:1;box-shadow:-6px 0 20px rgba(15,23,42,.14)}
html[data-vt=pop]::view-transition-new(root){animation-name:labhub-vt-under-in}
@keyframes labhub-vt-in{from{transform:translateX(100%)}}
@keyframes labhub-vt-out{to{transform:translateX(100%)}}
@keyframes labhub-vt-under-out{to{transform:translateX(-30%)}}
@keyframes labhub-vt-under-in{from{transform:translateX(-30%)}}`;

export function installPageTransitions() {
  if (Platform.OS !== "web" || typeof document === "undefined" || (window as any).__labhubVt) return;
  (window as any).__labhubVt = true;
  if (typeof (document as any).startViewTransition !== "function") return; // ไม่รองรับ = ไม่ต้องทำอะไร

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  // ห่อเมธอดของ router (useRouter() คืน object ตัวเดียวกันนี้) — ทุกหน้าที่ push / back ได้เอฟเฟกต์โดยไม่ต้องแก้ทีละหน้า
  const r = router as any;
  for (const name of ["push", "navigate"] as const) {
    const orig = r[name].bind(router);
    r[name] = (...args: any[]) => run("push", () => orig(...args));
  }
  for (const name of ["back", "dismiss"] as const) {
    const orig = r[name].bind(router);
    r[name] = (...args: any[]) => run("pop", () => orig(...args));
  }

  // ปุ่มย้อนของเครื่อง / ปุ่ม back เบราว์เซอร์: กัน router รับ popstate ไว้ก่อน แล้วส่งต่อให้ในจังหวะที่ถ่ายภาพหน้าเดิมแล้ว
  let replaying = false;
  window.addEventListener(
    "popstate",
    (e: PopStateEvent) => {
      if (replaying || Date.now() < busyUntil || (e as any).hasUAVisualTransition || !canAnimate()) return;
      e.stopImmediatePropagation();
      run("pop", () => {
        replaying = true;
        try {
          window.dispatchEvent(new PopStateEvent("popstate", { state: e.state }));
        } finally {
          replaying = false;
        }
      }, "dom");
    },
    true,
  );
}
