import { Platform } from "react-native";
import { File as FSFile, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { toCsv } from "./csv";
import { isStandalone } from "./webPush";

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
    openPrintView(webHtml, title);
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
export function openPrintView(html: string, title: string) {
  if (!isMobileWeb()) {
    const win = window.open("", "_blank");
    if (!win) throw new Error("เบราว์เซอร์บล็อกหน้าต่างใหม่ อนุญาต pop-up ให้เว็บนี้แล้วลองอีกครั้ง");
    win.document.write(html);
    win.document.close();
    return;
  }
  showPrintOverlay(html, title);
}

// หน้าต่างซ้อนเต็มจอ: แถบบน (← กลับ · ชื่อ · พิมพ์) + เนื้อหาใน iframe — กลับได้เสมอ
function showPrintOverlay(html: string, title: string) {
  document.getElementById("labhub-print")?.remove();
  const font = "NotoSansThai_600SemiBold, system-ui, sans-serif";
  const wrap = document.createElement("div");
  wrap.id = "labhub-print";
  wrap.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#EAF1FC;";

  const bar = document.createElement("div");
  bar.style.cssText =
    "display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top, 0px) + 10px) 12px 10px;" +
    "background:#fff;box-shadow:0 2px 10px rgba(23,32,51,.12);font-family:" + font + ";";

  const btn = (label: string, primary: boolean) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText =
      "flex:none;height:40px;padding:0 14px;border-radius:12px;font:inherit;font-size:15px;cursor:pointer;" +
      (primary ? "border:0;background:#2563EB;color:#fff;" : "border:1px solid #D3E0F5;background:#fff;color:#1D4ED8;");
    return b;
  };
  const back = btn("← กลับ", false);
  const name = document.createElement("div");
  name.textContent = title;
  name.style.cssText = "flex:1;min-width:0;font-size:14px;color:#172033;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  const print = btn("พิมพ์ / บันทึก PDF", true);
  bar.append(back, name, print);

  const frame = document.createElement("iframe");
  frame.title = title;
  frame.style.cssText = "flex:1;width:100%;border:0;background:#fff;";
  frame.srcdoc = html; // ในเนื้อหามีสคริปต์เด้งกล่องพิมพ์เอง (autoPrint)

  back.onclick = () => wrap.remove();
  print.onclick = () => frame.contentWindow?.print();
  wrap.append(bar, frame);
  document.body.appendChild(wrap);
}
