import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import supabase from "../../lib/supabase";

// render SVG string ที่เก็บใน DB โดยตรง
function SignaturePreview({ svgString }: { svgString: string }) {
  if (!svgString || !svgString.startsWith("<svg")) return null;
  const paths: { d: string; stroke: string; sw: number }[] = [];
  const re = /d="([^"]+)"[^/]*stroke="([^"]+)"[^/]*stroke-width="([^"]+)"/g;
  let m;
  while ((m = re.exec(svgString)) !== null) {
    paths.push({ d: m[1], stroke: m[2], sw: parseFloat(m[3]) });
  }
  return (
    <Svg width="100%" height={90} viewBox="0 0 320 180" style={{ backgroundColor: "#f8f9ff", borderRadius: 10 }}>
      {paths.map((p, i) => (
        <Path key={i} d={p.d} stroke={p.stroke} strokeWidth={p.sw}
          fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  borrowed:       { label: "กำลังยืม",  color: "#b45309", bg: "#fef3c7", border: "#f59e0b", icon: "cube-outline" },
  pending_return: { label: "รอคืน",     color: "#dc2626", bg: "#fee2e2", border: "#ef4444", icon: "time-outline" },
  returned:       { label: "คืนแล้ว",   color: "#16a34a", bg: "#dcfce7", border: "#22c55e", icon: "checkmark-circle-outline" },
};

const formatDate = (d: string) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};

const formatDateTime = (d: string) => {
  if (!d) return "-";
  return new Date(d).toLocaleString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const getDaysLeft = (due: string) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(due).getTime() - today.getTime()) / 86400000);
};


export default function AdminHistory() {
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("borrow_records")
      .select("*");

    if (error) {
      console.error("history fetch error:", error.message);
      setLoading(false); setRefreshing(false); return;
    }

    // ดึง item names แยก
    const itemIds = [...new Set((data || []).map((r: any) => r.item_id).filter(Boolean))];
    let itemMap: Record<string, string> = {};
    if (itemIds.length > 0) {
      const { data: items } = await supabase
        .from("items").select("id, name").in("id", itemIds);
      (items || []).forEach((it: any) => { itemMap[it.id] = it.name; });
    }

    // ดึง emails แยก
    const userIds = [...new Set((data || []).map((r: any) => r.user_id).filter(Boolean))];
    let emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles").select("id, email").in("id", userIds);
      (profiles || []).forEach((p: any) => { emailMap[p.id] = p.email; });
    }

    const merged = (data || []).map((r: any) => ({
      ...r,
      email: emailMap[r.user_id] || "-",
      itemName: itemMap[r.item_id] || "อุปกรณ์",
    }));

    // sort: borrow_date ล่าสุดก่อน, fallback due_date
    merged.sort((a: any, b: any) => {
      const aDate = a.borrow_date || a.due_date || "";
      const bDate = b.borrow_date || b.due_date || "";
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    setRecords(merged);
    applyFilter(merged, activeFilter, search);
    setLoading(false);
    setRefreshing(false);
  }, []);

  const applyFilter = (list: any[], filter: string, q: string) => {
    let result = filter === "all" ? list : list.filter(r => r.status === filter);
    if (q.trim()) {
      const lq = q.toLowerCase();
      result = result.filter(r =>
        r.itemName.toLowerCase().includes(lq) || r.email.toLowerCase().includes(lq)
      );
    }
    setFiltered(result);
  };

  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  useEffect(() => { applyFilter(records, activeFilter, search); }, [activeFilter, search, records]);

  const onRefresh = () => { setRefreshing(true); fetchHistory(); };
  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id);

  const total    = records.length;
  const active   = records.filter(r => r.status === "borrowed").length;
  const pending  = records.filter(r => r.status === "pending_return").length;
  const returned = records.filter(r => r.status === "returned").length;

  const FILTERS = [
    { key: "all",            label: "ทั้งหมด" },
    { key: "borrowed",       label: "กำลังยืม" },
    { key: "pending_return", label: "รอคืน" },
    { key: "returned",       label: "คืนแล้ว" },
  ];

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>ประวัติการยืม</Text>
          <Text style={s.headerSub}>จัดการรายการยืม-คืนทั้งหมด</Text>
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
              <Text style={s.statNum}>{total}</Text>
              <Text style={s.statLabel}>ทั้งหมด</Text>
            </View>
            <View style={[s.statCard, { borderLeftColor: "#f59e0b" }]}>
              <Text style={[s.statNum, { color: "#b45309" }]}>{active}</Text>
              <Text style={s.statLabel}>กำลังยืม</Text>
            </View>
            <View style={[s.statCard, { borderLeftColor: "#ef4444" }]}>
              <Text style={[s.statNum, { color: "#dc2626" }]}>{pending}</Text>
              <Text style={s.statLabel}>รอคืน</Text>
            </View>
            <View style={[s.statCard, { borderLeftColor: "#22c55e" }]}>
              <Text style={[s.statNum, { color: "#16a34a" }]}>{returned}</Text>
              <Text style={s.statLabel}>คืนแล้ว</Text>
            </View>
          </View>

          {/* SEARCH */}
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={16} color="#94a3b8" />
            <TextInput
              style={s.searchInput}
              placeholder="ค้นหาชื่ออุปกรณ์หรืออีเมล..."
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* FILTER TABS */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterRow}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[s.filterBtn, activeFilter === f.key && s.filterBtnActive]}
                onPress={() => setActiveFilter(f.key)}
              >
                <Text style={[s.filterTxt, activeFilter === f.key && s.filterTxtActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* LIST */}
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="document-outline" size={48} color="#cbd5e1" />
              <Text style={s.emptyTitle}>ไม่พบรายการ</Text>
            </View>
          ) : (
            <>
              <Text style={s.sectionLabel}>แสดง {filtered.length} รายการ</Text>
              {filtered.map((r) => {
                const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.returned;
                const bDate = r.borrow_date || r.due_date;
                const days = r.due_date ? getDaysLeft(r.due_date) : null;
                const overdue = days !== null && days < 0 && r.status === "borrowed";
                const isExpanded = expandedId === r.id;
                const borrowSig = r.borrow_signature_url || "";
                const returnSig = r.return_signature_url || "";

                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[s.card, { borderLeftColor: cfg.border }, overdue && s.cardOverdue]}
                    onPress={() => toggleExpand(r.id)}
                    activeOpacity={0.85}
                  >
                    {/* ROW หลัก */}
                    <View style={s.cardMain}>
                      <View style={[s.iconBox, { backgroundColor: cfg.bg }]}>
                        <Ionicons name={cfg.icon} size={22} color={cfg.color} />
                      </View>
                      <View style={s.cardBody}>
                        <Text style={s.cardName} numberOfLines={1}>{r.itemName}</Text>
                        <View style={s.cardRow}>
                          <Ionicons name="person-outline" size={11} color="#94a3b8" />
                          <Text style={s.cardEmail} numberOfLines={1}>{r.email}</Text>
                        </View>
                        {r.borrow_date && (
                        <View style={s.cardRow}>
                          <Ionicons name="time-outline" size={11} color="#94a3b8" />
                          <Text style={s.cardDate}>ยืม {formatDateTime(r.borrow_date)}</Text>
                        </View>
                      )}
                      <View style={s.cardRow}>
                          <Ionicons name="calendar-outline" size={11} color="#94a3b8" />
                          {r.due_date && (
                            <Text style={[s.cardDate, overdue && { color: "#dc2626", fontWeight: "700" }]}>
                              {overdue
                                ? `⚠️ เกิน ${Math.abs(days!)} วัน`
                                : `ครบ ${formatDate(r.due_date)}`}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 6 }}>
                        <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                          <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        <Ionicons
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={14} color="#94a3b8"
                        />
                      </View>
                    </View>

                    {/* EXPANDED: ลายเซ็น */}
                    {isExpanded && (
                      <View style={s.sigSection}>
                        <View style={s.sigDivider} />
                        <View style={s.sigRow}>
                          {/* ลายเซ็นยืม */}
                          <View style={s.sigBox}>
                            <Text style={s.sigLabel}>✍️ ลายเซ็นยืม</Text>
                            {borrowSig.startsWith("<svg") ? (
                              <View style={s.sigImgWrap}>
                                <SignaturePreview svgString={borrowSig} />
                              </View>
                            ) : (
                              <View style={s.sigEmpty}>
                                <Text style={s.sigEmptyTxt}>ไม่มีลายเซ็น</Text>
                              </View>
                            )}
                          </View>
                          {/* ลายเซ็นคืน */}
                          <View style={s.sigBox}>
                            <Text style={s.sigLabel}>✍️ ลายเซ็นคืน</Text>
                            {returnSig.startsWith("<svg") ? (
                              <View style={s.sigImgWrap}>
                                <SignaturePreview svgString={returnSig} />
                              </View>
                            ) : (
                              <View style={s.sigEmpty}>
                                <Text style={s.sigEmptyTxt}>
                                  {r.status === "returned" ? "ไม่มีลายเซ็น" : "ยังไม่ได้คืน"}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
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

  statsRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 10, borderLeftWidth: 4 },
  statNum:  { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  statLabel:{ fontSize: 10, color: "#94a3b8", marginTop: 2 },

  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, fontSize: 13, color: "#1e293b" },

  filterScroll: { marginBottom: 14 },
  filterRow: { flexDirection: "row", gap: 8, paddingRight: 4 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0",
  },
  filterBtnActive: { backgroundColor: "#1e3a8a", borderColor: "#1e3a8a" },
  filterTxt: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  filterTxtActive: { color: "#fff" },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
  },

  card: {
    backgroundColor: "#fff", borderRadius: 14, marginBottom: 10,
    borderLeftWidth: 4, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardOverdue: { borderColor: "#fca5a5", borderWidth: 1.5, borderLeftWidth: 4 },
  cardMain: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  cardBody: { flex: 1 },
  cardName:  { fontSize: 14, fontWeight: "700", color: "#1e293b", marginBottom: 4 },
  cardRow:   { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  cardEmail: { fontSize: 11, color: "#64748b", flex: 1 },
  cardDate:  { fontSize: 11, color: "#94a3b8" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: "700" },

  // Expanded signature section
  sigSection: { paddingHorizontal: 14, paddingBottom: 14 },
  sigDivider: { height: 1, backgroundColor: "#f1f5f9", marginBottom: 12 },
  sigRow: { flexDirection: "row", gap: 10 },
  sigBox: { flex: 1 },
  sigLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", marginBottom: 6 },
  sigImgWrap: { borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden" },
  sigEmpty: {
    height: 100, backgroundColor: "#f8fafc", borderRadius: 10,
    borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "dashed",
    justifyContent: "center", alignItems: "center",
  },
  sigEmptyTxt: { fontSize: 11, color: "#94a3b8" },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: "#94a3b8" },
});
