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
        {/* PWA: ติดตั้งเป็นแอปได้ (public/manifest.webmanifest + public/sw.js — ลงทะเบียน SW ที่ lib/webPush) */}
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
const webAppCss = `
html, body { touch-action: manipulation; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { caret-color: transparent; -webkit-tap-highlight-color: transparent; }
input, textarea, [contenteditable="true"] { caret-color: auto; }
`;
