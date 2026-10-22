import { Platform } from "react-native";

// เว็บ: ป้ายเตือนในช่อง Console (F12) แบบ Facebook — กันกลโกง "Self-XSS"
//   (มิจฉาชีพหลอกให้วางโค้ดใน Console → โค้ดทำงานด้วยบัญชีเหยื่อ โดยเฉพาะบัญชี admin)
//   ไม่ได้บล็อก F12 (บล็อกไม่ได้และไม่ช่วยอะไร) · ผู้ใช้ปกติไม่เห็น · ข้ามตอนพัฒนา (ไม่ให้รก console)
// ติดตั้งครั้งเดียวที่ app/_layout
const FONT = "font-family:system-ui,sans-serif";
const STOP = `color:#fff;background:linear-gradient(135deg,#EF4444 0%,#B91C1C 60%,#7F1D1D 100%);font-size:60px;font-weight:900;padding:10px 30px 14px;border-radius:16px;text-shadow:0 4px 0 rgba(0,0,0,.35);line-height:1.2;${FONT}`;
const TXT = `font-size:16px;line-height:1.7;border-left:4px solid #EF4444;padding-left:12px;${FONT}`;
const HOT = `font-size:16px;line-height:1.7;color:#EF4444;font-weight:800;${FONT}`;
const PILL = `color:#fff;background:linear-gradient(135deg,#3B82F6,#1D4ED8);font-size:13px;font-weight:800;padding:4px 12px;border-radius:999px;${FONT}`;
const SUB = `color:#64748B;font-size:13px;${FONT}`;

export function showConsoleWarning() {
  if (Platform.OS !== "web" || __DEV__ || typeof console === "undefined") return;
  console.log("%c⛔ หยุด!", STOP);
  console.log(
    "%cช่องนี้สำหรับผู้พัฒนาเท่านั้น ถ้ามีคนบอกให้คัดลอกโค้ดมาวางตรงนี้ เพื่อ \"เปิดฟีเจอร์ลับ\" หรือ \"แฮ็กระบบ\" %cนั่นคือการหลอกเพื่อเข้าบัญชี LabHub ของคุณ",
    TXT,
    HOT
  );
  console.log("%cอย่าวางโค้ดที่ไม่รู้ที่มาเด็ดขาด", HOT);
  console.log("%c⚗ LabHub%c  ห้องแล็บ IoT · มหาวิทยาลัยขอนแก่น", PILL, SUB);
}
