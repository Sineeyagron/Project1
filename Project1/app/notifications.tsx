import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";

type FeedItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  date: string;
  displayDate: string;
};

export default function Notifications() {
  const router = useRouter();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("th-TH", {
      day: "numeric", month: "short", year: "numeric",
    });
  };

  const fetchFeed = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: borrows } = await supabase
      .from("borrow_records")
      .select("id, status, borrow_date, created_at, due_date, items ( name )")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);

    const borrowFeed: FeedItem[] = (borrows || []).map((b: any) => {
      const itemName = b.items?.name || b.items?.[0]?.name || "อุปกรณ์";
      let subtitle = "";
      switch (b.status) {
        case "borrowed":       subtitle = b.due_date ? `ครบกำหนด ${formatDate(b.due_date)}` : "กำลังยืมอยู่"; break;
        case "pending_return": subtitle = "รอ Admin ยืนยันการคืน"; break;
        case "returned":       subtitle = "คืนอุปกรณ์เรียบร้อยแล้ว"; break;
        default:               subtitle = b.status;
      }
      const dateKey = b.borrow_date || b.created_at || "";
      return {
        id: `borrow-${b.id}`,
        title: `ยืม: ${itemName}`,
        subtitle,
        status: b.status,
        date: dateKey,
        displayDate: formatDate(dateKey),
      };
    });

    setFeed(borrowFeed);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);
  const onRefresh = () => { setRefreshing(true); fetchFeed(); };

  const getStyle = (status: string) => {
    switch (status) {
      case "borrowed":       return { icon: "cube-outline" as const,           iconColor: "#b45309", iconBg: "#fef3c7", dot: "#f59e0b" };
      case "pending_return": return { icon: "time-outline" as const,            iconColor: "#dc2626", iconBg: "#fee2e2", dot: "#ef4444" };
      case "returned":       return { icon: "checkmark-circle-outline" as const, iconColor: "#16a34a", iconBg: "#dcfce7", dot: "#22c55e" };
      default:               return { icon: "cube-outline" as const,           iconColor: "#64748b", iconBg: "#f1f5f9", dot: "#94a3b8" };
    }
  };

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>การแจ้งเตือน</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 60 }} />
      ) : feed.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="notifications-off-outline" size={52} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>ยังไม่มีกิจกรรม</Text>
          <Text style={styles.emptyText}>เมื่อคุณยืมอุปกรณ์{"\n"}จะปรากฎที่นี่</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}
        >
          <Text style={styles.listHeader}>ประวัติการยืม ({feed.length})</Text>

          {feed.map((item) => {
            const s = getStyle(item.status);
            return (
              <View key={item.id} style={styles.card}>
                <View style={[styles.dot, { backgroundColor: s.dot }]} />
                <View style={[styles.iconBox, { backgroundColor: s.iconBg }]}>
                  <Ionicons name={s.icon} size={20} color={s.iconColor} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardSub} numberOfLines={2}>{item.subtitle}</Text>
                </View>
                <Text style={styles.cardDate}>{item.displayDate}</Text>
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    backgroundColor: "#1e3a8a",
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerText: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: 60 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#475569", marginTop: 8 },
  emptyText: { fontSize: 13, color: "#94a3b8", textAlign: "center", lineHeight: 20 },

  list: { padding: 16 },
  listHeader: {
    fontSize: 11, fontWeight: "700", color: "#94a3b8",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4, position: "absolute", top: 14, left: 6 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", marginLeft: 4 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  cardSub: { fontSize: 11, color: "#64748b", marginTop: 2, lineHeight: 16 },
  cardDate: { fontSize: 10, color: "#94a3b8", marginLeft: 4, textAlign: "right" },
});
