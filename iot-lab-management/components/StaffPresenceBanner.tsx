import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { PRESENCE_ROLE, checkinTime, usePresence } from "../lib/presence";
import { C, W } from "../lib/theme";

// F4 แถบหน้าแรก นศ.: "มีผู้ดูแลอยู่ที่ IoT Lab ไหม" (ระบบยืม-คืน — แยกจากโค้ดระบบห้องในหน้าแรก)
// onPickup = ปุ่ม "ขอยืมแบบนัดรับ" (F2) — ยังไม่ส่ง = ซ่อนปุ่ม
export default function StaffPresenceBanner({ onPickup }: { onPickup?: () => void }) {
  const { list, loaded, error } = usePresence();
  if (!loaded || error) return null;

  if (list.length > 0) {
    return (
      <View style={[W.statGreen, s.box]}>
        <View style={s.head}>
          <View style={[s.dot, { backgroundColor: C.success }]} />
          <Text style={[s.title, { color: C.successInk }]}>มีผู้ดูแลอยู่ที่ IoT Lab ตอนนี้</Text>
        </View>
        {list.map((p) => (
          <Text key={p.user_id} style={s.person} numberOfLines={1}>
            <Text style={s.role}>{PRESENCE_ROLE[p.role] || "ผู้ดูแล"}</Text> {p.name} · เช็กอิน {checkinTime(p.checked_in_at)}
          </Text>
        ))}
        <Text style={s.hint}>ไปที่ห้องแล้วให้ผู้ดูแลเปิดตู้ จากนั้นสแกน QR ที่อุปกรณ์</Text>
      </View>
    );
  }

  return (
    <View style={[W.card, s.box]}>
      <View style={s.head}>
        <View style={[s.dot, { backgroundColor: "#94A3B8" }]} />
        <Text style={s.title}>ตอนนี้ไม่มีผู้ดูแลอยู่ที่ IoT Lab</Text>
      </View>
      {onPickup ? (
        <>
          <Text style={s.hint}>อยากยืมของ? ส่งคำขอนัดรับไว้ได้ ผู้ดูแลจะนัดเวลาให้</Text>
          <TouchableOpacity style={s.pickupBtn} onPress={onPickup} activeOpacity={0.85}>
            <Ionicons name="calendar-outline" size={16} color={C.primaryDark} />
            <Text style={s.pickupText}>ขอยืมแบบนัดรับ</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={s.hint}>ยืม-คืนต้องมีผู้ดูแลเปิดตู้ให้ ลองเช็กอีกครั้งภายหลัง</Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { padding: 14, gap: 4, marginBottom: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { flex: 1, fontSize: 14.5, fontWeight: "700", color: C.ink },
  person: { fontSize: 13, color: C.ink, marginTop: 2, marginLeft: 18 },
  role: { fontWeight: "700", color: C.successInk },
  pickupBtn: { ...W.small, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, marginTop: 8 },
  pickupText: { color: C.primaryDark, fontSize: 13.5, fontWeight: "600" },
  hint: { fontSize: 12, color: C.text2, marginTop: 2, marginLeft: 18, lineHeight: 17 },
});
