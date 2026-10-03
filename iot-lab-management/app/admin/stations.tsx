import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import supabase from "../../lib/supabase";
import { confirmAction, notify } from "../../lib/notify";
import { goBack, useRefreshOnFocus } from "../../lib/nav";
import { STATION_STATUS, naturalNo, roomStatus } from "../../lib/roomStatus";
import LoadError from "../../components/LoadError";

const C = {
  bg: "#eef3f8",
  purple: "#7c3aed",
  purpleDark: "#6d28d9",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  card: "#ffffff",
  green: "#16a34a",
  orange: "#c2410c",
  red: "#ef4444",
};

// กดเครื่อง = เปลี่ยนสถานะวนตามลำดับนี้
const NEXT_STATUS: Record<string, string> = { available: "repair", repair: "broken", broken: "available" };

type Station = {
  id: string;
  room_id: string;
  group_no: number;
  name: string;
  status: string;
};

export default function AdminStations() {
  const { room_id: roomParam } = useLocalSearchParams<{ room_id?: string }>(); // เปิดจากการ์ดห้อง → เลือกห้องนั้น
  const [stations, setStations] = useState<Station[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  // ห้องล่าสุดที่เลือก — กันผลโหลดของห้องเก่า (ตอบช้า) มาทับห้องใหม่ตอนสลับเร็วๆ
  const roomRef = useRef("");

  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Station | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("available");
  const [editGroup, setEditGroup] = useState<number>(1);
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    roomRef.current = selectedRoom;
    if (selectedRoom) fetchStations(selectedRoom);
  }, [selectedRoom]);

  useRefreshOnFocus(() => {
    if (selectedRoom) fetchStations(selectedRoom);
  });

  // TODO R1: อ่านรายชื่อห้องจากตาราง rooms แทนการเดาจากเครื่องที่มีอยู่
  const fetchRooms = async () => {
    const { data, error } = await supabase.from("computer_stations").select("room_id");
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const unique = data && data.length > 0
      ? ([...new Set(data.map((row: any) => row.room_id).filter(Boolean))] as string[]).sort()
      : ["CP9524", "SC9604"];
    setRooms(unique);
    setSelectedRoom((current) => current || (unique.includes(String(roomParam)) ? String(roomParam) : unique[0]) || "CP9524");
    setLoading(false);
  };

  const fetchStations = async (room = selectedRoom) => {
    const { data, error } = await supabase
      .from("computer_stations")
      .select("*")
      .eq("room_id", room)
      .order("group_no")
      .order("name");
    if (room !== roomRef.current) return; // ผู้ใช้สลับไปห้องอื่นแล้ว
    setRefreshing(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError("");
    const list = ((data as Station[]) || []).sort((a, b) =>
      (a.group_no - b.group_no) || (naturalNo(a.name) - naturalNo(b.name)) || a.name.localeCompare(b.name)
    );
    setStations(list);
  };

  const retry = () => {
    setLoadError("");
    if (selectedRoom) fetchStations(selectedRoom);
    else {
      setLoading(true);
      fetchRooms();
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<number, Station[]>();
    stations.forEach((station) => {
      const group = station.group_no || 1;
      map.set(group, [...(map.get(group) || []), station]);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([group, rows]) => ({ group, rows }));
  }, [stations]);

  const roomReady = stations.filter((station) => station.status === "available").length;
  const roomProblems = stations.length - roomReady;

  const onRefresh = () => {
    setRefreshing(true);
    fetchStations();
  };

  const toggleStatus = (station: Station) => {
    const next = NEXT_STATUS[station.status] || "available";
    const nextCfg = roomStatus(STATION_STATUS, next);
    confirmAction("เปลี่ยนสถานะเครื่อง", `${station.name} → ${nextCfg.label}?`, "ยืนยัน", async () => {
      setSaving(station.id);
      // .select() เพื่อรู้ว่าแก้ได้จริง — RLS ไม่ให้สิทธิ์จะไม่ error แต่แก้ได้ 0 แถว
      const { data, error } = await supabase
        .from("computer_stations")
        .update({ status: next })
        .eq("id", station.id)
        .select("id");
      setSaving(null);
      if (error || !data?.length) {
        notify("เปลี่ยนสถานะไม่สำเร็จ", error?.message || "ไม่มีสิทธิ์แก้ไข หรือเครื่องนี้ถูกลบไปแล้ว");
        return;
      }
      setStations((current) => current.map((row) => row.id === station.id ? { ...row, status: next } : row));
    });
  };

  const openEdit = (station: Station) => {
    setEditTarget(station);
    setEditName(station.name);
    setEditStatus(station.status);
    setEditGroup(station.group_no);
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editTarget || !editName.trim()) {
      notify("กรอกชื่อเครื่องก่อน");
      return;
    }
    const name = editName.trim();
    // ชื่อซ้ำได้ข้ามกลุ่ม (ทุกกลุ่มมี C1–C9) แต่ห้ามซ้ำในกลุ่มเดียวกัน
    const dup = stations.some(
      (row) => row.id !== editTarget.id && row.group_no === editGroup && row.name.toLowerCase() === name.toLowerCase()
    );
    if (dup) {
      notify("ชื่อซ้ำ", `กลุ่ม ${editGroup} ห้อง ${selectedRoom} มีเครื่องชื่อ "${name}" อยู่แล้ว`);
      return;
    }
    setEditSaving(true);
    const { data, error } = await supabase
      .from("computer_stations")
      .update({ name, status: editStatus, group_no: editGroup })
      .eq("id", editTarget.id)
      .select("id");
    setEditSaving(false);
    if (error || !data?.length) {
      notify("แก้ไขไม่สำเร็จ", error?.message || "ไม่มีสิทธิ์แก้ไข หรือเครื่องนี้ถูกลบไปแล้ว");
      return;
    }
    setEditModal(false);
    fetchStations();
  };

  // TODO (รอตัดสิน M6): เครื่องที่มีประวัติตรวจ/ซ่อม ควร "ปิดใช้งาน" แทนการลบ
  const deleteStation = (station: Station) => {
    confirmAction(
      "ลบเครื่อง",
      `ลบ "${station.name}" ?\n\nเช็กลิสต์ของเครื่องจะถูกลบด้วย ส่วนประวัติตรวจ/ซ่อมยังอยู่แต่จะไม่รู้ว่าเป็นเครื่องไหน`,
      "ลบ",
      async () => {
        const { data, error } = await supabase.from("computer_stations").delete().eq("id", station.id).select("id");
        if (error || !data?.length) {
          notify("ลบไม่สำเร็จ", error?.message || "ไม่มีสิทธิ์ลบ หรือเครื่องนี้ถูกลบไปแล้ว");
          return;
        }
        setEditModal(false);
        setStations((current) => current.filter((row) => row.id !== station.id));
      },
      true
    );
  };

  // กลุ่มที่เลือกได้ในหน้าต่างแก้ไข = กลุ่มที่มีในห้องนี้ + 1–6 (เดิมฟิก 1–6)
  const groupChoices = useMemo(
    () => [...new Set([1, 2, 3, 4, 5, 6, ...stations.map((row) => row.group_no)])].sort((a, b) => a - b),
    [stations]
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity style={s.backBtn} onPress={() => goBack("/admin/room")} activeOpacity={0.82}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.headerTextWrap}>
            <Text style={s.headerTitle}>จัดการเครื่องคอม</Text>
            <Text style={s.headerSub}>ห้อง {selectedRoom || "-"} · {stations.length} เครื่อง</Text>
          </View>
        </View>

        <View style={s.roomTabs}>
          {rooms.map((room) => {
            const active = selectedRoom === room;
            return (
              <TouchableOpacity
                key={room}
                style={[s.roomTab, active && s.roomTabActive]}
                onPress={() => setSelectedRoom(room)}
                activeOpacity={0.84}
              >
                <Text style={[s.roomText, active && s.roomTextActive]}>{room}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 54 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />}
          showsVerticalScrollIndicator
        >
          {!!loadError && <LoadError message={loadError} onRetry={retry} />}

          <View style={s.legendRow}>
            {Object.values(STATION_STATUS).map((cfg) => <Legend key={cfg.label} color={cfg.color} label={cfg.label} />)}
          </View>

          {loadError && stations.length === 0 ? null : grouped.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="desktop-outline" size={46} color="#cbd5e1" />
              <Text style={s.emptyText}>ยังไม่มีเครื่องในห้องนี้</Text>
            </View>
          ) : (
            grouped.map(({ group, rows }) => {
              const ready = rows.filter((station) => station.status === "available").length;
              const problems = rows.length - ready;
              return (
                <View key={group} style={s.groupCard}>
                  <View style={s.groupHeader}>
                    <View style={s.groupTitleRow}>
                      <View style={s.groupIcon}>
                        <Ionicons name="people-outline" size={18} color="#1d4ed8" />
                      </View>
                      <Text style={s.groupTitle}>กลุ่ม {group}</Text>
                    </View>
                    <View style={s.groupPills}>
                      <View style={s.readyPill}><Text style={s.readyPillText}>{ready} พร้อม</Text></View>
                      <View style={s.problemPill}><Text style={s.problemPillText}>{problems} ปัญหา</Text></View>
                    </View>
                  </View>

                  <View style={s.stationGrid}>
                    {rows.map((station) => {
                      const cfg = roomStatus(STATION_STATUS, station.status);
                      const isSaving = saving === station.id;
                      return (
                        <TouchableOpacity
                          key={station.id}
                          style={[s.stationCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
                          onPress={() => !isSaving && toggleStatus(station)}
                          onLongPress={() => openEdit(station)}
                          disabled={isSaving}
                          activeOpacity={0.86}
                        >
                          {isSaving ? (
                            <ActivityIndicator size="small" color={cfg.color} />
                          ) : (
                            <Ionicons name="desktop-outline" size={23} color={cfg.color} />
                          )}
                          <Text style={[s.stationName, { color: cfg.color }]} numberOfLines={1}>{station.name}</Text>
                          <Text style={[s.stationStatus, { color: cfg.color }]}>{cfg.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })
          )}

          <View style={s.roomSummary}>
            <Text style={s.summaryText}>รวม {stations.length} เครื่อง · {roomReady} พร้อมใช้ · {roomProblems} ปัญหา</Text>
          </View>
        </ScrollView>
      )}

      <Modal visible={editModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>แก้ไขเครื่องคอม</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Ionicons name="close" size={24} color={C.muted} />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>ชื่อเครื่อง</Text>
            <TextInput
              style={s.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="เช่น C1"
            />

            <Text style={s.fieldLabel}>กลุ่ม</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.modalChips}>
              {groupChoices.map((group) => (
                <TouchableOpacity
                  key={group}
                  style={[s.modalChip, editGroup === group && s.modalChipActive]}
                  onPress={() => setEditGroup(group)}
                >
                  <Text style={[s.modalChipText, editGroup === group && s.modalChipTextActive]}>กลุ่ม {group}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>สถานะ</Text>
            <View style={s.statusRow}>
              {Object.entries(STATION_STATUS).map(([key, cfg]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.statusBtn, { borderColor: cfg.color }, editStatus === key && { backgroundColor: cfg.color }]}
                  onPress={() => setEditStatus(key)}
                >
                  <Text style={[s.statusBtnText, { color: editStatus === key ? "#fff" : cfg.color }]}>{cfg.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.modalActions}>
              <TouchableOpacity style={[s.saveBtn, editSaving && { opacity: 0.6 }]} onPress={saveEdit} disabled={editSaving}>
                {editSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>บันทึก</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={s.deleteBtn} onPress={() => editTarget && deleteStation(editTarget)}>
                <Text style={s.deleteBtnText}>ลบเครื่อง</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: color }]} />
      <Text style={s.legendText}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.purple,
    paddingTop: 74,
    paddingHorizontal: 33,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: { flex: 1 },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "900", lineHeight: 28 },
  headerSub: { color: "#ddd6fe", fontSize: 12, fontWeight: "900", marginTop: 4 },
  roomTabs: {
    minHeight: 38,
    flexDirection: "row",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
    padding: 4,
    marginTop: 17,
  },
  roomTab: {
    flex: 1,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  roomTabActive: { backgroundColor: "#fff" },
  roomText: { color: "#ddd6fe", fontSize: 12, fontWeight: "900" },
  roomTextActive: { color: C.purple },
  body: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    paddingHorizontal: 30,
    paddingTop: 12,
    paddingBottom: 34,
  },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 13 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: C.muted, fontSize: 11, fontWeight: "900" },
  groupCard: {
    backgroundColor: C.card,
    borderRadius: 15,
    padding: 14,
    marginBottom: 15,
    shadowColor: "#94a3b8",
    shadowOpacity: 0.18,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  groupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13 },
  groupTitleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  groupIcon: { width: 31, height: 31, borderRadius: 9, backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center" },
  groupTitle: { color: C.ink, fontSize: 15, fontWeight: "900" },
  groupPills: { flexDirection: "row", alignItems: "center", gap: 7 },
  readyPill: { backgroundColor: "#dcfce7", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  readyPillText: { color: C.green, fontSize: 11, fontWeight: "900" },
  problemPill: { backgroundColor: "#fee2e2", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  problemPillText: { color: "#ef4444", fontSize: 11, fontWeight: "900" },
  stationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stationCard: {
    width: "31.5%",
    height: 84,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  stationName: { fontSize: 14, fontWeight: "900" },
  stationStatus: { fontSize: 11, fontWeight: "900" },
  roomSummary: { alignItems: "center", marginTop: 2 },
  summaryText: { color: C.faint, fontSize: 11, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 64, gap: 8 },
  emptyText: { color: C.faint, fontSize: 14, fontWeight: "800" },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.38)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modalTitle: { color: C.ink, fontSize: 18, fontWeight: "900" },
  fieldLabel: { color: C.muted, fontSize: 12, fontWeight: "900", marginTop: 10, marginBottom: 7 },
  input: { minHeight: 45, borderRadius: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 13, color: C.ink, fontSize: 14, fontWeight: "800" },
  modalChips: { gap: 8, paddingVertical: 4 },
  modalChip: { borderRadius: 999, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 13, paddingVertical: 7 },
  modalChipActive: { backgroundColor: C.purple, borderColor: C.purple },
  modalChipText: { color: C.muted, fontSize: 12, fontWeight: "900" },
  modalChipTextActive: { color: "#fff" },
  statusRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statusBtn: { flex: 1, borderWidth: 1.5, borderRadius: 999, paddingVertical: 9, alignItems: "center" },
  statusBtnText: { fontSize: 12, fontWeight: "900" },
  modalActions: { flexDirection: "row", gap: 10 },
  saveBtn: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  deleteBtn: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center" },
  deleteBtnText: { color: "#dc2626", fontSize: 15, fontWeight: "900" },
});
