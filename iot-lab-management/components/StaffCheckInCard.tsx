import React, { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View, ViewStyle, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { Pulse } from "./Motion";
import { PRESENCE_ROLE, PresentStaff, checkinTime, staffCheckIn, staffCheckOut } from "../lib/presence";
import { notify } from "../lib/notify";
import { C, W, gradient } from "../lib/theme";

// F4 การ์ดบนแดชบอร์ด Admin/TA แบบแถบเดียว (ย่อจาก ~190px ให้กล่องคำขอ/ทางลัดขึ้นมาใกล้ขึ้น — เจ้าของโปรเจกต์เลือก 11 ต.ค. 2569)
//   ยังไม่เช็กอิน: การ์ดส้มอำพันเต็มใบ + ไอคอนหมุดมีวงชีพจร + ปุ่มขาว "เช็กอิน" — ชวนกดตอนเข้ามา
//     (ส้ม ไม่ใช่น้ำเงิน จะได้ไม่ซ้ำกับกล่องคำขอตอนมีงานรอ — เจ้าของโปรเจกต์เลือก 11 ต.ค. 2569)
//   เช็กอินแล้ว: กลับเป็นแถบขาวเรียบ จุดเขียว + ปุ่มเช็กเอาท์ (กรอบแดง) ไม่แย่งสายตากล่องคำขอทั้งวัน
// รายชื่อมาจาก usePresence() ของหน้าแดชบอร์ด (ชุดเดียวกับจุดสีบนบรรทัดทักทาย ไม่โหลดซ้ำ)

// คนอื่นที่อยู่ห้อง: "TA สมศักดิ์" / "TA สมศักดิ์ +2"
function othersText(others: PresentStaff[]) {
  if (others.length === 0) return "";
  const first = `${PRESENCE_ROLE[others[0].role] || "ผู้ดูแล"} ${others[0].name}`;
  return others.length > 1 ? `${first} +${others.length - 1}` : first;
}

export default function StaffCheckInCard({ list, me, reload }: { list: PresentStaff[]; me: string | null; reload: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  // จอแคบมาก (~320px) หัวข้อเต็มถูกตัด → ใช้แบบสั้น (ปุ่มข้าง ๆ บอก "เช็กอิน" อยู่แล้ว)
  const narrow = useWindowDimensions().width < 350;

  const mine = list.find((p) => p.user_id === me);
  const others = othersText(list.filter((p) => p.user_id !== me));

  // กันกดรัวก่อนปุ่มทันเปลี่ยนเป็นวงหมุน (state ยังไม่ render → ส่ง RPC ซ้ำ) + วงหมุนค้างจนรายชื่อใหม่โหลดเสร็จ
  //   ไม่งั้นปุ่มกดได้อีกครั้งทั้งที่ยังขึ้นสถานะเก่าอยู่ชั่วครู่
  const lock = useRef(false);
  const toggle = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const { error } = mine ? await staffCheckOut() : await staffCheckIn();
      if (error) {
        notify(mine ? "เช็กเอาท์ไม่สำเร็จ" : "เช็กอินไม่สำเร็จ", error.message);
        return;
      }
      await reload();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  if (!mine) {
    return (
      <View style={s.hotCard}>
        <View style={s.pin}>
          <Pulse color="rgba(255,255,255,0.75)" size={34} grow={1.4} />
          <Ionicons name="location" size={18} color="#fff" />
        </View>
        <View style={s.body}>
          <Text style={s.hotTitle} numberOfLines={1}>{narrow ? "มาถึงแล้ว?" : "มาถึงแล้ว? เช็กอินเลย"}</Text>
          <Text style={s.hotSub} numberOfLines={1}>{others ? `ตอนนี้อยู่ห้อง: ${others}` : "นศ. จะเห็นว่ามีผู้ดูแลอยู่"}</Text>
        </View>
        <TouchableOpacity
          style={[s.whiteBtn, busy && { opacity: 0.6 }]}
          onPress={toggle}
          disabled={busy || !me}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="เช็กอิน อยู่ที่ IoT Lab"
        >
          {busy ? <ActivityIndicator size="small" color={C.warningInk} /> : <Text style={s.whiteText}>เช็กอิน</Text>}
        </TouchableOpacity>
      </View>
    );
  }

  // บรรทัดเดียว แสดงเฉพาะที่สำคัญ (เจ้าของโปรเจกต์เลือก 11 ต.ค. 2569 — ไม่ใช้ตัวหนังสือเลื่อน):
  //   อยู่คนเดียว → "ตั้งแต่ 02:22 · ออกอัตโนมัติ 17:00" / มีคนอื่น → "ตั้งแต่ 02:22 · กับ TA ชื่อ +2" (ตัด 17:00 ออก)
  //   ชื่อยาวจนล้น → ตัดท้ายเป็น "…" เวลาเช็กอินอยู่หน้าสุดจึงเห็นครบเสมอ
  const since = `ตั้งแต่ ${checkinTime(mine.checked_in_at)}`;
  const sub = others ? `${since} · กับ ${others}` : `${since} · ออกอัตโนมัติ 17:00`;

  return (
    <View style={s.card}>
      <View style={[s.dot, { backgroundColor: C.success }]} />
      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>อยู่ที่ IoT Lab</Text>
        <Text style={s.sub} numberOfLines={1}>{sub}</Text>
      </View>
      <TouchableOpacity
        style={[s.outBtn, busy && { opacity: 0.6 }]}
        onPress={toggle}
        disabled={busy || !me}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="เช็กเอาท์ ออกจากห้อง"
      >
        {busy ? <ActivityIndicator size="small" color={C.errorInk} /> : <Text style={s.outText}>เช็กเอาท์</Text>}
      </TouchableOpacity>
    </View>
  );
}

const ROW: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 14 };

const s = StyleSheet.create({
  card: { ...W.card, ...ROW },
  // ส้มอำพันจากชุดสี warning ของแอป (ไล่สีแบบเดียวกับ W.primary)
  hotCard: {
    ...ROW,
    borderRadius: 22,
    backgroundColor: C.warning,
    // ขอบบางเท่า W.card — สองสถานะสูงเท่ากัน สลับแล้วหน้าไม่กระตุก
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    ...gradient("linear-gradient(135deg, #D97706 0%, #F59E0B 60%, #FBBF24 100%)"),
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 4px rgba(180,83,9,0.2), 0 10px 22px rgba(245,158,11,0.32)",
  } as ViewStyle,
  dot: { width: 10, height: 10, borderRadius: 5 },
  pin: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.24)", alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14.5, fontWeight: "600", color: C.ink },
  sub: { fontSize: 12, color: C.text2, marginTop: 1 },
  hotTitle: { fontSize: 14.5, fontWeight: "700", color: "#fff" },
  hotSub: { fontSize: 12, fontWeight: "500", color: "#fff", marginTop: 1 },
  // ปุ่มกว้างคงที่ — ตอนกำลังโหลด (วงหมุน) การ์ดไม่ขยับ
  whiteBtn: {
    width: 92,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 10px rgba(120,53,15,0.22)",
  } as ViewStyle,
  whiteText: { color: C.warningInk, fontSize: 14, fontWeight: "700" },
  outBtn: {
    width: 92,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  outText: { color: C.errorInk, fontSize: 14, fontWeight: "600" },
});
