import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Modal, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";

const PORT_STATUS: { [k: string]: { color: string; bg: string; label: string; icon: any } } = {
  available: { color: "#16a34a", bg: "#dcfce7", label: "ใช้งานได้", icon: "checkmark-circle-outline" },
  repair:    { color: "#b45309", bg: "#fef3c7", label: "กำลังซ่อม", icon: "construct-outline" },
  broken:    { color: "#dc2626", bg: "#fee2e2", label: "เสีย",       icon: "close-circle-outline" },
};

const STATION_STATUS: { [k: string]: { color: string; bg: string; label: string; icon: any } } = {
  available: { color: "#16a34a", bg: "#86efac", label: "ว่าง",          icon: "checkmark-circle-outline" },
  repair:    { color: "#b45309", bg: "#fde68a", label: "ซ่อมบำรุง",     icon: "construct-outline" },
  broken:    { color: "#dc2626", bg: "#fca5a5", label: "พัง",            icon: "close-circle-outline" },
};

export default function RoomMap() {
  const router = useRouter();
  const { room_id } = useLocalSearchParams<{ room_id: string }>();
  const roomName = room_id || "CP9524";

  const [stations, setStations] = useState<any[]>([]);
  const [lanPorts, setLanPorts] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal: detail เครื่องคอม
  const [compModal, setCompModal]           = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);

  // Modal: Server LAN ports
  const [serverModal, setServerModal] = useState(false);
  const [serverGroup, setServerGroup] = useState<number | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [{ data: st }, { data: lp }] = await Promise.all([
      supabase.from("computer_stations").select("*")
        .eq("room_id", roomName).order("group_no").order("name"),
      supabase.from("lan_ports").select("*")
        .eq("room_id", roomName).order("group_no").order("port_no"),
    ]);
    setStations(st || []);
    setLanPorts(lp || []);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

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

  const getStationCfg = (status: string) =>
    STATION_STATUS[status] || STATION_STATUS.available;

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

      {/* LEGEND */}
      <View style={styles.legend}>
        {Object.entries(STATION_STATUS).map(([k, v]) => (
          <View key={k} style={styles.legItem}>
            <View style={[styles.legDot, { backgroundColor: v.bg }]} />
            <Text style={styles.legTxt}>{v.label}</Text>
          </View>
        ))}
        <Text style={styles.viewOnly}>👁 กดเพื่อดูสถานะ</Text>
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
                    {stns.map(station => {
                      const cfg = getStationCfg(station.status);
                      return (
                        <TouchableOpacity
                          key={station.id}
                          style={[styles.station, { backgroundColor: cfg.bg }]}
                          onPress={() => { setSelectedStation(station); setCompModal(true); }}
                        >
                          <Ionicons name="desktop-outline" size={16} color={cfg.color} />
                          <Text style={[styles.stationName, { color: cfg.color }]}>
                            {station.name}
                          </Text>
                          <Text style={[styles.stationSub, { color: cfg.color }]}>
                            {cfg.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
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
              <Ionicons name="desktop-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTxt}>ไม่พบข้อมูลเครื่องคอมในห้องนี้</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* MODAL: สถานะเครื่องคอม */}
      <Modal visible={compModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedStation?.name}</Text>
                <Text style={styles.modalSub}>ห้อง {roomName} · กลุ่ม {selectedStation?.group_no}</Text>
              </View>
              <TouchableOpacity onPress={() => setCompModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {(() => {
              const cfg = getStationCfg(selectedStation?.status || "available");
              return (
                <View style={[styles.statusBigBox, { backgroundColor: cfg.bg + "80" }]}>
                  <Ionicons name={cfg.icon} size={48} color={cfg.color} />
                  <Text style={[styles.statusBigLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  {selectedStation?.status === "repair" && (
                    <Text style={styles.statusNote}>เครื่องนี้อยู่ระหว่างซ่อมบำรุง ไม่สามารถใช้งานได้</Text>
                  )}
                  {selectedStation?.status === "broken" && (
                    <Text style={styles.statusNote}>เครื่องนี้ชำรุด กรุณาแจ้งผู้ดูแล</Text>
                  )}
                  {selectedStation?.status === "available" && (
                    <Text style={styles.statusNote}>เครื่องนี้พร้อมใช้งาน</Text>
                  )}
                </View>
              );
            })()}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setCompModal(false)}>
              <Text style={styles.closeBtnTxt}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL: LAN Ports ของ Server */}
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

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.portGrid}>
                {serverGroupPorts.map(port => {
                  const cfg = PORT_STATUS[port.status] || PORT_STATUS.available;
                  return (
                    <View key={port.id}
                      style={[styles.portCell, { backgroundColor: cfg.bg, borderColor: cfg.color + "40" }]}>
                      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                      <Text style={[styles.portNo, { color: cfg.color }]}>P{port.port_no}</Text>
                      <Text style={[styles.portStatus, { color: cfg.color }]}>{cfg.label}</Text>
                      {port.label ? (
                        <Text style={styles.portLabel} numberOfLines={1}>{port.label}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>

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

  legend: { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "center", flexWrap: "wrap" },
  legItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legDot: { width: 10, height: 10, borderRadius: 5 },
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

  station: { width: 62, height: 66, borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 2 },
  stationName: { fontSize: 10, fontWeight: "700" },
  stationSub: { fontSize: 8, fontWeight: "600" },

  serverCard: { width: 68, backgroundColor: "#eff6ff", borderRadius: 12, padding: 8, alignItems: "center", gap: 3, borderWidth: 1.5, borderColor: "#bfdbfe" },
  serverCardWarn: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  serverLabel: { fontSize: 10, fontWeight: "700" },
  serverPort: { fontSize: 9, color: "#94a3b8" },
  warnBadge: { backgroundColor: "#fef3c7", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  warnBadgeTxt: { fontSize: 8, color: "#b45309", fontWeight: "700" },

  empty: { padding: 40, alignItems: "center", gap: 10 },
  emptyTxt: { color: "#94a3b8", fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#1e293b" },
  modalSub: { fontSize: 12, color: "#64748b", marginTop: 2 },

  statusBigBox: { alignItems: "center", paddingVertical: 28, gap: 10, borderRadius: 16, marginBottom: 16 },
  statusBigLabel: { fontSize: 22, fontWeight: "800" },
  statusNote: { fontSize: 13, color: "#64748b", textAlign: "center" },

  portGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  portCell: { width: "22%", borderRadius: 10, padding: 8, alignItems: "center", gap: 2, borderWidth: 1 },
  portNo: { fontSize: 11, fontWeight: "700" },
  portStatus: { fontSize: 8, fontWeight: "600" },
  portLabel: { fontSize: 7, color: "#94a3b8", textAlign: "center" },
  portLegend: { flexDirection: "row", gap: 12, marginBottom: 8 },

  closeBtn: { backgroundColor: "#f1f5f9", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 4 },
  closeBtnTxt: { color: "#64748b", fontWeight: "600" },
});
