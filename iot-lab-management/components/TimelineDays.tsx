import React from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { DayGroup, EVENT_STYLE, bkkTime } from "../lib/timeline";
import { C, W } from "../lib/theme";

// F3 รายการประวัติจัดกลุ่มตามวัน (ระบบยืม-คืน) ใช้ร่วมหน้า นศ. + Admin
// 1 วัน = การ์ดเดียว แถวคั่นเส้นบาง (ไม่ใช่การ์ดต่อแถว) · person = บรรทัด "ชื่อ · รหัส นศ." (Admin)
export default function TimelineDays({
  groups,
  showCount,
  person,
}: {
  groups: DayGroup[];
  showCount?: boolean;
  person?: (userId: string) => string;
}) {
  return (
    <>
      {groups.map((g) => (
        <View key={g.dayKey} style={s.group}>
          <View style={s.dayHead}>
            <Text style={s.dayTitle}>
              {g.title}
              {showCount ? <Text style={s.dayCount}>  · {g.events.length} รายการ</Text> : null}
            </Text>
            <Text style={s.weekday}>{g.weekday}</Text>
          </View>
          <View style={s.card}>
            {g.events.map((e, i) => {
              const st = EVENT_STYLE[e.kind];
              return (
                <View key={e.key} style={[s.row, i > 0 && s.divider]}>
                  <Text style={s.time}>{bkkTime(e.at)}</Text>
                  <View style={[s.iconBox, { backgroundColor: st.bg }]}>
                    <Ionicons name={st.icon as any} size={18} color={st.color} />
                  </View>
                  <View style={s.body}>
                    <Text style={s.title} numberOfLines={1}>
                      <Text style={{ color: st.color }}>{st.label}</Text>
                      {"  "}{e.itemName}
                    </Text>
                    {person ? <Text style={s.person} numberOfLines={1}>{person(e.userId)}</Text> : null}
                    <Text
                      style={[s.detail, e.detailTone === "warn" && { color: C.warningInk }, e.detailTone === "bad" && { color: C.errorInk, fontWeight: "600" }]}
                      numberOfLines={2}
                    >
                      {e.detail}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </>
  );
}

const s = StyleSheet.create({
  group: { marginBottom: 14 },
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, paddingHorizontal: 2 },
  dayTitle: { fontSize: 14, fontWeight: "700", color: C.ink },
  dayCount: { fontSize: 12, fontWeight: "600", color: C.faint },
  weekday: { fontSize: 12, color: C.faint },
  card: { ...W.card, paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: "#E3EAF5" },
  time: { width: 40, fontSize: 12.5, fontWeight: "600", color: C.text2, marginTop: 9 },
  iconBox: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "600", color: C.ink },
  person: { fontSize: 12, color: C.text2, marginTop: 1 },
  detail: { fontSize: 12, color: C.faint, marginTop: 2, lineHeight: 17 },
});
