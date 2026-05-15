import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../../lib/supabase";

export default function AdminHome() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Equipment stats
  const [total, setTotal] = useState(0);
  const [borrowed, setBorrowed] = useState(0);
  const [pending, setPending] = useState(0);
  const [returned, setReturned] = useState(0);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: items } = await supabase.from("items").select("id");
    setTotal(items?.length || 0);

    const { data: borrows } = await supabase.from("borrow_records").select("status");
    setBorrowed(borrows?.filter((b: any) => b.status === "borrowed").length || 0);
    setPending(borrows?.filter((b: any) => b.status === "pending_return").length || 0);
    setReturned(borrows?.filter((b: any) => b.status === "returned").length || 0);

    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const MENU = [
    { icon: "barcode-outline",          label: "สแกนยืม",       route: "/admin/borrowscan",        color: "#1d4ed8" },
    { icon: "return-down-back-outline", label: "สแกนคืน",       route: "/admin/returnscan",        color: "#f97316" },
    { icon: "business-outline",         label: "จัดการห้อง",    route: "/admin/room",              color: "#8b5cf6" },
    { icon: "cube-outline",             label: "จัดการอุปกรณ์", route: "/admin/items",             color: "#0ea5e9" },
    { icon: "qr-code-outline",          label: "สร้าง QR",      route: "/admin/qrgen",             color: "#6366f1" },
    { icon: "scan-outline",             label: "สแกน & เพิ่ม",  route: "/admin/scan",              color: "#64748b" },
    { icon: "receipt-outline",          label: "ประวัติยืม",    route: "/admin/history",           color: "#94a3b8" },
    { icon: "desktop-outline",          label: "จัดการเครื่อง", route: "/admin/stations",          color: "#dc2626" },
    { icon: "git-network-outline",      label: "จัดการแลน",     route: "/admin/lanports",          color: "#7c3aed" },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/")} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#93c5fd" />
          <Text style={styles.backText}>กลับ</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <Text style={styles.headerSub}>ระบบจัดการห้องแล็บ IoT</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* ── EQUIPMENT STATS ── */}
          <Text style={styles.sectionLabel}>📦 อุปกรณ์</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { borderLeftColor: "#3b82f6" }]}>
              <Text style={styles.statNum}>{total}</Text>
              <Text style={styles.statLabel}>ทั้งหมด</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#f97316" }]}>
              <Text style={[styles.statNum, { color: "#ea580c" }]}>{borrowed}</Text>
              <Text style={styles.statLabel}>กำลังยืม</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#ef4444" }]}>
              <Text style={[styles.statNum, { color: "#dc2626" }]}>{pending}</Text>
              <Text style={styles.statLabel}>รอคืน</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#22c55e" }]}>
              <Text style={[styles.statNum, { color: "#16a34a" }]}>{returned}</Text>
              <Text style={styles.statLabel}>คืนแล้ว</Text>
            </View>
          </View>

          {/* ── MENU GRID ── */}
          <Text style={styles.sectionLabel}>⚙️ จัดการ</Text>
          <View style={styles.menuGrid}>
            {MENU.map((m) => (
              <TouchableOpacity
                key={m.route}
                style={styles.menuBtn}
                onPress={() => router.push(m.route as any)}
              >
                <View style={[styles.menuIconBox, { backgroundColor: m.color + "18" }]}>
                  <Ionicons name={m.icon as any} size={22} color={m.color} />
                </View>
                <Text style={styles.menuText}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  header: {
    backgroundColor: "#1e3a8a",
    paddingTop: 54, paddingBottom: 24, paddingHorizontal: 20,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10 },
  backText: { color: "#93c5fd", fontSize: 13 },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  headerSub: { color: "#93c5fd", fontSize: 12, marginTop: 4 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginHorizontal: 16, marginTop: 20, marginBottom: 10,
  },

  statsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 12, gap: 8,
  },
  statCard: {
    width: "47%", backgroundColor: "#fff",
    borderRadius: 14, padding: 14,
    borderLeftWidth: 4, marginHorizontal: 4,
  },
  statNum: { fontSize: 28, fontWeight: "800", color: "#1e293b" },
  statLabel: { fontSize: 12, color: "#94a3b8", marginTop: 2 },

  menuGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 16, gap: 10,
  },
  menuBtn: {
    width: "30%", backgroundColor: "#fff",
    borderRadius: 14, padding: 14,
    alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: "#f1f5f9",
  },
  menuIconBox: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  menuText: { fontSize: 11, fontWeight: "600", color: "#1e293b", textAlign: "center" },
});
