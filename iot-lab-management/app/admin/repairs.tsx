import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

const C = {
  bg: "#eef2f8",
  purple: "#7c3aed",
  purpleDeep: "#5b21b6",
  ink: "#111827",
  text: "#1f2937",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#d9dde7",
  card: "#ffffff",
  red: "#ef4444",
  yellow: "#facc15",
  green: "#22c55e",
  orange: "#f59e0b",
};

const STATUS_CFG: Record<string, { color: string; bg: string; border: string; label: string; icon: any; dot: string }> = {
  pending: { color: C.red, bg: "#fee2e2", border: "#f87171", label: "รอซ่อม", icon: "desktop-outline", dot: C.red },
  "in-repair": { color: C.orange, bg: "#fef3c7", border: "#facc15", label: "กำลังซ่อม", icon: "hardware-chip-outline", dot: C.yellow },
  done: { color: C.green, bg: "#dcfce7", border: "#34d399", label: "ซ่อมเสร็จแล้ว", icon: "desktop-outline", dot: C.green },
};

const ROOMS = ["CP9524", "SC9604"];

type FilterKey = "all" | "pending" | "in-repair" | "done";

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
  const router = useRouter();

  const [records, setRecords] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterKey>("all");
  const [saving, setSaving] = useState(false);

  const [addModal, setAddModal] = useState(false);
  const [formRoom, setFormRoom] = useState("CP9524");
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

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: recs, error: recError }, { data: stationRows, error: stationError }] = await Promise.all([
      supabase.from("repair_records").select("*").order("reported_at", { ascending: false }),
      supabase.from("computer_stations").select("*").order("room_id").order("group_no").order("name"),
    ]);

    if (recError || stationError) {
      Alert.alert("โหลดข้อมูลไม่สำเร็จ", recError?.message || stationError?.message || "กรุณาลองใหม่อีกครั้ง");
    }

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
    setFormRoom("CP9524");
    setFormStation(null);
    setFormDesc("");
    setFormNotes("");
    setFilteredStations(stations.filter((station: any) => station.room_id === "CP9524"));
    setAddModal(true);
  };

  const changeRoom = (room: string) => {
    setFormRoom(room);
    setFormStation(null);
    setFilteredStations(stations.filter((station: any) => station.room_id === room));
  };

  const saveRepair = async () => {
    if (!formDesc.trim()) {
      Alert.alert("กรุณาระบุรายละเอียด");
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("repair_records").insert([{
      station_id: formStation?.id || null,
      description: formDesc.trim(),
      notes: formNotes.trim() || null,
      status: "pending",
      reported_by: user?.id || null,
    }]);
    setSaving(false);

    if (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message);
      return;
    }

    setAddModal(false);
    Alert.alert("แจ้งซ่อมสำเร็จ");
    fetchAll();
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
    const { data: { user } } = await supabase.auth.getUser();
    const updates: any = { status: updateStatus, notes: updateNotes.trim() || null };
    if (updateStatus === "done") {
      updates.repaired_at = new Date().toISOString();
      updates.repaired_by = user?.id || null;
    }

    const { error } = await supabase.from("repair_records").update(updates).eq("id", updateRecord.id);
    setSaving(false);

    if (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message);
      return;
    }

    setUpdateModal(false);
    fetchAll();
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
        <View style={s.heroTop}>
          <TouchableOpacity style={s.headerIconBtn} onPress={() => router.replace("/admin/home")} activeOpacity={0.82}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>

          <View style={s.titleBlock}>
            <Text style={s.headerTitle}>ซ่อมบำรุง</Text>
            <Text style={s.headerSub}>เครื่องคอมพิวเตอร์ในห้องแล็บ</Text>
          </View>

          <TouchableOpacity style={s.headerIconBtn} onPress={openAdd} activeOpacity={0.82}>
            <Ionicons name="add" size={21} color="#06133a" />
          </TouchableOpacity>
        </View>

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
        <Text style={s.listTitle}>{filterStatus === "all" ? "รายการซ่อมทั้งหมด" : `รายการ${STATUS_CFG[filterStatus].label}`}</Text>
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
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="construct-outline" size={45} color="#cbd5e1" />
              <Text style={s.emptyTitle}>ไม่มีรายการซ่อม</Text>
              <Text style={s.emptyText}>กดปุ่มเพิ่มเพื่อแจ้งซ่อมใหม่</Text>
            </View>
          ) : (
            filtered.map((record) => {
              const cfg = STATUS_CFG[record.status] || STATUS_CFG.pending;
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
          <Ionicons name="add" size={17} color={C.ink} />
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
              {ROOMS.map((room) => (
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
              {(["pending", "in-repair", "done"] as const).map((status) => {
                const cfg = STATUS_CFG[status];
                const active = updateStatus === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[s.statusBtn, { borderColor: cfg.border }, active && { backgroundColor: cfg.bg }]}
                    onPress={() => setUpdateStatus(status)}
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
  container: { flex: 1, backgroundColor: C.bg },
  hero: {
    backgroundColor: C.purple,
    paddingTop: 29,
    paddingHorizontal: 29,
    paddingBottom: 24,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { alignItems: "center", flex: 1 },
  headerTitle: { color: "#ffffff", fontSize: 16, fontWeight: "900", lineHeight: 20 },
  headerSub: { color: "#ede9fe", fontSize: 11, fontWeight: "800", marginTop: 1 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 22 },
  statCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  statDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 4 },
  statValue: { color: "#ffffff", fontSize: 25, fontWeight: "900", lineHeight: 29 },
  statLabel: { color: "#ede9fe", fontSize: 10.5, fontWeight: "900", marginTop: 5 },
  filterShell: {
    backgroundColor: C.bg,
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
    minHeight: 96,
    backgroundColor: C.card,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.12,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
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
  cardSub: { color: "#374151", fontSize: 11, fontWeight: "600", marginTop: 2 },
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
  cardDate: { color: "#4b5563", fontSize: 10.5, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 54, gap: 8 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: "900" },
  emptyText: { color: C.faint, fontSize: 13, fontWeight: "700" },
  bottomBar: {
    position: "absolute",
    left: 26,
    right: 26,
    bottom: 13,
    height: 35,
    justifyContent: "center",
  },
  bottomAddBtn: {
    height: 34,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#bfc5d1",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  bottomAddText: { color: C.ink, fontSize: 13, fontWeight: "800" },
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
  roomBtnActive: { backgroundColor: C.purple, borderColor: C.purple },
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
  chipActive: { backgroundColor: C.purple, borderColor: C.purple },
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
  statusBtnText: { fontSize: 10.5, fontWeight: "900" },
});
