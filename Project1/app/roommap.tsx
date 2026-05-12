import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";

// Time slot คงที่ 4 ช่วง
const TIME_SLOTS = [
  { slot: 1, label: "ช่วงที่ 1", time: "08:00 – 10:00" },
  { slot: 2, label: "ช่วงที่ 2", time: "10:00 – 12:00" },
  { slot: 3, label: "ช่วงที่ 3", time: "13:00 – 15:00" },
  { slot: 4, label: "ช่วงที่ 4", time: "15:00 – 17:00" },
];

// แปลงวันที่เป็น string สำหรับ query
const toDateStr = (date: Date) => date.toISOString().split("T")[0];

// สร้าง array 7 วันข้างหน้า
const getNext7Days = () => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
};

// format วันที่แสดงผล
const formatDate = (date: Date) => {
  const days = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  return {
    day: days[date.getDay()],
    date: date.getDate(),
    full: toDateStr(date),
  };
};

export default function RoomMap() {
  const router = useRouter();
  const { room_id } = useLocalSearchParams<{ room_id: string }>();

  const roomName = room_id || "CP9524";

  const [stations, setStations] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [days] = useState(getNext7Days());

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    fetchStations();
  }, []);

  useEffect(() => {
    if (stations.length > 0) fetchBookings();
  }, [selectedDate, stations]);

  // ดึงเครื่องคอมของห้องนี้
  const fetchStations = async () => {
    const { data, error } = await supabase
      .from("computer_stations")
      .select("*")
      .eq("room_id", roomName)
      .order("group_no")
      .order("name");

    if (error) console.log(error);
    else setStations(data || []);
    setLoading(false);
  };

  // ดึง booking ของวันที่เลือก
  const fetchBookings = async () => {
    const stationIds = stations.map((s) => s.id);
    if (stationIds.length === 0) return;

    const { data, error } = await supabase
      .from("room_bookings")
      .select("station_id, time_slot, user_id")
      .in("station_id", stationIds)
      .eq("booking_date", toDateStr(selectedDate))
      .eq("status", "active");

    if (error) console.log(error);
    else setBookings(data || []);
  };

  // slot ที่ถูกจองของเครื่องนี้
  const getBookedSlots = (stationId: string) =>
    bookings.filter((b) => b.station_id === stationId).map((b) => b.time_slot);

  // สถานะของเครื่อง (ใช้แสดงสี)
  const getStationColor = (station: any) => {
    if (station.status === "repair") return "#cbd5e1"; // เทา
    const booked = getBookedSlots(station.id);
    if (booked.length >= 4) return "#fca5a5"; // แดง = เต็ม
    return "#86efac"; // เขียว = มีว่าง
  };

  const getStationTextColor = (station: any) => {
    if (station.status === "repair") return "#94a3b8";
    const booked = getBookedSlots(station.id);
    if (booked.length >= 4) return "#991b1b";
    return "#166534";
  };

  // กดเครื่อง → เปิด modal
  const handleStationPress = (station: any) => {
    if (station.status === "repair") {
      Alert.alert("ซ่อมบำรุง", "เครื่องนี้อยู่ระหว่างซ่อมบำรุง ไม่สามารถจองได้");
      return;
    }
    setSelectedStation(station);
    setSelectedSlot(null);
    setModalVisible(true);
  };

  // ยืนยันการจอง
  const confirmBooking = async () => {
    if (!selectedSlot) {
      Alert.alert("กรุณาเลือกช่วงเวลา");
      return;
    }

    setBooking(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert("กรุณาเข้าสู่ระบบก่อน");
      setBooking(false);
      return;
    }

    const { error } = await supabase.from("room_bookings").insert({
      user_id: user.id,
      station_id: selectedStation.id,
      booking_date: toDateStr(selectedDate),
      time_slot: selectedSlot,
      status: "active",
    });

    setBooking(false);

    if (error) {
      if (error.code === "23505") {
        Alert.alert("จองไม่สำเร็จ", "ช่วงเวลานี้ถูกจองไปแล้ว");
      } else {
        Alert.alert("เกิดข้อผิดพลาด", error.message);
      }
    } else {
      Alert.alert("จองสำเร็จ! 🎉", `${selectedStation.name} · ${TIME_SLOTS.find(t => t.slot === selectedSlot)?.time}`);
      setModalVisible(false);
      fetchBookings(); // refresh สีเครื่อง
    }
  };

  // จัดกลุ่ม stations ตาม group_no
  const grouped: { [key: number]: any[] } = {};
  stations.forEach((s) => {
    if (!grouped[s.group_no]) grouped[s.group_no] = [];
    grouped[s.group_no].push(s);
  });

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerText}>ผังห้อง {roomName}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* DATE PICKER */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dateScroll}
        contentContainerStyle={styles.dateRow}
      >
        {days.map((d, i) => {
          const f = formatDate(d);
          const isSelected = toDateStr(d) === toDateStr(selectedDate);
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dateBtn, isSelected && styles.dateBtnActive]}
              onPress={() => setSelectedDate(d)}
            >
              <Text style={[styles.dateDayText, isSelected && styles.dateTextActive]}>
                {f.day}
              </Text>
              <Text style={[styles.dateNumText, isSelected && styles.dateTextActive]}>
                {f.date}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* LEGEND */}
      <View style={styles.legend}>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: "#86efac" }]} />
          <Text style={styles.legText}>ว่าง</Text>
        </View>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: "#fca5a5" }]} />
          <Text style={styles.legText}>เต็ม</Text>
        </View>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: "#cbd5e1" }]} />
          <Text style={styles.legText}>ซ่อมบำรุง</Text>
        </View>
      </View>

      {/* ROOM MAP */}
      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* กระดาน */}
          <View style={styles.board}>
            <Ionicons name="easel-outline" size={20} color="#fff" />
            <Text style={styles.boardText}>กระดาน / Projector</Text>
          </View>

          {/* โต๊ะอาจารย์ */}
          <View style={styles.teacherDesk}>
            <Text style={styles.teacherText}>🧑‍🏫 โต๊ะอาจารย์</Text>
          </View>

          {/* กลุ่มเครื่องคอม */}
          {Object.entries(grouped).map(([groupNo, stns]) => (
            <View key={groupNo} style={styles.groupBox}>
              <Text style={styles.groupLabel}>กลุ่มที่ {groupNo}</Text>
              <View style={styles.stationsRow}>
                {stns.map((station) => (
                  <TouchableOpacity
                    key={station.id}
                    style={[
                      styles.station,
                      { backgroundColor: getStationColor(station) },
                    ]}
                    onPress={() => handleStationPress(station)}
                  >
                    <Ionicons name="desktop-outline" size={18} color={getStationTextColor(station)} />
                    <Text style={[styles.stationName, { color: getStationTextColor(station) }]}>
                      {station.name}
                    </Text>
                    {station.status === "repair" ? (
                      <Text style={styles.stationStatus}>ซ่อม</Text>
                    ) : (
                      <Text style={styles.stationStatus}>
                        {4 - getBookedSlots(station.id).length}/4 ว่าง
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {stations.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>ไม่พบข้อมูลเครื่องคอมในห้องนี้</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* BOOKING MODAL */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                จองเครื่อง {selectedStation?.name}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              ห้อง {roomName} · {selectedDate.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
            </Text>

            <Text style={styles.slotLabel}>เลือกช่วงเวลา</Text>

            {TIME_SLOTS.map((ts) => {
              const booked = selectedStation
                ? getBookedSlots(selectedStation.id).includes(ts.slot)
                : false;
              const isSelected = selectedSlot === ts.slot;

              return (
                <TouchableOpacity
                  key={ts.slot}
                  disabled={booked}
                  style={[
                    styles.slotBtn,
                    booked && styles.slotTaken,
                    isSelected && styles.slotSelected,
                  ]}
                  onPress={() => setSelectedSlot(ts.slot)}
                >
                  <View>
                    <Text style={[
                      styles.slotTime,
                      booked && { color: "#94a3b8" },
                      isSelected && { color: "#fff" },
                    ]}>
                      {ts.time}
                    </Text>
                    <Text style={[
                      styles.slotName,
                      booked && { color: "#94a3b8" },
                      isSelected && { color: "#bfdbfe" },
                    ]}>
                      {ts.label}
                    </Text>
                  </View>
                  {booked ? (
                    <Text style={styles.takenBadge}>เต็ม</Text>
                  ) : isSelected ? (
                    <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  ) : (
                    <Text style={styles.availBadge}>ว่าง</Text>
                  )}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.confirmBtn, (!selectedSlot || booking) && styles.confirmDisabled]}
              onPress={confirmBooking}
              disabled={!selectedSlot || booking}
            >
              {booking ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmText}>✅ ยืนยันการจอง</Text>
              )}
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e3a8a",
  },

  // Date picker
  dateScroll: { marginBottom: 12 },
  dateRow: { gap: 8, paddingBottom: 4 },
  dateBtn: {
    width: 44,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dateBtnActive: { backgroundColor: "#1e3a8a", borderColor: "#1e3a8a" },
  dateDayText: { fontSize: 10, color: "#64748b" },
  dateNumText: { fontSize: 16, fontWeight: "bold", color: "#1e293b" },
  dateTextActive: { color: "#fff" },

  // Legend
  legend: { flexDirection: "row", gap: 16, marginBottom: 14 },
  legItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legDot: { width: 10, height: 10, borderRadius: 3 },
  legText: { fontSize: 11, color: "#64748b" },

  // Board & teacher
  board: {
    backgroundColor: "#1e3a8a",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  boardText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  teacherDesk: {
    backgroundColor: "#dbeafe",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#93c5fd",
  },
  teacherText: { color: "#1e3a8a", fontWeight: "600", fontSize: 12 },

  // Groups
  groupBox: { marginBottom: 14 },
  groupLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  stationsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  station: {
    width: 72,
    height: 72,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  stationName: { fontSize: 11, fontWeight: "700" },
  stationStatus: { fontSize: 9, color: "#166534" },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#94a3b8" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#1e293b" },
  modalSub: { fontSize: 12, color: "#64748b", marginBottom: 16 },
  slotLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  slotBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  slotTaken: { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" },
  slotSelected: { backgroundColor: "#1e3a8a", borderColor: "#1e3a8a" },
  slotTime: { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  slotName: { fontSize: 10, color: "#64748b", marginTop: 1 },
  takenBadge: {
    fontSize: 9, fontWeight: "700",
    backgroundColor: "#f1f5f9", color: "#94a3b8",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  availBadge: {
    fontSize: 9, fontWeight: "700",
    backgroundColor: "#dcfce7", color: "#166534",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  confirmBtn: {
    backgroundColor: "#1e3a8a",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  confirmDisabled: { backgroundColor: "#94a3b8" },
  confirmText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
