import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { PRESENCE_ROLE, checkinTime, staffCheckIn, staffCheckOut, usePresence } from "../lib/presence";
import { currentUser } from "../lib/session";
import { notify } from "../lib/notify";
import { C, W } from "../lib/theme";

// F4 การ์ดบนแดชบอร์ด Admin/TA: เช็กอิน/เช็กเอาท์ปุ่มเดียว + รายชื่อคนที่อยู่ห้องตอนนี้
export default function StaffCheckInCard() {
  const { list, reload } = usePresence();
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { currentUser().then((u) => setMe(u?.id ?? null)); }, []);

  const mine = list.find((p) => p.user_id === me);

  const toggle = async () => {
    setBusy(true);
    const { error } = mine ? await staffCheckOut() : await staffCheckIn();
    setBusy(false);
    if (error) {
      notify(mine ? "เช็กเอาท์ไม่สำเร็จ" : "เช็กอินไม่สำเร็จ", error.message);
      return;
    }
    reload();
  };

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={[s.dot, { backgroundColor: mine ? C.success : "#94A3B8" }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{mine ? "คุณอยู่ที่ IoT Lab" : "คุณยังไม่ได้เช็กอิน"}</Text>
          <Text style={s.sub}>{mine ? `เช็กอิน ${checkinTime(mine.checked_in_at)} · นศ. เห็นว่ามีผู้ดูแลอยู่` : "เช็กอินเมื่อมาถึงห้อง นศ. จะเห็นว่ามีคนเปิดตู้ให้"}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[mine ? s.outBtn : s.inBtn, busy && { opacity: 0.6 }]}
        onPress={toggle}
        disabled={busy || !me}
        activeOpacity={0.85}
      >
        {busy ? (
          <ActivityIndicator color={mine ? C.errorInk : "#fff"} />
        ) : (
          <>
            <Ionicons name={mine ? "log-out-outline" : "location-outline"} size={18} color={mine ? C.errorInk : "#fff"} />
            <Text style={mine ? s.outText : s.inText}>{mine ? "เช็กเอาท์ (ออกจากห้อง)" : "เช็กอิน อยู่ที่ IoT Lab"}</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={s.label}>ตอนนี้อยู่ที่ห้อง</Text>
      {list.length === 0 ? (
        <Text style={s.empty}>ยังไม่มีใคร</Text>
      ) : (
        list.map((p) => (
          <Text key={p.user_id} style={s.person} numberOfLines={1}>
            <Text style={s.role}>{PRESENCE_ROLE[p.role] || "ผู้ดูแล"}</Text> {p.name} · {checkinTime(p.checked_in_at)}
          </Text>
        ))
      )}
      <Text style={s.note}>ลืมเช็กเอาท์ ระบบจะเช็กเอาท์ให้อัตโนมัติ 17:00</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { ...W.card, padding: 14, gap: 6, marginBottom: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { fontSize: 16, fontWeight: "600", color: C.ink },
  sub: { fontSize: 12.5, color: C.text2, marginTop: 1 },
  inBtn: { ...W.primary, flexDirection: "row", gap: 8, minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 4 },
  inText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  outBtn: {
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  outText: { color: C.errorInk, fontSize: 15, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "700", color: C.ink, marginTop: 6 },
  empty: { fontSize: 13, color: C.faint },
  person: { fontSize: 13, color: C.ink },
  role: { fontWeight: "700", color: C.primary },
  note: { fontSize: 11.5, color: C.faint, marginTop: 4 },
});
