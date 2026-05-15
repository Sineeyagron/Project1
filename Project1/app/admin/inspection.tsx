import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

const ROOMS = ["CP9524", "SC9604"];
const EQUIP_TYPES = ["mouse", "keyboard", "monitor"] as const;
type EquipType = typeof EQUIP_TYPES[number];

const EQUIP_LABELS: Record<EquipType, string> = {
  mouse: "🖱️ เมาส์",
  keyboard: "⌨️ คีย์บอร์ด",
  monitor: "🖥️ จอภาพ",
};

const CONDITION_CFG: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  good:    { color: "#16a34a", bg: "#dcfce7", label: "ปกติ",   icon: "checkmark-circle-outline" },
  damaged: { color: "#b45309", bg: "#fef3c7", label: "ชำรุด", icon: "construct-outline" },
  missing: { color: "#dc2626", bg: "#fee2e2", label: "หาย",   icon: "alert-circle-outline" },
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

export default function InspectionPage() {
  const router = useRouter();

  const [selectedRoom, setSelectedRoom] = useState("CP9524");
  const [term, setTerm] = useState("");
  const [stations, setStations] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [borrowHistory, setBorrowHistory] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal: form บันทึก
  const [formModal, setFormModal] = useState(false);
  const [formStation, setFormStation] = useState<any>(null);
  const [formType, setFormType] = useState<EquipType>("mouse");
  const [formCondition, setFormCondition] = useState<"good" | "damaged" | "missing">("good");
  const [formNotes, setFormNotes] = useState("");

  // Modal: ดูประวัติผู้ยืมล่าสุดของ station
  const [histModal, setHistModal] = useState(false);
  const [histStation, setHistStation] = useState<any>(null);
  const [histRecords, setHistRecords] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => {
    if (stations.length === 0) fetchStations();
  }, [selectedRoom]);

  useEffect(() => { fetchStations(); }, [selectedRoom]);

  const fetchStations = async () => {
    setLoading(true);
    const { data: st } = await supabase
      .from("computer_stations").select("*")
      .eq("room_id", selectedRoom).order("group_no").order("name");
    setStations(st || []);
    setLoading(false);
  };

  const fetchInspections = async (termVal: string) => {
    if (!termVal.trim()) return;
    setLoading(true);
    const { data } = await supabase
      .from("equipment_inspections")
      .select("*")
      .eq("term", termVal.trim())
      .in("station_id", (stations.map(s => s.id)));
    setInspections(data || []);
    setLoading(false);
  };

  const openHistory = async (station: any) => {
    setHistStation(station);
    setHistModal(true);
    setHistLoading(true);

    // ดึงประวัติยืมล่าสุด 5 รายการของ station นี้
    // (ยังไม่มี FK station↔borrow แต่ดึงจาก profile ได้)
    const { data: recs } = await supabase
      .from("borrow_records")
      .select("*")
      .eq("status", "returned")
      .order("created_at", { ascending: false })
      .limit(10);

    // enrichment: ดึง email
    const enriched: any[] = [];
    for (const r of (recs || [])) {
      let email = "ไม่ทราบ";
      if (r.user_id) {
        const { data: p } = await supabase
          .from("profiles").select("email").eq("id", r.user_id).single();
        if (p?.email) email = p.email;
      }
      enriched.push({ ...r, email });
    }

    setHistRecords(enriched);
    setHistLoading(false);
  };

  const openForm = (station: any) => {
    setFormStation(station);
    setFormType("mouse");
    setFormCondition("good");
    setFormNotes("");
    setFormModal(true);
  };

  const saveInspection = async () => {
    if (!term.trim()) { Alert.alert("กรุณาระบุเทอม"); return; }
    if (!formStation) return;

    setSaving(true);

    // ดึง admin session
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("equipment_inspections").insert([{
      term: term.trim(),
      station_id: formStation.id,
      inspector_id: user?.id || null,
      equipment_type: formType,
      condition: formCondition,
      notes: formNotes.trim() || null,
    }]);

    setSaving(false);

    if (error) { Alert.alert("เกิดข้อผิดพลาด", error.message); return; }

    Alert.alert("บันทึกสำเร็จ");
    setFormModal(false);
    fetchInspections(term);
  };

  // นับจำนวน inspection ของ station นี้ในเทอมนี้
  const getStationInspCount = (stationId: string) =>
    inspections.filter(i => i.station_id === stationId).length;

  const getStationIssues = (stationId: string) =>
    inspections.filter(i => i.station_id === stationId && i.condition !== "good").length;

  // จัดกลุ่ม
  const grouped: Record<number, any[]> = {};
  stations.forEach(s => {
    if (!grouped[s.group_no]) grouped[s.group_no] = [];
    grouped[s.group_no].push(s);
  });

  return (
    <View style={st.container}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={st.headerTxt}>ตรวจสภาพอุปกรณ์</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">

        {/* เลือกห้อง */}
        <View style={st.roomRow}>
          {ROOMS.map(r => (
            <TouchableOpacity
              key={r}
              style={[st.roomBtn, selectedRoom === r && st.roomBtnActive]}
              onPress={() => setSelectedRoom(r)}
            >
              <Text style={[st.roomBtnTxt, selectedRoom === r && st.roomBtnTxtActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* เทอม */}
        <Text style={st.fieldLabel}>เทอมที่ตรวจ (เช่น 1/2568)</Text>
        <View style={st.inputRow}>
          <TextInput
            style={st.termInput}
            placeholder="1/2568"
            value={term}
            onChangeText={setTerm}
          />
          <TouchableOpacity
            style={st.searchBtn}
            onPress={() => fetchInspections(term)}
          >
            <Ionicons name="search-outline" size={18} color="#fff" />
            <Text style={st.searchBtnTxt}>ดูผล</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator color="#7c3aed" style={{ marginVertical: 16 }} />}

        {/* รายการเครื่อง */}
        {Object.entries(grouped).map(([gNo, stns]) => (
          <View key={gNo} style={st.groupBox}>
            <Text style={st.groupLabel}>กลุ่มที่ {gNo}</Text>
            {stns.map(station => {
              const count = getStationInspCount(station.id);
              const issues = getStationIssues(station.id);
              return (
                <View key={station.id} style={st.stationRow}>
                  <View style={st.stationInfo}>
                    <Text style={st.stationName}>{station.name}</Text>
                    {count > 0 ? (
                      <Text style={[st.stationBadge, issues > 0 && { color: "#dc2626" }]}>
                        {issues > 0 ? `⚠️ พบปัญหา ${issues}/${count}` : `✅ ตรวจแล้ว ${count} รายการ`}
                      </Text>
                    ) : (
                      <Text style={st.stationBadge}>ยังไม่ได้ตรวจเทอมนี้</Text>
                    )}
                  </View>
                  <View style={st.stationActions}>
                    <TouchableOpacity style={st.histBtn} onPress={() => openHistory(station)}>
                      <Ionicons name="time-outline" size={16} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity style={st.inspBtn} onPress={() => openForm(station)}>
                      <Ionicons name="clipboard-outline" size={16} color="#fff" />
                      <Text style={st.inspBtnTxt}>ตรวจ</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {/* ผลรวมเทอมนี้ */}
        {inspections.length > 0 && (
          <View style={st.summaryBox}>
            <Text style={st.summaryTitle}>ผลรวมเทอม {term}</Text>
            {inspections.filter(i => i.condition !== "good").map(i => {
              const stn = stations.find(s => s.id === i.station_id);
              const cfg = CONDITION_CFG[i.condition];
              return (
                <View key={i.id} style={[st.issueRow, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={[st.issueName, { color: cfg.color }]}>
                      {stn?.name || "?"} — {EQUIP_LABELS[i.equipment_type as EquipType] || i.equipment_type}
                    </Text>
                    <Text style={[st.issueStatus, { color: cfg.color }]}>{cfg.label}</Text>
                    {i.notes ? <Text style={st.issueNote}>{i.notes}</Text> : null}
                    <Text style={st.issueDate}>{formatDate(i.inspected_at)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── MODAL: บันทึกการตรวจ ── */}
      <Modal visible={formModal} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={st.modalBox}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>บันทึกการตรวจ — {formStation?.name}</Text>
              <TouchableOpacity onPress={() => setFormModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={st.fieldLabel}>อุปกรณ์</Text>
            <View style={st.typeRow}>
              {EQUIP_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[st.typeBtn, formType === t && st.typeBtnActive]}
                  onPress={() => setFormType(t)}
                >
                  <Text style={[st.typeBtnTxt, formType === t && st.typeBtnTxtActive]}>
                    {EQUIP_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={st.fieldLabel}>สภาพ</Text>
            <View style={st.condRow}>
              {(["good", "damaged", "missing"] as const).map(c => {
                const cfg = CONDITION_CFG[c];
                return (
                  <TouchableOpacity
                    key={c}
                    style={[st.condBtn, { borderColor: cfg.color }, formCondition === c && { backgroundColor: cfg.bg }]}
                    onPress={() => setFormCondition(c)}
                  >
                    <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                    <Text style={[st.condBtnTxt, { color: cfg.color }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={st.fieldLabel}>หมายเหตุ (ถ้ามี)</Text>
            <TextInput
              style={st.notesInput}
              placeholder="รายละเอียดเพิ่มเติม..."
              value={formNotes}
              onChangeText={setFormNotes}
              multiline
            />

            <TouchableOpacity
              style={[st.saveBtn, saving && { backgroundColor: "#94a3b8" }]}
              onPress={saveInspection}
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

      {/* ── MODAL: ประวัติผู้ยืม ── */}
      <Modal visible={histModal} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={[st.modalBox, { maxHeight: "75%" }]}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>ประวัติผู้ยืม — {histStation?.name}</Text>
              <TouchableOpacity onPress={() => setHistModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {histLoading ? (
              <ActivityIndicator color="#7c3aed" style={{ marginVertical: 20 }} />
            ) : histRecords.length === 0 ? (
              <Text style={st.emptyTxt}>ไม่พบประวัติการยืม</Text>
            ) : (
              <ScrollView>
                {histRecords.map(r => (
                  <View key={r.id} style={st.histRow}>
                    <Ionicons name="person-circle-outline" size={20} color="#7c3aed" />
                    <View style={{ flex: 1 }}>
                      <Text style={st.histEmail}>{r.email}</Text>
                      <Text style={st.histDate}>
                        ยืม: {formatDate(r.borrow_date || r.created_at)}
                        {r.return_date ? `  คืน: ${formatDate(r.return_date)}` : "  (ยังไม่คืน)"}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    backgroundColor: "#7c3aed", paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerTxt: { color: "#fff", fontSize: 17, fontWeight: "bold" },
  body: { padding: 16 },

  roomRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  roomBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center",
  },
  roomBtnActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  roomBtnTxt: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  roomBtnTxtActive: { color: "#fff" },

  fieldLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 4,
  },

  inputRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  termInput: {
    flex: 1, backgroundColor: "#fff", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "#e2e8f0", fontSize: 14,
  },
  searchBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#7c3aed", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchBtnTxt: { color: "#fff", fontWeight: "600", fontSize: 13 },

  groupBox: { marginBottom: 14 },
  groupLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },

  stationRow: {
    backgroundColor: "#fff", borderRadius: 12, padding: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 6, borderWidth: 1, borderColor: "#e2e8f0",
  },
  stationInfo: { flex: 1 },
  stationName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  stationBadge: { fontSize: 11, color: "#64748b", marginTop: 2 },
  stationActions: { flexDirection: "row", gap: 8 },
  histBtn: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center",
  },
  inspBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#7c3aed", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
  },
  inspBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "600" },

  summaryBox: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0",
  },
  summaryTitle: { fontSize: 13, fontWeight: "700", color: "#1e293b", marginBottom: 10 },
  issueRow: { flexDirection: "row", gap: 10, borderRadius: 10, padding: 10, marginBottom: 6, alignItems: "flex-start" },
  issueName: { fontSize: 13, fontWeight: "600" },
  issueStatus: { fontSize: 11, fontWeight: "600" },
  issueNote: { fontSize: 11, color: "#64748b", marginTop: 2 },
  issueDate: { fontSize: 10, color: "#94a3b8", marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b", flex: 1, marginRight: 8 },

  typeRow: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  typeBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  typeBtnActive: { backgroundColor: "#ede9fe", borderColor: "#7c3aed" },
  typeBtnTxt: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  typeBtnTxtActive: { color: "#7c3aed" },

  condRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  condBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    alignItems: "center", gap: 4,
  },
  condBtnTxt: { fontSize: 12, fontWeight: "600" },

  notesInput: {
    backgroundColor: "#f8fafc", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#e2e8f0", fontSize: 13,
    minHeight: 60, textAlignVertical: "top", marginBottom: 14,
  },
  saveBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    backgroundColor: "#7c3aed", padding: 14, borderRadius: 12,
  },
  saveBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },

  histRow: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  histEmail: { fontSize: 13, fontWeight: "600", color: "#1e293b" },
  histDate: { fontSize: 11, color: "#64748b", marginTop: 2 },
  emptyTxt: { color: "#94a3b8", fontSize: 13, textAlign: "center", marginVertical: 20 },
});
