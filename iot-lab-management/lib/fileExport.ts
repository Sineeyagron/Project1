import { Platform } from "react-native";
import { File as FSFile, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { toCsv } from "./csv";

// ส่งออกไฟล์: เว็บ = ดาวน์โหลด / เปิดหน้าพิมพ์ · มือถือ = สร้างไฟล์แล้วเปิดเมนูแชร์ (LINE, อีเมล, Files, Drive)

// CSV (มี BOM ให้ Excel อ่านภาษาไทยถูก) — fileName ภาษาไทยได้บนเว็บ / มือถือใช้ asciiName
export async function exportCsv(rows: string[][], fileName: string, asciiName: string) {
  const csv = "﻿" + toCsv(rows);
  if (Platform.OS === "web") {
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
    const win = window.open("", "_blank");
    if (!win) throw new Error("เบราว์เซอร์บล็อกหน้าต่างใหม่ อนุญาต pop-up ให้เว็บนี้แล้วลองอีกครั้ง");
    win.document.write(webHtml);
    win.document.close();
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
