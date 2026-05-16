import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl, AppState,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";

const TYPE_CFG: Record<string, { icon: any; iconColor: string; iconBg: string; dot: string }> = {
  borrow: { icon: "cube-outline",             iconColor: "#b45309", iconBg: "#fef3c7", dot: "#f59e0b" },
  return: { icon: "checkmark-circle-outline", iconColor: "#16a34a", iconBg: "#dcfce7", dot: "#22c55e" },
};

const formatDate = (d: string) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};

export default function Notifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const prevCountRef = useRef(-1);
  const isFirstLoad = useRef(true);

  const fetchNotifications = useCallback(async (silent = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const list = data || [];

    if (!isFirstLoad.current && prevCountRef.current >= 0 && list.length > prevCountRef.current) {
      setNewCount(list.length - prevCountRef.current);
    }
    prevCountRef.current = list.length;
    isFirstLoad.current = false;

    setNotifications(list);
    if (!silent) { setLoading(false); setRefreshing(false); }
    else setLoading(false);
  }, []);

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("notifications").update({ read: true })
      .eq("user_id", user.id).eq("read", false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setNewCount(0);
  };

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  useEffect(() => {
    const interval = setInterval(() => fetchNotifications(true), 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", state => {
      if (state === "active") fetchNotifications(true);
    });
    return () => sub.remove();
  }, [fetchNotifications]);

  const onRefresh = () => { setRefreshing(true); setNewCount(0); fetchNotifications(); };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={s.container}>

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>การแจ้งเตือน</Text>
          {unreadCount > 0 && (
            <Text style={s.headerSub}>{unreadCount} รายการยังไม่ได้อ่าน</Text>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} style={s.markAllBtn}>
            <Text style={s.markAllTxt}>อ่านทั้งหมด</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 70 }} />
        )}
      </View>

      {/* new banner */}
      {newCount > 0 && (
        <TouchableOpacity style={s.newBanner} onPress={() => setNewCount(0)}>
          <Ionicons name="notifications" size={16} color="#fff" />
          <Text style={s.newBannerTxt}>มีการแจ้งเตือนใหม่ {newCount} รายการ</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 60 }} />
      ) : notifications.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="notifications-off-outline" size={52} color="#cbd5e1" />
          <Text style={s.emptyTitle}>ยังไม่มีการแจ้งเตือน</Text>
          <Text style={s.emptyText}>เมื่อคุณยืม/คืนอุปกรณ์{"\n"}จะปรากฏที่นี่</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}
        >
          <Text style={s.sectionLabel}>การแจ้งเตือนทั้งหมด ({notifications.length})</Text>

          {notifications.map(n => {
            const cfg = TYPE_CFG[n.type] || TYPE_CFG.borrow;
            return (
              <View key={n.id} style={[s.card, !n.read && s.cardUnread]}>
                {!n.read && <View style={[s.dot, { backgroundColor: cfg.dot }]} />}
                <View style={[s.iconBox, { backgroundColor: cfg.iconBg }]}>
                  <Ionicons name={cfg.icon} size={20} color={cfg.iconColor} />
                </View>
                <View style={s.cardContent}>
                  <Text style={[s.cardTitle, !n.read && s.cardTitleUnread]}>{n.title}</Text>
                  <Text style={s.cardBody}>{n.body}</Text>
                </View>
                <Text style={s.cardDate}>{formatDate(n.created_at)}</Text>
              </View>
            );
          })}

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
    paddingTop: 54, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  headerSub: { color: "#93c5fd", fontSize: 11, marginTop: 2 },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8 },
  markAllTxt: { color: "#fff", fontSize: 11, fontWeight: "600" },

  newBanner: {
    backgroundColor: "#1d4ed8", flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8, paddingVertical: 10,
  },
  newBannerTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: 60 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#475569", marginTop: 8 },
  emptyText: { fontSize: 13, color: "#94a3b8", textAlign: "center", lineHeight: 20 },

  list: { padding: 16 },
  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#94a3b8",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
  },

  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 10,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: "#1e3a8a" },
  dot: { width: 8, height: 8, borderRadius: 4, position: "absolute", top: 14, left: 6 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", marginLeft: 4 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: "600", color: "#475569" },
  cardTitleUnread: { fontWeight: "700", color: "#1e293b" },
  cardBody: { fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 17 },
  cardDate: { fontSize: 10, color: "#94a3b8", textAlign: "right" },
});
