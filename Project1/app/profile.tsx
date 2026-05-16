import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  borrowed:       { label: "กำลังยืม", color: "#b45309", bg: "#fef3c7", border: "#f59e0b" },
  pending_return: { label: "กำลังยืม", color: "#b45309", bg: "#fef3c7", border: "#f59e0b" },
  returned:       { label: "คืนแล้ว",  color: "#16a34a", bg: "#dcfce7", border: "#22c55e" },
};

const formatDate = (d: string) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};

export default function Profile() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [totalBorrows, setTotalBorrows] = useState(0);
  const [activeLoans, setActiveLoans] = useState(0);
  const [recentBorrows, setRecentBorrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchProfile(); }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles").select("email").eq("id", user.id).single();
    setEmail(profile?.email || user.email || "");

    const { data: borrows } = await supabase
      .from("borrow_records")
      .select("id, status, borrow_date, due_date, item_id")
      .eq("user_id", user.id)
      .order("borrow_date", { ascending: false })
      .limit(5);

    const itemIds = [...new Set((borrows || []).map((b: any) => b.item_id).filter(Boolean))];
    let itemMap: Record<string, string> = {};
    if (itemIds.length > 0) {
      const { data: items } = await supabase.from("items").select("id, name").in("id", itemIds);
      (items || []).forEach((i: any) => { itemMap[i.id] = i.name; });
    }

    const enriched = (borrows || []).map((b: any) => ({ ...b, itemName: itemMap[b.item_id] || "อุปกรณ์" }));

    const { count } = await supabase
      .from("borrow_records").select("id", { count: "exact", head: true }).eq("user_id", user.id);

    setTotalBorrows(count || 0);
    setActiveLoans((borrows || []).filter((b: any) => b.status === "borrowed" || b.status === "pending_return").length);
    setRecentBorrows(enriched);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); fetchProfile(); };
  const username = email.split("@")[0];

  if (loading) return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color="#1e3a8a" />
    </View>
  );

  return (
    <View style={s.container}>

      {/* HEADER */}
      <View style={s.header}>
        <Text style={s.headerTitle}>โปรไฟล์</Text>
        <TouchableOpacity onPress={() => router.push("/sittings")}>
          <Ionicons name="settings-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}
      >
        {/* AVATAR CARD */}
        <View style={s.avatarCard}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarInitial}>{username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={s.userName}>{username}</Text>
          <Text style={s.userEmail}>{email}</Text>
        </View>

        {/* STATS */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { borderLeftColor: "#3b82f6" }]}>
            <Text style={s.statNum}>{totalBorrows}</Text>
            <Text style={s.statLabel}>ยืมทั้งหมด</Text>
          </View>
          <View style={[s.statCard, { borderLeftColor: "#f59e0b" }]}>
            <Text style={[s.statNum, { color: "#b45309" }]}>{activeLoans}</Text>
            <Text style={s.statLabel}>กำลังยืม</Text>
          </View>
        </View>

        {/* QUICK LINKS */}
        <Text style={s.sectionLabel}>เมนู</Text>
        <TouchableOpacity style={s.menuCard} onPress={() => router.push("/borrow")}>
          <View style={[s.menuIcon, { backgroundColor: "#eff6ff" }]}>
            <Ionicons name="time-outline" size={20} color="#1e3a8a" />
          </View>
          <Text style={s.menuTxt}>ประวัติการยืมทั้งหมด</Text>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>
        <TouchableOpacity style={s.menuCard} onPress={() => router.push("/sittings")}>
          <View style={[s.menuIcon, { backgroundColor: "#f0fdf4" }]}>
            <Ionicons name="settings-outline" size={20} color="#16a34a" />
          </View>
          <Text style={s.menuTxt}>ตั้งค่า</Text>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* RECENT */}
        <View style={s.recentHeader}>
          <Text style={s.sectionLabel}>ประวัติล่าสุด</Text>
          <TouchableOpacity onPress={() => router.push("/borrow")}>
            <Text style={s.viewAll}>ดูทั้งหมด</Text>
          </TouchableOpacity>
        </View>

        {recentBorrows.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="cube-outline" size={40} color="#cbd5e1" />
            <Text style={s.emptyTxt}>ยังไม่มีประวัติการยืม</Text>
          </View>
        ) : (
          recentBorrows.map(b => {
            const cfg = STATUS_CFG[b.status] ?? STATUS_CFG.returned;
            const overdue = b.status === "borrowed" && b.due_date &&
              new Date(b.due_date) < new Date();
            return (
              <View key={b.id} style={[s.recentCard, { borderLeftColor: cfg.border }]}>
                <View style={[s.recentIcon, { backgroundColor: cfg.bg }]}>
                  <Ionicons name="cube-outline" size={18} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.recentName} numberOfLines={1}>{b.itemName}</Text>
                  <Text style={s.recentDate}>
                    ยืม {formatDate(b.borrow_date)}
                    {b.due_date && ` · ครบ ${formatDate(b.due_date)}`}
                  </Text>
                  {overdue && <Text style={s.overdue}>⚠️ เกินกำหนด</Text>}
                </View>
                <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.badgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* TAB BAR */}
      <View style={s.tabBar}>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push("/home")}>
          <Ionicons name="home-outline" size={22} color="#94a3b8" />
          <Text style={s.tabTxt}>ชั้นเรียน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push("/equipment")}>
          <Ionicons name="cube-outline" size={22} color="#94a3b8" />
          <Text style={s.tabTxt}>อุปกรณ์</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push("/notifications")}>
          <Ionicons name="notifications-outline" size={22} color="#94a3b8" />
          <Text style={s.tabTxt}>แจ้งเตือน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem}>
          <Ionicons name="person" size={22} color="#1e3a8a" />
          <Text style={[s.tabTxt, s.tabTxtActive]}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f1f5f9" },

  header: {
    backgroundColor: "#1e3a8a",
    paddingTop: 58, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "bold" },

  body: { padding: 16 },

  avatarCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 24,
    alignItems: "center", marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#1e3a8a", justifyContent: "center", alignItems: "center",
    marginBottom: 12,
  },
  avatarInitial: { color: "#fff", fontSize: 32, fontWeight: "800" },
  userName: { fontSize: 20, fontWeight: "800", color: "#1e293b" },
  userEmail: { fontSize: 13, color: "#64748b", marginTop: 4 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14,
    padding: 16, borderLeftWidth: 4,
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  statNum: { fontSize: 26, fontWeight: "800", color: "#1e293b" },
  statLabel: { fontSize: 11, color: "#94a3b8", marginTop: 4 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
  },

  menuCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 14,
    marginBottom: 8,
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  menuIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  menuTxt: { flex: 1, fontSize: 14, fontWeight: "600", color: "#1e293b" },

  recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 8 },
  viewAll: { fontSize: 12, color: "#1e3a8a", fontWeight: "600" },

  recentCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
    marginBottom: 8, borderLeftWidth: 4,
  },
  recentIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  recentName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  recentDate: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  overdue: { fontSize: 11, color: "#dc2626", fontWeight: "700", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTxt: { fontSize: 10, fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: 30, gap: 8 },
  emptyTxt: { color: "#94a3b8", fontSize: 13 },

  tabBar: {
    flexDirection: "row", backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#e2e8f0",
    paddingBottom: 24, paddingTop: 10,
    position: "absolute", bottom: 0, left: 0, right: 0,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 3 },
  tabTxt: { fontSize: 10, color: "#94a3b8" },
  tabTxtActive: { color: "#1e3a8a", fontWeight: "700" },
});
