import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput } from "./AppText";
import Countdown from "./Countdown";
import supabase from "../lib/supabase";
import { who } from "../lib/people";
import { useRealtime } from "../lib/realtime";
import { useRefreshOnFocus } from "../lib/nav";
import { confirmAction, notify } from "../lib/notify";
import { bkkDayKey, bkkTime, thaiDay } from "../lib/timeline";
import { W, NG } from "../lib/theme";

// F2 แท็บ "นัดรับ" ในกล่องคำขอผู้ดูแล (ระบบยืม-คืน)
//   รอนัดเวลา: ปุ่มลัด ตอนนี้ / อีก 10 นาที / อีก 30 นาที / เลือกเวลา → schedule_pickup · ปฏิเสธต้องมีเหตุผล → decline_pickup
//   นัดแล้ว: เรียงตามเวลา + "นศ. ไม่มา · ยกเลิกนัด" → cancel_pickup(no_show)
// กติกาทั้งหมดอยู่ใน RPC (TA จัดการคำขอของตัวเองไม่ได้ / ของว่างหลังหักนัด)

const C = {
  purple: "#2563EB",
  ink: "#172033",
  muted: "#475569",
  faint: "#64748B",
  line: "#DCE6F5",
  green: "#047857",
  orange: "#c2410c",
  red: "#ef4444",
};

const SELECT = "id, user_id, item_prefix, days, note, status, pickup_at, created_at, expires_at, requester:profiles!pickup_requests_user_id_fkey(email, full_name, student_id)";

type Quick = "now" | "10" | "30" | "custom";
const QUICK: { key: Quick; label: string }[] = [
  { key: "now", label: "ตอนนี้" },
  { key: "10", label: "อีก 10 นาที" },
  { key: "30", label: "อีก 30 นาที" },
  { key: "custom", label: "เลือกเวลา" },
];
const DAY_CHOICES = [
  { offset: 0, label: "วันนี้" },
  { offset: 1, label: "พรุ่งนี้" },
  { offset: 2, label: "มะรืน" },
];

// วัน (ไทย) + "HH:mm" → ISO / เวลาไม่ถูกต้อง = null
function customIso(offset: number, hhmm: string) {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  const day = bkkDayKey(new Date(Date.now() + offset * 86400000).toISOString());
  return new Date(`${day}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00+07:00`).toISOString();
}

const whenLabel = (iso: string) => {
  const day = bkkDayKey(iso);
  return `${day === bkkDayKey(new Date().toISOString()) ? "วันนี้" : thaiDay(day)} ${bkkTime(iso)} น.`;
};

export default function PickupInbox({ role, userId, onCount }: { role: string | null; userId: string | null; onCount: (n: number) => void }) {
  const [pending, setPending] = useState<any[]>([]);
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("pickup_requests")
      .select(SELECT)
      .in("status", ["pending", "scheduled"])
      .order("created_at", { ascending: true });
    if (error) notify("โหลดคำขอนัดรับไม่สำเร็จ", error.message);
    const rows = data || [];
    const p = rows.filter((r: any) => r.status === "pending");
    setPending(p);
    setScheduled(rows.filter((r: any) => r.status === "scheduled").sort((a: any, b: any) => Date.parse(a.pickup_at) - Date.parse(b.pickup_at)));
    onCount(p.length);
    setLoading(false);
  }, [onCount]);

  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(() => { load(); });
  useRealtime("staff", "request", () => { load(); });

  if (loading) return <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 50 }} />;

  return (
    <View style={{ gap: 12 }}>
      <Text style={s.section}>รอนัดเวลา ({pending.length})</Text>
      {pending.length === 0 ? (
        <Text style={s.empty}>ไม่มีคำขอที่รอนัด</Text>
      ) : (
        pending.map((r) => <PendingCard key={r.id} r={r} self={role !== "admin" && r.user_id === userId} onDone={load} />)
      )}

      <Text style={[s.section, { marginTop: 6 }]}>นัดรับแล้ว ({scheduled.length})</Text>
      {scheduled.length === 0 ? (
        <Text style={s.empty}>ยังไม่มีนัด</Text>
      ) : (
        scheduled.map((r) => <ScheduledCard key={r.id} r={r} onDone={load} />)
      )}
    </View>
  );
}

function PendingCard({ r, self, onDone }: { r: any; self: boolean; onDone: () => void }) {
  const [quick, setQuick] = useState<Quick>("10");
  const [dayOffset, setDayOffset] = useState(0);
  const [time, setTime] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const at = quick === "now" ? new Date().toISOString()
    : quick === "10" ? new Date(Date.now() + 10 * 60000).toISOString()
    : quick === "30" ? new Date(Date.now() + 30 * 60000).toISOString()
    : customIso(dayOffset, time);

  const schedule = async () => {
    if (!at) return;
    setBusy(true);
    const { error } = await supabase.rpc("schedule_pickup", { p_id: r.id, p_pickup_at: at });
    setBusy(false);
    if (error) {
      notify("นัดไม่สำเร็จ", error.message);
      onDone();
      return;
    }
    onDone();
  };

  const decline = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("decline_pickup", { p_id: r.id, p_note: reason.trim() });
    setBusy(false);
    if (error) {
      notify("ปฏิเสธไม่สำเร็จ", error.message);
      return;
    }
    onDone();
  };

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={[s.pill, { backgroundColor: "#fef3c7" }]}>
          <Ionicons name="calendar-outline" size={13} color="#b45309" />
          <Text style={[s.pillText, { color: "#b45309" }]}>รอนัดเวลา</Text>
        </View>
        <Countdown until={r.expires_at} onDone={onDone} style={s.countdown} />
      </View>
      <Text style={s.code}>{r.item_prefix} · ยืม {r.days} วัน</Text>
      <Text style={s.meta} numberOfLines={1}>{who(r.requester)}</Text>
      {r.note ? <Text style={s.note}>หมายเหตุ นศ.: {r.note}</Text> : null}

      {self ? (
        <Text style={s.selfNote}>คำขอของคุณเอง — ให้ผู้ดูแลคนอื่นนัดให้</Text>
      ) : declining ? (
        <>
          <TextInput
            style={[s.input, { minHeight: 64 }]}
            value={reason}
            onChangeText={setReason}
            placeholder="เหตุผลที่ปฏิเสธ (จำเป็น) — ผู้ขอจะเห็นข้อความนี้"
            placeholderTextColor={C.faint}
            multiline
          />
          <View style={s.actions}>
            <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={() => setDeclining(false)} activeOpacity={0.85}>
              <Text style={s.btnGhostText}>กลับ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: C.red }, (!reason.trim() || busy) && s.off]} onPress={decline} disabled={!reason.trim() || busy} activeOpacity={0.85}>
              <Text style={s.btnText}>ยืนยันปฏิเสธ</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={s.label}>นัดรับเมื่อ</Text>
          <View style={s.chipRow}>
            {QUICK.map((q) => (
              <TouchableOpacity key={q.key} style={[s.chip, quick === q.key && s.chipOn]} onPress={() => setQuick(q.key)} activeOpacity={0.85}>
                <Text style={[s.chipText, quick === q.key && s.chipTextOn]}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {quick === "custom" && (
            <View style={s.customRow}>
              {DAY_CHOICES.map((d) => (
                <TouchableOpacity key={d.offset} style={[s.chip, dayOffset === d.offset && s.chipOn]} onPress={() => setDayOffset(d.offset)} activeOpacity={0.85}>
                  <Text style={[s.chipText, dayOffset === d.offset && s.chipTextOn]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                style={[s.input, s.timeInput, !!time && !at && { borderColor: C.red }]}
                value={time}
                onChangeText={setTime}
                placeholder="13:30"
                placeholderTextColor={C.faint}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          )}
          {at ? <Text style={s.when}>นัด {whenLabel(at)}</Text> : quick === "custom" ? <Text style={s.hint}>พิมพ์เวลาแบบ ชม.:นาที เช่น 13:30</Text> : null}
          <View style={s.actions}>
            <TouchableOpacity style={[s.btn, s.btnDecline]} onPress={() => setDeclining(true)} activeOpacity={0.85}>
              <Text style={s.btnDeclineText}>ปฏิเสธ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: C.green }, (!at || busy) && s.off]} onPress={schedule} disabled={!at || busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>ยืนยันนัดรับ</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function ScheduledCard({ r, onDone }: { r: any; onDone: () => void }) {
  const late = Date.parse(r.pickup_at) < Date.now();
  const noShow = () => {
    confirmAction("นศ. ไม่มาตามนัด", `ยกเลิกนัดรับ ${r.item_prefix} ของ ${who(r.requester)} ?`, "ยกเลิกนัด", async () => {
      const { error } = await supabase.rpc("cancel_pickup", { p_id: r.id, p_no_show: true });
      if (error) {
        notify("ยกเลิกไม่สำเร็จ", error.message);
        return;
      }
      onDone();
    }, true);
  };
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={[s.pill, { backgroundColor: "#ECFDF5" }]}>
          <Ionicons name="time-outline" size={13} color={C.green} />
          <Text style={[s.pillText, { color: C.green }]}>{whenLabel(r.pickup_at)}</Text>
        </View>
        {late ? <Text style={[s.countdown, { color: "#dc2626" }]}>เลยเวลานัด</Text> : null}
      </View>
      <Text style={s.code}>{r.item_prefix} · ยืม {r.days} วัน</Text>
      <Text style={s.meta} numberOfLines={1}>{who(r.requester)}</Text>
      {r.note ? <Text style={s.note}>หมายเหตุ นศ.: {r.note}</Text> : null}
      <TouchableOpacity style={[s.btn, s.btnDecline, { alignSelf: "flex-start", paddingHorizontal: 14 }]} onPress={noShow} activeOpacity={0.85}>
        <Text style={s.btnDeclineText}>นศ. ไม่มา · ยกเลิกนัด</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  section: { fontSize: 15, fontWeight: "900", color: C.ink },
  empty: { fontSize: 13, color: C.faint, fontWeight: "700" },
  card: { ...W.card, padding: 14, gap: 8 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: "900" },
  countdown: { fontSize: 12, fontWeight: "900", color: C.orange },
  code: { fontSize: 18, fontWeight: "900", color: C.ink },
  meta: { fontSize: 12.5, fontWeight: "700", color: C.muted },
  note: { fontSize: 12.5, fontWeight: "700", color: C.ink },
  label: { fontSize: 12, fontWeight: "800", color: C.muted, marginTop: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  customRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: "#f8fafc" },
  chipOn: { ...NG, backgroundColor: C.purple, borderColor: C.purple },
  chipText: { fontWeight: "800", color: C.muted, fontSize: 13 },
  chipTextOn: { color: "#fff" },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 10, fontSize: 14, color: C.ink, textAlignVertical: "top", backgroundColor: "#fff" },
  timeInput: { width: 76, textAlign: "center", fontWeight: "800" },
  when: { fontSize: 13, fontWeight: "800", color: C.green },
  hint: { fontSize: 12, color: C.faint, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 2 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "900" },
  btnDecline: { borderWidth: 1.5, borderColor: C.red, backgroundColor: "#fff", flex: 0.6 },
  btnDeclineText: { color: C.red, fontWeight: "900" },
  btnGhost: { borderWidth: 1, borderColor: C.line, backgroundColor: "#fff", flex: 0.6 },
  btnGhostText: { color: C.muted, fontWeight: "900" },
  selfNote: { fontSize: 13, fontWeight: "700", color: "#b45309", backgroundColor: "#fffbeb", padding: 10, borderRadius: 10, overflow: "hidden" },
  off: { opacity: 0.45 },
});
