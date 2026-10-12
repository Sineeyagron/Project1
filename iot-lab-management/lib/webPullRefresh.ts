import { Platform } from "react-native";

// ลากลงเพื่อรีเฟรช บนเว็บ/PWA (มือถือจริงใช้ RefreshControl ของแต่ละหน้าอยู่แล้ว — บนเว็บ RefreshControl ไม่ทำงาน)
//   เริ่มลากตอนรายการอยู่บนสุด → วงกลมลูกศรเลื่อนลงตามนิ้ว → ปล่อยเกินระยะ = โหลดหน้าใหม่ (ล็อกอินยังอยู่ ไฟล์แอปมาจาก cache)
//   ไม่ทำงานในหน้าต่างเด้ง/แผ่นล่าง (role="dialog") ช่องพิมพ์ และตอนลากแนวนอน
// ติดตั้งครั้งเดียวที่ app/_layout

const TRIGGER = 70; // ระยะ (px หลังหน่วง) ที่ปล่อยแล้วรีเฟรช
const MAX = 110;

function scrollParent(el: Element | null): HTMLElement | null {
  for (let n = el as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
}

export function installPullToRefresh() {
  if (Platform.OS !== "web" || typeof document === "undefined" || (window as any).__labhubPull) return;
  (window as any).__labhubPull = true;

  const css = document.createElement("style");
  css.textContent = `
#labhub-pull { position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) - 44px); z-index: 2147483000;
  width: 38px; height: 38px; margin-left: -19px; border-radius: 19px; background: #fff;
  box-shadow: 0 2px 4px rgba(15,23,42,.08), 0 8px 18px rgba(37,99,235,.22);
  display: flex; align-items: center; justify-content: center; pointer-events: none; opacity: 0; }
#labhub-pull svg { transition: transform .12s linear; }
#labhub-pull.back { transition: transform .2s ease, opacity .2s ease; }
#labhub-pull.spin svg { animation: labhub-spin .8s linear infinite; }
@keyframes labhub-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(css);

  const dot = document.createElement("div");
  dot.id = "labhub-pull";
  dot.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>';
  document.body.appendChild(dot);
  const icon = dot.firstElementChild as SVGElement;

  let startX = 0, startY = 0, pull = 0;
  let scroller: HTMLElement | null = null;
  let tracking = false;
  let busy = false;

  const show = (y: number) => {
    dot.classList.remove("back");
    dot.style.opacity = String(Math.min(1, y / TRIGGER));
    dot.style.transform = `translateY(${y + 44}px)`;
    icon.style.transform = `rotate(${(y / TRIGGER) * 270}deg)`;
  };
  const hide = () => {
    dot.classList.add("back");
    dot.style.opacity = "0";
    dot.style.transform = "translateY(0)";
  };

  document.addEventListener("touchstart", (e) => {
    tracking = false;
    if (busy || e.touches.length !== 1) return;
    const t = e.target as Element;
    if (t.closest?.('input, textarea, [contenteditable="true"], [role="dialog"], [aria-modal="true"]')) return;
    scroller = scrollParent(t);
    if (scroller && scroller.scrollTop > 0) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    pull = 0;
    tracking = true;
  }, { passive: true });

  document.addEventListener("touchmove", (e) => {
    if (!tracking) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    // ลากแนวนอน / ดันขึ้น / รายการเลื่อนลงไปแล้ว → ไม่ใช่การรีเฟรช
    if ((pull === 0 && Math.abs(dx) > Math.abs(dy)) || (scroller && scroller.scrollTop > 0)) {
      tracking = false;
      if (pull) hide();
      pull = 0;
      return;
    }
    pull = Math.max(0, Math.min(MAX, dy * 0.5));
    show(pull);
  }, { passive: true });

  const end = () => {
    if (!tracking) return;
    tracking = false;
    if (pull >= TRIGGER) {
      busy = true;
      dot.classList.add("back", "spin");
      dot.style.opacity = "1";
      dot.style.transform = `translateY(${TRIGGER + 44}px)`;
      setTimeout(() => window.location.reload(), 150);
    } else {
      hide();
    }
    pull = 0;
  };
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener("touchcancel", end, { passive: true });
}
