import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, TextInput, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

const STATUS_CFG: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  pending:   { color: "#dc2626", bg: "#fee2e2", label: "รอซ่อม",       icon: "time-outline" },
  "in-repair": { color: "#b45309", bg: "#fef3c7", label: "กำลังซ่อม", icon: "construct-outline" },
  done:      { color: "#16a34a", bg: "#dcfce7", label: "ซ่อมเสร็จแล้ว", icon: "checkmark-circle-outline" },
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

  // Modal: เพิ่มรายการซ่อม
  const [addModal, setAddModal] = useState(false);
  const [formRoom, setFormRoom] = useState("CP9524");
  const [formStation, setFormStation] = useState<any>(null);
  const [formDesc, setFormDesc] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [filteredStations, setFilteredStations] = useState<any[]>([]);

  // Modal: อัปเดตสถานะ
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

    // enrich reporter name
    const enriched: any[] = [];
    for (const r of (recs || [])) {
      let reporterEmail = "";
      if (r.reported_by) {
        const { data: p } = await supabase.from("profiles").select("email").eq("id", r.reported_by).single();
        reporterEmail = p?.email || "";
      }
      const station = (st || []).find(s => s.id === r.station_id);
      enriched.push({ ...r, reporterEmail, stationName: station ? `${station.room_id} กลุ่ม${station.group_no} ${station.name}` : "-" });
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
    setFilteredStations(stations.filter(s => s.room_id === "CP9524"));
    setAddModal(true);
  };

  const changeRoom = (room: string) => {
    setFormRoom(room);
    setFormStation(null);
    setFilteredStations(stations.filter(s => s.room_id === room));
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

    Alert.alert("บันทึกสำเร็จ");
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
    const updates: any = {
      status: updateStatus,
      notes: updateNotes.trim() || null,
    };
    if (updateStatus === "done") {
      updates.repaired_at = new Date().toISOString();
      updates.repaired_by = user?.id || null;
    }

    const { error } = await supabase
      .from("repair_records").update(updates).eq("id", updateRecord.id);

    setSaving(false);
    if (error) { Alert.alert("เกิดข้อผิดพลาด", error.message); return; }

    Alert.alert("อัปเดตสำเร็จ");
    setUpdateModal(false);
    fetchAll();
  };

  const filtered = filterStatus === "all"
    ? records
    : records.filter(r => r.status === filterStatus);

  const countByStatus = (s: string) => records.filter(r => r.status === s).length;

  return (
    <View style={st.container}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={st.headerTxt}>การซ่อมบำรุง</Text>
        <TouchableOpacity onPress={openAdd}>
          <Ionicons name="add-circle-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* สถิติ */}
      <View style={st.statsRow}>
        {Object.entries(STATUS_CFG).map(([k, v]) => (
          <View key={k} style={[st.statCard, { backgroundColor: v.bg }]}>
            <Ionicons name={v.icon} size={20} color={v.color} />
            <Text style={[st.statCount, { color: v.color }]}>{countByStatus(k)}</Text>
            <Text style={[st.statLabel, { color: v.color }]}>{v.label}</Text>
          </View>
        ))}
      </View>

      {/* Filter tabs */}
      <View style={st.filterRow}>
        {(["all", "pending", "in-repair", "done"] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[st.filterBtn, filterStatus === f && st.filterBtnActive]}
            onPress={() => setFilterStatus(f)}
          >
            <Text style={[st.filterTxt, filterStatus === f && st.filterTxtActive]}>
              {f === "all" ? "ทั้งหมด" : STATUS_CFG[f].label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#f97316" size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={st.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}>

          {filtered.length === 0 && (
            <View style={st.empty}>
              <Ionicons name="construct-outline" size={48} color="#cbd5e1" />
              <Text style={st.emptyTxt}>ไม่มีรายการซ่อม</Text>
            </View>
          )}

          {filtered.map(rec => {
            const cfg = STATUS_CFG[rec.status] || STATUS_CFG.pending;
            return (
              <View key={rec.id} style={st.repairCard}>
                <View style={st.cardTop}>
                  <View style={[st.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={13} color={cfg.color} />
                    <Text style={[st.statusBadgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <Text style={st.cardDate}>{formatDate(rec.reported_at)}</Text>
                </View>

                <Text style={st.cardStation}>{rec.stationName}</Text>
                <Text style={st.cardDesc}>{rec.description}</Text>
                {rec.notes ? <Text style={st.cardNotes}>หมายเหตุ: {rec.notes}</Text> : null}
                {rec.reporterEmail ? (
                  <Text style={st.cardReporter}>รายงานโดย: {rec.reporterEmail}</Text>
                ) : null}
                {rec.status === "done" && rec.repaired_at && (
                  <Text style={st.cardDone}>✅ ซ่อมเสร็จ: {formatDate(rec.repaired_at)}</Text>
                )}

                {rec.status !== "done" && (
                  <TouchableOpacity style={st.updateBtn} onPress={() => openUpdate(rec)}>
                    <Ionicons name="create-outline" size={15} color="#f97316" />
                    <Text style={st.updateBtnTxt}>อัปเดตสถานะ</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── MODAL: เพิ่มรายการซ่อม ── */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={st.modalBox}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>แจ้งซ่อมอุปกรณ์</Text>
              <TouchableOpacity onPress={() => setAddModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={st.fieldLabel}>ห้อง</Text>
            <View style={st.roomRow}>
              {ROOMS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[st.roomBtn, formRoom === r && st.roomBtnActive]}
                  onPress={() => changeRoom(r)}
                >
                  <Text style={[st.roomBtnTxt, formRoom === r && st.roomBtnTxtActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={st.fieldLabel}>เครื่อง (ไม่บังคับ)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={st.stationChips}>
                <TouchableOpacity
                  style={[st.chip, !formStation && st.chipActive]}
                  onPress={() => setFormStation(null)}
                >
                  <Text style={[st.chipTxt, !formStation && st.chipTxtActive]}>ไม่ระบุ</Text>
                </TouchableOpacity>
                {filteredStations.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[st.chip, formStation?.id === s.id && st.chipActive]}
                    onPress={() => setFormStation(s)}
                  >
                    <Text style={[st.chipTxt, formStation?.id === s.id && st.chipTxtActive]}>
                      G{s.group_no} {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={st.fieldLabel}>รายละเอียด *</Text>
            <TextInput
              style={st.textArea}
              placeholder="อธิบายปัญหา..."
              value={formDesc}
              onChangeText={setFormDesc}
              multiline
            />

            <Text style={st.fieldLabel}>หมายเหตุ</Text>
            <TextInput
              style={st.textInput}
              placeholder="ข้อมูลเพิ่มเติม..."
              value={formNotes}
              onChangeText={setFormNotes}
            />

            <TouchableOpacity
              style={[st.saveBtn, saving && { backgroundColor: "#94a3b8" }]}
              onPress={saveRepair}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={st.saveBtnTxt}>บันทึก</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: อัปเดตสถานะ ── */}
      <Modal visible={updateModal} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={st.modalBox}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>อัปเดตสถานะการซ่อม</Text>
              <TouchableOpacity onPress={() => setUpdateModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={st.fieldLabel}>สถานะ</Text>
            <View style={st.statusBtnRow}>
              {(["pending", "in-repair", "done"] as const).map(s => {
                const cfg = STATUS_CFG[s];
                return (
                  <TouchableOpacity
                    key={s}
                    style={[st.statusBtn, { borderColor: cfg.color }, updateStatus === s && { backgroundColor: cfg.bg }]}
                    onPress={() => setUpdateStatus(s)}
                  >
                    <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                    <Text style={[st.statusBtnTxt, { color: cfg.color }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={st.fieldLabel}>หมายเหตุ</Text>
            <TextInput
              style={st.textInput}
              placeholder="รายละเอียดการซ่อม..."
              value={updateNotes}
              onChangeText={setUpdateNotes}
            />

            <TouchableOpacity
              style={[st.saveBtn, saving && { backgroundColor: "#94a3b8" }]}
              onPress={saveUpdate}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={st.saveBtnTxt}>บันทึก</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    backgroundColor: "#f97316", paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerTxt: { color: "#fff", fontSize: 17, fontWeight: "bold" },

  statsRow: { flexDirection: "row", padding: 12, gap: 8 },
  statCard: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 4 },
  statCount: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 9, fontWeight: "600", textAlign: "center" },

  filterRow: { flexDirection: "row", paddingHorizontal: 12, gap: 6, marginBottom: 8, flexWrap: "wrap" },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#e2e8f0" },
  filterBtnActive: { backgroundColor: "#f97316" },
  filterTxt: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  filterTxtActive: { color: "#fff" },

  list: { padding: 12 },

  repairCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0", gap: 6,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusBadgeTxt: { fontSize: 11, fontWeight: "700" },
  cardDate: { fontSize: 11, color: "#94a3b8" },
  cardStation: { fontSize: 12, color: "#64748b" },
  cardDesc: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  cardNotes: { fontSize: 12, color: "#64748b" },
  cardReporter: { fontSize: 11, color: "#94a3b8" },
  cardDone: { fontSize: 11, color: "#16a34a", fontWeight: "600" },
  updateBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-end", paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: "#fff7ed", borderRadius: 8, borderWidth: 1, borderColor: "#fed7aa",
  },
  updateBtnTxt: { fontSize: 12, color: "#f97316", fontWeight: "600" },

  empty: { padding: 40, alignItems: "center", gap: 10 },
  emptyTxt: { color: "#94a3b8", fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b" },

  fieldLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 4,
  },

  roomRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  roomBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center", borderWidth: 1, borderColor: "#e2e8f0" },
  roomBtnActive: { backgroundColor: "#f97316", borderColor: "#f97316" },
  roomBtnTxt: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  roomBtnTxtActive: { color: "#fff" },

  stationChips: { flexDirection: "row", gap: 6, paddingRight: 16 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  chipActive: { backgroundColor: "#f97316", borderColor: "#f97316" },
  chipTxt: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  chipTxtActive: { color: "#fff" },

  textArea: {
    backgroundColor: "#f8fafc", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#e2e8f0", fontSize: 13,
    minHeight: 72, textAlignVertical: "top", marginBottom: 4,
  },
  textInput: {
    backgroundColor: "#f8fafc", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#e2e8f0", fontSize: 13, marginBottom: 14,
  },

  statusBtnRow: { flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" },
  statusBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
  },
  statusBtnTxt: { fontSize: 11, fontWeight: "700" },

  saveBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    backgroundColor: "#f97316", padding: 14, borderRadius: 12,
  },
  saveBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
