import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { C, W, gradient } from "../lib/theme";
import { promptInstall, useInstallMode } from "../lib/installApp";

// การ์ดชวนติดตั้ง LabHub ลงหน้าจอโฮม (หน้า login, เว็บมือถือเท่านั้น — mockup docs/mockups/install-prompt.html แบบ A/B)
//   iPhone = บอก 2 ขั้น (แชร์ → เพิ่มไปยังหน้าจอโฮม) / Android = ปุ่มติดตั้งแอป
//   กด × = ซ่อนจนเปิดเว็บครั้งหน้า
export default function InstallAppCard() {
  const mode = useInstallMode();
  const [hidden, setHidden] = useState(false);
  if (Platform.OS !== "web" || !mode || hidden) return null;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={s.icon}>
          <Ionicons name="download-outline" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{mode === "ios" ? "ติดตั้ง LabHub ลงหน้าจอโฮม" : "ติดตั้ง LabHub เป็นแอป"}</Text>
          <Text style={s.sub}>เปิดเร็ว เต็มจอ และรับแจ้งเตือนได้</Text>
        </View>
        <Pressable onPress={() => setHidden(true)} hitSlop={10} style={s.close} accessibilityRole="button" accessibilityLabel="ปิด">
          <Ionicons name="close" size={18} color={C.faint} />
        </Pressable>
      </View>

      {mode === "ios" ? (
        <View style={s.steps}>
          <View style={s.step}>
            <Text style={s.num}>1</Text>
            <Text style={s.stepText}>แตะ</Text>
            <View style={s.chip}>
              <Ionicons name="share-outline" size={14} color={C.primaryDark} />
              <Text style={s.chipText}>แชร์</Text>
            </View>
            <Text style={s.stepText}>ที่แถบล่างของ Safari</Text>
          </View>
          <View style={s.step}>
            <Text style={s.num}>2</Text>
            <Text style={s.stepText}>เลือก</Text>
            <View style={s.chip}>
              <Ionicons name="add-circle-outline" size={14} color={C.primaryDark} />
              <Text style={s.chipText}>เพิ่มไปยังหน้าจอโฮม</Text>
            </View>
          </View>
        </View>
      ) : (
        <Pressable onPress={promptInstall} style={({ pressed }) => [s.btn, pressed && { opacity: 0.88 }]} accessibilityRole="button">
          <Ionicons name="download-outline" size={17} color="#fff" />
          <Text style={s.btnText}>ติดตั้งแอป</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { ...W.card, padding: 14, marginTop: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: C.primary, ...gradient("linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)"),
    boxShadow: "0 4px 10px rgba(37,99,235,0.3)",
  },
  title: { fontSize: 15, fontWeight: "700", color: C.ink },
  sub: { fontSize: 13, color: C.text2, marginTop: 1 },
  close: { width: 32, height: 32, alignItems: "center", justifyContent: "center", alignSelf: "flex-start", marginTop: -4, marginRight: -6 },
  steps: { gap: 8 },
  step: {
    flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6,
    backgroundColor: "rgba(255,255,255,0.8)", borderWidth: 1, borderColor: C.border, borderRadius: 14,
    paddingVertical: 9, paddingHorizontal: 12,
  },
  num: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: C.primarySoft, color: C.primaryDark,
    fontSize: 12, fontWeight: "800", textAlign: "center", lineHeight: 22, overflow: "hidden",
  },
  stepText: { fontSize: 13.5, color: C.ink },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: C.primaryTint, borderWidth: 1, borderColor: C.primarySoft, borderRadius: 8,
    paddingVertical: 2, paddingHorizontal: 8,
  },
  chipText: { fontSize: 13, fontWeight: "700", color: C.primaryDark },
  btn: { ...W.primary, height: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
