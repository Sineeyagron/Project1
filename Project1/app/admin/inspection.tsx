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

  type ConditionKey = "good" | "damaged" | "missing";
  type EquipState = { condition: ConditionKey; notes: string; existingId: string | null };

  // Modal: form บันทึก
  const [formModal, setFormModal] = useState(false);
  const [formStation, setFormStation] = useState<any>(null);
  const [formData, setFormData] = useState<Record<EquipType, EquipState>>({
    mouse:    { condition: "good", notes: "", existingId: null },
    keyboard: { condition: "good", notes: "", existingId: null },
    monitor:  { condition: "good", notes: "", existingId: null },
  });

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
      .in("station_id", stations.map(s => s.id))
      .order("created_at", { ascending: true });
    setInspections(data || []);
    setLoading(false);
  };

  const openForm = (station: any) => {
    setFormStation(station);
    // โหลดข้อมูลเดิมถ้าเคยตรวจแล้วในเทอมนี้
    const existing = inspections.filter(i => i.station_id === station.id);
    const init: Record<EquipType, EquipState> = {
      mouse:    { condition: "good", notes: "", existingId: null },
      keyboard: { condition: "good", notes: "", existingId: null },
      monitor:  { condition: "good", notes: "", existingId: null },
    };
    for (const rec of existing) {
      const t = rec.equipment_type as EquipType;
      if (init[t] !== undefined) {
        init[t] = { condition: rec.condition, notes: rec.notes || "", existingId: rec.id };
      }
    }
    setFormData(init);
    setFormModal(true);
  };

  const setEquipField = (type: EquipType, field: keyof EquipState, value: string) => {
    setFormData(prev => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  };

  const saveInspection = async () => {
    if (!term.trim()) { Alert.alert("กรุณาระบุเทอม"); return; }
    if (!formStation) return;

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    // ดึง record ที่มีอยู่จาก DB ตรงๆ ไม่พึ่ง state เพื่อป้องกัน insert ซ้ำ
    const { data: existing } = await supabase
      .from("equipment_inspections")
      .select("id, equipment_type")
      .eq("term", term.trim())
      .eq("station_id", formStation.id);

    const existingMap: Record<string, string> = {};
    for (const r of (existing || [])) {
      existingMap[r.equipment_type] = r.id;
    }

    let errorMsg: string | null = null;

    for (const t of EQUIP_TYPES) {
      const row = {
        term: term.trim(),
        station_id: formStation.id,
        inspector_id: user?.id || null,
        equipment_type: t,
        condition: formData[t].condition,
        notes: formData[t].notes.trim() || null,
      };
      const existingId = existingMap[t];
      const { error } = existingId
        ? await supabase.from("equipment_inspections").update(row).eq("id", existingId)
        : await supabase.from("equipment_inspections").insert([row]);
      if (error) { errorMsg = error.message; break; }
    }

    setSaving(false);

    if (errorMsg) { Alert.alert("เกิดข้อผิดพลาด", errorMsg); return; }

    Alert.alert("บันทึกสำเร็จ");
    setFormModal(false);
    fetchInspections(term);
  };

  // deduplicate เหลือแค่ 1 record ต่อ equipment_type (ล่าสุด) ต่อ station
  const getLatestPerType = (stationId: string) => {
    const recs = inspections.filter(i => i.station_id === stationId);
    const map: Record<string, any> = {};
    for (const r of recs) map[r.equipment_type] = r; // ล่าสุดทับก่อนหน้าเสมอ
    return Object.values(map);
  };

  const getStationInspCount = (stationId: string) => getLatestPerType(stationId).length;

  const getStationIssues = (stationId: string) =>
    getLatestPerType(stationId).filter(i => i.condition !== "good").length;

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
                    <TouchableOpacity
                      style={[st.inspBtn, count > 0 && { backgroundColor: "#0891b2" }]}
                      onPress={() => openForm(station)}
                    >
                      <Ionicons name={count > 0 ? "create-outline" : "clipboard-outline"} size={16} color="#fff" />
                      <Text style={st.inspBtnTxt}>{count > 0 ? "แก้ไข" : "ตรวจ"}</Text>
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
            {(() => {
              // last-wins: record หลังสุดของแต่ละ station+type ชนะเสมอ
              const map: Record<string, any> = {};
              for (const i of inspections) map[`${i.station_id}_${i.equipment_type}`] = i;
              return Object.values(map).filter(i => i.condition !== "good");
            })().map(i => {
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
          <ScrollView contentContainerStyle={st.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={st.modalBox}>
              <View style={st.modalHeader}>
                <Text style={st.modalTitle}>
                {EQUIP_TYPES.some(t => formData[t].existingId) ? "แก้ไขผลตรวจ" : "ตรวจสภาพ"} — {formStation?.name}
              </Text>
                <TouchableOpacity onPress={() => setFormModal(false)}>
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              {EQUIP_TYPES.map((t, idx) => {
                const cfg = CONDITION_CFG[formData[t].condition];
                return (
                  <View key={t} style={[st.equipBlock, idx < EQUIP_TYPES.length - 1 && st.equipBlockBorder]}>
                    <Text style={st.equipBlockTitle}>{EQUIP_LABELS[t]}</Text>
                    <View style={st.condRow}>
                      {(["good", "damaged", "missing"] as const).map(c => {
                        const ccfg = CONDITION_CFG[c];
                        const active = formData[t].condition === c;
                        return (
                          <TouchableOpacity
                            key={c}
                            style={[st.condBtn, { borderColor: ccfg.color }, active && { backgroundColor: ccfg.bg }]}
                            onPress={() => setEquipField(t, "condition", c)}
                          >
                            <Ionicons name={ccfg.icon} size={16} color={ccfg.color} />
                            <Text style={[st.condBtnTxt, { color: ccfg.color }]}>{ccfg.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {formData[t].condition !== "good" && (
                      <TextInput
                        style={st.notesInput}
                        placeholder="หมายเหตุ (ถ้ามี)..."
                        value={formData[t].notes}
                        onChangeText={v => setEquipField(t, "notes", v)}
                      />
                    )}
                  </View>
                );
              })}

              <TouchableOpacity
                style={[st.saveBtn, saving && { backgroundColor: "#94a3b8" }]}
                onPress={saveInspection}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#fff" />
                    <Text style={st.saveBtnTxt}>บันทึกทั้งหมด</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  modalScroll: { justifyContent: "flex-end", flexGrow: 1 },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b", flex: 1, marginRight: 8 },

  equipBlock: { paddingVertical: 12 },
  equipBlockBorder: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  equipBlockTitle: { fontSize: 14, fontWeight: "700", color: "#1e293b", marginBottom: 10 },

  condRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
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

  emptyTxt: { color: "#94a3b8", fontSize: 13, textAlign: "center", marginVertical: 20 },
});
