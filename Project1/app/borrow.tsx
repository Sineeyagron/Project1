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
  const [tab, setTab] = useState<"borrow" | "booking">("borrow");

  // ── ยืมอุปกรณ์ ──
  const [borrows, setBorrows] = useState<any[]>([]);
  const [borrowLoading, setBorrowLoading] = useState(true);

  // ── จองห้อง ──
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingLoading, setBookingLoading] = useState(true);

  useEffect(() => {
    fetchBorrows();
    fetchBookings();
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

  // ── ดึงประวัติจองห้อง ──
  const fetchBookings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("room_bookings")
      .select(`
        id, booking_date, time_slot, status,
        computer_stations ( name, room_id )
      `)
      .eq("user_id", user.id)
      .order("booking_date", { ascending: false });

    if (!error) setBookings(data || []);
    setBookingLoading(false);
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

  // ── ยกเลิกการจองห้อง ──
  const cancelBooking = (booking: any) => {
    if (booking.status !== "active") return;

    // เช็คว่าเป็นวันที่ผ่านมาแล้วหรือเปล่า
    const today = new Date().toISOString().split("T")[0];
    if (booking.booking_date < today) {
      Alert.alert("ไม่สามารถยกเลิกได้", "การจองที่ผ่านมาแล้วไม่สามารถยกเลิกได้");
      return;
    }

    Alert.alert("ยกเลิกการจอง", `ยืนยันยกเลิกการจอง ${booking.computer_stations?.name} ?`, [
      { text: "ไม่ยกเลิก", style: "cancel" },
      {
        text: "ยกเลิกการจอง",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("room_bookings")
            .update({ status: "cancelled" })
            .eq("id", booking.id);
          if (error) { alert("ยกเลิกไม่สำเร็จ"); return; }
          alert("ยกเลิกการจองแล้ว");
          fetchBookings();
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

  // ── Badge สถานะจอง ──
  const getBookingBadge = (status: string, date: string) => {
    const today = new Date().toISOString().split("T")[0];
    if (status === "cancelled") return { label: "ยกเลิกแล้ว", bg: "#f1f5f9", color: "#94a3b8" };
    if (date < today)           return { label: "ผ่านไปแล้ว",  bg: "#f1f5f9", color: "#94a3b8" };
    if (date === today)         return { label: "วันนี้",       bg: "#dbeafe", color: "#1d4ed8" };
    return                             { label: "จองแล้ว",      bg: "#dcfce7", color: "#16a34a" };
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
        <Text style={styles.headerText}>ประวัติของฉัน</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* TABS */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "borrow" && styles.tabActive]}
          onPress={() => setTab("borrow")}
        >
          <Ionicons name="cube-outline" size={16} color={tab === "borrow" ? "#fff" : "#64748b"} />
          <Text style={[styles.tabText, tab === "borrow" && styles.tabTextActive]}>
            ยืมอุปกรณ์
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === "booking" && styles.tabActive]}
          onPress={() => setTab("booking")}
        >
          <Ionicons name="calendar-outline" size={16} color={tab === "booking" ? "#fff" : "#64748b"} />
          <Text style={[styles.tabText, tab === "booking" && styles.tabTextActive]}>
            จองห้อง
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB: ยืมอุปกรณ์ ── */}
      {tab === "borrow" && (
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
      )}

      {/* ── TAB: จองห้อง ── */}
      {tab === "booking" && (
        <ScrollView contentContainerStyle={styles.list}>
          {bookingLoading ? (
            <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
          ) : bookings.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={40} color="#cbd5e1" />
              <Text style={styles.emptyText}>ยังไม่มีประวัติการจองห้อง</Text>
              <TouchableOpacity
                style={styles.goBookBtn}
                onPress={() => router.push("/home")}
              >
                <Text style={styles.goBookText}>จองห้องเลย →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            bookings.map((b) => {
              const badge = getBookingBadge(b.status, b.booking_date);
              const station = b.computer_stations;
              const canCancel = b.status === "active" && b.booking_date >= new Date().toISOString().split("T")[0];
              return (
                <TouchableOpacity
                  key={b.id}
                  style={styles.card}
                  onPress={() => canCancel ? cancelBooking(b) : null}
                >
                  <View style={styles.cardLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#ede9fe" }]}>
                      <Ionicons name="desktop-outline" size={22} color="#7c3aed" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>
                        {station?.room_id} · {station?.name}
                      </Text>
                      <Text style={styles.cardDate}>
                        {formatDate(b.booking_date)}
                      </Text>
                      <Text style={styles.cardSlot}>
                        🕐 {TIME_SLOTS[b.time_slot]}
                      </Text>
                      {canCancel && (
                        <Text style={[styles.tapHint, { color: "#dc2626" }]}>กดเพื่อยกเลิก</Text>
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
      )}

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

  // Tabs
  tabs: {
    flexDirection: "row",
    margin: 16,
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10,
  },
  tabActive: { backgroundColor: "#1e3a8a" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  tabTextActive: { color: "#fff" },

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
  cardSlot: { fontSize: 11, color: "#64748b", marginTop: 2 },
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
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10,
  },
  goBookText: { color: "#fff", fontWeight: "600" },
});
