import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Image, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";
import { useRealtime } from "../lib/realtime";
import { currentUser } from "../lib/session";
import { RECORD_STATUS } from "../lib/status";
import { goBack, useRefreshOnFocus } from "../lib/nav";
import { confirmAction, notify } from "../lib/notify";
import Countdown from "../components/Countdown";

const KIND_TH: Record<string, string> = { borrow: "ขอยืม", return: "ขอคืน", renew: "ขอยืมต่อ" };

// ผลคำขอที่จบแล้ว (แสดงย้อนหลังไม่กี่รายการ)
const REQUEST_RESULT: Record<string, { label: string; color: string; bg: string }> = {
  approved:      { label: "อนุมัติแล้ว",     color: "#16a34a", bg: "#dcfce7" },
  declined:      { label: "ถูกปฏิเสธ",      color: "#dc2626", bg: "#fee2e2" },
  expired:       { label: "หมดอายุ",        color: "#64748b", bg: "#f1f5f9" },
  cancelled:     { label: "ยกเลิกแล้ว",     color: "#64748b", bg: "#f1f5f9" },
  auto_returned: { label: "คืนอัตโนมัติ",   color: "#b45309", bg: "#fef3c7" },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  borrowed:       { ...RECORD_STATUS.borrowed, icon: "cube-outline" },
  pending_return: { ...RECORD_STATUS.pending_return, icon: "hourglass-outline" },
  returned:       { ...RECORD_STATUS.returned, icon: "checkmark-circle-outline" },
};

const formatDate = (d: string) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};

const getDaysLeft = (due: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(due).getTime() - today.getTime()) / 86400000);
};

export default function Borrow() {
  const router = useRouter();
  const [borrows, setBorrows] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBorrows = useCallback(async () => {
    const user = await currentUser();
    if (!user) { setLoading(false); return; }
    const [{ data }, { data: reqs }] = await Promise.all([
      supabase
        .from("borrow_records")
        // borrow_records ไม่มีคอลัมน์ created_at (ใช้ borrow_date)
        .select("id, status, borrow_date, due_date, renew_count, auto_returned, return_condition, damage_cost, item_id, items(name, item_code, image_url)")
        .eq("user_id", user.id)
        .order("borrow_date", { ascending: false }),
      supabase
        .from("borrow_requests")
        .select("id, kind, status, days, created_at, expires_at, decision_note, items(name, item_code)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);
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
  // ผลล่าสุดใน 7 วัน (ไม่รวม "อนุมัติยืม" เพราะเห็นในรายการยืมอยู่แล้ว)
  const weekAgo = Date.now() - 7 * 86400000;
  const recentResults = requests
    .filter((r) => r.status !== "pending" && new Date(r.created_at).getTime() > weekAgo)
    .filter((r) => !(r.kind === "borrow" && r.status === "approved"))
    .slice(0, 5);

  useEffect(() => { fetchBorrows(); }, [fetchBorrows]);
  // กลับมาหน้านี้ (ปุ่ม ← / สลับแท็บ) → โหลดข้อมูลใหม่
  useRefreshOnFocus(() => { fetchBorrows(); });
  // Realtime: ผลคำขอ (อนุมัติ/ปฏิเสธ/หมดเวลา) มาเป็นแจ้งเตือน → โหลดรายการใหม่ทันที
  useRealtime("user", "notification", () => { fetchBorrows(); });

  const onRefresh = () => { setRefreshing(true); fetchBorrows(); };

  const activeBorrows = borrows.filter(b => b.status === "borrowed" || b.status === "pending_return").length;
  const returned      = borrows.filter(b => b.status === "returned").length;

  return (
    <View style={s.container}>
      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => goBack("/home")} activeOpacity={0.84}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>ประวัติการยืม</Text>
          <Text style={s.headerSub}>อุปกรณ์ของฉัน</Text>
        </View>
        <TouchableOpacity style={s.backBtn} onPress={() => router.push("/scan")} activeOpacity={0.84}>
          <Ionicons name="scan" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}
        >
          {/* STATS */}
          <View style={s.statsRow}>
            <View style={[s.statCard, { borderLeftColor: "#3b82f6" }]}>
              <Text style={s.statNum}>{borrows.length}</Text>
              <Text style={s.statLabel}>ทั้งหมด</Text>
            </View>
            <View style={[s.statCard, { borderLeftColor: "#f59e0b" }]}>
              <Text style={[s.statNum, { color: "#b45309" }]}>{activeBorrows}</Text>
              <Text style={s.statLabel}>กำลังยืม</Text>
            </View>
            <View style={[s.statCard, { borderLeftColor: "#22c55e" }]}>
              <Text style={[s.statNum, { color: "#16a34a" }]}>{returned}</Text>
              <Text style={s.statLabel}>คืนแล้ว</Text>
            </View>
          </View>

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

          {recentResults.length > 0 && (
            <>
              <Text style={s.sectionLabel}>ผลคำขอล่าสุด</Text>
              {recentResults.map((r) => {
                const res = REQUEST_RESULT[r.status] ?? REQUEST_RESULT.expired;
                return (
                  <View key={r.id} style={[s.card, { borderLeftColor: res.color }]}>
                    <View style={s.cardBody}>
                      <Text style={s.cardName} numberOfLines={1}>
                        {KIND_TH[r.kind]} {r.items?.item_code || r.items?.name || "อุปกรณ์"}
                      </Text>
                      <Text style={s.cardDate}>{formatDate(r.created_at)}</Text>
                      {!!r.decision_note && <Text style={s.cardDue}>เหตุผล: {r.decision_note}</Text>}
                    </View>
                    <View style={[s.badge, { backgroundColor: res.bg }]}>
                      <Text style={[s.badgeText, { color: res.color }]}>{res.label}</Text>
                    </View>
                  </View>
                );
              })}
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
              <Text style={s.sectionLabel}>รายการทั้งหมด ({borrows.length})</Text>
              {borrows.map((b) => {
                const cfg   = STATUS_CFG[b.status] ?? STATUS_CFG.returned;
                const name  = b.items?.item_code || b.items?.name || b.items?.[0]?.item_code || b.items?.[0]?.name || "อุปกรณ์";
                const img   = b.items?.image_url || b.items?.[0]?.image_url || null;
                const bDate = b.borrow_date || b.created_at;
                const days  = b.due_date ? getDaysLeft(b.due_date) : null;
                const overdue = days !== null && days < 0 && b.status === "borrowed";

                return (
                  <View
                    key={b.id}
                    style={[s.card, { borderLeftColor: cfg.border }, overdue && s.cardOverdue]}
                  >
                    {/* รูปหรือ icon */}
                    {img ? (
                      <Image source={{ uri: img }} style={s.itemImg} />
                    ) : (
                      <View style={[s.iconBox, { backgroundColor: cfg.bg }]}>
                        <Ionicons name={cfg.icon} size={22} color={cfg.color} />
                      </View>
                    )}

                    {/* ข้อมูล */}
                    <View style={s.cardBody}>
                      <Text style={s.cardName} numberOfLines={1}>{name}</Text>
                      <Text style={s.cardDate}>ยืม {formatDate(bDate)}</Text>
                      {b.due_date && (
                        <Text style={[s.cardDue, overdue && s.cardDueOverdue]}>
                          {overdue
                            ? `⚠️ เกินกำหนด ${Math.abs(days!)} วัน`
                            : b.status === "borrowed"
                              ? `ครบกำหนด ${formatDate(b.due_date)} · อีก ${days} วัน`
                              : `ครบกำหนด ${formatDate(b.due_date)}`}
                          {b.renew_count > 0 ? " · ยืมต่อแล้ว" : ""}
                        </Text>
                      )}
                      {b.status === "returned" && (b.auto_returned || b.return_condition === "damaged") && (
                        <Text style={[s.cardDue, { color: "#b45309" }]}>
                          {b.auto_returned
                            ? "คืนอัตโนมัติ (ยังไม่ได้ตรวจสภาพ)"
                            : `ตรวจพบชำรุด${b.damage_cost != null ? ` · ค่าเสียหาย ${b.damage_cost} บาท` : ""}`}
                        </Text>
                      )}
                    </View>

                    {/* badge */}
                    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  header: {
    backgroundColor: "#2563eb",
    paddingTop: 54, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  backBtn: {
    width: 39,
    height: 39,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.23)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", textAlign: "center" },
  headerSub:   { color: "#93c5fd", fontSize: 12, textAlign: "center", marginTop: 2 },

  body: { padding: 16 },

  statsRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14,
    padding: 14, borderLeftWidth: 4,
  },
  statNum:   { fontSize: 24, fontWeight: "800", color: "#1e293b" },
  statLabel: { fontSize: 11, color: "#94a3b8", marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 10,
  },

  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12,
    borderLeftWidth: 4,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardOverdue: { borderColor: "#fca5a5", borderWidth: 1.5, borderLeftWidth: 4 },
  iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  itemImg: { width: 48, height: 48, borderRadius: 12 },

  cardBody: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  cardDate: { fontSize: 11, color: "#94a3b8", marginTop: 3 },
  cardDue:  { fontSize: 11, color: "#64748b", marginTop: 2 },
  cardDueOverdue: { color: "#dc2626", fontWeight: "700" },
  tapHint: { fontSize: 10, color: "#f97316", marginTop: 4, fontWeight: "600" },
  reqCard: { borderLeftColor: "#fb923c" },
  countdown: { fontSize: 12, color: "#c2410c", fontWeight: "800", marginTop: 3 },
  cancelBtn: {
    borderWidth: 1.5, borderColor: "#ef4444", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  cancelBtnText: { color: "#ef4444", fontSize: 12, fontWeight: "800" },

  badge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: "flex-start",
  },
  badgeText: { fontSize: 10, fontWeight: "700" },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#475569", marginTop: 8 },
  emptyText: { fontSize: 13, color: "#94a3b8", textAlign: "center", lineHeight: 20 },
});
