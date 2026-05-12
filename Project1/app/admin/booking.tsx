import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

const TIME_SLOTS: { [key: number]: string } = {
  1: "08:00 – 10:00",
  2: "10:00 – 12:00",
  3: "13:00 – 15:00",
  4: "15:00 – 17:00",
};

export default function AdminBooking() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "today" | "upcoming">("today");

  useEffect(() => { fetchBookings(); }, [filter]);

  const fetchBookings = async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    let query = supabase
      .from("room_bookings")
      .select(`
        id, booking_date, time_slot, status, user_id,
        computer_stations ( name, room_id )
      `)
      .eq("status", "active")
      .order("booking_date")
      .order("time_slot");

    if (filter === "today")    query = query.eq("booking_date", today);
    if (filter === "upcoming") query = query.gte("booking_date", today);

    const { data, error } = await query;
    if (error) { console.log(error); setLoading(false); return; }

    // ดึง email จาก profiles
    const userIds = [...new Set((data || []).map((b: any) => b.user_id))];
    const { data: profiles } = await supabase
      .from("profiles").select("id, email").in("id", userIds);

    const merged = (data || []).map((b: any) => ({
      ...b,
      email: profiles?.find((p: any) => p.id === b.user_id)?.email || b.user_id,
    }));

    setBookings(merged);
    setLoading(false);
  };

  const cancelBooking = (booking: any) => {
    Alert.alert(
      "ยกเลิกการจอง",
      `ยกเลิกการจอง ${booking.computer_stations?.name} ของ ${booking.email} ?`,
      [
        { text: "ไม่ยกเลิก", style: "cancel" },
        {
          text: "ยกเลิก",
          style: "destructive",
          onPress: async () => {
            await supabase.from("room_bookings")
              .update({ status: "cancelled" }).eq("id", booking.id);
            fetchBookings();
          },
        },
      ]
    );
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

  const today = new Date().toISOString().split("T")[0];

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>การจองห้องทั้งหมด</Text>
        <TouchableOpacity onPress={fetchBookings}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* FILTER */}
      <View style={styles.filterRow}>
        {(["today", "upcoming", "all"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === "today" ? "วันนี้" : f === "upcoming" ? "ล่วงหน้า" : "ทั้งหมด"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* COUNT */}
      <Text style={styles.countText}>พบ {bookings.length} รายการ</Text>

      {/* LIST */}
      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {bookings.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={40} color="#cbd5e1" />
              <Text style={styles.emptyText}>ไม่มีการจองในช่วงนี้</Text>
            </View>
          ) : (
            bookings.map((b) => {
              const isToday = b.booking_date === today;
              return (
                <View key={b.id} style={[styles.card, isToday && styles.cardToday]}>
                  <View style={styles.cardTop}>
                    <View style={styles.roomBadge}>
                      <Ionicons name="desktop-outline" size={14} color="#7c3aed" />
                      <Text style={styles.roomText}>
                        {b.computer_stations?.room_id} · {b.computer_stations?.name}
                      </Text>
                    </View>
                    {isToday && (
                      <View style={styles.todayBadge}>
                        <Text style={styles.todayText}>วันนี้</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.emailText}>👤 {b.email}</Text>
                  <Text style={styles.dateText}>
                    📅 {formatDate(b.booking_date)} · 🕐 {TIME_SLOTS[b.time_slot]}
                  </Text>

                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => cancelBooking(b)}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#dc2626" />
                    <Text style={styles.cancelText}>ยกเลิกการจอง</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
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

  filterRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 16, paddingTop: 14,
  },
  filterBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: "#e2e8f0", alignItems: "center",
  },
  filterActive: { backgroundColor: "#1e3a8a" },
  filterText: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  filterTextActive: { color: "#fff" },

  countText: { fontSize: 12, color: "#94a3b8", paddingHorizontal: 16, marginTop: 8, marginBottom: 4 },

  list: { paddingHorizontal: 16, paddingTop: 8 },
  card: {
    backgroundColor: "#fff", borderRadius: 14,
    padding: 14, marginBottom: 10,
    borderLeftWidth: 3, borderLeftColor: "#e2e8f0",
  },
  cardToday: { borderLeftColor: "#3b82f6" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  roomBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#ede9fe", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  roomText: { fontSize: 12, fontWeight: "700", color: "#7c3aed" },
  todayBadge: {
    backgroundColor: "#dbeafe", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  todayText: { fontSize: 11, fontWeight: "700", color: "#1d4ed8" },
  emailText: { fontSize: 12, color: "#475569", marginBottom: 3 },
  dateText: { fontSize: 12, color: "#64748b", marginBottom: 10 },
  cancelBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-end",
  },
  cancelText: { fontSize: 12, color: "#dc2626", fontWeight: "600" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { color: "#94a3b8", fontSize: 14 },
});
