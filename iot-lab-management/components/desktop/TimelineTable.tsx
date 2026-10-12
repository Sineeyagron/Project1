import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../AppText";
import { DayGroup, EVENT_STYLE } from "../../lib/timeline";
import { C } from "../../lib/theme";

// ประวัติยืม-คืนแบบตาราง (จอใหญ่) — ข้อมูลชุดเดียวกับ TimelineDays (lib/timeline) แค่จัดเป็นแถว/คอลัมน์
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

export default function TimelineTable({ groups, person }: { groups: DayGroup[]; person: (userId: string) => string }) {
  return (
    <View style={s.table}>
      <View style={[s.tr, s.trHead]}>
        <Text style={[s.th, { width: 64 }]}>เวลา</Text>
        <Text style={[s.th, { width: 130 }]}>รายการ</Text>
        <Text style={[s.th, { flex: 1.1 }]}>อุปกรณ์</Text>
        <Text style={[s.th, { flex: 1.4 }]}>ผู้ยืม</Text>
        <Text style={[s.th, { flex: 2 }]}>รายละเอียด</Text>
      </View>
      {groups.map((g) => (
        <View key={g.dayKey}>
          <View style={s.day}>
            <Text style={s.dayTitle}>{g.title}</Text>
            <Text style={s.dayWeek}>{g.weekday} · {g.events.length} รายการ</Text>
          </View>
          {g.events.map((e) => {
            const st = EVENT_STYLE[e.kind];
            return (
              <View key={e.key} style={s.tr}>
                <Text style={[s.td, s.muted, { width: 64 }]}>{time(e.at)}</Text>
                <View style={{ width: 130 }}>
                  <View style={[s.pill, { backgroundColor: st.bg }]}>
                    <Ionicons name={st.icon as any} size={12} color={st.color} />
                    <Text style={[s.pillText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                <Text style={[s.td, s.bold, { flex: 1.1 }]} numberOfLines={1}>{e.itemName}</Text>
                <Text style={[s.td, { flex: 1.4 }]} numberOfLines={1}>{person(e.userId)}</Text>
                <Text
                  style={[s.td, s.muted, { flex: 2 }, e.detailTone === "warn" && { color: C.warningInk }, e.detailTone === "bad" && { color: C.errorInk, fontWeight: "700" }]}
                  numberOfLines={2}
                >
                  {e.overdue ? "เกินกำหนด · " : ""}{e.detail}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  table: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#DCE6F5", overflow: "hidden", marginBottom: 14 },
  tr: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  trHead: { backgroundColor: "#FAFCFF", paddingVertical: 9 },
  th: { fontSize: 11.5, fontWeight: "700", color: "#94A3B8" },
  day: { flexDirection: "row", alignItems: "baseline", gap: 10, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6, backgroundColor: "#F8FBFF", borderBottomWidth: 1, borderBottomColor: "#EEF2F8" },
  dayTitle: { fontSize: 13.5, fontWeight: "900", color: C.ink },
  dayWeek: { fontSize: 12, color: "#64748B" },
  td: { fontSize: 13.5, color: C.ink },
  bold: { fontWeight: "800" },
  muted: { color: "#64748B", fontSize: 12.5 },
  pill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 11.5, fontWeight: "800" },
});
