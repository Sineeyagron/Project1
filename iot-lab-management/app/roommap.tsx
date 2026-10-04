import React, { useEffect, useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Text } from "../components/AppText";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";
import { goBack, useRefreshOnFocus } from "../lib/nav";
import { EQUIP_STATUS, LAN_STATUS, STATION_STATUS, naturalNo, roomStatus } from "../lib/roomStatus";
import LoadError from "../components/LoadError";
import { Room, fetchRooms, roomPlace } from "../lib/rooms";
import { notify } from "../lib/notify";
import { currentUser } from "../lib/session";
import RoomReportForm from "../components/RoomReportForm";
import { useRoomLive } from "../lib/roomRealtime";
import { W } from "../lib/theme";
import ScreenHeader, { HeaderButton } from "../components/ScreenHeader";

const EQUIP_LABELS: Record<string, string> = {
  mouse:    "🖱️ เมาส์",
  keyboard: "⌨️ คีย์บอร์ด",
  monitor:  "🖥️ จอภาพ",
};

export default function RoomMap() {
  const { room_id } = useLocalSearchParams<{ room_id: string }>();
  // ไม่ได้ส่งห้องมา → ใช้ห้องแรกจากตาราง rooms (เดิมฟิก "CP9524")
  const [roomName, setRoomName] = useState(room_id ? String(room_id) : "");
  const [roomInfo, setRoomInfo] = useState<Room | null>(null);
  useEffect(() => {
    if (room_id) setRoomName(String(room_id));
    else fetchRooms().then(({ rooms }) => {
      if (rooms[0]) setRoomName(rooms[0].id);
      else setLoading(false);
    });
  }, [room_id]);

  const [stations, setStations] = useState<any[]>([]);
  const [lanPorts, setLanPorts] = useState<any[]>([]);
  const [equipMap, setEquipMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const roomRef = useRef(roomName); // กันผลของห้องเก่า (ตอบช้า) มาทับห้องใหม่

  // Modal: detail เครื่องคอม + checklist
  const [compModal, setCompModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState<any>(null);

  // Admin/TA: แก้เช็กลิสต์ตรงได้ + เห็นประวัติการเปลี่ยนสถานะ (RLS: staff เท่านั้น)
  const [isStaff, setIsStaff] = useState(false);
  const [stationLog, setStationLog] = useState<any[]>([]);
  const [equipSaving, setEquipSaving] = useState<string | null>(null);
  // เป้าหมายที่กำลังกรอกคำแจ้งปัญหา (เครื่อง หรือ LAN port)
  const [reportTarget, setReportTarget] = useState<{ kind: "station" | "lan"; id: string; label: string } | null>(null);
  useEffect(() => {
    supabase.rpc("is_staff").then(({ data }) => setIsStaff(!!data));
  }, []);

  // Modal: Server LAN ports
  const [serverModal, setServerModal] = useState(false);
  const [serverGroup, setServerGroup] = useState<number | null>(null);

  useEffect(() => {
    roomRef.current = roomName;
    if (roomName) fetchAll();
  }, [roomName]);
  useRefreshOnFocus(() => { if (roomName) fetchAll(); });
  // อัปเดตสด: มีคนเปลี่ยนสถานะเครื่อง/LAN/เช็กลิสต์ในห้องนี้ → โหลดใหม่ทันที (REVIEW M12)
  useRoomLive(() => { if (roomName) fetchAll(); }, roomName);

  const fetchAll = async () => {
    const room = roomName;
    const [{ data: st, error: e1 }, { data: lp, error: e2 }, { data: eq, error: e3 }, { data: info }] = await Promise.all([
      // เครื่องที่ปิดใช้งาน (active=false) ไม่ขึ้นในผังห้อง
      supabase.from("computer_stations").select("*")
        .eq("room_id", room).eq("active", true).order("group_no").order("name"),
      supabase.from("lan_ports").select("*")
        .eq("room_id", room).order("group_no").order("port_no"),
      // เฉพาะเช็กลิสต์ของเครื่องในห้องนี้ (เดิมโหลดทั้งตารางทุกห้อง)
      supabase.from("station_equipment").select("*, computer_stations!inner(room_id)")
        .eq("computer_stations.room_id", room),
      supabase.from("rooms").select("*").eq("id", room).maybeSingle(),
    ]);
    if (room !== roomRef.current) return;
    setRoomInfo((info as Room) || null);
    setLoading(false);
    setRefreshing(false);
    if (e1 || e2 || e3) {
      // โหลดพัง ห้ามโชว์ผังเปล่า/ "ครบ" — ขึ้นแถบให้ลองใหม่
      setLoadError(e1?.message || e2?.message || e3?.message || "");
      return;
    }
    setLoadError("");

    const sorted = (st || []).sort((a: any, b: any) => naturalNo(a.name) - naturalNo(b.name));
    setStations(sorted);
    // หน้าต่างรายละเอียดที่เปิดค้าง → แสดงสถานะล่าสุดด้วย
    setSelectedStation((prev: any) => (prev ? sorted.find((x: any) => x.id === prev.id) || prev : prev));
    setLanPorts(lp || []);

    // จัด equipMap: station_id → []
    const map: Record<string, any[]> = {};
    (eq || []).forEach((e: any) => {
      if (!map[e.station_id]) map[e.station_id] = [];
      map[e.station_id].push(e);
    });
    setEquipMap(map);
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

  const openStation = async (station: any) => {
    setSelectedStation(station);
    setStationLog([]);
    setReportTarget(null);
    setCompModal(true);
    if (isStaff) {
      const { data } = await supabase
        .from("room_status_log").select("*").eq("station_id", station.id)
        .order("changed_at", { ascending: false }).limit(5);
      const rows = data || [];
      // ชื่อผู้เปลี่ยน (อีเมลส่วนหน้า @)
      const ids = [...new Set(rows.map((row: any) => row.changed_by).filter(Boolean))];
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: people } = await supabase.from("profiles").select("id, email").in("id", ids);
        (people || []).forEach((p: any) => { names[p.id] = (p.email || "").split("@")[0]; });
      }
      setStationLog(rows.map((row: any) => ({ ...row, who: names[row.changed_by] || "ระบบ" })));
    }
  };

  // Admin/TA กดอุปกรณ์ในเช็กลิสต์ = เปลี่ยนสถานะวน ครบ → หาย → ชำรุด → ครบ
  // (ผลตรวจประจำเทอมก็อัปเดตเช็กลิสต์ให้เองอยู่แล้ว — อันนี้ไว้แก้ระหว่างเทอม)
  const NEXT_EQUIP: Record<string, string> = { present: "missing", missing: "broken", broken: "present" };
  const cycleEquip = async (type: string, current: string) => {
    if (!isStaff || !selectedStation || equipSaving) return;
    const next = NEXT_EQUIP[current] || "present";
    setEquipSaving(type);
    const user = await currentUser();
    const { data, error } = await supabase
      .from("station_equipment")
      .update({ status: next, updated_at: new Date().toISOString(), updated_by: user?.id || null })
      .eq("station_id", selectedStation.id).eq("equipment_type", type)
      .select("*");
    setEquipSaving(null);
    if (error || !data?.length) {
      notify("แก้เช็กลิสต์ไม่สำเร็จ", error?.message || "ไม่มีสิทธิ์แก้ไข");
      return;
    }
    setEquipMap((prev) => ({
      ...prev,
      [selectedStation.id]: [...(prev[selectedStation.id] || []).filter((e: any) => e.equipment_type !== type), data[0]],
    }));
  };

  return (
    <View style={s.container}>

      {/* HEADER */}
      <ScreenHeader
        title={`ผังห้อง ${roomName}`}
        subtitle={`${roomPlace(roomInfo)} · ${stations.length} เครื่อง · ${lanPorts.length} LAN port`}
        onBack={() => goBack("/home")}
        right={<HeaderButton icon="refresh" label="รีเฟรช" onPress={onRefresh} />}
      />

      {/* LEGEND */}
      <View style={s.legend}>
        {Object.entries(STATION_STATUS).map(([k, v]) => (
          <View key={k} style={s.legItem}>
            <View style={[s.legDot, { backgroundColor: v.border }]} />
            <Text style={s.legTxt}>{v.label}</Text>
          </View>
        ))}
        <Text style={s.viewOnly}>👁 กดเพื่อดูรายละเอียด</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1D4ED8" />}>

          {!!loadError && <LoadError message={loadError} onRetry={onRefresh} />}

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
                      const cfg = roomStatus(STATION_STATUS, station.status);
                      const { hasIssue } = getEquipSummary(station.id);
                      return (
                        <TouchableOpacity
                          key={station.id}
                          style={[s.station, { backgroundColor: cfg.border }]}
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
                    onPress={() => { setServerGroup(groupNo); setReportTarget(null); setServerModal(true); }}
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

          {stations.length === 0 && !loadError && (
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
              // ค่าสำรองเมื่อเจอสถานะแปลก — เดิมไม่มี แอปพังทั้งหน้า
              const cfg = roomStatus(STATION_STATUS, selectedStation?.status);
              return (
                <View style={[s.statusBigBox, { backgroundColor: cfg.border + "80" }]}>
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
                const cfg = roomStatus(EQUIP_STATUS, status);
                return (
                  <TouchableOpacity
                    key={type}
                    style={[s.checklistItem, { backgroundColor: cfg.bg }]}
                    onPress={() => cycleEquip(type, status)}
                    disabled={!isStaff || !!equipSaving}
                    activeOpacity={0.8}
                  >
                    {equipSaving === type
                      ? <ActivityIndicator size="small" color={cfg.color} />
                      : <Ionicons name={cfg.icon} size={20} color={cfg.color} />}
                    <Text style={[s.checklistLabel, { color: cfg.color }]}>
                      {EQUIP_LABELS[type]}
                    </Text>
                    <Text style={[s.checklistStatus, { color: cfg.color }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {isStaff ? <Text style={s.staffHint}>Admin/TA: กดอุปกรณ์เพื่อเปลี่ยน ครบ → หาย → ชำรุด</Text> : null}

            {isStaff && stationLog.length > 0 ? (
              <View style={s.logBox}>
                <Text style={s.checklistTitle}>ประวัติสถานะล่าสุด</Text>
                {stationLog.map((row: any) => (
                  <Text key={row.id} style={s.logRow} numberOfLines={1}>
                    {new Date(row.changed_at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {" · "}{roomStatus(STATION_STATUS, row.from_status).label} → {roomStatus(STATION_STATUS, row.to_status).label}
                    {" · "}{row.source === "repair" ? "งานซ่อม" : row.who}
                  </Text>
                ))}
              </View>
            ) : null}

            {/* แจ้งปัญหาเครื่อง (R3) — ทุกคนที่ล็อกอิน */}
            {reportTarget?.kind === "station" && reportTarget.id === selectedStation?.id ? (
              <RoomReportForm kind="station" targetId={reportTarget.id} label={reportTarget.label} onDone={() => setReportTarget(null)} />
            ) : (
              <TouchableOpacity
                style={s.reportBtn}
                onPress={() => selectedStation && setReportTarget({
                  kind: "station", id: selectedStation.id, label: `กลุ่ม ${selectedStation.group_no} ${selectedStation.name}`,
                })}
              >
                <Ionicons name="megaphone-outline" size={16} color="#c2410c" />
                <Text style={s.reportBtnTxt}>แจ้งปัญหาเครื่องนี้</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.closeBtn} onPress={() => { setCompModal(false); setReportTarget(null); }}>
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
              <TouchableOpacity onPress={() => { setServerModal(false); setReportTarget(null); }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={s.portGrid}>
                {serverGroupPorts.map(port => {
                  const cfg = roomStatus(LAN_STATUS, port.status);
                  const picked = reportTarget?.kind === "lan" && reportTarget.id === port.id;
                  return (
                    // กด port = แจ้งปัญหา port นั้น (R3)
                    <TouchableOpacity key={port.id}
                      style={[s.portCell, { backgroundColor: cfg.bg, borderColor: picked ? "#ea580c" : cfg.color + "40" }]}
                      onPress={() => setReportTarget({ kind: "lan", id: port.id, label: `กลุ่ม ${port.group_no} Port ${port.port_no}` })}
                      activeOpacity={0.8}>
                      <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                      <Text style={[s.portNo, { color: cfg.color }]}>P{port.port_no}</Text>
                      <Text style={[s.portStatus, { color: cfg.color }]}>{cfg.label}</Text>
                      {port.label ? <Text style={s.portLabel} numberOfLines={1}>{port.label}</Text> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {reportTarget?.kind === "lan" ? (
                <RoomReportForm kind="lan" targetId={reportTarget.id} label={reportTarget.label} onDone={() => setReportTarget(null)} />
              ) : (
                <Text style={s.staffHint}>พบ port มีปัญหา? กดที่ port เพื่อแจ้งผู้ดูแล</Text>
              )}

              <View style={s.portLegend}>
                {Object.entries(LAN_STATUS).map(([k, v]) => (
                  <View key={k} style={s.legItem}>
                    <View style={[s.legDot, { backgroundColor: v.color }]} />
                    <Text style={s.legTxt}>{v.label}</Text>
                  </View>
                ))}
              </View>
              <View style={{ height: 20 }} />
            </ScrollView>

            <TouchableOpacity style={s.closeBtn} onPress={() => { setServerModal(false); setReportTarget(null); }}>
              <Text style={s.closeBtnTxt}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  header: { ...W.headerBar,
    paddingTop: 52,
    paddingBottom: 10,
    marginBottom: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    ...W.iconBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleBlock: { flex: 1, paddingHorizontal: 10 },
  headerText: { fontSize: 20, fontWeight: "700", color: "#172033" },
  headerSub: { color: "#475569", fontSize: 12, marginTop: 1 },

  legend: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    alignItems: "center",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 0,
  },
  legItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legDot: { width: 10, height: 10, borderRadius: 3 },
  legTxt: { fontSize: 12, color: "#475569" },
  viewOnly: { marginLeft: "auto", fontSize: 12, color: "#475569" },

  scrollContent: { paddingHorizontal: 16 },

  board: { ...W.primary, padding: 10, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 10 },
  boardTxt: { color: "#fff", fontWeight: "600", fontSize: 13 },
  teacherDesk: { ...W.small, borderRadius: 12, padding: 8, alignItems: "center", marginBottom: 14 },
  teacherTxt: { color: "#475569", fontSize: 12 },

  groupBox: { ...W.card, padding: 10, marginBottom: 12 },
  groupLabel: { fontSize: 13, fontWeight: "600", color: "#172033", marginBottom: 8 },
  groupRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  stationsWrap: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },

  station: { width: 54, height: 60, borderRadius: 15, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 4px rgba(15,23,42,0.06)", alignItems: "center", justifyContent: "center", gap: 2, position: "relative" },
  stationName: { fontSize: 9, fontWeight: "700" },
  stationSub: { fontSize: 7.5, fontWeight: "600" },
  equipWarnDot: {
    position: "absolute", top: 4, right: 4,
    width: 7, height: 7, borderRadius: 4, backgroundColor: "#f97316",
  },

  serverCard: { width: 64, backgroundColor: "#EEF5FF", borderRadius: 15, padding: 8, alignItems: "center", gap: 3, borderWidth: 1, borderColor: "#BFDBFE", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" },
  serverCardWarn: { backgroundColor: "#FFFBEB", borderColor: "#FCD34D" },
  serverLabel: { fontSize: 10, fontWeight: "700" },
  serverPort: { fontSize: 9, color: "#475569" },
  warnBadge: { backgroundColor: "#F59E0B", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  warnBadgeTxt: { fontSize: 9, color: "#FFFFFF", fontWeight: "600" },

  empty: { padding: 40, alignItems: "center", gap: 10 },
  emptyTxt: { color: "#475569", fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(23,32,51,0.4)", justifyContent: "flex-end" },
  modalBox: { ...W.sheet, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#172033" },
  modalSub: { fontSize: 12, color: "#475569", marginTop: 2 },

  statusBigBox: { alignItems: "center", paddingVertical: 18, gap: 6, borderRadius: 18, marginBottom: 14, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" },
  statusBigLabel: { fontSize: 18, fontWeight: "700" },
  statusNote: { fontSize: 12, color: "#475569", textAlign: "center" },

  checklistTitle: { fontSize: 13, fontWeight: "600", color: "#172033", marginBottom: 8 },
  checklistGrid: { flexDirection: "row", gap: 8, marginBottom: 16 },
  checklistItem: {
    flex: 1, borderRadius: 15, padding: 10, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
    alignItems: "center", gap: 4,
  },
  checklistLabel: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  checklistStatus: { fontSize: 10, fontWeight: "600" },
  staffHint: { fontSize: 11, color: "#475569", marginTop: 8, textAlign: "center" },
  logBox: { marginTop: 12, backgroundColor: "#F5F8FE", borderRadius: 15, padding: 10 },
  logRow: { fontSize: 11, color: "#334155", marginTop: 4 },
  reportBtn: { marginTop: 12, minHeight: 46, borderRadius: 15, borderWidth: 1, borderColor: "#fdba74", backgroundColor: "#fff7ed", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  reportBtnTxt: { color: "#c2410c", fontWeight: "600", fontSize: 14 },

  portGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  portCell: { width: "22%", borderRadius: 12, padding: 8, alignItems: "center", gap: 2, borderWidth: 1 },
  portNo: { fontSize: 11, fontWeight: "700" },
  portStatus: { fontSize: 8, fontWeight: "600" },
  portLabel: { fontSize: 7, color: "#475569", textAlign: "center" },
  portLegend: { flexDirection: "row", gap: 12, marginBottom: 8 },

  closeBtn: { backgroundColor: "#EEF2F7", padding: 14, borderRadius: 15, alignItems: "center", marginTop: 4 },
  closeBtnTxt: { color: "#172033", fontWeight: "600", fontSize: 14 },
});
