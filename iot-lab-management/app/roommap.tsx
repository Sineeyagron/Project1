import React, { useEffect, useRef, useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
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
import { W, gradient } from "../lib/theme";
import Svg, { Circle } from "react-native-svg";
import { FadeIn, PressScale } from "../components/Motion";
import BottomSheet from "../components/BottomSheet";
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
  const [rooms, setRooms] = useState<Room[]>([]); // ชิปสลับห้องในหน้าเดียว
  const [onlyFree, setOnlyFree] = useState(false); // กรอง "เฉพาะเครื่องว่าง"
  useEffect(() => {
    fetchRooms().then(({ rooms: list }) => {
      setRooms(list);
      if (!room_id) {
        if (list[0]) setRoomName(list[0].id);
        else setLoading(false);
      }
    });
    if (room_id) setRoomName(String(room_id));
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

      {loading ? (
        <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1D4ED8" />}>

          {!!loadError && <LoadError message={loadError} onRetry={onRefresh} />}

          {/* กระดาน */}
          {/* ── ชิปสลับห้อง (มีมากกว่า 1 ห้อง) ── */}
          {rooms.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.roomChips}>
              {rooms.map((r) => {
                const active = r.id === roomName;
                return (
                  <PressScale key={r.id} style={[s.roomChip, active && s.roomChipOn]} onPress={() => { if (!active) setRoomName(r.id); }} scaleTo={0.94}>
                    <Ionicons name="business" size={13} color={active ? "#FFFFFF" : "#64748B"} />
                    <Text style={[s.roomChipTxt, active && { color: "#FFFFFF" }]}>{r.id}</Text>
                  </PressScale>
                );
              })}
            </ScrollView>
          ) : null}

          {/* ── การ์ดสรุป: ว่างกี่เครื่อง (สิ่งที่นักศึกษาอยากรู้ก่อน) ── */}
          {(() => {
            const free = stations.filter((x) => x.status === "available").length;
            const repair = stations.filter((x) => x.status === "repair").length;
            const broken = stations.length - free - repair;
            const lanBad = lanPorts.filter((x) => x.status !== "available").length;
            const pct = stations.length ? Math.round((free / stations.length) * 100) : 0;
            return (
              <FadeIn style={s.hero}>
                <View style={s.heroGlow} />
                <View style={{ flex: 1 }}>
                  <Text style={s.heroKicker}>เครื่องพร้อมใช้ตอนนี้</Text>
                  <Text style={s.heroNum}>
                    {free}<Text style={s.heroOf}> / {stations.length} เครื่อง</Text>
                  </Text>
                  <View style={s.heroStats}>
                    {repair > 0 ? <HeroChip icon="construct" text={`ซ่อม ${repair}`} /> : null}
                    {broken > 0 ? <HeroChip icon="close-circle" text={`เสีย ${broken}`} /> : null}
                    <HeroChip icon="git-network" text={lanBad > 0 ? `LAN มีปัญหา ${lanBad}` : "LAN ปกติ"} />
                  </View>
                </View>
                <View style={s.heroRing}>
                  <Svg width={74} height={74}>
                    <Circle cx={37} cy={37} r={31} stroke="rgba(255,255,255,0.25)" strokeWidth={8} fill="none" />
                    <Circle
                      cx={37} cy={37} r={31} stroke="#FFFFFF" strokeWidth={8} fill="none" strokeLinecap="round"
                      strokeDasharray={`${(2 * Math.PI * 31 * pct) / 100} ${2 * Math.PI * 31}`}
                      transform="rotate(-90 37 37)"
                    />
                  </Svg>
                  <Text style={s.heroPct}>{pct}%</Text>
                </View>
              </FadeIn>
            );
          })()}

          {/* ── แถบเครื่องมือ: หน้าห้อง + กรองเฉพาะเครื่องว่าง ── */}
          <View style={s.toolRow}>
            <View style={s.board}>
              <Ionicons name="easel-outline" size={14} color="#64748B" />
              <Text style={s.boardTxt} numberOfLines={1}>หน้าห้อง · กระดาน / โต๊ะอาจารย์</Text>
            </View>
            <PressScale style={[s.freeToggle, onlyFree && s.freeToggleOn]} onPress={() => setOnlyFree((v) => !v)} scaleTo={0.94} accessibilityLabel="แสดงเฉพาะเครื่องว่าง">
              <Ionicons name={onlyFree ? "checkmark-circle" : "ellipse-outline"} size={15} color={onlyFree ? "#FFFFFF" : "#047857"} />
              <Text style={[s.freeToggleTxt, onlyFree && { color: "#FFFFFF" }]}>เฉพาะที่ว่าง</Text>
            </PressScale>
          </View>

          {/* กลุ่ม (โต๊ะ) */}
          {Object.entries(grouped).map(([gNo, stns], gi) => {
            const groupNo = Number(gNo);
            const srv = getServerSummary(groupNo);
            const ok = stns.filter((x) => x.status === "available").length;
            return (
              <FadeIn key={gNo} delay={80 + gi * 50} style={s.groupBox}>
                <View style={s.groupHead}>
                  <View style={s.groupNo}><Text style={s.groupNoTxt}>{groupNo}</Text></View>
                  <Text style={s.groupLabel}>กลุ่มที่ {groupNo}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={[s.groupFree, ok === 0 && { color: "#B91C1C" }]}>ว่าง {ok}/{stns.length}</Text>
                </View>
                <View style={s.groupRow}>
                  {/* คอม 3×3 วาดเป็นจอ: เปิด (ว่าง) = ฟ้าเรือง / ซ่อม = ส้ม / เสีย = จอดับ */}
                  <View style={s.stationsWrap}>
                    {stns.map((station) => {
                      const cfg = roomStatus(STATION_STATUS, station.status);
                      const { hasIssue } = getEquipSummary(station.id);
                      const free = station.status === "available";
                      const repairing = station.status === "repair";
                      const dim = onlyFree && !free;
                      // การ์ดเรียบ: ว่าง = ขาว + ไฟเขียว / ซ่อม = เหลืองอ่อน / เสีย = แดงอ่อน
                      const tone = free
                        ? { box: s.stOk, icon: "desktop-outline" as const, fg: "#64748B", name: "#172033", light: "#22C55E" }
                        : repairing
                        ? { box: s.stRepair, icon: "construct-outline" as const, fg: "#B45309", name: "#92400E", light: "#F59E0B" }
                        : { box: s.stBroken, icon: "close-circle-outline" as const, fg: "#DC2626", name: "#991B1B", light: "#EF4444" };
                      return (
                        <PressScale
                          key={station.id}
                          style={[s.station, tone.box, dim && { opacity: 0.25 }]}
                          onPress={() => openStation(station)}
                          scaleTo={0.92}
                          accessibilityLabel={`เครื่อง ${station.name} ${cfg.label}`}
                        >
                          {hasIssue && <View style={s.equipWarnDot} />}
                          <Ionicons name={tone.icon} size={16} color={tone.fg} />
                          <Text style={[s.stationName, { color: tone.name }]}>{station.name}</Text>
                          {/* ไฟสถานะขีดเล็กขอบล่าง */}
                          <View style={[s.statusLight, { backgroundColor: tone.light }]} />
                        </PressScale>
                      );
                    })}
                  </View>

                  {/* Server */}
                  <PressScale
                    style={[s.serverCard, srv.broken > 0 && s.serverCardWarn]}
                    onPress={() => { setServerGroup(groupNo); setReportTarget(null); setServerModal(true); }}
                    scaleTo={0.95}
                    accessibilityLabel={`Server กลุ่ม ${groupNo}`}
                  >
                    <Ionicons name="server" size={20} color={srv.broken > 0 ? "#b45309" : "#4F46E5"} />
                    <Text style={[s.serverLabel, { color: srv.broken > 0 ? "#b45309" : "#4F46E5" }]}>Server</Text>
                    <Text style={s.serverPort}>{srv.total} port</Text>
                    {srv.broken > 0 && (
                      <View style={s.warnBadge}>
                        <Text style={s.warnBadgeTxt}>{srv.broken} เสีย</Text>
                      </View>
                    )}
                  </PressScale>
                </View>
              </FadeIn>
            );
          })}

          <Text style={s.tapHint}>แตะที่เครื่องเพื่อดูอุปกรณ์ หรือแจ้งปัญหา</Text>

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
      <BottomSheet visible={compModal} onClose={() => { setCompModal(false); setReportTarget(null); }} style={s.modalBox}>
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
      </BottomSheet>

      {/* ── MODAL: LAN Ports ── */}
      <BottomSheet visible={serverModal} onClose={() => { setServerModal(false); setReportTarget(null); }} style={[s.modalBox, { maxHeight: "80%" }]}>
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
      </BottomSheet>

    </View>
  );
}

function HeroChip({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.heroChip}>
      <Ionicons name={icon} size={12} color="#FFFFFF" />
      <Text style={s.heroChipTxt}>{text}</Text>
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

  board: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, height: 34, borderRadius: 12, backgroundColor: "rgba(226,232,240,0.7)", paddingHorizontal: 8 },
  boardTxt: { color: "#475569", fontWeight: "600", fontSize: 11.5 },
  teacherDesk: { ...W.small, borderRadius: 12, padding: 8, alignItems: "center", marginBottom: 14 },
  teacherTxt: { color: "#475569", fontSize: 12 },

  groupBox: { ...W.card, padding: 10, marginBottom: 12 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  groupLabel: { fontSize: 14, fontWeight: "700", color: "#172033" },
  groupRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  // 3×3 (C1–C3 / C4–C6 / C7–C9) ทุกกลุ่มเป็นสี่เหลี่ยมเท่ากัน
  stationsWrap: { flex: 1, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6 },

  station: { width: "31.5%", height: 54, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 2, overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,0.05)" },
  stOk: { backgroundColor: "#FFFFFF", borderColor: "#E3EAF4" },
  stRepair: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  stBroken: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  statusLight: { position: "absolute", bottom: 5, width: 16, height: 3, borderRadius: 2 },
  stationName: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  stationSub: { fontSize: 9, fontWeight: "700" },
  equipWarnDot: {
    position: "absolute", top: 4, right: 4,
    width: 7, height: 7, borderRadius: 4, backgroundColor: "#f97316",
  },

  serverCard: { width: 64, backgroundColor: "#EEF5FF", borderRadius: 15, padding: 8, alignItems: "center", justifyContent: "center", gap: 3, borderWidth: 1, borderColor: "#BFDBFE", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" },
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
  roomChips: { gap: 8, paddingBottom: 12 },
  roomChip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: "#DCE6F5" },
  roomChipOn: { backgroundColor: "#2563EB", borderColor: "#2563EB", boxShadow: "0 4px 10px rgba(37,99,235,0.28)" },
  roomChipTxt: { fontSize: 13, fontWeight: "700", color: "#475569" },
  hero: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderRadius: 24, marginBottom: 12, overflow: "hidden", backgroundColor: "#2563EB", ...gradient("linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #38BDF8 100%)"), boxShadow: "0 12px 26px rgba(37,99,235,0.30)" },
  heroGlow: { position: "absolute", right: -40, top: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(255,255,255,0.12)" },
  heroKicker: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" },
  heroNum: { color: "#FFFFFF", fontSize: 40, fontWeight: "700", lineHeight: 50 },
  heroOf: { color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: "600" },
  heroStats: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  heroChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)" },
  heroChipTxt: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "600" },
  heroRing: { width: 74, height: 74, alignItems: "center", justifyContent: "center" },
  heroPct: { position: "absolute", color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  toolRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  freeToggle: { flexDirection: "row", alignItems: "center", gap: 5, height: 34, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0" },
  freeToggleOn: { backgroundColor: "#059669", borderColor: "#059669" },
  freeToggleTxt: { fontSize: 12.5, fontWeight: "700", color: "#047857" },
  groupNo: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF2FF" },
  groupNoTxt: { fontSize: 12, fontWeight: "700", color: "#4F46E5" },
  groupFree: { fontSize: 12.5, fontWeight: "700", color: "#047857" },
  tapHint: { textAlign: "center", color: "#64748B", fontSize: 12, marginTop: 4 },
});
