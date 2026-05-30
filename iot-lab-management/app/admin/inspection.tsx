import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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

const DEFAULT_ROOM = "CP9524";
const DEFAULT_TERM = "1/2568";
const EQUIP_TYPES = ["mouse", "keyboard", "monitor"] as const;
type EquipType = (typeof EQUIP_TYPES)[number];
type ConditionKey = "good" | "damaged" | "missing";
type EquipState = { condition: ConditionKey; notes: string; existingId: string | null };

const EQUIP_LABELS: Record<EquipType, string> = {
  mouse: "เมาส์",
  keyboard: "คีย์บอร์ด",
  monitor: "จอภาพ",
};

const CONDITION_CFG: Record<
  ConditionKey,
  { color: string; bg: string; soft: string; label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  good: { color: "#10b981", bg: "#ecfdf5", soft: "#d1fae5", label: "ปกติ", icon: "checkmark" },
  damaged: { color: "#ef4444", bg: "#fff1f2", soft: "#fee2e2", label: "ชำรุด", icon: "warning-outline" },
  missing: { color: "#ef4444", bg: "#fff1f2", soft: "#fee2e2", label: "หาย", icon: "warning-outline" },
};

const emptyForm: Record<EquipType, EquipState> = {
  mouse: { condition: "good", notes: "", existingId: null },
  keyboard: { condition: "good", notes: "", existingId: null },
  monitor: { condition: "good", notes: "", existingId: null },
};

function stationNumber(name?: string) {
  const match = String(name || "").match(/\d+/);
  return match ? Number(match[0]) : 9999;
}

function latestPerType(rows: any[]) {
  const map: Record<string, any> = {};
  for (const row of rows) map[row.equipment_type] = row;
  return Object.values(map);
}

function formatProblem(record?: any) {
  if (!record) return "พบปัญหา";
  if (record.notes) return record.notes;
  return CONDITION_CFG[record.condition as ConditionKey]?.label || "พบปัญหา";
}

export default function InspectionPage() {
  const router = useRouter();
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [rooms, setRooms] = useState<string[]>([DEFAULT_ROOM]);
  const [selectedRoom, setSelectedRoom] = useState(DEFAULT_ROOM);
  const [stations, setStations] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formModal, setFormModal] = useState(false);
  const [formStation, setFormStation] = useState<any>(null);
  const [formData, setFormData] = useState<Record<EquipType, EquipState>>(emptyForm);

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    fetchData(term, selectedRoom);
  }, [selectedRoom]);

  const fetchRooms = async () => {
    const { data } = await supabase.from("computer_stations").select("room_id");
    const uniqueRooms = Array.from(new Set((data || []).map((row) => row.room_id).filter(Boolean))).sort();
    if (uniqueRooms.length > 0) {
      setRooms(uniqueRooms);
      if (!uniqueRooms.includes(selectedRoom)) setSelectedRoom(uniqueRooms[0]);
    } else {
      setRooms([DEFAULT_ROOM]);
    }
  };

  const fetchData = async (termValue = term, roomValue = selectedRoom) => {
    setLoading(true);
    const { data: stationRows, error: stationError } = await supabase
      .from("computer_stations")
      .select("*")
      .eq("room_id", roomValue)
      .order("group_no")
      .order("name");

    if (stationError) {
      setLoading(false);
      Alert.alert("โหลดข้อมูลไม่สำเร็จ", stationError.message);
      return;
    }

    const ids = (stationRows || []).map((station) => station.id);
    let inspectionRows: any[] = [];
    if (ids.length > 0 && termValue.trim()) {
      const { data, error } = await supabase
        .from("equipment_inspections")
        .select("*")
        .eq("term", termValue.trim())
        .in("station_id", ids)
        .order("created_at", { ascending: true });
      if (error) Alert.alert("โหลดผลตรวจไม่สำเร็จ", error.message);
      inspectionRows = data || [];
    }

    setStations(stationRows || []);
    setInspections(inspectionRows);
    setLoading(false);
  };

  const recordsByStation = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const row of inspections) {
      if (!map[row.station_id]) map[row.station_id] = [];
      map[row.station_id].push(row);
    }
    return map;
  }, [inspections]);

  const getStationState = (stationId: string) => {
    const latest = latestPerType(recordsByStation[stationId] || []);
    if (latest.length === 0) return { state: "pending" as const, count: 0, issue: null as any };
    const issue = latest.find((row) => row.condition !== "good");
    if (issue) return { state: "issue" as const, count: latest.length, issue };
    return { state: "good" as const, count: latest.length, issue: null as any };
  };

  const grouped = useMemo(() => {
    const groupMap: Record<number, any[]> = {};
    for (const station of stations) {
      const key = Number(station.group_no || 0);
      if (!groupMap[key]) groupMap[key] = [];
      groupMap[key].push(station);
    }
    return Object.entries(groupMap)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([groupNo, rows]) => ({
        groupNo,
        rows: rows.sort((a, b) => stationNumber(a.name) - stationNumber(b.name)),
      }));
  }, [stations]);

  const checkedCount = useMemo(
    () => stations.filter((station) => getStationState(station.id).state !== "pending").length,
    [stations, recordsByStation],
  );
  const progress = stations.length ? checkedCount / stations.length : 0;

  const openForm = (station: any) => {
    const existing = latestPerType(recordsByStation[station.id] || []);
    const next: Record<EquipType, EquipState> = {
      mouse: { ...emptyForm.mouse },
      keyboard: { ...emptyForm.keyboard },
      monitor: { ...emptyForm.monitor },
    };

    for (const record of existing) {
      const type = record.equipment_type as EquipType;
      if (next[type]) {
        next[type] = {
          condition: record.condition || "good",
          notes: record.notes || "",
          existingId: record.id,
        };
      }
    }

    setFormStation(station);
    setFormData(next);
    setFormModal(true);
  };

  const setEquipField = (type: EquipType, field: keyof EquipState, value: string) => {
    setFormData((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  };

  const markAllGood = () => {
    setFormData({
      mouse: { ...formData.mouse, condition: "good", notes: "" },
      keyboard: { ...formData.keyboard, condition: "good", notes: "" },
      monitor: { ...formData.monitor, condition: "good", notes: "" },
    });
  };

  const saveInspection = async () => {
    if (!term.trim()) {
      Alert.alert("กรุณาระบุเทอม");
      return;
    }
    if (!formStation) return;

    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: existing } = await supabase
      .from("equipment_inspections")
      .select("id, equipment_type")
      .eq("term", term.trim())
      .eq("station_id", formStation.id);

    const existingMap: Record<string, string> = {};
    for (const row of existing || []) existingMap[row.equipment_type] = row.id;

    let errorMsg: string | null = null;
    for (const type of EQUIP_TYPES) {
      const row = {
        term: term.trim(),
        station_id: formStation.id,
        inspector_id: user?.id || null,
        equipment_type: type,
        condition: formData[type].condition,
        notes: formData[type].notes.trim() || null,
      };
      const existingId = existingMap[type];
      const { error } = existingId
        ? await supabase.from("equipment_inspections").update(row).eq("id", existingId)
        : await supabase.from("equipment_inspections").insert([row]);

      if (error) {
        errorMsg = error.message;
        break;
      }
    }

    setSaving(false);
    if (errorMsg) {
      Alert.alert("บันทึกไม่สำเร็จ", errorMsg);
      return;
    }

    setFormModal(false);
    await fetchData(term, selectedRoom);
  };

  const renderStationCard = (station: any) => {
    const status = getStationState(station.id);
    const isGood = status.state === "good";
    const isIssue = status.state === "issue";
    const cfg = isGood ? CONDITION_CFG.good : isIssue ? CONDITION_CFG.damaged : null;

    return (
      <TouchableOpacity
        key={station.id}
        style={[
          st.stationCard,
          isGood && st.stationCardGood,
          isIssue && st.stationCardIssue,
        ]}
        activeOpacity={0.86}
        onPress={() => openForm(station)}
      >
        <View style={[st.cornerIcon, cfg ? { backgroundColor: cfg.soft } : st.cornerIconMuted]}>
          <Ionicons
            name={cfg ? cfg.icon : "clipboard-outline"}
            size={15}
            color={cfg ? cfg.color : "#94a3b8"}
          />
        </View>

        <Text style={st.stationName}>{station.name}</Text>
        <Text
          style={[
            st.stationStatus,
            isGood && { color: "#059669" },
            isIssue && { color: "#ef4444" },
          ]}
          numberOfLines={1}
        >
          {isGood
            ? "ตรวจแล้ว · ปกติ"
            : isIssue
              ? `พบปัญหา · ${formatProblem(status.issue)}`
              : "ยังไม่ได้ตรวจ"}
        </Text>

        <View style={st.cardButton}>
          <Ionicons
            name={isGood ? "checkmark" : isIssue ? "construct-outline" : "clipboard-outline"}
            size={14}
            color="#111827"
          />
          <Text style={st.cardButtonText}>{isGood ? "ตรวจแล้ว" : isIssue ? "มีปัญหา" : "ตรวจ"}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={st.container}>
      <View style={st.header}>
        <View style={st.topBar}>
          <TouchableOpacity style={st.backBtn} onPress={() => router.replace("/admin/home")} activeOpacity={0.82}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={st.headerTitle}>ตรวจสภาพอุปกรณ์</Text>
          <TouchableOpacity style={st.backBtn} onPress={() => fetchData(term, selectedRoom)} activeOpacity={0.82}>
            <Ionicons name="refresh" size={19} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={st.termRow}>
          <TextInput
            style={st.termInput}
            value={term}
            onChangeText={setTerm}
            placeholder="1/2568"
            placeholderTextColor="#94a3b8"
            returnKeyType="search"
            onSubmitEditing={() => fetchData(term, selectedRoom)}
          />
          <TouchableOpacity style={st.searchBtn} onPress={() => fetchData(term, selectedRoom)} activeOpacity={0.84}>
            <Ionicons name="search" size={19} color="#111827" />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.roomTabs}
        >
          {rooms.map((room) => {
            const active = selectedRoom === room;
            return (
              <TouchableOpacity
                key={room}
                style={[st.roomTab, active && st.roomTabActive]}
                onPress={() => setSelectedRoom(room)}
                activeOpacity={0.84}
              >
                <Ionicons name="business-outline" size={14} color={active ? "#fff" : "#6d28d9"} />
                <Text style={[st.roomTabText, active && st.roomTabTextActive]}>{room}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={st.progressMeta}>
          <Text style={st.progressLabel}>ความคืบหน้าการตรวจ</Text>
          <Text style={st.progressCount}>
            {checkedCount} / {stations.length} เครื่อง
          </Text>
        </View>
        <View style={st.progressTrack}>
          <View style={[st.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
        {loading ? <ActivityIndicator color="#7c3aed" style={{ marginTop: 24 }} /> : null}

        {!loading && stations.length === 0 ? (
          <Text style={st.emptyText}>ยังไม่มีเครื่องคอมพิวเตอร์ในห้อง {selectedRoom}</Text>
        ) : null}

        {!loading &&
          grouped.map((group) => (
            <View key={group.groupNo} style={st.groupSection}>
              <View style={st.groupHeader}>
                <Text style={st.groupTitle}>กลุ่มที่ {group.groupNo}</Text>
                <View style={st.groupPill}>
                  <Text style={st.groupPillText}>{group.rows.length} เครื่อง</Text>
                </View>
              </View>
              <View style={st.cardGrid}>{group.rows.map(renderStationCard)}</View>
            </View>
          ))}

        <View style={{ height: 28 }} />
      </ScrollView>

      <Modal visible={formModal} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <ScrollView contentContainerStyle={st.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={st.modalBox}>
              <View style={st.modalHeader}>
                <View>
                  <Text style={st.modalTitle}>{formStation?.name}</Text>
                  <Text style={st.modalSubtitle}>บันทึกผลตรวจเทอม {term || DEFAULT_TERM}</Text>
                </View>
                <TouchableOpacity style={st.closeBtn} onPress={() => setFormModal(false)}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={st.quickGoodBtn} onPress={markAllGood} activeOpacity={0.86}>
                <Ionicons name="checkmark-circle" size={18} color="#059669" />
                <Text style={st.quickGoodText}>ตรวจแล้ว · ปกติทั้งหมด</Text>
              </TouchableOpacity>

              {EQUIP_TYPES.map((type) => {
                const cfg = CONDITION_CFG[formData[type].condition];
                return (
                  <View key={type} style={st.equipBlock}>
                    <View style={st.equipHeader}>
                      <Text style={st.equipTitle}>{EQUIP_LABELS[type]}</Text>
                      <View style={[st.statusChip, { backgroundColor: cfg.soft }]}>
                        <Text style={[st.statusChipText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>
                    <View style={st.condRow}>
                      {(["good", "damaged", "missing"] as const).map((condition) => {
                        const conditionCfg = CONDITION_CFG[condition];
                        const active = formData[type].condition === condition;
                        return (
                          <TouchableOpacity
                            key={condition}
                            style={[
                              st.condBtn,
                              active && {
                                borderColor: conditionCfg.color,
                                backgroundColor: conditionCfg.bg,
                              },
                            ]}
                            onPress={() => setEquipField(type, "condition", condition)}
                            activeOpacity={0.82}
                          >
                            <Ionicons name={conditionCfg.icon} size={15} color={conditionCfg.color} />
                            <Text style={[st.condBtnText, active && { color: conditionCfg.color }]}>
                              {conditionCfg.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {formData[type].condition !== "good" ? (
                      <TextInput
                        style={st.notesInput}
                        value={formData[type].notes}
                        onChangeText={(value) => setEquipField(type, "notes", value)}
                        placeholder="ระบุปัญหา เช่น จอไม่ติด"
                        placeholderTextColor="#94a3b8"
                      />
                    ) : null}
                  </View>
                );
              })}

              <TouchableOpacity
                style={[st.saveBtn, saving && { opacity: 0.65 }]}
                onPress={saveInspection}
                disabled={saving}
                activeOpacity={0.86}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={18} color="#fff" />
                    <Text style={st.saveBtnText}>บันทึกผลตรวจ</Text>
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
  container: { flex: 1, backgroundColor: "#eef2f8" },
  header: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 16,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
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
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
  termRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 5,
    height: 31,
    overflow: "hidden",
    marginBottom: 11,
  },
  termInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 11,
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },
  searchBtn: {
    width: 38,
    height: "100%",
    borderLeftWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  roomTabs: {
    gap: 8,
    paddingBottom: 12,
    paddingTop: 1,
  },
  roomTab: {
    minWidth: 86,
    height: 32,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#d8b4fe",
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    shadowColor: "#4c1d95",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  roomTabActive: {
    backgroundColor: "#5b21b6",
    borderColor: "#fff",
  },
  roomTabText: {
    color: "#5b21b6",
    fontSize: 12,
    fontWeight: "900",
  },
  roomTabTextActive: {
    color: "#fff",
  },
  progressMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  progressLabel: { color: "#ddd6fe", fontSize: 11, fontWeight: "800" },
  progressCount: { color: "#fff", fontSize: 11, fontWeight: "900" },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#10b981",
  },
  body: {
    paddingHorizontal: 25,
    paddingTop: 15,
  },
  emptyText: {
    marginTop: 24,
    color: "#64748b",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
  },
  groupSection: {
    marginBottom: 13,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  groupTitle: { color: "#374151", fontSize: 12, fontWeight: "800" },
  groupPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#ede9fe",
  },
  groupPillText: { color: "#6d28d9", fontSize: 11, fontWeight: "900" },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  stationCard: {
    width: "48.5%",
    minHeight: 109,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d7dce5",
    paddingHorizontal: 11,
    paddingTop: 13,
    paddingBottom: 10,
    shadowColor: "#64748b",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  stationCardGood: {
    borderColor: "#10b981",
    backgroundColor: "#f8fffc",
  },
  stationCardIssue: {
    borderColor: "#ef4444",
    backgroundColor: "#fffafa",
  },
  cornerIcon: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 27,
    height: 27,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cornerIconMuted: {
    backgroundColor: "#f1f5f9",
  },
  stationName: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 12,
    paddingRight: 28,
  },
  stationStatus: {
    color: "#374151",
    fontSize: 10,
    fontWeight: "800",
    minHeight: 14,
    marginBottom: 10,
  },
  cardButton: {
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#b9bec8",
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  cardButtonText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  modalScroll: { flexGrow: 1, justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: { color: "#111827", fontSize: 20, fontWeight: "900" },
  modalSubtitle: { color: "#64748b", fontSize: 12, fontWeight: "700", marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  quickGoodBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginBottom: 12,
  },
  quickGoodText: { color: "#059669", fontSize: 13, fontWeight: "900" },
  equipBlock: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  equipHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  equipTitle: { color: "#111827", fontSize: 14, fontWeight: "900" },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusChipText: { fontSize: 11, fontWeight: "900" },
  condRow: { flexDirection: "row", gap: 8 },
  condBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 4,
  },
  condBtnText: { color: "#64748b", fontSize: 11, fontWeight: "900" },
  notesInput: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    marginTop: 10,
    paddingHorizontal: 12,
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
  saveBtn: {
    height: 48,
    borderRadius: 13,
    backgroundColor: "#7c3aed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 4,
    shadowColor: "#6d28d9",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
