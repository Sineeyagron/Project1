import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl, AppState,
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
  const [newCount, setNewCount] = useState(0);
  const prevCountRef = useRef<number>(-1);
  const isFirstLoad = useRef(true);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("th-TH", {
      day: "numeric", month: "short", year: "numeric",
    });
  };

  const fetchFeed = useCallback(async (silent = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // ดึง borrow_records ก่อน (ไม่รวม join เพื่อความแน่นอน)
    const { data: borrows, error: borrowErr } = await supabase
      .from("borrow_records")
      .select("id, status, created_at, due_date, item_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);

    if (borrowErr) {
      console.warn("[Notifications] borrow_records error:", borrowErr.message);
    }

    // ดึงชื่อ item แยก (หลีกเลี่ยงปัญหา FK join)
    const records = borrows || [];
    const itemIds = [...new Set(records.map((b: any) => b.item_id).filter(Boolean))];
    let itemMap: Record<string, string> = {};

    if (itemIds.length > 0) {
      const { data: itemRows } = await supabase
        .from("items")
        .select("id, name")
        .in("id", itemIds);
      (itemRows || []).forEach((it: any) => { itemMap[it.id] = it.name; });
    }

    const borrowFeed: FeedItem[] = records.map((b: any) => {
      const itemName = itemMap[b.item_id] || "อุปกรณ์";
      let subtitle = "";
      switch (b.status) {
        case "borrowed":       subtitle = b.due_date ? `ครบกำหนด ${formatDate(b.due_date)}` : "กำลังยืมอยู่"; break;
        case "pending_return": subtitle = "รอ Admin ยืนยันการคืน"; break;
        case "returned":       subtitle = "คืนอุปกรณ์เรียบร้อยแล้ว"; break;
        default:               subtitle = b.status;
      }
      const dateKey = b.created_at || "";
      return {
        id: `borrow-${b.id}`,
        title: `ยืม: ${itemName}`,
        subtitle,
        status: b.status,
        date: dateKey,
        displayDate: formatDate(dateKey),
      };
    });

    // ตรวจว่ามีรายการใหม่มั้ย (ยกเว้นครั้งแรก)
    if (!isFirstLoad.current && prevCountRef.current >= 0 && borrowFeed.length > prevCountRef.current) {
      setNewCount(borrowFeed.length - prevCountRef.current);
    }
    prevCountRef.current = borrowFeed.length;
    isFirstLoad.current = false;

    setFeed(borrowFeed);
    if (!silent) {
      setLoading(false);
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  }, []);

  // โหลดครั้งแรก
  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  // Poll ทุก 15 วินาที
  useEffect(() => {
    const interval = setInterval(() => { fetchFeed(true); }, 15000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  // โหลดใหม่เมื่อ app กลับมา foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchFeed(true);
    });
    return () => sub.remove();
  }, [fetchFeed]);

  const onRefresh = () => { setRefreshing(true); setNewCount(0); fetchFeed(); };

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

      {/* แบนเนอร์รายการใหม่ */}
      {newCount > 0 && (
        <TouchableOpacity
          style={styles.newBanner}
          onPress={() => { setNewCount(0); }}
        >
          <Ionicons name="notifications" size={16} color="#fff" />
          <Text style={styles.newBannerTxt}>มีรายการใหม่ {newCount} รายการ</Text>
        </TouchableOpacity>
      )}

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

  newBanner: {
    backgroundColor: "#1d4ed8", flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8, paddingVertical: 10,
  },
  newBannerTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },

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
