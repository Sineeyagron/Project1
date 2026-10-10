import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Text } from "../components/AppText";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";
import { useRealtime } from "../lib/realtime";
import { currentUser } from "../lib/session";
import { goBack, useRefreshOnFocus } from "../lib/nav";
import { confirmAction, notify } from "../lib/notify";
import Countdown from "../components/Countdown";
import { W } from "../lib/theme";
import StatWidget from "../components/StatWidget";
import ScreenHeader, { HeaderButton } from "../components/ScreenHeader";
import TimelineDays from "../components/TimelineDays";
import { TimelineFilter, bkkDayKey, bkkTime, buildEvents, filterEvents, groupByDay, thaiDay } from "../lib/timeline";
import { PICKUP_STATUS } from "../lib/status";

const KIND_TH: Record<string, string> = { borrow: "ขอยืม", return: "ขอคืน", renew: "ขอยืมต่อ" };

// F3 ตัวกรองประวัติ (หน้า นศ.)
const FILTERS: { key: TimelineFilter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "borrow", label: "ยืมออก" },
  { key: "return", label: "คืนเข้า" },
  { key: "other", label: "อื่น ๆ" },
];

// ข้อมูลชุดล่าสุด (หน่วยความจำ) — เปิดหน้าซ้ำเห็นประวัติทันที แล้วค่อยโหลดใหม่เบื้องหลัง / ล้างเมื่อออกจากระบบ
type BorrowCache = { borrows: any[]; requests: any[]; maxActive: number; pickups: any[]; pickupLog: any[] };
let cache: BorrowCache | null = null;
supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") cache = null; });

export default function Borrow() {
  const router = useRouter();
  const [borrows, setBorrows] = useState<any[]>(cache?.borrows ?? []);
  const [requests, setRequests] = useState<any[]>(cache?.requests ?? []);
  const [loading, setLoading] = useState(!cache);
  const [refreshing, setRefreshing] = useState(false);
  const [maxActive, setMaxActive] = useState(cache?.maxActive ?? 3);
  // F2 นัดรับของที่ยังไม่จบ (รอนัด / นัดแล้ว)
  const [pickups, setPickups] = useState<any[]>(cache?.pickups ?? []);
  // นัดรับที่จบแล้ว/นัดแล้ว สำหรับประวัติ (F3)
  const [pickupLog, setPickupLog] = useState<any[]>(cache?.pickupLog ?? []);
  const [filter, setFilter] = useState<TimelineFilter>("all");

  const fetchBorrows = useCallback(async () => {
    const user = await currentUser();
    if (!user) { setLoading(false); return; }
    const [{ data }, { data: reqs }, { data: setting }, { data: pks }, { data: pkLog }] = await Promise.all([
      supabase
        .from("borrow_records")
        // borrow_records ไม่มีคอลัมน์ created_at (ใช้ borrow_date)
        .select("id, user_id, status, borrow_date, return_date, due_date, renew_count, auto_returned, return_condition, damage_cost, item_id, items(name, item_code, image_url)")
        .eq("user_id", user.id)
        .order("borrow_date", { ascending: false }),
      supabase
        .from("borrow_requests")
        .select("id, user_id, item_id, borrow_record_id, kind, status, days, created_at, expires_at, decided_at, decision_note, items(name, item_code)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase.from("app_settings").select("value").eq("key", "max_active_borrows").maybeSingle(),
      supabase.rpc("my_pickups"),
      supabase
        .from("pickup_requests")
        .select("id, user_id, item_prefix, days, status, pickup_at, decided_at")
        .eq("user_id", user.id)
        .in("status", ["scheduled", "picked_up", "no_show"])
        .order("decided_at", { ascending: false })
        .limit(100),
    ]);
    setPickups(pks || []);
    setPickupLog(pkLog || []);
    const max = Number(setting?.value);
    const nextMax = Number.isFinite(max) && max > 0 ? max : 3;
    setMaxActive(nextMax);
    cache = { borrows: data || [], requests: reqs || [], maxActive: nextMax, pickups: pks || [], pickupLog: pkLog || [] };
    setBorrows(data || []);
    setRequests(reqs || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  const cancelRequest = (req: any) => {
    const code = req.items?.item_code || req.items?.name || "อุปกรณ์";
    confirmAction("ยกเลิกคำขอ", `ยกเลิก${KIND_TH[req.kind]} ${code} ?`, "ยกเลิกคำขอ", async () => {
      const { error } = await supabase.rpc("cancel_request", { p_request_id: req.id });
      if (error) {
        notify("ยกเลิกไม่สำเร็จ", error.message);
        return;
      }
      fetchBorrows();
    }, true);
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");

  // F3 เหตุการณ์จัดกลุ่มตามวัน (ใหม่สุดบน)
  const events = useMemo(() => {
    const names: Record<string, string> = {};
    [...borrows, ...requests].forEach((r) => {
      const it = Array.isArray(r.items) ? r.items[0] : r.items;
      if (r.item_id && it) names[r.item_id] = it.item_code || it.name;
    });
    return buildEvents(borrows, requests, { itemName: (id) => (id && names[id]) || "อุปกรณ์" }, pickupLog);
  }, [borrows, requests, pickupLog]);
  const groups = useMemo(() => groupByDay(filterEvents(events, filter)), [events, filter]);

  useEffect(() => { fetchBorrows(); }, [fetchBorrows]);
  // กลับมาหน้านี้ (ปุ่ม ← / สลับแท็บ) → โหลดข้อมูลใหม่
  useRefreshOnFocus(() => { fetchBorrows(); });
  // Realtime: ผลคำขอ (อนุมัติ/ปฏิเสธ/หมดเวลา) มาเป็นแจ้งเตือน → โหลดรายการใหม่ทันที
  useRealtime("user", "notification", () => { fetchBorrows(); });

  const onRefresh = () => { setRefreshing(true); fetchBorrows(); };

  const activeBorrows = borrows.filter(b => b.status === "borrowed" || b.status === "pending_return").length;
  const returned      = borrows.filter(b => b.status === "returned").length;
  const pendingBorrows = pendingRequests.filter((r) => r.kind === "borrow").length;
  const canBorrow = Math.max(maxActive - activeBorrows - pendingBorrows - pickups.length, 0);

  const cancelPickup = (p: any) => {
    confirmAction(
      p.status === "scheduled" ? "ยกเลิกนัด" : "ยกเลิกคำขอ",
      `ยกเลิกนัดรับ ${p.item_prefix} ?`,
      "ยกเลิก",
      async () => {
        const { error } = await supabase.rpc("cancel_pickup", { p_id: p.id });
        if (error) {
          notify("ยกเลิกไม่สำเร็จ", error.message);
          return;
        }
        fetchBorrows();
      },
      true
    );
  };

  return (
    <View style={s.container}>
      {/* HEADER */}
      <ScreenHeader
        title={"ประวัติการยืม"}
        subtitle={loading ? "อุปกรณ์ของฉัน" : `ยืมอยู่ ${activeBorrows} ชิ้น · ยืมได้อีก ${canBorrow} ชิ้น`}
        onBack={() => goBack("/home")}
        right={<HeaderButton icon="scan" label="สแกน" onPress={() => router.push("/scan")} />}
      />

      {loading ? (
        <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1D4ED8" />}
        >
          {/* STATS */}
          <View style={s.statsRow}>
            <StatWidget tone="blue" icon="layers-outline" label="ทั้งหมด" value={borrows.length} />
            <StatWidget tone="amber" icon="time-outline" label="กำลังยืม" value={activeBorrows} />
            <StatWidget tone="green" icon="checkmark" label="คืนแล้ว" value={returned} />
          </View>

          {/* F2 นัดรับของ */}
          {pickups.length > 0 && (
            <>
              <Text style={s.sectionLabel}>นัดรับของ ({pickups.length})</Text>
              {pickups.map((p) => {
                const st = PICKUP_STATUS[p.status] ?? PICKUP_STATUS.pending;
                const scheduled = p.status === "scheduled";
                const steps = ["ส่งคำขอ", "ผู้ดูแลนัดเวลา", "มารับของ แล้วสแกน QR ชิ้นที่ได้รับ", "กำลังยืม"];
                const done = scheduled ? 2 : 1;
                return (
                  <View key={p.id} style={[s.card, s.pickupCard]}>
                    <View style={s.pickupHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cardName} numberOfLines={1}>{p.item_prefix}</Text>
                        <Text style={s.cardDate}>ยืม {p.days} วัน{p.note ? ` · ${p.note}` : ""}</Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: st.bg }]}>
                        <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>

                    {scheduled && p.pickup_at ? (
                      <View style={s.pickupTime}>
                        <Ionicons name="calendar" size={18} color="#047857" />
                        <View style={{ flex: 1 }}>
                          <Text style={s.pickupTimeText}>
                            {bkkDayKey(p.pickup_at) === bkkDayKey(new Date().toISOString()) ? "วันนี้" : thaiDay(bkkDayKey(p.pickup_at))} · {bkkTime(p.pickup_at)} น.
                          </Text>
                          {!!p.scheduled_by_name && <Text style={s.pickupBy}>นัดโดย {p.scheduled_by_name}</Text>}
                        </View>
                      </View>
                    ) : (
                      <Countdown until={p.expires_at} onDone={fetchBorrows} style={s.countdown} />
                    )}

                    <View style={s.steps}>
                      {steps.map((t, i) => (
                        <View key={t} style={s.step}>
                          <Ionicons
                            name={i < done ? "checkmark-circle" : "ellipse-outline"}
                            size={16}
                            color={i < done ? "#047857" : i === done ? "#2563EB" : "#94A3B8"}
                          />
                          <Text style={[s.stepText, i === done && s.stepNow]}>{t}</Text>
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity style={[s.cancelBtn, { alignSelf: "flex-start" }]} onPress={() => cancelPickup(p)} activeOpacity={0.85}>
                      <Text style={s.cancelBtnText}>{scheduled ? "ยกเลิกนัด" : "ยกเลิกคำขอ"}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}

          {/* คำขอที่รอผู้ดูแล */}
          {pendingRequests.length > 0 && (
            <>
              <Text style={s.sectionLabel}>คำขอที่รออนุมัติ ({pendingRequests.length})</Text>
              {pendingRequests.map((r) => (
                <View key={r.id} style={[s.card, s.reqCard]}>
                  <View style={[s.iconBox, { backgroundColor: "#ffedd5" }]}>
                    <Ionicons name="hourglass-outline" size={22} color="#c2410c" />
                  </View>
                  <View style={s.cardBody}>
                    <Text style={s.cardName} numberOfLines={1}>
                      {KIND_TH[r.kind]} {r.items?.item_code || r.items?.name || "อุปกรณ์"}
                    </Text>
                    {!!r.days && <Text style={s.cardDate}>{r.days} วัน</Text>}
                    <Countdown until={r.expires_at} onDone={fetchBorrows} style={s.countdown} />
                  </View>
                  <TouchableOpacity style={s.cancelBtn} onPress={() => cancelRequest(r)} activeOpacity={0.85}>
                    <Text style={s.cancelBtnText}>ยกเลิก</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* LIST */}
          {borrows.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={52} color="#cbd5e1" />
              <Text style={s.emptyTitle}>ยังไม่มีประวัติการยืม</Text>
              <Text style={s.emptyText}>สแกน QR ที่ตัวอุปกรณ์ในห้องเพื่อขอยืม</Text>
            </View>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                {FILTERS.map((f) => {
                  const active = filter === f.key;
                  return (
                    <TouchableOpacity key={f.key} style={[s.chip, active && s.chipActive]} onPress={() => setFilter(f.key)} activeOpacity={0.85}>
                      <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              {groups.length === 0 ? (
                <Text style={s.emptyText}>ไม่มีรายการในหมวดนี้</Text>
              ) : (
                <TimelineDays groups={groups} />
              )}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },

  header: { ...W.headerBar,
    paddingTop: 52,
    paddingBottom: 10,
    marginBottom: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    ...W.iconBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#172033", fontSize: 20, fontWeight: "700" },
  headerSub:   { color: "#475569", fontSize: 12, marginTop: 1 },

  body: { padding: 16, paddingTop: 4, paddingBottom: 40 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },

  sectionLabel: {
    fontSize: 16, fontWeight: "600", color: "#172033",
    marginBottom: 10,
  },

  card: {
    ...W.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardOverdue: { borderColor: "#fca5a5", borderWidth: 1.5 },
  iconBox: { width: 46, height: 46, borderRadius: 15, justifyContent: "center", alignItems: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" },
  itemImg: { width: 46, height: 46, borderRadius: 15 },

  cardBody: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "600", color: "#172033" },
  cardDate: { fontSize: 12, color: "#475569", marginTop: 2 },
  cardDue:  { fontSize: 12, color: "#475569", marginTop: 1 },
  cardDueOverdue: { color: "#dc2626", fontWeight: "700" },
  tapHint: { fontSize: 10, color: "#f97316", marginTop: 4, fontWeight: "600" },
  reqCard: {},
  countdown: { fontSize: 12, color: "#c2410c", fontWeight: "600", marginTop: 2 },
  cancelBtn: {
    borderWidth: 1, borderColor: "#FCA5A5", backgroundColor: "#FFF5F5", borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  cancelBtnText: { color: "#B91C1C", fontSize: 13, fontWeight: "600" },

  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: "center",
  },
  badgeText: { fontSize: 12, fontWeight: "600" },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  pickupCard: { flexDirection: "column", alignItems: "stretch", gap: 10 },
  pickupHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  pickupTime: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: "#ECFDF5" },
  pickupTimeText: { fontSize: 15, fontWeight: "700", color: "#047857" },
  pickupBy: { fontSize: 12, color: "#475569", marginTop: 1 },
  steps: { gap: 4 },
  step: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepText: { fontSize: 12.5, color: "#64748B" },
  stepNow: { color: "#1D4ED8", fontWeight: "600" },
  chipRow: { gap: 8, paddingBottom: 12 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "#DCE6F5",
  },
  chipActive: { backgroundColor: "#2563EB", borderColor: "#2563EB", boxShadow: "0 4px 10px rgba(37,99,235,0.28)" },
  chipText: { color: "#475569", fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#475569", marginTop: 8 },
  emptyText: { fontSize: 13, color: "#475569", textAlign: "center", lineHeight: 20 },
});
