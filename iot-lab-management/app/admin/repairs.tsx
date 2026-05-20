import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, TextInput, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

const STATUS_CFG: Record<string, { color: string; bg: string; border: string; label: string; icon: any }> = {
  pending:    { color: "#dc2626", bg: "#fee2e2", border: "#ef4444", label: "รอซ่อม",        icon: "time-outline" },
  "in-repair":{ color: "#b45309", bg: "#fef3c7", border: "#f59e0b", label: "กำลังซ่อม",    icon: "construct-outline" },
  done:       { color: "#16a34a", bg: "#dcfce7", border: "#22c55e", label: "ซ่อมเสร็จแล้ว", icon: "checkmark-circle-outline" },
};

const ROOMS = ["CP9524", "SC9604"];

const formatDate = (d?: string) => {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};

export default function RepairsPage() {
  const router = useRouter();

  const [records, setRecords] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "in-repair" | "done">("all");
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

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: recs }, { data: st }] = await Promise.all([
      supabase.from("repair_records").select("*").order("reported_at", { ascending: false }),
      supabase.from("computer_stations").select("*").order("room_id").order("group_no").order("name"),
    ]);

    const enriched: any[] = [];
    for (const r of (recs || [])) {
      let reporterEmail = "";
      if (r.reported_by) {
        const { data: p } = await supabase.from("profiles").select("email").eq("id", r.reported_by).single();
        reporterEmail = p?.email || "";
      }
      const station = (st || []).find((s: any) => s.id === r.station_id);
      enriched.push({
        ...r,
        reporterEmail,
        stationName: station ? `${station.room_id} กลุ่ม ${station.group_no} · ${station.name}` : null,
      });
    }

    setRecords(enriched);
    setStations(st || []);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); fetchAll(); };

  const openAdd = () => {
    setFormRoom("CP9524");
    setFormStation(null);
    setFormDesc("");
    setFormNotes("");
    setFilteredStations(stations.filter((s: any) => s.room_id === "CP9524"));
    setAddModal(true);
  };

  const changeRoom = (room: string) => {
    setFormRoom(room);
    setFormStation(null);
    setFilteredStations(stations.filter((s: any) => s.room_id === room));
  };

  const saveRepair = async () => {
    if (!formDesc.trim()) { Alert.alert("กรุณาระบุรายละเอียด"); return; }
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
    if (error) { Alert.alert("เกิดข้อผิดพลาด", error.message); return; }
    Alert.alert("แจ้งซ่อมสำเร็จ");
    setAddModal(false);
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
    if (error) { Alert.alert("เกิดข้อผิดพลาด", error.message); return; }
    setUpdateModal(false);
    fetchAll();
  };

  const filtered = filterStatus === "all" ? records : records.filter(r => r.status === filterStatus);
  const countByStatus = (s: string) => records.filter(r => r.status === s).length;

  const FILTERS = [
    { key: "all",       label: "ทั้งหมด" },
    { key: "pending",   label: STATUS_CFG.pending.label },
    { key: "in-repair", label: STATUS_CFG["in-repair"].label },
    { key: "done",      label: STATUS_CFG.done.label },
  ] as const;

  return (
    <View style={s.container}>

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>ซ่อมบำรุง</Text>
          <Text style={s.headerSub}>เครื่องคอมพิวเตอร์ในห้องแล็บ</Text>
        </View>
        <TouchableOpacity onPress={openAdd}>
          <Ionicons name="add-circle-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* STATS */}
      <View style={s.statsRow}>
        {Object.entries(STATUS_CFG).map(([k, v]) => (
          <View key={k} style={[s.statCard, { borderLeftColor: v.border }]}>
            <Text style={[s.statNum, { color: v.color }]}>{countByStatus(k)}</Text>
            <Text style={s.statLabel}>{v.label}</Text>
          </View>
        ))}
      </View>

      {/* FILTERS */}
      <View style={s.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.filterBtn, filterStatus === f.key && s.filterBtnActive]}
              onPress={() => setFilterStatus(f.key as any)}
            >
              <Text style={[s.filterTxt, filterStatus === f.key && s.filterTxtActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color="#1e3a8a" size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}
        >
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="construct-outline" size={48} color="#cbd5e1" />
              <Text style={s.emptyTitle}>ไม่มีรายการซ่อม</Text>
              <Text style={s.emptyText}>กด + เพื่อแจ้งซ่อมใหม่</Text>
            </View>
          ) : (
            filtered.map(rec => {
              const cfg = STATUS_CFG[rec.status] || STATUS_CFG.pending;
              return (
                <View key={rec.id} style={[s.card, { borderLeftColor: cfg.border }]}>
                  {/* top row */}
                  <View style={s.cardTop}>
                    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon} size={12} color={cfg.color} />
                      <Text style={[s.badgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <Text style={s.cardDate}>{formatDate(rec.reported_at)}</Text>
                  </View>

                  {/* station */}
                  {rec.stationName && (
                    <View style={s.cardRow}>
                      <Ionicons name="desktop-outline" size={13} color="#94a3b8" />
                      <Text style={s.cardStation}>{rec.stationName}</Text>
                    </View>
                  )}

                  {/* description */}
                  <Text style={s.cardDesc}>{rec.description}</Text>

                  {/* notes */}
                  {rec.notes ? (
                    <View style={s.cardRow}>
                      <Ionicons name="document-text-outline" size={13} color="#94a3b8" />
                      <Text style={s.cardNotes}>{rec.notes}</Text>
                    </View>
                  ) : null}

                  {/* reporter */}
                  {rec.reporterEmail ? (
                    <View style={s.cardRow}>
                      <Ionicons name="person-outline" size={13} color="#94a3b8" />
                      <Text style={s.cardMeta}>แจ้งโดย {rec.reporterEmail}</Text>
                    </View>
                  ) : null}

                  {/* done date */}
                  {rec.status === "done" && rec.repaired_at && (
                    <View style={s.cardRow}>
                      <Ionicons name="checkmark-circle-outline" size={13} color="#16a34a" />
                      <Text style={[s.cardMeta, { color: "#16a34a" }]}>ซ่อมเสร็จ {formatDate(rec.repaired_at)}</Text>
                    </View>
                  )}

                  {/* update button */}
                  {rec.status !== "done" && (
                    <TouchableOpacity style={s.updateBtn} onPress={() => openUpdate(rec)}>
                      <Ionicons name="create-outline" size={14} color="#1e3a8a" />
                      <Text style={s.updateBtnTxt}>อัปเดตสถานะ</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* MODAL: เพิ่มรายการซ่อม */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={s.overlay}>
          <ScrollView contentContainerStyle={s.modalBox} keyboardShouldPersistTaps="handled">
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>แจ้งซ่อมเครื่องคอม</Text>
              <TouchableOpacity onPress={() => setAddModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>ห้อง</Text>
            <View style={s.roomRow}>
              {ROOMS.map(r => (
                <TouchableOpacity key={r}
                  style={[s.roomBtn, formRoom === r && s.roomBtnActive]}
                  onPress={() => changeRoom(r)}
                >
                  <Text style={[s.roomBtnTxt, formRoom === r && s.roomBtnTxtActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.fieldLabel}>เครื่อง (ไม่บังคับ)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              <TouchableOpacity
                style={[s.chip, !formStation && s.chipActive]}
                onPress={() => setFormStation(null)}
              >
                <Text style={[s.chipTxt, !formStation && s.chipTxtActive]}>ไม่ระบุ</Text>
              </TouchableOpacity>
              {filteredStations.map((st: any) => (
                <TouchableOpacity key={st.id}
                  style={[s.chip, formStation?.id === st.id && s.chipActive]}
                  onPress={() => setFormStation(st)}
                >
                  <Text style={[s.chipTxt, formStation?.id === st.id && s.chipTxtActive]}>
                    G{st.group_no} {st.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>รายละเอียดปัญหา *</Text>
            <TextInput
              style={s.textArea}
              placeholder="อธิบายปัญหาที่พบ..."
              value={formDesc}
              onChangeText={setFormDesc}
              multiline
            />

            <Text style={s.fieldLabel}>หมายเหตุ</Text>
            <TextInput
              style={s.textInput}
              placeholder="ข้อมูลเพิ่มเติม..."
              value={formNotes}
              onChangeText={setFormNotes}
            />

            <TouchableOpacity
              style={[s.saveBtn, saving && { backgroundColor: "#94a3b8" }]}
              onPress={saveRepair} disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={s.saveBtnTxt}>บันทึกการแจ้งซ่อม</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL: อัปเดตสถานะ */}
      <Modal visible={updateModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>อัปเดตสถานะการซ่อม</Text>
              <TouchableOpacity onPress={() => setUpdateModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>สถานะ</Text>
            <View style={s.statusBtnRow}>
              {(["pending", "in-repair", "done"] as const).map(st => {
                const cfg = STATUS_CFG[st];
                return (
                  <TouchableOpacity key={st}
                    style={[s.statusBtn, { borderColor: cfg.border }, updateStatus === st && { backgroundColor: cfg.bg }]}
                    onPress={() => setUpdateStatus(st)}
                  >
                    <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                    <Text style={[s.statusBtnTxt, { color: cfg.color }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.fieldLabel}>หมายเหตุ</Text>
            <TextInput
              style={[s.textInput, { marginBottom: 16 }]}
              placeholder="รายละเอียดการซ่อม..."
              value={updateNotes}
              onChangeText={setUpdateNotes}
            />

            <TouchableOpacity
              style={[s.saveBtn, saving && { backgroundColor: "#94a3b8" }]}
              onPress={saveUpdate} disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={s.saveBtnTxt}>บันทึก</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  header: {
    backgroundColor: "#1e3a8a",
    paddingTop: 54, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", textAlign: "center" },
  headerSub:   { color: "#93c5fd", fontSize: 12, textAlign: "center", marginTop: 2 },

  statsRow: { flexDirection: "row", padding: 12, gap: 8 },
  statCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 12,
    padding: 10, borderLeftWidth: 4,
    alignItems: "center",
  },
  statNum:   { fontSize: 22, fontWeight: "800", color: "#1e293b" },
  statLabel: { fontSize: 9, fontWeight: "600", color: "#64748b", marginTop: 2, textAlign: "center" },

  filterWrap: { paddingHorizontal: 12, marginBottom: 8 },
  filterRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0",
    alignSelf: "flex-start",
  },
  filterBtnActive: { backgroundColor: "#1e3a8a", bordercolor: "#1e3a8a" },
  filterTxt: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  filterTxtActive: { color: "#fff" },

  list: { padding: 12 },

  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    marginBottom: 10, borderLeftWidth: 4, gap: 6,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeTxt: { fontSize: 11, fontWeight: "700" },
  cardDate: { fontSize: 11, color: "#94a3b8" },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  cardStation: { fontSize: 12, color: "#64748b", flex: 1 },
  cardDesc: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  cardNotes: { fontSize: 12, color: "#64748b", flex: 1 },
  cardMeta: { fontSize: 11, color: "#94a3b8", flex: 1 },
  updateBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: "#eff6ff", borderRadius: 8,
    borderWidth: 1, borderColor: "#bfdbfe",
  },
  updateBtnTxt: { fontSize: 12, color: "#1e3a8a", fontWeight: "600" },

  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#475569" },
  emptyText: { fontSize: 13, color: "#94a3b8" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: "#1e293b" },

  fieldLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 12,
  },
  roomRow: { flexDirection: "row", gap: 8 },
  roomBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#f1f5f9", alignItems: "center",
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  roomBtnActive: { backgroundColor: "#1e3a8a", bordercolor: "#1e3a8a" },
  roomBtnTxt: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  roomBtnTxtActive: { color: "#fff" },

  chipRow: { flexDirection: "row", gap: 6, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  chipActive: { backgroundColor: "#1e3a8a", bordercolor: "#1e3a8a" },
  chipTxt: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  chipTxtActive: { color: "#fff" },

  textArea: {
    backgroundColor: "#f8fafc", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#e2e8f0", fontSize: 13,
    minHeight: 80, textAlignVertical: "top",
  },
  textInput: {
    backgroundColor: "#f8fafc", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#e2e8f0", fontSize: 13,
  },
  statusBtnRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  statusBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
  },
  statusBtnTxt: { fontSize: 11, fontWeight: "700" },

  saveBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8,
    backgroundColor: "#1e3a8a", padding: 14, borderRadius: 12,
  },
  saveBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
