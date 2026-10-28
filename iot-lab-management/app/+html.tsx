import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// โครงหน้า HTML ของเวอร์ชันเว็บ (expo-router) — ใช้เฉพาะเว็บ ไม่มีผลกับแอปมือถือ
// PWA: manifest / ไอคอน / theme-color อยู่ที่ไฟล์นี้
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="th">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* maximum-scale=1: iPhone ไม่ซูมหน้าเองตอนแตะช่องพิมพ์ (ตัวอักษรเล็กกว่า 16px) — ยังถ่างนิ้วซูมได้ */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, shrink-to-fit=no" />
        {/* PWA: ติดตั้งเป็นแอปได้ (public/manifest.webmanifest + public/sw.js — ลงทะเบียน SW ที่ lib/web/webPush) */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#2563EB" />
        <meta name="application-name" content="LabHub" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* iOS: "เพิ่มไปยังหน้าจอโฮม" เปิดเต็มจอแบบแอป (จำเป็นสำหรับ Web Push บน iPhone) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LabHub" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        {/* หน้าเลื่อนแบบแอปมือถือ (ScrollView ของ React Native คุมเอง) */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: webAppCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// ให้รู้สึกเหมือนแอป ไม่ใช่หน้าเว็บ:
//   เคอร์เซอร์ข้อความขึ้นเฉพาะในช่องพิมพ์ (เบราว์เซอร์ที่เปิด caret browsing วางเคอร์เซอร์ได้ทุกจุด) +
//   แตะแล้วไม่มีกรอบสีฟ้าแวบบนมือถือ +
//   แตะสองทีไม่ซูม (touch-action) / หมุนจอแล้วตัวหนังสือไม่ขยายเอง
// หน้า admin จอใหญ่: ScrollView แนวตั้ง (overflow-y auto + overflow-x hidden ของ react-native-web) จองที่แถบเลื่อนทั้งสองข้าง
//   ไม่งั้นแถบเลื่อน 15px ดันเนื้อหาไปซ้าย 7px ไม่ตรงกับหัวหน้าจอ (หัวอยู่นอก ScrollView)
//   เฉพาะชั้นในสุด — ScrollView ที่มี RefreshControl บนเว็บมีกล่องห่อคลาสเดียวกันอีกชั้น
// --lh-page-bg / --lh-card-shadow: พื้นหน้า + เงาการ์ดของหน้า admin บนคอม (W.page/W.card ใน lib/theme อ่านตัวแปรนี้ ไม่มี = ค่าเดิมของมือถือ)
//   พื้น = แสงฟ้าสองมุมบน + เส้นตาราง 32px จางลงครึ่งล่าง + ไล่ฟ้า→ฟ้าอ่อน (สีนิ่ง ไม่มีเบลอ/แอนิเมชัน — เว็บไม่หน่วง)
const webAppCss = `
html, body { touch-action: manipulation; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { caret-color: transparent; -webkit-tap-highlight-color: transparent; }
input, textarea, [contenteditable="true"] { caret-color: auto; }
[data-admin-page] .r-1rnoaur.r-11yh6sk:not(:has(.r-1rnoaur.r-11yh6sk)) { scrollbar-gutter: stable both-edges; }
[data-admin-page] {
  --lh-page-bg:
    radial-gradient(680px 460px at 6% -10%, rgba(59,130,246,0.40), transparent 65%),
    radial-gradient(600px 420px at 100% 0%, rgba(96,165,250,0.40), transparent 65%),
    linear-gradient(180deg, rgba(222,232,252,0) 0%, #DFE9FC 55%, #E3EBFC 100%),
    repeating-linear-gradient(0deg, rgba(37,99,235,0.03) 0 1px, transparent 1px 32px),
    repeating-linear-gradient(90deg, rgba(37,99,235,0.03) 0 1px, transparent 1px 32px),
    linear-gradient(180deg, #B3C8F8 0%, #DEE8FC 45%, #E3EBFC 100%);
  --lh-card-shadow: inset 0 1px 0 #FFFFFF, 0 1px 2px rgba(30,64,175,0.05), 0 10px 26px rgba(37,99,235,0.30);
}
`;
