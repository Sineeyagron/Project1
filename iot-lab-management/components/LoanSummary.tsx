import React, { useCallback, useEffect, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "./AppText";
import { PressScale } from "./Motion";
import supabase from "../lib/supabase";
import { currentUser } from "../lib/session";
import { useRefreshOnFocus } from "../lib/nav";
import { useRealtime } from "../lib/realtime";
import { C, iconDot } from "../lib/theme";

// ช่อง "การยืมของฉัน" ในลิงก์ด่วนหน้าแรกนักศึกษา (ระบบยืม — แยกจากส่วนการ์ดห้องในหน้าแรก)
// ขนาด/หน้าตาเท่าช่องลิงก์ด่วนอื่น บอกสถานะสั้น ๆ + สีตามความเร่ง:
//   เกินกำหนด = แดง / ครบวันนี้-พรุ่งนี้ = เหลือง / ปกติ = ฟ้า / ไม่ได้ยืม = เรียบ ๆ
// กด → หน้าประวัติการยืม / โหลดใหม่: กลับมาหน้านี้ + มีแจ้งเตือนใหม่ (อนุมัติ/ปฏิเสธ/คืน ส่งแจ้งเตือนทุกครั้ง)

type Loan = { status: string; due: string | null };

const daysLeft = (date: string) => {
  const due = new Date(date);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
};
// วันครบกำหนดเก็บเป็นวันที่อย่างเดียว (ไม่มีเวลา)
const shortDate = (date: string) => new Date(date).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

export default function LoanQuickCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    const user = await currentUser();
    if (!user) return;
    const [loanRes, reqRes] = await Promise.all([
      supabase
        .from("borrow_records")
        .select("status, due_date")
        .eq("user_id", user.id)
        .in("status", ["borrowed", "pending_return"])
        .order("due_date", { ascending: true }),
      supabase
        .from("borrow_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("kind", "borrow")
        .eq("status", "pending"),
    ]);
    if (!loanRes.error) setLoans((loanRes.data || []).map((r: any) => ({ status: r.status, due: r.due_date })));
    if (!reqRes.error) setPending(reqRes.count || 0);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(() => { load(); });
  useRealtime("user", "notification", () => { load(); });

  const borrowed = loans.filter((l) => l.status === "borrowed" && l.due);
  const overdue = borrowed.filter((l) => daysLeft(l.due!) < 0).length;
  const next = borrowed[0]; // เรียง due_date มาแล้ว = ครบกำหนดเร็วสุด
  const nextDays = next ? daysLeft(next.due!) : null;

  // ข้อความบรรทัดรอง (สั้น พอดีช่องครึ่งจอ)
  let sub = "ยังไม่ได้ยืม";
  let tone = { fg: C.muted, dot: "#0EA5E9", bg: null as string | null, icon: "time-outline" as keyof typeof Ionicons.glyphMap };
  if (overdue > 0) {
    sub = `เกินกำหนด ${overdue} ชิ้น`;
    tone = { fg: C.errorInk, dot: C.error, bg: C.errorBg, icon: "alert" };
  } else if (nextDays !== null && nextDays <= 1) {
    sub = nextDays === 0 ? `คืนวันนี้ (${shortDate(next!.due!)})` : `คืนพรุ่งนี้ (${shortDate(next!.due!)})`;
    tone = { fg: C.warningInk, dot: C.warning, bg: C.warningBg, icon: "time" };
  } else if (loans.length > 0) {
    sub = next ? `ยืม ${loans.length} · คืน ${shortDate(next.due!)}` : `รอตรวจรับคืน ${loans.length}`;
    tone = { fg: C.primaryDark, dot: C.primary, bg: null, icon: "cube" };
  } else if (pending > 0) {
    sub = `รออนุมัติ ${pending} รายการ`;
    tone = { fg: C.primaryDark, dot: C.primary, bg: null, icon: "hourglass-outline" };
  }

  return (
    <PressScale
      style={[style, tone.bg ? { backgroundColor: tone.bg, borderColor: `${tone.dot}40` } : null]}
      onPress={() => router.push("/borrow")}
      accessibilityLabel={`การยืมของฉัน ${sub}`}
    >
      <View style={iconDot(tone.dot, 38)}>
        <Ionicons name={tone.icon} size={19} color="#FFFFFF" />
        {loans.length > 0 ? (
          <View style={[s.count, { backgroundColor: tone.dot }]}>
            <Text style={s.countText}>{loans.length}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.name} numberOfLines={1}>การยืมของฉัน</Text>
        <Text style={[s.sub, { color: tone.fg }, tone.bg ? s.subStrong : null]} numberOfLines={1}>{sub}</Text>
      </View>
    </PressScale>
  );
}

const s = StyleSheet.create({
  name: { color: C.ink, fontSize: 13, fontWeight: "600" },
  sub: { fontSize: 11 },
  subStrong: { fontWeight: "700" },
  count: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  countText: { color: "#FFFFFF", fontSize: 9.5, fontWeight: "700", lineHeight: 12 },
});
