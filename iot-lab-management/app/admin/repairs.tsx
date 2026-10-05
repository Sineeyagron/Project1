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
import supabase from "../../lib/supabase";
import { notify } from "../../lib/notify";
import { goBack, useRefreshOnFocus } from "../../lib/nav";
import { REPAIR_STATUS, roomStatus } from "../../lib/roomStatus";
import LoadError from "../../components/LoadError";
import { fetchRooms as loadRooms } from "../../lib/rooms";
import { naturalNo } from "../../lib/roomStatus";
import { W, NG } from "../../lib/theme";
import ScreenHeader, { HeaderButton } from "../../components/ScreenHeader";

const C = {
  bg: "#EAF1FC",
  purple: "#2563EB",
  purpleDeep: "#1E40AF",
  ink: "#172033",
  text: "#172033",
  muted: "#475569",
  faint: "#64748B",
  line: "#d9dde7",
  card: "#ffffff",
  red: "#ef4444",
  yellow: "#F59E0B",
  green: "#10B981",
  orange: "#f59e0b",
};

type FilterKey = "all" | "pending" | "in-repair" | "done";
const REPAIR_ORDER = ["pending", "in-repair", "done"] as const;

function formatDate(d?: string) {
  if (!d) return "-";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function stationTitle(record: any) {
  if (record.stationShort) return `${record.stationShort} ${record.description || ""}`.trim();
  return record.description || "รายการซ่อม";
}

function stationSub(record: any) {
  if (record.stationRoom) {
    const reporter = record.reporterEmail ? `แจ้งโดย ${record.reporterEmail.split("@")[0]}` : "แจ้งโดย admin";
    return `${record.stationRoom} · ${reporter}`;
  }
  return record.reporterEmail ? `แจ้งโดย ${record.reporterEmail}` : "ไม่ระบุเครื่อง";
}

export default function RepairsPage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loadError, setLoadError] = useState("");
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterKey>("all");
  const [saving, setSaving] = useState(false);

  const [addModal, setAddModal] = useState(false);
  const [formRoom, setFormRoom] = useState("");
  const [formStation, setFormStation] = useState<any>(null);
  const [formDesc, setFormDesc] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [filteredStations, setFilteredStations] = useState<any[]>([]);

  const [updateModal, setUpdateModal] = useState(false);
  const [updateRecord, setUpdateRecord] = useState<any>(null);
  const [updateStatus, setUpdateStatus] = useState<"pending" | "in-repair" | "done">("pending");
  const [updateNotes, setUpdateNotes] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);
  useRefreshOnFocus(() => fetchAll(true));

  // รายชื่อห้องจากตาราง rooms (ห้องที่เปิดอยู่)
  const [rooms, setRooms] = useState<string[]>([]);

  const fetchAll = async (quiet = false) => {
    if (!quiet) setLoading(true);
    const [{ data: recs, error: recError }, { data: stationRows, error: stationError }, roomResult] = await Promise.all([
      supabase.from("repair_records").select("*").order("reported_at", { ascending: false }),
      supabase.from("computer_stations").select("*").order("room_id").order("group_no").order("name"),
      loadRooms(),
    ]);

    if (recError || stationError || roomResult.error) {
      setLoadError(recError?.message || stationError?.message || roomResult.error?.message || "กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoadError("");
    setRooms(roomResult.rooms.map((room) => room.id));

    const safeStations = stationRows || [];
    const userIds = [...new Set((recs || []).map((r: any) => r.reported_by).filter(Boolean))];
    const emailMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", userIds);
      (profiles || []).forEach((profile: any) => {
        emailMap[profile.id] = profile.email || "";
      });
    }

    const enriched = (recs || []).map((record: any) => {
      const station = safeStations.find((row: any) => row.id === record.station_id);
      return {
        ...record,
        reporterEmail: emailMap[record.reported_by] || "",
        stationShort: station?.name || "",
        stationRoom: station ? `ห้อง ${station.room_id} · กลุ่ม ${station.group_no}` : "",
      };
    });

    setRecords(enriched);
    setStations(safeStations);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const openAdd = () => {
    const room = rooms.includes(formRoom) ? formRoom : rooms[0] || "";
    setFormRoom(room);
    setFormStation(null);
    setFormDesc("");
    setFormNotes("");
    setFilteredStations(stationsIn(room));
    setAddModal(true);
  };

  // เครื่องที่แจ้งซ่อมได้ = เครื่องที่เปิดใช้งานในห้องนั้น เรียงกลุ่ม → เลขเครื่อง
  const stationsIn = (room: string) =>
    stations
      .filter((station: any) => station.room_id === room && station.active !== false)
      .sort((a: any, b: any) => (a.group_no - b.group_no) || (naturalNo(a.name) - naturalNo(b.name)));

  const changeRoom = (room: string) => {
    setFormRoom(room);
    setFormStation(null);
    setFilteredStations(stationsIn(room));
  };

  const saveRepair = async () => {
    if (!formDesc.trim()) {
      notify("กรุณาระบุรายละเอียด");
      return;
    }

    setSaving(true);
    // ผู้แจ้ง/เวลาแจ้ง ฐานข้อมูลใส่เอง / มีเครื่อง → เครื่องเปลี่ยนเป็น "กำลังซ่อม" อัตโนมัติ (trigger)
    const { error } = await supabase.from("repair_records").insert([{
      station_id: formStation?.id || null,
      description: formDesc.trim(),
      notes: formNotes.trim() || null,
      status: "pending",
    }]);
    setSaving(false);

    if (error) {
      notify("แจ้งซ่อมไม่สำเร็จ", error.message);
      return;
    }

    setAddModal(false);
    notify("แจ้งซ่อมสำเร็จ", formStation ? `${formStation.name} เปลี่ยนเป็น "กำลังซ่อม" แล้ว` : undefined);
    fetchAll(true);
  };

  const openUpdate = (record: any) => {
    setUpdateRecord(record);
    setUpdateStatus(record.status);
    setUpdateNotes(record.notes || "");
    setUpdateModal(true);
  };

  const saveUpdate = async () => {
    if (!updateRecord) return;

    setSaving(true);
    // ผู้ซ่อม/เวลาซ่อมเสร็จ ฐานข้อมูลใส่เอง / ห้ามย้อนสถานะ (trigger กัน)
    // ซ่อมเสร็จและไม่มีงานค้างอื่น → เครื่องกลับเป็น "ใช้งานได้" อัตโนมัติ
    const updates = { status: updateStatus, notes: updateNotes.trim() || null };

    // .select() เพื่อรู้ว่าแก้ได้จริง — RLS ไม่ให้สิทธิ์จะไม่ error แต่แก้ได้ 0 แถว
    const { data, error } = await supabase.from("repair_records").update(updates).eq("id", updateRecord.id).select("id");
    setSaving(false);

    if (error || !data?.length) {
      notify("บันทึกไม่สำเร็จ", error?.message || "ไม่มีสิทธิ์แก้ไข หรือรายการนี้ถูกลบไปแล้ว");
      return;
    }

    setUpdateModal(false);
    fetchAll(true);
  };

  const counts = useMemo(() => ({
    pending: records.filter((record) => record.status === "pending").length,
    inRepair: records.filter((record) => record.status === "in-repair").length,
    done: records.filter((record) => record.status === "done").length,
  }), [records]);

  const filtered = useMemo(() => {
    if (filterStatus === "all") return records;
    return records.filter((record) => record.status === filterStatus);
  }, [records, filterStatus]);

  const filters = [
    { key: "all", label: "ทั้งหมด" },
    { key: "pending", label: "รอซ่อม" },
    { key: "in-repair", label: "กำลังซ่อม" },
    { key: "done", label: "ซ่อมเสร็จแล้ว" },
  ] as const;

  return (
    <View style={s.container}>
      <View style={s.hero}>
        <ScreenHeader
          title={"ซ่อมบำรุง"}
          subtitle={"เครื่องคอมพิวเตอร์ในห้องแล็บ"}
          onBack={() => goBack("/admin/room")}
          right={<HeaderButton icon="add" label="เพิ่มงานซ่อม" onPress={openAdd} />}
          bleed={16}
          style={{ marginBottom: 0 }}
        />

        <View style={s.statsRow}>
          <RepairStat value={counts.pending} label="รอซ่อม" dotColor={C.red} />
          <RepairStat value={counts.inRepair} label="กำลังซ่อม" dotColor={C.yellow} />
          <RepairStat value={counts.done} label="ซ่อมเสร็จ" dotColor={C.green} />
        </View>
      </View>

      <View style={s.filterShell}>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.filterRow}>
          {filters.map((filter) => {
            const active = filterStatus === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                style={[s.filterBtn, active && s.filterBtnActive]}
                onPress={() => setFilterStatus(filter.key)}
                activeOpacity={0.8}
              >
                <Text style={[s.filterText, active && s.filterTextActive]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={s.listTitleRow}>
        <Text style={s.listTitle}>{filterStatus === "all" ? "รายการซ่อมทั้งหมด" : `รายการ${roomStatus(REPAIR_STATUS, filterStatus).label}`}</Text>
      </View>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color={C.purple} />
          <Text style={s.loadingText}>กำลังโหลดรายการซ่อม...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />}
        >
          {!!loadError && <LoadError message={loadError} onRetry={() => fetchAll()} />}
          {loadError && records.length === 0 ? null : filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="construct-outline" size={45} color="#cbd5e1" />
              <Text style={s.emptyTitle}>ไม่มีรายการซ่อม</Text>
              <Text style={s.emptyText}>กดปุ่มเพิ่มเพื่อแจ้งซ่อมใหม่</Text>
            </View>
          ) : (
            filtered.map((record) => {
              const cfg = roomStatus(REPAIR_STATUS, record.status);
              return (
                <TouchableOpacity
                  key={record.id}
                  style={s.card}
                  activeOpacity={0.88}
                  onPress={() => record.status !== "done" && openUpdate(record)}
                >
                  <View style={[s.cardLine, { backgroundColor: cfg.border }]} />
                  <View style={[s.cardIcon, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={23} color={cfg.color} />
                  </View>

                  <View style={s.cardBody}>
                    <Text style={s.cardTitle} numberOfLines={1}>{stationTitle(record)}</Text>
                    <Text style={s.cardSub} numberOfLines={1}>{stationSub(record)}</Text>
                    <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>

                  <View style={s.cardDateWrap}>
                    <Ionicons name="calendar-outline" size={12} color="#4b5563" />
                    <Text style={s.cardDate}>{formatDate(record.repaired_at || record.reported_at)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 92 }} />
        </ScrollView>
      )}

      <View style={s.bottomBar}>
        <TouchableOpacity style={s.bottomAddBtn} onPress={openAdd} activeOpacity={0.86}>
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={s.bottomAddText}>แจ้งซ่อมใหม่</Text>
        </TouchableOpacity>
        <View style={s.downFab}>
          <Ionicons name="arrow-down" size={18} color="#64748b" />
        </View>
      </View>

      <Modal visible={addModal} transparent animationType="slide">
        <View style={s.overlay}>
          <ScrollView contentContainerStyle={s.modalBox} keyboardShouldPersistTaps="handled">
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>แจ้งซ่อมใหม่</Text>
              <TouchableOpacity style={s.closeBtn} onPress={() => setAddModal(false)}>
                <Ionicons name="close" size={22} color={C.muted} />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>ห้อง</Text>
            <View style={s.roomRow}>
              {rooms.map((room) => (
                <TouchableOpacity key={room} style={[s.roomBtn, formRoom === room && s.roomBtnActive]} onPress={() => changeRoom(room)}>
                  <Text style={[s.roomBtnText, formRoom === room && s.roomBtnTextActive]}>{room}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>เครื่อง (ไม่บังคับ)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              <TouchableOpacity style={[s.chip, !formStation && s.chipActive]} onPress={() => setFormStation(null)}>
                <Text style={[s.chipText, !formStation && s.chipTextActive]}>ไม่ระบุ</Text>
              </TouchableOpacity>
              {filteredStations.map((station: any) => (
                <TouchableOpacity
                  key={station.id}
                  style={[s.chip, formStation?.id === station.id && s.chipActive]}
                  onPress={() => setFormStation(station)}
                >
                  <Text style={[s.chipText, formStation?.id === station.id && s.chipTextActive]}>
                    G{station.group_no} {station.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>รายละเอียดปัญหา *</Text>
            <TextInput
              style={s.textArea}
              placeholder="เช่น หน้าจอไม่ติด, คีย์บอร์ดพัง..."
              placeholderTextColor="#94a3b8"
              value={formDesc}
              onChangeText={setFormDesc}
              multiline
            />

            <Text style={s.fieldLabel}>หมายเหตุ</Text>
            <TextInput
              style={s.textInput}
              placeholder="ข้อมูลเพิ่มเติม..."
              placeholderTextColor="#94a3b8"
              value={formNotes}
              onChangeText={setFormNotes}
            />

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.65 }]} onPress={saveRepair} disabled={saving}>
              {saving ? <ActivityIndicator color="#ffffff" /> : (
                <>
                  <Ionicons name="save-outline" size={18} color="#ffffff" />
                  <Text style={s.saveBtnText}>บันทึกการแจ้งซ่อม</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={updateModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>อัปเดตสถานะ</Text>
              <TouchableOpacity style={s.closeBtn} onPress={() => setUpdateModal(false)}>
                <Ionicons name="close" size={22} color={C.muted} />
              </TouchableOpacity>
            </View>

            <Text style={s.updateTitle}>{updateRecord ? stationTitle(updateRecord) : ""}</Text>
            <Text style={s.fieldLabel}>สถานะ</Text>
            <View style={s.statusBtnRow}>
              {REPAIR_ORDER.map((status, index) => {
                const cfg = REPAIR_STATUS[status];
                const active = updateStatus === status;
                // ย้อนสถานะไม่ได้ (รอซ่อม → กำลังซ่อม → เสร็จ) — ฐานข้อมูลกันซ้ำอีกชั้น
                const locked = index < REPAIR_ORDER.indexOf(updateRecord?.status);
                return (
                  <TouchableOpacity
                    key={status}
                    style={[s.statusBtn, { borderColor: cfg.border }, active && { backgroundColor: cfg.bg }, locked && { opacity: 0.35 }]}
                    onPress={() => !locked && setUpdateStatus(status)}
                    disabled={locked}
                  >
                    <Ionicons name={cfg.icon} size={17} color={cfg.color} />
                    <Text style={[s.statusBtnText, { color: cfg.color }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.fieldLabel}>หมายเหตุ</Text>
            <TextInput
              style={s.textInput}
              placeholder="รายละเอียดการซ่อม..."
              placeholderTextColor="#94a3b8"
              value={updateNotes}
              onChangeText={setUpdateNotes}
            />

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.65 }]} onPress={saveUpdate} disabled={saving}>
              {saving ? <ActivityIndicator color="#ffffff" /> : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
                  <Text style={s.saveBtnText}>บันทึก</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RepairStat({ value, label, dotColor }: { value: number; label: string; dotColor: string }) {
  return (
    <View style={s.statCard}>
      <View style={[s.statDot, { backgroundColor: dotColor }]} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  hero: {
    paddingTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  heroTop: { ...W.headerBar, marginHorizontal: -16, paddingTop: 52, paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerIconBtn: {
    ...W.iconBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { alignItems: "flex-start", flex: 1 },
  headerTitle: { color: "#172033", fontSize: 20, fontWeight: "700", lineHeight: 28 },
  headerSub: { color: "#475569", fontSize: 12, marginTop: 0 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  statCard: {
    flex: 1,
    minHeight: 78,
    ...W.card,
    alignItems: "center",
    justifyContent: "center",
  },
  statDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  statValue: { color: "#172033", fontSize: 26, fontWeight: "700", lineHeight: 32 },
  statLabel: { color: "#475569", fontSize: 12, marginTop: 1 },
  filterShell: {
    paddingTop: 14,
    paddingHorizontal: 26,
  },
  filterRow: { gap: 9, paddingBottom: 8, alignItems: "center" },
  filterBtn: {
    minHeight: 32,
    paddingHorizontal: 19,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: {
    ...NG,
    backgroundColor: C.purple,
    borderColor: C.purple,
    shadowColor: C.purple,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  filterText: { color: C.text, fontSize: 12, fontWeight: "800" },
  filterTextActive: { color: "#ffffff" },
  listTitleRow: { paddingHorizontal: 28, paddingTop: 11, paddingBottom: 9 },
  listTitle: { color: "#374151", fontSize: 12, fontWeight: "500" },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: C.faint, fontSize: 13, fontWeight: "700" },
  list: { paddingHorizontal: 27, paddingBottom: 20 },
  card: {
    ...W.card,
    minHeight: 96,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    position: "relative",
    overflow: "hidden",
  },
  cardLine: {
    position: "absolute",
    left: 66,
    right: 13,
    top: 13,
    height: 2,
    borderRadius: 2,
  },
  cardIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, minWidth: 0, paddingTop: 4 },
  cardTitle: { color: C.ink, fontSize: 14, fontWeight: "900", lineHeight: 18 },
  cardSub: { color: "#374151", fontSize: 12, fontWeight: "600", marginTop: 2 },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  statusPillText: { fontSize: 10, fontWeight: "900" },
  cardDateWrap: {
    position: "absolute",
    right: 17,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardDate: { color: "#4b5563", fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 54, gap: 8 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: "900" },
  emptyText: { color: C.faint, fontSize: 13, fontWeight: "700" },
  bottomBar: {
    position: "absolute",
    left: 26,
    right: 26,
    bottom: 18,
    height: 46,
    justifyContent: "center",
  },
  bottomAddBtn: {
    height: 46,
    ...W.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  bottomAddText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  downFab: {
    position: "absolute",
    alignSelf: "center",
    bottom: -10,
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.42)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { color: C.ink, fontSize: 18, fontWeight: "900" },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  fieldLabel: { color: C.muted, fontSize: 12, fontWeight: "900", marginTop: 12, marginBottom: 8 },
  roomRow: { flexDirection: "row", gap: 8 },
  roomBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  roomBtnActive: { ...NG, backgroundColor: C.purple, borderColor: C.purple },
  roomBtnText: { color: C.muted, fontSize: 13, fontWeight: "800" },
  roomBtnTextActive: { color: "#ffffff" },
  chipRow: { gap: 7, paddingVertical: 2 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { ...NG, backgroundColor: C.purple, borderColor: C.purple },
  chipText: { color: C.muted, fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: "#ffffff" },
  textArea: {
    minHeight: 86,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#f8fafc",
    padding: 12,
    color: C.ink,
    fontSize: 13,
    textAlignVertical: "top",
  },
  textInput: {
    minHeight: 45,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    color: C.ink,
    fontSize: 13,
  },
  saveBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: C.purpleDeep,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  updateTitle: { color: C.ink, fontSize: 14, fontWeight: "800", marginBottom: 4 },
  statusBtnRow: { flexDirection: "row", gap: 8 },
  statusBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  statusBtnText: { fontSize: 12, fontWeight: "900" },
});
