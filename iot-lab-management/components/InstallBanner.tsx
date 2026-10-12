import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { C, W, gradient } from "../lib/theme";
import { dismissInstall, iosSteps, promptInstall, useInstallMode } from "../lib/installApp";

// แถบชวนติดตั้ง LabHub ลอยติดล่างจอ (หน้า login, เว็บมือถือเท่านั้น — ผู้ใช้เลือกแบบ 1 ใน docs/mockups/install-banner-ios26.html)
//   iPhone = บอกขั้นตอน (iOS 26: ≡ → แชร์ → เพิ่มไปยังหน้าจอโฮม / รุ่นเก่า: แชร์ → เพิ่ม...) ชื่อเมนูตามภาษาเครื่อง
//   Android = ปุ่มติดตั้ง · กด × = ซ่อนจนเปิดครั้งหน้า · แตะช่องพิมพ์ = หลบไปก่อน (ไม่บังตอนกรอก)
// หน้า login เว้นที่ล่างเท่าแถบ (INSTALL_BANNER_SPACE) เลื่อนขึ้นแล้วเห็นปุ่มครบ
export const INSTALL_BANNER_SPACE = 130;

export default function InstallBanner() {
  const mode = useInstallMode();
  const typing = useTyping();
  if (Platform.OS !== "web" || !mode || typing) return null;

  const steps = mode === "ios" ? iosSteps() : null;
  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={[s.bar, s.enter]}>
        <View style={s.icon}>
          <Ionicons name="download-outline" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{steps ? "ติดตั้ง LabHub ลงหน้าจอโฮม" : "ติดตั้ง LabHub เป็นแอป"}</Text>
          {steps ? (
            <View style={s.steps}>
              <Text style={s.stepText}>แตะ</Text>
              {steps.menuFirst && (
                <>
                  <View style={s.chip}><Ionicons name="menu" size={13} color={C.primaryDark} /></View>
                  <Text style={s.stepText}>ในช่องที่อยู่เว็บ →</Text>
                </>
              )}
              <View style={s.chip}>
                <Ionicons name="share-outline" size={13} color={C.primaryDark} />
                <Text style={s.chipText}>{steps.share}</Text>
              </View>
              {!steps.menuFirst && <Text style={s.stepText}>ด้านล่าง</Text>}
              <Text style={s.stepText}>→</Text>
              <View style={s.chip}>
                <Ionicons name="add-circle-outline" size={13} color={C.primaryDark} />
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
          <Ionicons name="close" size={18} color={C.faint} />
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
  bar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: C.surface, borderRadius: 18, borderWidth: 1, borderColor: C.primarySoft,
    paddingVertical: 12, paddingLeft: 12, paddingRight: 8,
    boxShadow: "0 2px 6px rgba(15,23,42,0.08), 0 12px 26px rgba(15,23,42,0.16)",
  },
  // เด้งขึ้นนุ่ม ๆ หลังเปิดหน้า 1 วินาที (CSS animation ของเว็บ)
  enter: {
    animationDuration: "420ms",
    animationDelay: "1s",
    animationTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    animationFillMode: "both",
    animationKeyframes: [{ "0%": { opacity: 0, transform: "translateY(24px)" }, "100%": { opacity: 1, transform: "translateY(0px)" } }],
  } as any,
  icon: {
    width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: C.primary, ...gradient("linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)"),
  },
  title: { fontSize: 14.5, fontWeight: "700", color: C.ink },
  sub: { fontSize: 13, color: C.text2, marginTop: 1 },
  steps: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 4, rowGap: 4, marginTop: 4 },
  stepText: { fontSize: 13, color: C.text2 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: C.primaryTint, borderWidth: 1, borderColor: C.primarySoft, borderRadius: 7,
    paddingVertical: 1, paddingHorizontal: 6,
  },
  chipText: { fontSize: 12.5, fontWeight: "700", color: C.primaryDark },
  btn: { ...W.primary, height: 38, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  close: { width: 32, height: 32, alignItems: "center", justifyContent: "center", alignSelf: "flex-start", marginTop: -4 },
});
