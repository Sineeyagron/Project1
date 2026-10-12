import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// โครงหน้า HTML ของเวอร์ชันเว็บ (expo-router) — ใช้เฉพาะเว็บ ไม่มีผลกับแอปมือถือ
// (PWA: manifest / ไอคอน / theme-color จะใส่ที่ไฟล์นี้)
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="th">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
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
//   แตะแล้วไม่มีกรอบสีฟ้าแวบบนมือถือ
const webAppCss = `
body { caret-color: transparent; -webkit-tap-highlight-color: transparent; }
input, textarea, [contenteditable="true"] { caret-color: auto; }
`;
