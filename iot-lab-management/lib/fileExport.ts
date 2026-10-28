import { Platform } from "react-native";
import { File as FSFile, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { toCsv } from "./csv";
import { isStandalone } from "./web/webPush";

// ส่งออกไฟล์: เว็บคอม = ดาวน์โหลด / เปิดหน้าพิมพ์ในแท็บใหม่ · มือถือ (แอป) = สร้างไฟล์แล้วเปิดเมนูแชร์ (LINE, อีเมล, Files, Drive)
// เว็บบนมือถือ / แอปที่ติดตั้ง (PWA): ไม่มีแถบเบราว์เซอร์ให้กดย้อน → แท็บใหม่/ไฟล์ที่เปิดเต็มจอ = ค้างออกไม่ได้
//   → CSV = เมนูแชร์ของเครื่อง (Web Share) / หน้าพิมพ์ = เปิดซ้อนในแอป มีปุ่ม ← กลับ + พิมพ์ (openPrintView)

// มือถือ (นิ้วแตะ) หรือเปิดจากไอคอนหน้าจอโฮม
const isMobileWeb = () =>
  Platform.OS === "web" && typeof window !== "undefined" &&
  (isStandalone() || !!window.matchMedia?.("(pointer: coarse)").matches);

// CSV (มี BOM ให้ Excel อ่านภาษาไทยถูก) — fileName ภาษาไทยได้บนเว็บ / มือถือใช้ asciiName
export async function exportCsv(rows: string[][], fileName: string, asciiName: string) {
  const csv = "﻿" + toCsv(rows);
  if (Platform.OS === "web") {
    // มือถือ: ส่งไฟล์เข้าเมนูแชร์ของเครื่อง (บันทึกลงไฟล์ / LINE / Drive) — iPhone ไม่ดาวน์โหลด แต่เปิดไฟล์เต็มจอแล้วออกไม่ได้
    if (isMobileWeb() && typeof File !== "undefined") {
      const file = new File([csv], fileName, { type: "text/csv" });
      const nav = navigator as any;
      if (nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: fileName });
        } catch (e: any) {
          if (e?.name !== "AbortError") throw e; // กดปิดเมนูแชร์ = ไม่ใช่ error
        }
        return;
      }
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  const file = new FSFile(Paths.cache, asciiName);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);
  await share(file.uri, "text/csv", "public.comma-separated-values-text", fileName);
}

// PDF จาก HTML — เว็บ: เปิดแท็บใหม่แล้วเด้งกล่องพิมพ์ (เลือก "บันทึกเป็น PDF") / มือถือ: expo-print แล้วแชร์
// html สำหรับเว็บควรมี autoPrint (สคริปต์เรียก window.print เอง)
export async function exportPdf(html: string, webHtml: string, title: string, landscape = false) {
  if (Platform.OS === "web") {
    openPrintView(webHtml, title, undefined, landscape ? PAGE_LANDSCAPE : PAGE_PORTRAIT);
    return;
  }
  const { uri } = await Print.printToFileAsync({
    html,
    width: landscape ? 842 : 595, // A4 = 595 × 842 pt
    height: landscape ? 595 : 842,
  });
  await share(uri, "application/pdf", "com.adobe.pdf", title);
}

async function share(uri: string, mimeType: string, UTI: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error(`แชร์ไม่ได้ในเครื่องนี้ (ไฟล์อยู่ที่ ${uri})`);
  await Sharing.shareAsync(uri, { mimeType, UTI, dialogTitle });
}

// เว็บ: หน้าพิมพ์ (HTML ที่เรียก window.print เอง) — คอม = แท็บใหม่ / มือถือ, แอปที่ติดตั้ง = เปิดซ้อนในแอป
// note = คำแนะนำในกล่องสีฟ้าเหนือปุ่มพิมพ์ (เฉพาะหน้าซ้อนบนมือถือ)
// pageWidth = ความกว้าง (px) ที่ใช้จัดหน้าตัวอย่างบนมือถือ ก่อนย่อทั้งแผ่นให้พอดีจอ
export function openPrintView(html: string, title: string, note?: string, pageWidth = PAGE_PORTRAIT) {
  if (!isMobileWeb()) {
    const win = window.open("", "_blank");
    if (!win) throw new Error("เบราว์เซอร์บล็อกหน้าต่างใหม่ อนุญาต pop-up ให้เว็บนี้แล้วลองอีกครั้ง");
    win.document.write(html);
    win.document.close();
    return;
  }
  showPrintOverlay(html, title, note, pageWidth);
}

// A4 ที่ 96dpi: แนวตั้ง 794px (+ขอบ 26px) / แนวนอน 1123px
const PAGE_PORTRAIT = 820;
const PAGE_LANDSCAPE = 1123;

const svgIcon = (d: string, size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON_BACK = '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>';
const ICON_PRINT = '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>';
const ICON_INFO = '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>';

// หน้าต่างซ้อนเต็มจอ: แถบบน (← · ชื่อ) + ตัวอย่างใน iframe (เนื้อหาไม่เด้งพิมพ์เองเมื่ออยู่ใน iframe)
// + แถบล่างติดจอ (คำแนะนำ · ปุ่มพิมพ์) — ของเยอะแค่ไหนก็ไม่ต้องเลื่อนหาปุ่ม, กลับได้เสมอ
function showPrintOverlay(html: string, title: string, note: string | undefined, pageWidth: number) {
  document.getElementById("labhub-print")?.remove();
  const font = "NotoSansThai_600SemiBold, system-ui, sans-serif";
  const wrap = document.createElement("div");
  wrap.id = "labhub-print";
  wrap.style.cssText =
    "position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#EEF2F7;font-family:" + font + ";";

  const top = document.createElement("div");
  top.style.cssText =
    "display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px;" +
    "background:#fff;border-bottom:1px solid #E3EAF5;";
  const back = document.createElement("button");
  back.type = "button";
  back.setAttribute("aria-label", "กลับ");
  back.innerHTML = svgIcon(ICON_BACK, 20);
  back.style.cssText =
    "flex:none;width:40px;height:40px;border-radius:12px;border:1px solid #D3E0F5;background:#fff;color:#1D4ED8;" +
    "display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;";
  const head = document.createElement("div");
  head.style.cssText = "flex:1;min-width:0;";
  const name = document.createElement("div");
  name.textContent = title;
  name.style.cssText = "font-size:16px;color:#172033;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  const sub = document.createElement("div");
  sub.textContent = "ตัวอย่างก่อนพิมพ์ · กระดาษ A4";
  sub.style.cssText = "font-size:12px;color:#5B6B85;";
  head.append(name, sub);
  top.append(back, head);

  // ตัวอย่าง: จัดหน้าที่ความกว้างกระดาษจริงแล้วย่อทั้ง iframe ด้วย transform
  // (จัดที่ความกว้างจอ = ตารางบีบ ตัวหนังสือล้น / zoom ใน iPhone ไม่ย่อตัวหนังสือเล็ก ๆ ตาม → ป้ายล้นช่อง)
  const scroller = document.createElement("div");
  scroller.style.cssText = "flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;";
  const sizer = document.createElement("div");
  sizer.style.cssText = "position:relative;overflow:hidden;margin:0 auto;";
  const frame = document.createElement("iframe");
  frame.title = title;
  frame.setAttribute("scrolling", "no");
  frame.style.cssText =
    `position:absolute;top:0;left:0;width:${pageWidth}px;height:100vh;border:0;background:#EEF2F7;transform-origin:0 0;`;
  frame.srcdoc = html;
  sizer.append(frame);
  scroller.append(sizer);
  const layout = () => {
    if (!wrap.isConnected) return;
    const doc = frame.contentDocument;
    const height = Math.max(doc?.documentElement.scrollHeight || 0, doc?.body?.scrollHeight || 0) || window.innerHeight;
    const scale = Math.min(1, scroller.clientWidth / pageWidth);
    frame.style.height = `${height}px`;
    frame.style.transform = `scale(${scale})`;
    sizer.style.width = `${pageWidth * scale}px`;
    sizer.style.height = `${height * scale}px`;
  };
  frame.onload = () => {
    layout();
    // ฟอนต์ไทยโหลดเสร็จทีหลัง = ความสูงเปลี่ยน
    (frame.contentDocument as any)?.fonts?.ready?.then(layout);
    setTimeout(layout, 600);
  };
  window.addEventListener("resize", layout);

  const bottom = document.createElement("div");
  bottom.style.cssText =
    "padding:10px 14px calc(env(safe-area-inset-bottom, 0px) + 12px);background:#fff;" +
    "border-top:1px solid #E3EAF5;box-shadow:0 -4px 14px rgba(23,32,51,.08);";
  if (note) {
    const info = document.createElement("div");
    info.style.cssText =
      "display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;padding:8px 10px;border-radius:12px;" +
      "background:#E8F0FE;color:#1D4ED8;font-size:12px;line-height:1.5;";
    info.innerHTML = `<span style="flex:none;margin-top:1px">${svgIcon(ICON_INFO, 16)}</span>`;
    const text = document.createElement("span");
    text.textContent = note;
    info.append(text);
    bottom.append(info);
  }
  const print = document.createElement("button");
  print.type = "button";
  print.innerHTML = svgIcon(ICON_PRINT, 20) + "<span>พิมพ์ / บันทึก PDF</span>";
  print.style.cssText =
    "width:100%;height:48px;border:0;border-radius:14px;background:#2563EB;color:#fff;font:inherit;font-size:16px;" +
    "display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;";
  bottom.append(print);

  back.onclick = () => {
    window.removeEventListener("resize", layout);
    wrap.remove();
  };
  print.onclick = () => frame.contentWindow?.print();
  wrap.append(top, scroller, bottom);
  document.body.appendChild(wrap);
}
