import React, { useEffect } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../components/AppText";
import { PressScale } from "../components/Motion";
import { Thumb, availTone, formatDue, getSelectedGroup, setPendingAction } from "../components/EquipmentParts";
import { ITEM_STATUS } from "../lib/status";
import { useSheetFit } from "../lib/sheetFit";
import { C, W } from "../lib/theme";

// แผ่นรายละเอียดรุ่น (หน้าอุปกรณ์ของ นศ.) — แผ่นมาตรฐานของ iOS (presentation "formSheet" ตั้งใน app/_layout.tsx)
//   เจ้าของโปรเจกต์เลือก 11 ต.ค. 2569: iOS เลื่อนแผ่นเอง (120Hz แม้ใน Expo Go) + ฉากเทาระบบจางพร้อมแผ่น + ปัดลงเพื่อปิด
//   สูงพอดีเนื้อหา (lib/sheetFit) / เนื้อหาทั้งแผ่นอยู่ใน ScrollView ตัวเดียวที่เป็นรากของแผ่น
//   ห้ามมี ScrollView ซ้อนข้างใน: แผ่นของ iOS จับ ScrollView ตัวแรกไปผูกกับท่าปัดลง แล้วยืดให้เต็มแผ่น
//   (เคยเป็นรายการชิ้นที่ยืดทับส่วนหัวจนหาย + มีช่องว่างกลางแผ่น — เจอบน iPhone 11 ต.ค. 2569)
const ROW = 45; // ความสูงแถวชิ้นโดยประมาณ

export default function EquipmentSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const g = getSelectedGroup();
  // ประมาณความสูงก่อนแผ่นขึ้น (แล้ว useSheetFit วัดจริงอีกรอบ): หัว + วิธียืม + หัวข้อรายการ + แถวชิ้น + ปุ่มล่าง + ขอบล่างจอ
  const estimate = g
    ? 22 + 96 + (g.description ? 70 : 0) + 80 + 46 + g.units.length * ROW + (g.available > 0 ? 130 : 0) + Math.max(insets.bottom, 16)
    : 400;
  const fit = useSheetFit(estimate);

  // เปิดตรงจากลิงก์/รีเฟรชหน้า (ไม่มีรุ่นที่เลือก) → ปิดแผ่น
  useEffect(() => {
    if (!g) router.back();
  }, []);
  if (!g) return null;

  const tone = availTone(g);
  // สแกน: ปิดแผ่นก่อน แล้วให้หน้าอุปกรณ์เปิดหน้าสแกนเมื่อกลับมาโฟกัส (push จากในแผ่นจะไปซ้อนอยู่ในแผ่น)
  const goScan = () => {
    setPendingAction("scan");
    router.back();
  };

  return (
    <ScrollView style={s.fill} showsVerticalScrollIndicator={false} bounces={false}>
      <Stack.Screen options={{ sheetAllowedDetents: fit.detents }} />
      {/* วัดความสูงเนื้อหาจริงจาก View นี้ (ไม่ยืดเต็มแผ่น) */}
      <View style={[s.root, { paddingBottom: Math.max(insets.bottom, 16) }]} onLayout={fit.onLayout}>
      <View style={s.head}>
        <Thumb image={g.image} category={g.category} size={84} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name}>{g.name}</Text>
          <Text style={s.sub}>{g.category} · ห้อง {g.location}</Text>
          <View style={[s.avail, { backgroundColor: tone.bg }]}>
            <Text style={[s.availText, { color: tone.fg }]}>ว่าง {g.available} จาก {g.units.length} ชิ้น</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => router.back()} style={s.closeBtn} hitSlop={8} accessibilityLabel="ปิด">
          <Ionicons name="close" size={20} color={C.muted} />
        </TouchableOpacity>
      </View>

      {g.description ? <Text style={s.desc}>{g.description}</Text> : null}

      {/* วิธียืม — อยู่บนรายการชิ้น (รุ่นที่มีหลายชิ้นจะไม่ดันข้อความนี้ตกจอ) */}
      <View style={s.howTo}>
        <Ionicons name="information-circle" size={20} color={C.primary} />
        <Text style={s.howToText}>
          {g.available > 0
            ? `ไปที่ห้อง ${g.location} หยิบชิ้นที่ว่าง แล้วสแกน QR ที่ตัวอุปกรณ์เพื่อขอยืม`
            : g.nextDue
            ? `ตอนนี้ไม่มีชิ้นว่าง ชิ้นแรกครบกำหนดคืน ${formatDue(g.nextDue)}`
            : "ตอนนี้ไม่มีชิ้นว่าง ลองกลับมาดูใหม่ภายหลัง"}
        </Text>
      </View>

      <Text style={s.unitsTitle}>แต่ละชิ้น ({g.units.length})</Text>
      <View style={s.units}>
        {g.units.map((u, i) => {
          const st = ITEM_STATUS[u.status] || ITEM_STATUS.available;
          return (
            <View key={u.id} style={[s.unitRow, i > 0 && s.unitDivider]}>
              <Text style={s.unitCode}>{u.item_code || u.name}</Text>
              {u.status === "borrowed" && u.due_date ? <Text style={s.unitDue}>คืน {formatDue(u.due_date)}</Text> : null}
              <View style={[s.pill, { backgroundColor: st.bg }]}>
                <Text style={[s.pillText, { color: st.color }]}>{st.label}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {g.available > 0 ? (
        <View style={s.footer}>
          <PressScale style={s.scanBtn} onPress={goScan}>
            <Ionicons name="scan" size={18} color="#FFFFFF" />
            <Text style={s.scanBtnText}>เปิดกล้องสแกน QR</Text>
          </PressScale>
          {/* F2 ขอยืมแบบนัดรับ — แผ่นนัดรับซ้อนบนแผ่นนี้ (แบบแผ่นของ iOS) */}
          <TouchableOpacity
            style={s.pickupBtn}
            onPress={() => router.push({ pathname: "/pickup-sheet", params: { key: g.key, name: g.name } })}
            activeOpacity={0.85}
          >
            <Ionicons name="calendar-outline" size={17} color={C.primaryDark} />
            <Text style={s.pickupBtnText}>ขอยืมแบบนัดรับ</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.surface },
  root: { paddingHorizontal: 18, paddingTop: 22 },
  head: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  name: { color: C.ink, fontSize: 19, fontWeight: "700", lineHeight: 26 },
  sub: { color: C.text2, fontSize: 13, marginTop: 2 },
  avail: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  availText: { fontSize: 13, fontWeight: "700" },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" },
  desc: { color: C.text2, fontSize: 14, lineHeight: 21, marginTop: 14 },
  howTo: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: C.primaryTint },
  howToText: { flex: 1, color: C.primaryDark, fontSize: 13, lineHeight: 20 },
  unitsTitle: { color: C.ink, fontSize: 15, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  units: { borderRadius: 16, backgroundColor: "#F6F9FE", borderWidth: 1, borderColor: "#E3EAF5", paddingHorizontal: 14 },
  unitRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11 },
  unitDivider: { borderTopWidth: 1, borderTopColor: "#E3EAF5" },
  unitCode: { flex: 1, color: C.ink, fontSize: 14, fontWeight: "600" },
  unitDue: { color: C.text2, fontSize: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: "700" },
  footer: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E8EEF7" },
  scanBtn: { ...W.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50 },
  scanBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  pickupBtn: { ...W.small, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, marginTop: 8 },
  pickupBtnText: { color: C.primaryDark, fontSize: 14, fontWeight: "600" },
});
