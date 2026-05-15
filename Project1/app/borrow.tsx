import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";

const TIME_SLOTS: { [key: number]: string } = {
  1: "08:00 – 10:00",
  2: "10:00 – 12:00",
  3: "13:00 – 15:00",
  4: "15:00 – 17:00",
};

export default function Borrow() {
  const router = useRouter();

  const [borrows, setBorrows] = useState<any[]>([]);
  const [borrowLoading, setBorrowLoading] = useState(true);

  useEffect(() => {
    fetchBorrows();
  }, []);

  // ── ดึงประวัติยืมอุปกรณ์ ──
  const fetchBorrows = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("borrow_records")
      .select(`id, status, borrow_date, due_date, created_at, item_id, items ( name, image_url )`)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error) setBorrows(data || []);
    setBorrowLoading(false);
  };

  // ── ขอคืนอุปกรณ์ ──
  const requestReturn = (item: any) => {
    if (item.status !== "borrowed") return;
    Alert.alert("ขอคืนอุปกรณ์", "คุณต้องการขอคืนอุปกรณ์นี้ใช่ไหม?", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ยืนยัน",
        onPress: async () => {
          const { error } = await supabase
            .from("borrow_records")
            .update({ status: "pending_return" })
            .eq("id", item.id);
          if (error) { alert("ขอคืนไม่สำเร็จ"); return; }
          alert("ส่งคำขอคืนแล้ว ✅");
          fetchBorrows();
        },
      },
    ]);
  };

  // ── Badge สถานะยืม ──
  const getBorrowBadge = (status: string) => {
    switch (status) {
      case "borrowed":       return { label: "กำลังยืม",  bg: "#fef3c7", color: "#b45309" };
      case "pending_return": return { label: "รอคืน",     bg: "#fee2e2", color: "#dc2626" };
      case "returned":       return { label: "คืนแล้ว",   bg: "#dcfce7", color: "#16a34a" };
      default:               return { label: status,      bg: "#f1f5f9", color: "#64748b" };
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("th-TH", {
      day: "numeric", month: "short", year: "numeric",
    });
  };

  const getDaysLeft = (dueDate: string) => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>ประวัติการยืม</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
          {borrowLoading ? (
            <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
          ) : borrows.length === 0 ? (

            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={40} color="#cbd5e1" />
              <Text style={styles.emptyText}>ยังไม่มีประวัติการยืม</Text>
            </View>
          ) : (
            borrows.map((b) => {
              const badge = getBorrowBadge(b.status);
              const itemName = b.items?.name || b.items?.[0]?.name || "อุปกรณ์";
              const imageUrl = b.items?.image_url || b.items?.[0]?.image_url || null;
              const borrowDate = b.borrow_date || b.created_at;
              const daysLeft = b.due_date ? getDaysLeft(b.due_date) : null;
              const isOverdue = daysLeft !== null && daysLeft < 0 && b.status === "borrowed";
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.card, isOverdue && styles.cardOverdue]}
                  onPress={() => b.status === "borrowed" ? requestReturn(b) : null}
                >
                  <View style={styles.cardLeft}>
                    {imageUrl ? (
                      <Image source={{ uri: imageUrl }} style={styles.itemImg} />
                    ) : (
                      <View style={styles.iconBox}>
                        <Ionicons name="cube-outline" size={22} color="#1e3a8a" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{itemName}</Text>
                      <Text style={styles.cardDate}>
                        ยืม: {formatDate(borrowDate)}
                      </Text>
                      {b.due_date && (
                        <Text style={[styles.cardDate, isOverdue && { color: "#dc2626", fontWeight: "700" }]}>
                          {isOverdue
                            ? `⚠️ เกินกำหนด ${Math.abs(daysLeft!)} วัน`
                            : b.status === "borrowed"
                              ? `ครบ: ${formatDate(b.due_date)} (อีก ${daysLeft} วัน)`
                              : `ครบ: ${formatDate(b.due_date)}`
                          }
                        </Text>
                      )}
                      {b.status === "borrowed" && (
                        <Text style={styles.tapHint}>กดเพื่อขอคืน</Text>
                      )}
                    </View>
                  </View>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    backgroundColor: "#1e3a8a",
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerText: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  // List
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  iconBox: {
    width: 48, height: 48,
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  itemImg: { width: 48, height: 48, borderRadius: 12 },
  cardOverdue: { borderWidth: 1.5, borderColor: "#fca5a5" },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  cardDate: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  tapHint: { fontSize: 10, color: "#f97316", marginTop: 3 },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, marginLeft: 8,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },

  // Empty
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { color: "#94a3b8", fontSize: 14 },
  goBookBtn: {
    marginTop: 8, backgroundColor: "#1e3a8a",
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
  },
  goBookText: { color: "#fff", fontWeight: "600" },
});
