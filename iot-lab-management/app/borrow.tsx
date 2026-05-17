import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Image, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  borrowed:       { label: "กำลังยืม",  color: "#b45309", bg: "#fef3c7", border: "#f59e0b", icon: "cube-outline" },
  pending_return: { label: "กำลังยืม",  color: "#b45309", bg: "#fef3c7", border: "#f59e0b", icon: "cube-outline" },
  returned:       { label: "คืนแล้ว",   color: "#16a34a", bg: "#dcfce7", border: "#22c55e", icon: "checkmark-circle-outline" },
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBorrows = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("borrow_records")
      .select("id, status, borrow_date, due_date, created_at, item_id, items(name, image_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setBorrows(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchBorrows(); }, [fetchBorrows]);

  const onRefresh = () => { setRefreshing(true); fetchBorrows(); };

  const activeBorrows = borrows.filter(b => b.status === "borrowed" || b.status === "pending_return").length;
  const returned      = borrows.filter(b => b.status === "returned").length;

  return (
    <View style={s.container}>
      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>ประวัติการยืม</Text>
          <Text style={s.headerSub}>อุปกรณ์ของฉัน</Text>
        </View>
        <View style={{ width: 22 }} />
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

          {/* LIST */}
          {borrows.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={52} color="#cbd5e1" />
              <Text style={s.emptyTitle}>ยังไม่มีประวัติการยืม</Text>
              <Text style={s.emptyText}>เมื่อคุณยืมอุปกรณ์จะปรากฎที่นี่</Text>
            </View>
          ) : (
            <>
              <Text style={s.sectionLabel}>รายการทั้งหมด ({borrows.length})</Text>
              {borrows.map((b) => {
                const cfg   = STATUS_CFG[b.status] ?? STATUS_CFG.returned;
                const name  = b.items?.name || b.items?.[0]?.name || "อุปกรณ์";
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
    backgroundColor: "#1e3a8a",
    paddingTop: 54, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
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

  badge: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: "flex-start",
  },
  badgeText: { fontSize: 10, fontWeight: "700" },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#475569", marginTop: 8 },
  emptyText: { fontSize: 13, color: "#94a3b8", textAlign: "center", lineHeight: 20 },
});
