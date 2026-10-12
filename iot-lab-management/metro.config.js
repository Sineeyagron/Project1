// Metro (bundler ของ Expo) — ค่าเริ่มต้นของ Expo + สลับไลบรารีที่ใช้เฉพาะมือถือออกจาก build เว็บ
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// เว็บ: react-native-keyboard-controller (+ reanimated ที่ติดมา ~840 KB) → ตัวแทนเบา ๆ lib/shims/keyboard-controller.web.tsx
// แอปมือถือ (iOS/Android) ใช้ของจริงเหมือนเดิม
const WEB_SHIMS = {
  "react-native-keyboard-controller": path.resolve(__dirname, "lib/shims/keyboard-controller.web.tsx"),
};

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_SHIMS[moduleName]) {
    return { type: "sourceFile", filePath: WEB_SHIMS[moduleName] };
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
