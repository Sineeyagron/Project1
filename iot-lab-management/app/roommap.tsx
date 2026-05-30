import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Modal, ActivityIndicator, RefreshControl,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";

const PORT_STATUS: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  available: { color: "#16a34a", bg: "#dcfce7", label: "ใช้งานได้", icon: "checkmark-circle-outline" },
  repair:    { color: "#b45309", bg: "#fef3c7", label: "กำลังซ่อม", icon: "construct-outline" },
  broken:    { color: "#dc2626", bg: "#fee2e2", label: "เสีย",       icon: "close-circle-outline" },
};

const STATION_STATUS: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  available: { color: "#16a34a", bg: "#86efac", label: "ว่าง",      icon: "checkmark-circle-outline" },
  repair:    { color: "#b45309", bg: "#fde68a", label: "ซ่อมบำรุง", icon: "construct-outline" },
  broken:    { color: "#dc2626", bg: "#fca5a5", label: "พัง",        icon: "close-circle-outline" },
};

const EQUIP_STATUS: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  present: { color: "#16a34a", bg: "#dcfce7", label: "ครบ",    icon: "checkmark-circle-outline" },
  missing: { color: "#dc2626", bg: "#fee2e2", label: "หาย",   icon: "alert-circle-outline" },
  broken:  { color: "#b45309", bg: "#fef3c7", label: "ชำรุด", icon: "construct-outline" },
};

const EQUIP_LABELS: Record<string, string> = {
  mouse:    "🖱️ เมาส์",
  keyboard: "⌨️ คีย์บอร์ด",
  monitor:  "🖥️ จอภาพ",
};

export default function RoomMap() {
  const router = useRouter();
  const { room_id } = useLocalSearchParams<{ room_id: string }>();
  const roomName = room_id || "CP9524";

  const [stations, setStations] = useState<any[]>([]);
  const [lanPorts, setLanPorts] = useState<any[]>([]);
  const [equipMap, setEquipMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal: detail เครื่องคอม + checklist
  const [compModal, setCompModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);

  // Modal: Server LAN ports
  const [serverModal, setServerModal] = useState(false);
  const [serverGroup, setServerGroup] = useState<number | null>(null);

  useEffect(() => { fetchAll(); }, [roomName]);

  const fetchAll = async () => {
    const [{ data: st }, { data: lp }, { data: eq }] = await Promise.all([
      supabase.from("computer_stations").select("*")
        .eq("room_id", roomName).order("group_no").order("name"),
      supabase.from("lan_ports").select("*")
        .eq("room_id", roomName).order("group_no").order("port_no"),
      supabase.from("station_equipment").select("*"),
    ]);

    setStations(st || []);
    setLanPorts(lp || []);

    // จัด equipMap: station_id → []
    const map: Record<string, any[]> = {};
    (eq || []).forEach((e: any) => {
      if (!map[e.station_id]) map[e.station_id] = [];
      map[e.station_id].push(e);
    });
    setEquipMap(map);
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
  const grouped: Record<number, any[]> = {};
  stations.forEach(s => {
    if (!grouped[s.group_no]) grouped[s.group_no] = [];
    grouped[s.group_no].push(s);
  });

  const serverGroupPorts = serverGroup !== null ? getGroupPorts(serverGroup) : [];

  // Equipment summary สำหรับ station badge
  const getEquipSummary = (stationId: string) => {
    const equips = equipMap[stationId] || [];
    const hasIssue = equips.some(e => e.status !== "present");
    return { hasIssue, equips };
  };

  const openStation = (station: any) => {
    setSelectedStation(station);
    setCompModal(true);
  };

  return (
    <View style={s.container}>

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.replace("/home")} activeOpacity={0.84}>
          <Ionicons name="arrow-back" size={23} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerTitleBlock}>
          <Text style={s.headerText}>ผังห้อง {roomName}</Text>
          <Text style={s.headerSub}>{stations.length} เครื่อง · {lanPorts.length} LAN port</Text>
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={onRefresh} activeOpacity={0.84}>
          <Ionicons name="refresh" size={19} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* LEGEND */}
      <View style={s.legend}>
        {Object.entries(STATION_STATUS).map(([k, v]) => (
          <View key={k} style={s.legItem}>
            <View style={[s.legDot, { backgroundColor: v.bg }]} />
            <Text style={s.legTxt}>{v.label}</Text>
          </View>
        ))}
        <Text style={s.viewOnly}>👁 กดเพื่อดูรายละเอียด</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}>

          {/* กระดาน */}
          <View style={s.board}>
            <Ionicons name="easel-outline" size={20} color="#fff" />
            <Text style={s.boardTxt}>กระดาน / Projector</Text>
          </View>
          <View style={s.teacherDesk}>
            <Text style={s.teacherTxt}>🧑‍🏫 โต๊ะอาจารย์</Text>
          </View>

          {/* กลุ่ม */}
          {Object.entries(grouped).map(([gNo, stns]) => {
            const groupNo = Number(gNo);
            const srv = getServerSummary(groupNo);
            return (
              <View key={gNo} style={s.groupBox}>
                <Text style={s.groupLabel}>กลุ่มที่ {groupNo}</Text>
                <View style={s.groupRow}>

                  {/* คอมในกลุ่ม */}
                  <View style={s.stationsWrap}>
                    {stns.map(station => {
                      const cfg = STATION_STATUS[station.status] || STATION_STATUS.available;
                      const { hasIssue } = getEquipSummary(station.id);
                      return (
                        <TouchableOpacity
                          key={station.id}
                          style={[s.station, { backgroundColor: cfg.bg }]}
                          onPress={() => openStation(station)}
                        >
                          {hasIssue && <View style={s.equipWarnDot} />}
                          <Ionicons name="desktop-outline" size={16} color={cfg.color} />
                          <Text style={[s.stationName, { color: cfg.color }]}>{station.name}</Text>
                          <Text style={[s.stationSub, { color: cfg.color }]}>{cfg.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Server card */}
                  <TouchableOpacity
                    style={[s.serverCard, srv.broken > 0 && s.serverCardWarn]}
                    onPress={() => { setServerGroup(groupNo); setServerModal(true); }}
                  >
                    <Ionicons name="server-outline" size={20}
                      color={srv.broken > 0 ? "#b45309" : "#1d4ed8"} />
                    <Text style={[s.serverLabel, { color: srv.broken > 0 ? "#b45309" : "#1d4ed8" }]}>
                      Server
                    </Text>
                    <Text style={s.serverPort}>{srv.total} port</Text>
                    {srv.broken > 0 && (
                      <View style={s.warnBadge}>
                        <Text style={s.warnBadgeTxt}>{srv.broken} เสีย</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {stations.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="desktop-outline" size={48} color="#cbd5e1" />
              <Text style={s.emptyTxt}>ไม่พบข้อมูลเครื่องคอมในห้องนี้</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── MODAL: สถานะเครื่องคอม + Equipment Checklist ── */}
      <Modal visible={compModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>{selectedStation?.name}</Text>
                <Text style={s.modalSub}>ห้อง {roomName} · กลุ่ม {selectedStation?.group_no}</Text>
              </View>
              <TouchableOpacity onPress={() => setCompModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* สถานะเครื่อง */}
            {(() => {
              const cfg = STATION_STATUS[selectedStation?.status || "available"];
              return (
                <View style={[s.statusBigBox, { backgroundColor: cfg.bg + "80" }]}>
                  <Ionicons name={cfg.icon} size={40} color={cfg.color} />
                  <Text style={[s.statusBigLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  {selectedStation?.status === "repair" && (
                    <Text style={s.statusNote}>เครื่องนี้อยู่ระหว่างซ่อมบำรุง</Text>
                  )}
                  {selectedStation?.status === "broken" && (
                    <Text style={s.statusNote}>เครื่องนี้ชำรุด กรุณาแจ้งผู้ดูแล</Text>
                  )}
                  {selectedStation?.status === "available" && (
                    <Text style={s.statusNote}>เครื่องนี้พร้อมใช้งาน</Text>
                  )}
                </View>
              );
            })()}

            {/* Equipment Checklist */}
            <Text style={s.checklistTitle}>อุปกรณ์ประจำเครื่อง</Text>
            <View style={s.checklistGrid}>
              {(["mouse", "keyboard", "monitor"] as const).map(type => {
                const equips = equipMap[selectedStation?.id] || [];
                const eq = equips.find((e: any) => e.equipment_type === type);
                const status = eq?.status || "present";
                const cfg = EQUIP_STATUS[status];
                return (
                  <View key={type} style={[s.checklistItem, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                    <Text style={[s.checklistLabel, { color: cfg.color }]}>
                      {EQUIP_LABELS[type]}
                    </Text>
                    <Text style={[s.checklistStatus, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity style={s.closeBtn} onPress={() => setCompModal(false)}>
              <Text style={s.closeBtnTxt}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: LAN Ports ── */}
      <Modal visible={serverModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: "80%" }]}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Server กลุ่ม {serverGroup}</Text>
                <Text style={s.modalSub}>ห้อง {roomName} · {serverGroupPorts.length} LAN Port</Text>
              </View>
              <TouchableOpacity onPress={() => setServerModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.portGrid}>
                {serverGroupPorts.map(port => {
                  const cfg = PORT_STATUS[port.status] || PORT_STATUS.available;
                  return (
                    <View key={port.id}
                      style={[s.portCell, { backgroundColor: cfg.bg, borderColor: cfg.color + "40" }]}>
                      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                      <Text style={[s.portNo, { color: cfg.color }]}>P{port.port_no}</Text>
                      <Text style={[s.portStatus, { color: cfg.color }]}>{cfg.label}</Text>
                      {port.label ? <Text style={s.portLabel} numberOfLines={1}>{port.label}</Text> : null}
                    </View>
                  );
                })}
              </View>

              <View style={s.portLegend}>
                {Object.entries(PORT_STATUS).map(([k, v]) => (
                  <View key={k} style={s.legItem}>
                    <View style={[s.legDot, { backgroundColor: v.color }]} />
                    <Text style={s.legTxt}>{v.label}</Text>
                  </View>
                ))}
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>

            <TouchableOpacity style={s.closeBtn} onPress={() => setServerModal(false)}>
              <Text style={s.closeBtnTxt}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#edf5ff" },
  header: {
    backgroundColor: "#2563eb",
    paddingTop: 54,
    paddingBottom: 17,
    paddingHorizontal: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 39,
    height: 39,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.23)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleBlock: { flex: 1, paddingHorizontal: 14 },
  headerText: { fontSize: 21, fontWeight: "900", color: "#fff" },
  headerSub: { color: "#dbeafe", fontSize: 11, fontWeight: "800", marginTop: 2 },

  legend: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    alignItems: "center",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  legItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legDot: { width: 10, height: 10, borderRadius: 5 },
  legTxt: { fontSize: 11, color: "#64748b" },
  viewOnly: { marginLeft: "auto", fontSize: 10, color: "#94a3b8" },

  scrollContent: { paddingHorizontal: 16 },

  board: { backgroundColor: "#2563eb", borderRadius: 10, padding: 10, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 10 },
  boardTxt: { color: "#fff", fontWeight: "600", fontSize: 13 },
  teacherDesk: { backgroundColor: "#dbeafe", borderRadius: 10, padding: 10, alignItems: "center", marginBottom: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#93c5fd" },
  teacherTxt: { color: "#1e3a8a", fontWeight: "600", fontSize: 12 },

  groupBox: { marginBottom: 16 },
  groupLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  groupRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  stationsWrap: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },

  station: { width: 60, height: 66, borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 2, position: "relative" },
  stationName: { fontSize: 9, fontWeight: "700" },
  stationSub: { fontSize: 7.5, fontWeight: "600" },
  equipWarnDot: {
    position: "absolute", top: 4, right: 4,
    width: 7, height: 7, borderRadius: 4, backgroundColor: "#f97316",
  },

  serverCard: { width: 66, backgroundColor: "#eff6ff", borderRadius: 12, padding: 8, alignItems: "center", gap: 3, borderWidth: 1.5, borderColor: "#bfdbfe" },
  serverCardWarn: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  serverLabel: { fontSize: 10, fontWeight: "700" },
  serverPort: { fontSize: 9, color: "#94a3b8" },
  warnBadge: { backgroundColor: "#fef3c7", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6 },
  warnBadgeTxt: { fontSize: 8, color: "#b45309", fontWeight: "700" },

  empty: { padding: 40, alignItems: "center", gap: 10 },
  emptyTxt: { color: "#94a3b8", fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#1e293b" },
  modalSub: { fontSize: 12, color: "#64748b", marginTop: 2 },

  statusBigBox: { alignItems: "center", paddingVertical: 20, gap: 8, borderRadius: 16, marginBottom: 14 },
  statusBigLabel: { fontSize: 20, fontWeight: "800" },
  statusNote: { fontSize: 12, color: "#64748b", textAlign: "center" },

  checklistTitle: { fontSize: 12, fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  checklistGrid: { flexDirection: "row", gap: 8, marginBottom: 16 },
  checklistItem: {
    flex: 1, borderRadius: 12, padding: 10,
    alignItems: "center", gap: 4,
  },
  checklistLabel: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  checklistStatus: { fontSize: 10, fontWeight: "600" },

  portGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  portCell: { width: "22%", borderRadius: 10, padding: 8, alignItems: "center", gap: 2, borderWidth: 1 },
  portNo: { fontSize: 11, fontWeight: "700" },
  portStatus: { fontSize: 8, fontWeight: "600" },
  portLabel: { fontSize: 7, color: "#94a3b8", textAlign: "center" },
  portLegend: { flexDirection: "row", gap: 12, marginBottom: 8 },

  closeBtn: { backgroundColor: "#f1f5f9", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 4 },
  closeBtnTxt: { color: "#64748b", fontWeight: "600" },
});
