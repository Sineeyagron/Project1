import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";
import { goBack, useRefreshOnFocus } from "../../lib/nav";
import { confirmAction, notify } from "../../lib/notify";
import { STATION_STATUS } from "../../lib/roomStatus";
import { ROOM_CODE_RE, Room, fetchRooms, roomPlace } from "../../lib/rooms";
import LoadError from "../../components/LoadError";
import { useRole } from "../../lib/roles";
import { useRoomLive } from "../../lib/roomRealtime";
import { W, NG } from "../../lib/theme";

const C = {
  bg: "#EAF1FC",
  purple: "#2563EB",
  purpleDeep: "#1E40AF",
  card: "#ffffff",
  ink: "#172033",
  text: "#172033",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#d8dde8",
  green: "#10b981",
  orange: "#f59e0b",
  red: "#ef4444",
};

type RoomStats = {
  room: Room;
  total: number; // เครื่องที่เปิดใช้งาน
  allStations: number; // รวมเครื่องที่ปิดใช้งาน (ใช้ตัดสินว่าลบห้องได้ไหม)
  lanTotal: number;
  available: number;
  repair: number;
  broken: number;
  lanIssues: number;
};

export default function AdminRoom() {
  const router = useRouter();
  // TA ดูห้องและเข้าหน้าเครื่อง/LAN ได้ แต่เพิ่ม/แก้/ปิด/ลบห้องไม่ได้ (RLS กันจริง)
  const isAdmin = useRole().role === "admin";

  const [stats, setStats] = useState<RoomStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [openReports, setOpenReports] = useState(0); // คำแจ้งจากนักศึกษาที่รอตรวจ (R3)

  // หน้าต่างเพิ่ม/แก้ห้อง (editing = null → เพิ่มห้องใหม่)
  const [roomModal, setRoomModal] = useState(false);
  const [editing, setEditing] = useState<RoomStats | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formBuilding, setFormBuilding] = useState("");
  const [formFloor, setFormFloor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);
  useRefreshOnFocus(() => fetchStats());
  useRoomLive(() => fetchStats()); // อัปเดตสดทุกห้อง

  // รายชื่อห้องจากตาราง rooms (รวมห้องที่ปิด) + สถิติจากเครื่อง/LAN
  const fetchStats = async () => {
    const [{ data: stations, error: stationError }, { data: lanData, error: lanError }, roomResult] = await Promise.all([
      supabase.from("computer_stations").select("room_id, status, active"),
      supabase.from("lan_ports").select("room_id, status"),
      fetchRooms(true),
    ]);
    if (stationError || lanError || roomResult.error) {
      // โหลดพัง ห้ามโชว์ว่า "ปกติ" — เก็บตัวเลขเดิมไว้ แล้วขึ้นแถบให้ลองใหม่
      setLoadError(stationError?.message || lanError?.message || roomResult.error?.message || "");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoadError("");

    const result: RoomStats[] = roomResult.rooms.map((room) => {
      const all = (stations || []).filter((station: any) => station.room_id === room.id);
      const active = all.filter((station: any) => station.active !== false);
      const lan = (lanData || []).filter((port: any) => port.room_id === room.id);
      return {
        room,
        total: active.length,
        allStations: all.length,
        lanTotal: lan.length,
        available: active.filter((station: any) => station.status === "available").length,
        repair: active.filter((station: any) => station.status === "repair").length,
        broken: active.filter((station: any) => station.status === "broken").length,
        lanIssues: lan.filter((port: any) => port.status !== "available").length,
      };
    });

    setStats(result);
    const { count } = await supabase.from("room_reports").select("id", { count: "exact", head: true }).eq("status", "open");
    setOpenReports(count || 0);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const totals = useMemo(() => {
    const open = stats.filter((row) => row.room.active);
    return {
      rooms: open.length,
      stations: open.reduce((sum, row) => sum + row.total, 0),
      warnings: open.reduce((sum, row) => sum + row.lanIssues + row.repair + row.broken, 0),
    };
  }, [stats]);

  const openAdd = () => {
    setEditing(null);
    setFormCode("");
    setFormBuilding("");
    setFormFloor("");
    setRoomModal(true);
  };

  const openEdit = (row: RoomStats) => {
    setEditing(row);
    setFormCode(row.room.id);
    setFormBuilding(row.room.building || "");
    setFormFloor(row.room.floor || "");
    setRoomModal(true);
  };

  const saveRoom = async () => {
    const code = formCode.trim().toUpperCase();
    if (!ROOM_CODE_RE.test(code)) {
      notify("รหัสห้องไม่ถูกต้อง", "ใช้ตัวอักษรอังกฤษ/ตัวเลข/ขีด 2–20 ตัว เช่น CP9524");
      return;
    }
    const payload = { id: code, building: formBuilding.trim(), floor: formFloor.trim() || null };
    setSaving(true);
    const { data, error } = editing
      // แก้รหัสห้อง → เครื่อง/LAN ของห้องนี้เปลี่ยนตามอัตโนมัติ (FK on update cascade)
      ? await supabase.from("rooms").update(payload).eq("id", editing.room.id).select("id")
      : await supabase
          .from("rooms")
          .insert([{ ...payload, sort_order: Math.max(0, ...stats.map((row) => row.room.sort_order)) + 1 }])
          .select("id");
    setSaving(false);
    if (error || !data?.length) {
      notify(
        editing ? "แก้ไขห้องไม่สำเร็จ" : "เพิ่มห้องไม่สำเร็จ",
        error?.code === "23505" ? `มีห้องรหัส ${code} อยู่แล้ว` : error?.message || "ไม่มีสิทธิ์แก้ไข (เฉพาะ Admin)"
      );
      return;
    }
    setRoomModal(false);
    fetchStats();
  };

  // ปิด/เปิดห้อง: ห้องที่ปิดไม่ขึ้นในหน้านักศึกษาและหน้าอื่น ๆ แต่ข้อมูลยังอยู่ครบ
  const toggleActive = (row: RoomStats) => {
    const next = !row.room.active;
    confirmAction(
      next ? "เปิดห้อง" : "ปิดห้อง",
      next
        ? `เปิดห้อง ${row.room.id} ให้กลับมาแสดงทุกหน้า?`
        : `ปิดห้อง ${row.room.id}?\n\nห้องจะไม่แสดงในหน้านักศึกษาและหน้าจัดการอื่น แต่เครื่อง/LAN/ประวัติยังอยู่ครบ เปิดกลับได้`,
      next ? "เปิดห้อง" : "ปิดห้อง",
      async () => {
        const { data, error } = await supabase.from("rooms").update({ active: next }).eq("id", row.room.id).select("id");
        if (error || !data?.length) {
          notify("ไม่สำเร็จ", error?.message || "ไม่มีสิทธิ์แก้ไข (เฉพาะ Admin)");
          return;
        }
        setRoomModal(false);
        fetchStats();
      },
      !next
    );
  };

  // ลบห้อง: ได้เฉพาะห้องว่าง (ไม่มีเครื่องและ LAN) — ห้องที่มีข้อมูลให้ "ปิดห้อง" แทน (ฐานข้อมูลก็กันไว้)
  const deleteRoom = (row: RoomStats) => {
    if (row.allStations > 0 || row.lanTotal > 0) {
      notify(
        "ลบห้องไม่ได้",
        `ห้อง ${row.room.id} มีเครื่อง ${row.allStations} เครื่อง และ LAN ${row.lanTotal} port\nใช้ "ปิดห้อง" แทน`
      );
      return;
    }
    confirmAction("ลบห้อง", `ลบห้อง ${row.room.id}? (ห้องว่าง ไม่มีเครื่อง/LAN)`, "ลบ", async () => {
      const { data, error } = await supabase.from("rooms").delete().eq("id", row.room.id).select("id");
      if (error || !data?.length) {
        notify("ลบห้องไม่สำเร็จ", error?.code === "23503" ? "ห้องนี้ยังมีเครื่อง/LAN อยู่" : error?.message || "ไม่มีสิทธิ์ลบ");
        return;
      }
      setRoomModal(false);
      fetchStats();
    }, true);
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity style={s.iconBtn} onPress={() => goBack("/admin/home")} activeOpacity={0.82}>
            <Ionicons name="chevron-back" size={21} color="#172033" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>จัดการห้อง</Text>
          {isAdmin ? (
            <TouchableOpacity style={s.iconBtn} onPress={openAdd} activeOpacity={0.82} accessibilityLabel="เพิ่มห้อง">
              <Ionicons name="add" size={22} color="#1D4ED8" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        <View style={s.summaryRow}>
          <HeaderStat value={totals.rooms} label="ห้องที่เปิดอยู่" />
          <HeaderStat value={totals.stations} label="เครื่องทั้งหมด" />
          <HeaderStat value={totals.warnings} label="แจ้งเตือน" />
        </View>
      </View>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={C.purple} />
          <Text style={s.loadingText}>กำลังโหลดข้อมูลห้อง...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />}
        >
          {!!loadError && <LoadError message={loadError} onRetry={onRefresh} />}
          <TouchableOpacity
            style={[s.reportsBanner, openReports > 0 && s.reportsBannerHot]}
            onPress={() => router.push("/admin/roomreports" as any)}
            activeOpacity={0.86}
          >
            <Ionicons name="megaphone-outline" size={20} color={openReports > 0 ? "#c2410c" : C.muted} />
            <Text style={[s.reportsText, openReports > 0 && { color: "#9a3412" }]}>
              {openReports > 0 ? `คำแจ้งจากนักศึกษา ${openReports} รายการรอตรวจ` : "คำแจ้งปัญหาจากนักศึกษา"}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </TouchableOpacity>
          {!loadError && stats.length === 0 ? (
            <Text style={s.emptyText}>ยังไม่มีห้อง กด + เพื่อเพิ่มห้อง</Text>
          ) : null}
          {stats.map((row) => {
            const room = row.room;
            // ป้ายห้องดูทั้งเครื่องและ LAN (เดิมดูแค่ LAN — เครื่องเสียหลายเครื่องก็ยังขึ้น "ปกติ")
            const stationIssues = row.repair + row.broken;
            const issueText = [
              stationIssues > 0 ? `เครื่อง ${stationIssues}` : "",
              row.lanIssues > 0 ? `LAN ${row.lanIssues}` : "",
            ].filter(Boolean).join(" · ");
            return (
            <View key={room.id} style={[s.roomCard, !room.active && s.roomCardClosed]}>
              <View style={s.roomHeader}>
                <View style={s.roomIconBox}>
                  <Ionicons name="business-outline" size={21} color={room.active ? C.purple : C.faint} />
                </View>
                <View style={s.roomTitleBlock}>
                  <Text style={s.roomName}>{room.id}</Text>
                  <Text style={s.roomSub}>{roomPlace(room)} · {row.total} เครื่อง</Text>
                </View>

                {!room.active ? (
                  <View style={s.closedBadge}>
                    <Text style={s.closedText}>ปิดอยู่</Text>
                  </View>
                ) : issueText ? (
                  <View style={s.warnBadge}>
                    <Ionicons name="warning-outline" size={13} color="#c2410c" />
                    <Text style={s.warnText}>{issueText}</Text>
                  </View>
                ) : (
                  <View style={s.okBadge}>
                    <Ionicons name="checkmark-circle-outline" size={13} color={C.green} />
                    <Text style={s.okText}>ปกติ</Text>
                  </View>
                )}
                {isAdmin ? (
                  <TouchableOpacity style={s.editBtn} onPress={() => openEdit(row)} accessibilityLabel={`แก้ไขห้อง ${room.id}`}>
                    <Ionicons name="create-outline" size={18} color={C.muted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {room.active ? (
                <>
                  <View style={s.statusGrid}>
                    <RoomMetric value={row.available} label={STATION_STATUS.available.label} color={C.green} />
                    <RoomMetric value={row.repair} label={STATION_STATUS.repair.label} color={row.repair > 0 ? C.orange : C.faint} />
                    <RoomMetric value={row.broken} label={STATION_STATUS.broken.label} color={row.broken > 0 ? C.red : C.faint} />
                  </View>

                  <View style={s.actionRow}>
                    <ActionButton icon="map-outline" label="ผังห้อง" onPress={() => router.push({ pathname: "/roommap", params: { room_id: room.id } } as any)} />
                    <ActionButton icon="desktop-outline" label="จัดการเครื่อง" onPress={() => router.push({ pathname: "/admin/stations", params: { room_id: room.id } } as any)} />
                    <ActionButton icon="git-network-outline" label="LAN Port" onPress={() => router.push({ pathname: "/admin/lanports", params: { room_id: room.id } } as any)} />
                  </View>
                </>
              ) : null}
            </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal visible={roomModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editing ? `แก้ไขห้อง ${editing.room.id}` : "เพิ่มห้องใหม่"}</Text>
              <TouchableOpacity onPress={() => setRoomModal(false)}>
                <Ionicons name="close" size={24} color={C.muted} />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>รหัสห้อง *</Text>
            <TextInput
              style={s.input}
              value={formCode}
              onChangeText={(text) => setFormCode(text.toUpperCase())}
              placeholder="เช่น CP9524"
              autoCapitalize="characters"
            />
            {editing && formCode.trim().toUpperCase() !== editing.room.id ? (
              <Text style={s.hint}>เปลี่ยนรหัสห้อง → เครื่องและ LAN ของห้องนี้เปลี่ยนตามให้อัตโนมัติ</Text>
            ) : null}

            <Text style={s.fieldLabel}>อาคาร</Text>
            <TextInput style={s.input} value={formBuilding} onChangeText={setFormBuilding} placeholder="เช่น อาคารคอมพิวเตอร์" />

            <Text style={s.fieldLabel}>ชั้น</Text>
            <TextInput style={s.input} value={formFloor} onChangeText={setFormFloor} placeholder="เช่น 5" />

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={saveRoom} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{editing ? "บันทึก" : "เพิ่มห้อง"}</Text>}
            </TouchableOpacity>

            {editing ? (
              <View style={s.modalActions}>
                <TouchableOpacity style={s.secondaryBtn} onPress={() => toggleActive(editing)}>
                  <Text style={s.secondaryBtnText}>{editing.room.active ? "ปิดห้อง" : "เปิดห้อง"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.deleteBtn} onPress={() => deleteRoom(editing)}>
                  <Text style={s.deleteBtnText}>ลบห้อง</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function HeaderStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={s.headerStat}>
      <Text style={s.headerStatValue}>{value}</Text>
      <Text style={s.headerStatLabel}>{label}</Text>
    </View>
  );
}

function RoomMetric({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={s.metricCell}>
      <Text style={[s.metricValue, { color }]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
      <View style={[s.metricLine, { backgroundColor: color }]} />
    </View>
  );
}

function ActionButton({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.actionBtn} onPress={onPress} activeOpacity={0.84}>
      <Ionicons name={icon} size={19} color={C.ink} />
      <Text style={s.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  iconBtn: {
    ...W.small,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#172033",
    fontSize: 20,
    fontWeight: "700",
  },
  summaryRow: { flexDirection: "row", gap: 10 },
  headerStat: {
    flex: 1,
    minHeight: 80,
    ...W.statBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  headerStatValue: {
    color: "#172033",
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 32,
  },
  headerStatLabel: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
    textAlign: "center",
  },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: C.faint, fontSize: 13, fontWeight: "700" },
  scroll: { paddingHorizontal: 23, paddingTop: 14 },
  roomCard: {
    ...W.card,
    marginBottom: 13,
    overflow: "hidden",
  },
  roomHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  roomIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },
  roomTitleBlock: { flex: 1 },
  roomName: { fontSize: 14.5, fontWeight: "900", color: C.ink, lineHeight: 18 },
  roomSub: { fontSize: 11, color: "#374151", fontWeight: "600", marginTop: 2 },
  warnBadge: {
    ...NG,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffedd5",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  warnText: { fontSize: 10.5, color: "#c2410c", fontWeight: "800" },
  okBadge: {
    ...NG,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  okText: { fontSize: 10.5, color: C.green, fontWeight: "900" },
  statusGrid: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  metricCell: {
    flex: 1,
    minHeight: 78,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: C.line,
  },
  metricValue: { fontSize: 20, fontWeight: "900", lineHeight: 23 },
  metricLabel: { color: C.muted, fontSize: 11, fontWeight: "800", marginTop: 5 },
  metricLine: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 0,
    height: 2,
    borderRadius: 2,
  },
  actionRow: { flexDirection: "row" },
  actionBtn: {
    flex: 1,
    minHeight: 52,
    borderRightWidth: 1,
    borderRightColor: "#bfc5d1",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionText: { color: C.ink, fontSize: 12, fontWeight: "800" },
  roomCardClosed: { opacity: 0.7 },
  reportsBanner: { ...W.card, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, marginBottom: 13 },
  reportsBannerHot: { ...NG, backgroundColor: "#fff7ed", borderColor: "#fdba74" },
  reportsText: { flex: 1, fontSize: 13, fontWeight: "900", color: C.ink },
  closedBadge: { ...NG, backgroundColor: "#DCE6F5", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  closedText: { fontSize: 10.5, color: C.muted, fontWeight: "900" },
  editBtn: { marginLeft: 8, width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#f1f5f9" },
  emptyText: { color: C.faint, fontSize: 14, fontWeight: "800", textAlign: "center", marginTop: 40 },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.38)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  modalTitle: { color: C.ink, fontSize: 18, fontWeight: "900" },
  fieldLabel: { color: C.muted, fontSize: 12, fontWeight: "900", marginTop: 10, marginBottom: 7 },
  input: { minHeight: 45, borderRadius: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#DCE6F5", paddingHorizontal: 13, color: C.ink, fontSize: 14, fontWeight: "800" },
  hint: { color: "#b45309", fontSize: 11, fontWeight: "700", marginTop: 6 },
  saveBtn: { ...W.primarySolid, minHeight: 48, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 18 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  secondaryBtn: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { color: C.ink, fontSize: 14, fontWeight: "900" },
  deleteBtn: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center" },
  deleteBtnText: { color: "#dc2626", fontSize: 14, fontWeight: "900" },
});
