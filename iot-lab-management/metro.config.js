// Metro (bundler ของ Expo) — ค่าเริ่มต้นของ Expo + สลับไลบรารีที่ใช้เฉพาะมือถือออกจาก build เว็บ
const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// เว็บ: react-native-keyboard-controller (+ reanimated ที่ติดมา ~840 KB) → ตัวแทนเบา ๆ lib/shims/keyboard-controller.web.tsx
// แอปมือถือ (iOS/Android) ใช้ของจริงเหมือนเดิม
const WEB_SHIMS = {
  "react-native-keyboard-controller": path.resolve(__dirname, "lib/shims/keyboard-controller.web.tsx"),
};

// เว็บ: ฟอนต์ไอคอน Ionicons ฉบับย่อ (เฉพาะไอคอนที่ใช้ — scripts/subset-ionicons.js, Vercel สร้างให้ก่อน build)
//   ใช้เฉพาะตอน build ที่ตั้ง LABHUB_ICON_SUBSET=1 (vercel.json) — dev ในเครื่องใช้ฟอนต์เต็ม (ไอคอนใหม่ไม่หาย)
const IONICONS_WEB = path.resolve(__dirname, "assets/fonts/Ionicons.web.ttf");
const USE_ICON_SUBSET = process.env.LABHUB_ICON_SUBSET === "1" && fs.existsSync(IONICONS_WEB);

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_SHIMS[moduleName]) {
    return { type: "sourceFile", filePath: WEB_SHIMS[moduleName] };
  }
  if (platform === "web" && USE_ICON_SUBSET && moduleName.endsWith("Fonts/Ionicons.ttf")) {
    return { type: "assetFiles", filePaths: [IONICONS_WEB] };
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
