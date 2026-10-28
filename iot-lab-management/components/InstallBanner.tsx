import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { C, W } from "../lib/theme";
import { dismissInstall, iosSteps, promptInstall, useInstallMode } from "../lib/installApp";

// แถบชวนติดตั้ง LabHub ลอยติดล่างจอ (หน้า login, เว็บมือถือเท่านั้น — ผู้ใช้เลือกแบบ 1 จาก mockup · พื้นฟ้า ขึ้นทันที ตามที่ขอ)
//   iPhone = บอกขั้นตอน (iOS 26: ≡ → แชร์ → เพิ่มไปยังหน้าจอโฮม / รุ่นเก่า: แชร์ → เพิ่ม...) ชื่อเมนูตามภาษาเครื่อง
//   Android = ปุ่มติดตั้ง · กด × = ซ่อนจนเปิดครั้งหน้า · แตะช่องพิมพ์ = หลบไปก่อน (ไม่บังตอนกรอก)
// หน้า login เว้นที่ล่างเท่าแถบ (INSTALL_BANNER_SPACE) เลื่อนขึ้นแล้วเห็นปุ่มครบ
export const INSTALL_BANNER_SPACE = 170; // แถบสูง ~143 + ขอบล่าง 12

export default function InstallBanner() {
  const mode = useInstallMode();
  const typing = useTyping();
  if (Platform.OS !== "web" || !mode || typing) return null;

  const steps = mode === "ios" ? iosSteps() : null;
  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={[s.bar, s.enter]}>
        <View style={s.icon}>
          <Ionicons name="download-outline" size={24} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{steps ? "ติดตั้ง LabHub ลงหน้าจอโฮม" : "ติดตั้ง LabHub เป็นแอป"}</Text>
          {steps ? (
            <View style={s.steps}>
              <Text style={s.stepText}>แตะ</Text>
              {steps.menuFirst && (
                <>
                  <View style={s.chip}><Ionicons name="menu" size={15} color={C.primaryDark} /></View>
                  <Text style={s.stepText}>ในช่องที่อยู่เว็บ →</Text>
                </>
              )}
              <View style={s.chip}>
                <Ionicons name="share-outline" size={15} color={C.primaryDark} />
                <Text style={s.chipText}>{steps.share}</Text>
              </View>
              {!steps.menuFirst && <Text style={s.stepText}>ด้านล่าง</Text>}
              <Text style={s.stepText}>→</Text>
              <View style={s.chip}>
                <Ionicons name="add-circle-outline" size={15} color={C.primaryDark} />
                <Text style={s.chipText}>{steps.add}</Text>
              </View>
            </View>
          ) : (
            <Text style={s.sub}>เปิดเร็ว เต็มจอ รับแจ้งเตือนได้</Text>
          )}
        </View>
        {!steps && (
          <Pressable onPress={promptInstall} style={({ pressed }) => [s.btn, pressed && { opacity: 0.88 }]} accessibilityRole="button">
            <Text style={s.btnText}>ติดตั้ง</Text>
          </Pressable>
        )}
        <Pressable onPress={dismissInstall} hitSlop={10} style={s.close} accessibilityRole="button" accessibilityLabel="ปิด">
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.85)" />
        </Pressable>
      </View>
    </View>
  );
}

// แตะช่องพิมพ์อยู่ (คีย์บอร์ดขึ้น) → ซ่อนแถบ
function useTyping() {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && t.matches("input, textarea, [contenteditable='true']");
    const onIn = (e: FocusEvent) => { if (isField(e.target)) setTyping(true); };
    const onOut = (e: FocusEvent) => { if (isField(e.target)) setTyping(false); };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return typing;
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12, bottom: 12 },
  // พื้นฟ้าไล่สีแบบปุ่มหลัก ตัวหนังสือขาว — เด่นกว่าการ์ดขาวในหน้า
  bar: {
    ...W.primary, borderRadius: 20,
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 16, paddingLeft: 14, paddingRight: 8,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 10px rgba(29,78,216,0.25), 0 16px 34px rgba(23,32,51,0.28)",
  },
  // เลื่อนขึ้นสั้น ๆ ทันทีที่เปิดหน้า (CSS animation ของเว็บ)
  enter: {
    animationDuration: "260ms",
    animationTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    animationFillMode: "both",
    animationKeyframes: [{ "0%": { opacity: 0, transform: "translateY(16px)" }, "100%": { opacity: 1, transform: "translateY(0px)" } }],
  } as any,
  icon: {
    width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)", borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
  },
  title: { fontSize: 16, fontWeight: "700", color: "#fff" },
  sub: { fontSize: 13.5, color: "rgba(255,255,255,0.9)", marginTop: 2 },
  steps: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 5, rowGap: 6, marginTop: 6 },
  stepText: { fontSize: 14, color: "rgba(255,255,255,0.95)" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#fff", borderRadius: 8, paddingVertical: 2, paddingHorizontal: 8,
  },
  chipText: { fontSize: 13.5, fontWeight: "700", color: C.primaryDark },
  btn: { height: 40, paddingHorizontal: 18, borderRadius: 13, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  btnText: { color: C.primaryDark, fontSize: 15, fontWeight: "700" },
  close: { width: 34, height: 34, alignItems: "center", justifyContent: "center", alignSelf: "flex-start", marginTop: -6 },
});
