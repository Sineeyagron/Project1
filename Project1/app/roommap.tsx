import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Modal, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";

const TIME_SLOTS = [
  { slot: 1, label: "ช่วงที่ 1", time: "08:00 – 10:00" },
  { slot: 2, label: "ช่วงที่ 2", time: "10:00 – 12:00" },
  { slot: 3, label: "ช่วงที่ 3", time: "13:00 – 15:00" },
  { slot: 4, label: "ช่วงที่ 4", time: "15:00 – 17:00" },
];

const PORT_STATUS: { [k: string]: { color: string; bg: string; label: string } } = {
  available: { color: "#16a34a", bg: "#dcfce7", label: "ใช้งานได้" },
  repair:    { color: "#b45309", bg: "#fef3c7", label: "ซ่อม" },
  broken:    { color: "#dc2626", bg: "#fee2e2", label: "เสีย" },
};

const toDateStr = (d: Date) => d.toISOString().split("T")[0];
const getNext7Days = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  });
const fmtDate = (d: Date) => {
  const days = ["อา","จ","อ","พ","พฤ","ศ","ส"];
  return { day: days[d.getDay()], date: d.getDate() };
};

export default function RoomMap() {
  const router = useRouter();
  const { room_id } = useLocalSearchParams<{ room_id: string }>();
  const roomName = room_id || "CP9524";

  const [stations, setStations]   = useState<any[]>([]);
  const [bookings, setBookings]   = useState<any[]>([]);
  const [lanPorts, setLanPorts]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [days] = useState(getNext7Days());

  // Modal: detail เครื่องคอม
  const [compModal, setCompModal]         = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);

  // Modal: Server ports ของกลุ่ม
  const [serverModal, setServerModal] = useState(false);
  const [serverGroup, setServerGroup] = useState<number | null>(null);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { if (stations.length > 0) fetchBookings(); }, [selectedDate, stations]);

  const fetchAll = async () => {
    await Promise.all([fetchStations(), fetchLanPorts()]);
    setLoading(false);
  };

  const fetchStations = async () => {
    const { data } = await supabase
      .from("computer_stations").select("*")
      .eq("room_id", roomName).order("group_no").order("name");
    setStations(data || []);
  };

  const fetchBookings = async () => {
    const ids = stations.map(s => s.id);
    if (!ids.length) return;
    const { data } = await supabase
      .from("room_bookings").select("station_id, time_slot")
      .in("station_id", ids)
      .eq("booking_date", toDateStr(selectedDate))
      .eq("status", "active");
    setBookings(data || []);
    setRefreshing(false);
  };

  const fetchLanPorts = async () => {
    const { data } = await supabase
      .from("lan_ports").select("*")
      .eq("room_id", roomName).order("group_no").order("port_no");
    setLanPorts(data || []);
  };

  const onRefresh = () => { setRefreshing(true); fetchBookings(); fetchLanPorts(); };

  const getBookedSlots = (id: string) =>
    bookings.filter(b => b.station_id === id).map(b => b.time_slot);

  const getStationColor = (s: any) => {
    if (s.status === "repair") return "#cbd5e1";
    return getBookedSlots(s.id).length >= 4 ? "#fca5a5" : "#86efac";
  };
  const getStationTextColor = (s: any) => {
    if (s.status === "repair") return "#94a3b8";
    return getBookedSlots(s.id).length >= 4 ? "#991b1b" : "#166534";
  };

  const getGroupPorts = (groupNo: number) =>
    lanPorts.filter(p => p.group_no === groupNo);

  const getServerSummary = (groupNo: number) => {
    const ports = getGroupPorts(groupNo);
    const broken = ports.filter(p => p.status !== "available").length;
    return { total: ports.length, broken };
  };

  // จัดกลุ่ม stations
  const grouped: { [k: number]: any[] } = {};
  stations.forEach(s => {
    if (!grouped[s.group_no]) grouped[s.group_no] = [];
    grouped[s.group_no].push(s);
  });

  const serverGroupPorts = serverGroup !== null ? getGroupPorts(serverGroup) : [];

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.dateScroll} contentContainerStyle={styles.dateRow}>
        {days.map((d, i) => {
          const f = fmtDate(d);
          const active = toDateStr(d) === toDateStr(selectedDate);
          return (
            <TouchableOpacity key={i}
              style={[styles.dateBtn, active && styles.dateBtnActive]}
              onPress={() => setSelectedDate(d)}>
              <Text style={[styles.dateDayTxt, active && styles.dateTxtActive]}>{f.day}</Text>
              <Text style={[styles.dateNumTxt, active && styles.dateTxtActive]}>{f.date}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* LEGEND */}
      <View style={styles.legend}>
        {[
          { color: "#86efac", label: "ว่าง" },
          { color: "#fca5a5", label: "เต็ม" },
          { color: "#cbd5e1", label: "ซ่อมบำรุง" },
        ].map(l => (
          <View key={l.label} style={styles.legItem}>
            <View style={[styles.legDot, { backgroundColor: l.color }]} />
            <Text style={styles.legTxt}>{l.label}</Text>
          </View>
        ))}
        <Text style={styles.viewOnly}>👁 ดูสถานะเท่านั้น</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}>

          {/* กระดาน */}
          <View style={styles.board}>
            <Ionicons name="easel-outline" size={20} color="#fff" />
            <Text style={styles.boardTxt}>กระดาน / Projector</Text>
          </View>
          <View style={styles.teacherDesk}>
            <Text style={styles.teacherTxt}>🧑‍🏫 โต๊ะอาจารย์</Text>
          </View>

          {/* กลุ่ม */}
          {Object.entries(grouped).map(([gNo, stns]) => {
            const groupNo = Number(gNo);
            const srv = getServerSummary(groupNo);
            return (
              <View key={gNo} style={styles.groupBox}>
                <Text style={styles.groupLabel}>กลุ่มที่ {groupNo}</Text>

                <View style={styles.groupRow}>
                  {/* คอมในกลุ่ม */}
                  <View style={styles.stationsWrap}>
                    {stns.map(station => (
                      <TouchableOpacity
                        key={station.id}
                        style={[styles.station, { backgroundColor: getStationColor(station) }]}
                        onPress={() => { setSelectedStation(station); setCompModal(true); }}
                      >
                        <Ionicons name="desktop-outline" size={16} color={getStationTextColor(station)} />
                        <Text style={[styles.stationName, { color: getStationTextColor(station) }]}>
                          {station.name}
                        </Text>
                        {station.status === "repair" ? (
                          <Text style={styles.stationSub}>ซ่อม</Text>
                        ) : (
                          <Text style={styles.stationSub}>{4 - getBookedSlots(station.id).length}/4</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Server card */}
                  <TouchableOpacity
                    style={[styles.serverCard, srv.broken > 0 && styles.serverCardWarn]}
                    onPress={() => { setServerGroup(groupNo); setServerModal(true); }}
                  >
                    <Ionicons
                      name="server-outline" size={20}
                      color={srv.broken > 0 ? "#b45309" : "#1d4ed8"}
                    />
                    <Text style={[styles.serverLabel, { color: srv.broken > 0 ? "#b45309" : "#1d4ed8" }]}>
                      Server
                    </Text>
                    <Text style={styles.serverPort}>{srv.total} port</Text>
                    {srv.broken > 0 && (
                      <View style={styles.warnBadge}>
                        <Text style={styles.warnBadgeTxt}>{srv.broken} เสีย</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {stations.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyTxt}>ไม่พบข้อมูลเครื่องคอมในห้องนี้</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* MODAL: รายละเอียดเครื่องคอม */}
      <Modal visible={compModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>เครื่อง {selectedStation?.name}</Text>
                <Text style={styles.modalSub}>
                  ห้อง {roomName} · {selectedDate.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCompModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {selectedStation?.status === "repair" ? (
              <View style={styles.repairBox}>
                <Ionicons name="construct-outline" size={28} color="#b45309" />
                <Text style={styles.repairTxt}>เครื่องนี้อยู่ระหว่างซ่อมบำรุง</Text>
              </View>
            ) : (
              <>
                <Text style={styles.slotLabel}>สถานะช่วงเวลาวันนี้</Text>
                {TIME_SLOTS.map(ts => {
                  const booked = selectedStation
                    ? getBookedSlots(selectedStation.id).includes(ts.slot) : false;
                  return (
                    <View key={ts.slot} style={[styles.slotRow, booked && styles.slotRowTaken]}>
                      <View>
                        <Text style={[styles.slotTime, booked && { color: "#94a3b8" }]}>{ts.time}</Text>
                        <Text style={styles.slotName}>{ts.label}</Text>
                      </View>
                      <View style={[styles.slotBadge, { backgroundColor: booked ? "#fee2e2" : "#dcfce7" }]}>
                        <Text style={[styles.slotBadgeTxt, { color: booked ? "#dc2626" : "#16a34a" }]}>
                          {booked ? "มีการใช้งาน" : "ว่าง"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setCompModal(false)}>
              <Text style={styles.closeBtnTxt}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: LAN Ports ของ Server กลุ่มนี้ */}
      <Modal visible={serverModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Server กลุ่ม {serverGroup}</Text>
                <Text style={styles.modalSub}>ห้อง {roomName} · {serverGroupPorts.length} LAN Port</Text>
              </View>
              <TouchableOpacity onPress={() => setServerModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.slotLabel}>สถานะ LAN Port</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.portGrid}>
                {serverGroupPorts.map(port => {
                  const cfg = PORT_STATUS[port.status] || PORT_STATUS.available;
                  return (
                    <View
                      key={port.id}
                      style={[styles.portCell, { backgroundColor: cfg.bg, borderColor: cfg.color + "40" }]}
                    >
                      <Ionicons name="git-network-outline" size={14} color={cfg.color} />
                      <Text style={[styles.portNo, { color: cfg.color }]}>P{port.port_no}</Text>
                      <Text style={[styles.portStatus, { color: cfg.color }]}>{cfg.label}</Text>
                      {port.label ? (
                        <Text style={styles.portLabel} numberOfLines={1}>{port.label}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              {/* Legend ports */}
              <View style={styles.portLegend}>
                {Object.entries(PORT_STATUS).map(([k, v]) => (
                  <View key={k} style={styles.legItem}>
                    <View style={[styles.legDot, { backgroundColor: v.color }]} />
                    <Text style={styles.legTxt}>{v.label}</Text>
                  </View>
                ))}
              </View>

              <View style={{ height: 20 }} />
            </ScrollView>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setServerModal(false)}>
              <Text style={styles.closeBtnTxt}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9", paddingTop: 50, paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  headerText: { fontSize: 18, fontWeight: "bold", color: "#1e3a8a" },

  dateScroll: { marginBottom: 12 },
  dateRow: { gap: 8, paddingBottom: 4 },
  dateBtn: { width: 44, height: 54, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e2e8f0" },
  dateBtnActive: { backgroundColor: "#1e3a8a", borderColor: "#1e3a8a" },
  dateDayTxt: { fontSize: 10, color: "#64748b" },
  dateNumTxt: { fontSize: 16, fontWeight: "bold", color: "#1e293b" },
  dateTxtActive: { color: "#fff" },

  legend: { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "center", flexWrap: "wrap" },
  legItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legDot: { width: 8, height: 8, borderRadius: 4 },
  legTxt: { fontSize: 11, color: "#64748b" },
  viewOnly: { marginLeft: "auto", fontSize: 10, color: "#94a3b8" },

  board: { backgroundColor: "#1e3a8a", borderRadius: 10, padding: 10, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 10 },
  boardTxt: { color: "#fff", fontWeight: "600", fontSize: 13 },
  teacherDesk: { backgroundColor: "#dbeafe", borderRadius: 10, padding: 10, alignItems: "center", marginBottom: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#93c5fd" },
  teacherTxt: { color: "#1e3a8a", fontWeight: "600", fontSize: 12 },

  groupBox: { marginBottom: 16 },
  groupLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  groupRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },

  stationsWrap: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  station: { width: 62, height: 62, borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 2 },
  stationName: { fontSize: 10, fontWeight: "700" },
  stationSub: { fontSize: 8, color: "#166534" },

  serverCard: {
    width: 68, backgroundColor: "#eff6ff", borderRadius: 12,
    padding: 8, alignItems: "center", gap: 3,
    borderWidth: 1.5, borderColor: "#bfdbfe",
  },
  serverCardWarn: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  serverLabel: { fontSize: 10, fontWeight: "700" },
  serverPort: { fontSize: 9, color: "#94a3b8" },
  warnBadge: { backgroundColor: "#fef3c7", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  warnBadgeTxt: { fontSize: 8, color: "#b45309", fontWeight: "700" },

  empty: { padding: 40, alignItems: "center" },
  emptyTxt: { color: "#94a3b8" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#1e293b" },
  modalSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  repairBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  repairTxt: { fontSize: 14, color: "#b45309", fontWeight: "600" },

  slotLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  slotRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#f1f5f9" },
  slotRowTaken: { backgroundColor: "#fafafa" },
  slotTime: { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  slotName: { fontSize: 10, color: "#94a3b8", marginTop: 1 },
  slotBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  slotBadgeTxt: { fontSize: 10, fontWeight: "700" },

  // Port grid
  portGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  portCell: {
    width: "22%", borderRadius: 10, padding: 8,
    alignItems: "center", gap: 2,
    borderWidth: 1,
  },
  portNo: { fontSize: 11, fontWeight: "700" },
  portStatus: { fontSize: 8, fontWeight: "600" },
  portLabel: { fontSize: 7, color: "#94a3b8", textAlign: "center" },
  portLegend: { flexDirection: "row", gap: 12, marginBottom: 8 },

  closeBtn: { backgroundColor: "#f1f5f9", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 8 },
  closeBtnTxt: { color: "#64748b", fontWeight: "600" },
});
