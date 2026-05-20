import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Modal, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

const STATUS_CONFIG: {
  [k: string]: { label: string; color: string; bg: string; icon: any; next: string };
} = {
  available: { label: "ว่าง",      color: "#16a34a", bg: "#dcfce7", icon: "checkmark-circle-outline", next: "repair"    },
  repair:    { label: "ซ่อม",      color: "#b45309", bg: "#fef3c7", icon: "construct-outline",         next: "broken"    },
  broken:    { label: "พัง",       color: "#dc2626", bg: "#fee2e2", icon: "close-circle-outline",      next: "available" },
};

type Station = {
  id: string;
  room_id: string;
  group_no: number;
  name: string;
  status: string;
};

export default function AdminStations() {
  const router = useRouter();

  const [stations, setStations]         = useState<Station[]>([]);
  const [rooms, setRooms]               = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<number>(1);
  const [groups, setGroups]             = useState<number[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [saving, setSaving]             = useState<string | null>(null);

  // Modal: Add Station
  const [addModal, setAddModal]   = useState(false);
  const [newName, setNewName]     = useState("");
  const [adding, setAdding]       = useState(false);

  // Modal: Edit Station
  const [editModal, setEditModal]       = useState(false);
  const [editTarget, setEditTarget]     = useState<Station | null>(null);
  const [editName, setEditName]         = useState("");
  const [editStatus, setEditStatus]     = useState("available");
  const [editGroup, setEditGroup]       = useState<number>(1);
  const [editSaving, setEditSaving]     = useState(false);

  useEffect(() => { fetchRooms(); }, []);
  useEffect(() => { if (selectedRoom) fetchGroups(); }, [selectedRoom]);
  useEffect(() => { if (selectedRoom) fetchStations(); }, [selectedRoom, selectedGroup]);

  // ── fetch rooms ──
  const fetchRooms = async () => {
    const { data } = await supabase.from("computer_stations").select("room_id");
    if (data && data.length > 0) {
      const unique = [...new Set(data.map((r: any) => r.room_id))] as string[];
      setRooms(unique);
      setSelectedRoom(unique[0]);
    } else {
      // fallback: seed known rooms
      setRooms(["CP9524", "SC9604"]);
      setSelectedRoom("CP9524");
    }
    setLoading(false);
  };

  // ── fetch groups for selected room ──
  const fetchGroups = async () => {
    const { data } = await supabase
      .from("computer_stations").select("group_no").eq("room_id", selectedRoom);
    if (data && data.length > 0) {
      const unique = [...new Set(data.map((r: any) => r.group_no))].sort() as number[];
      setGroups(unique);
      if (!unique.includes(selectedGroup)) setSelectedGroup(unique[0]);
    } else {
      setGroups([1, 2, 3, 4, 5, 6]);
    }
  };

  // ── fetch stations ──
  const fetchStations = async () => {
    const { data } = await supabase
      .from("computer_stations").select("*")
      .eq("room_id", selectedRoom)
      .eq("group_no", selectedGroup)
      .order("name");
    setStations((data as Station[]) || []);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); fetchStations(); };

  // ── toggle status ──
  const toggleStatus = (station: Station) => {
    const next = STATUS_CONFIG[station.status]?.next || "available";
    const nextCfg = STATUS_CONFIG[next];
    Alert.alert(
      "เปลี่ยนสถานะ",
      `${station.name}\n→ "${nextCfg.label}" ?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ยืนยัน",
          onPress: async () => {
            setSaving(station.id);
            const { error } = await supabase
              .from("computer_stations").update({ status: next }).eq("id", station.id);
            if (error) Alert.alert("เกิดข้อผิดพลาด", error.message);
            else setStations(prev =>
              prev.map(s => s.id === station.id ? { ...s, status: next } : s)
            );
            setSaving(null);
          },
        },
      ]
    );
  };

  // ── open edit modal ──
  const openEdit = (station: Station) => {
    setEditTarget(station);
    setEditName(station.name);
    setEditStatus(station.status);
    setEditGroup(station.group_no);
    setEditModal(true);
  };

  // ── save edit ──
  const saveEdit = async () => {
    if (!editTarget || !editName.trim()) {
      Alert.alert("กรอกชื่อก่อน"); return;
    }
    setEditSaving(true);
    const { error } = await supabase
      .from("computer_stations")
      .update({ name: editName.trim(), status: editStatus, group_no: editGroup })
      .eq("id", editTarget.id);
    setEditSaving(false);
    if (error) { Alert.alert("แก้ไขไม่สำเร็จ", error.message); return; }
    setEditModal(false);
    fetchStations();
    fetchGroups();
  };

  // ── delete station ──
  const deleteStation = (station: Station) => {
    Alert.alert("ลบเครื่อง", `ลบ "${station.name}" ?`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ", style: "destructive",
        onPress: async () => {
          await supabase.from("computer_stations").delete().eq("id", station.id);
          setStations(prev => prev.filter(s => s.id !== station.id));
        },
      },
    ]);
  };

  // ── add station ──
  const addStation = async () => {
    if (!newName.trim()) { Alert.alert("กรอกชื่อเครื่องก่อน"); return; }
    setAdding(true);
    const { error } = await supabase.from("computer_stations").insert([{
      room_id:  selectedRoom,
      group_no: selectedGroup,
      name:     newName.trim(),
      status:   "available",
    }]);
    setAdding(false);
    if (error) { Alert.alert("เพิ่มไม่สำเร็จ", error.message); return; }
    setAddModal(false);
    setNewName("");
    fetchStations();
  };

  // ── stats ──
  const avail  = stations.filter(s => s.status === "available").length;
  const repair = stations.filter(s => s.status === "repair").length;
  const broken = stations.filter(s => s.status === "broken").length;

  return (
    <View style={s.container}>

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTxt}>จัดการเครื่องคอม</Text>
        <TouchableOpacity onPress={() => setAddModal(true)}>
          <Ionicons name="add-circle-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ROOM SELECTOR */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.selScroll} contentContainerStyle={s.selRow}>
        {rooms.map(r => (
          <TouchableOpacity key={r}
            style={[s.selBtn, selectedRoom === r && s.selBtnActive]}
            onPress={() => setSelectedRoom(r)}>
            <Text style={[s.selTxt, selectedRoom === r && s.selTxtActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* GROUP SELECTOR */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.selScroll} contentContainerStyle={s.selRow}>
        {(groups.length > 0 ? groups : [1,2,3,4,5,6]).map(g => (
          <TouchableOpacity key={g}
            style={[s.grpBtn, selectedGroup === g && s.grpBtnActive]}
            onPress={() => setSelectedGroup(g)}>
            <Text style={[s.grpTxt, selectedGroup === g && s.grpTxtActive]}>กลุ่ม {g}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#dc2626" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#dc2626" />}>

          {/* สถิติ */}
          <View style={s.statsRow}>
            <View style={[s.statCard, { borderLeftColor: "#22c55e" }]}>
              <Text style={[s.statNum, { color: "#16a34a" }]}>{avail}</Text>
              <Text style={s.statLabel}>ว่าง</Text>
            </View>
            <View style={[s.statCard, { borderLeftColor: "#f59e0b" }]}>
              <Text style={[s.statNum, { color: "#b45309" }]}>{repair}</Text>
              <Text style={s.statLabel}>ซ่อม</Text>
            </View>
            <View style={[s.statCard, { borderLeftColor: "#ef4444" }]}>
              <Text style={[s.statNum, { color: "#dc2626" }]}>{broken}</Text>
              <Text style={s.statLabel}>พัง</Text>
            </View>
            <View style={[s.statCard, { borderLeftColor: "#64748b" }]}>
              <Text style={[s.statNum, { color: "#475569" }]}>{stations.length}</Text>
              <Text style={s.statLabel}>ทั้งหมด</Text>
            </View>
          </View>

          {/* คำใบ้ */}
          <View style={s.hint}>
            <Ionicons name="information-circle-outline" size={15} color="#dc2626" />
            <Text style={s.hintTxt}>กดเพื่อเปลี่ยนสถานะ · กดค้างเพื่อแก้ไข/ลบ</Text>
          </View>

          {/* STATION LIST */}
          {stations.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="desktop-outline" size={48} color="#cbd5e1" />
              <Text style={s.emptyTxt}>ยังไม่มีเครื่องในกลุ่มนี้</Text>
              <Text style={s.emptySub}>กด + เพื่อเพิ่มเครื่อง</Text>
            </View>
          ) : (
            <View style={s.grid}>
              {stations.map(station => {
                const cfg = STATUS_CONFIG[station.status] || STATUS_CONFIG.available;
                const isSaving = saving === station.id;
                return (
                  <TouchableOpacity
                    key={station.id}
                    style={[s.card, { backgroundColor: cfg.bg, borderColor: cfg.color + "50" }]}
                    onPress={() => !isSaving && toggleStatus(station)}
                    onLongPress={() => openEdit(station)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color={cfg.color} />
                    ) : (
                      <Ionicons name="desktop-outline" size={22} color={cfg.color} />
                    )}
                    <Text style={[s.cardName, { color: cfg.color }]} numberOfLines={1}>
                      {station.name}
                    </Text>
                    <View style={[s.badge, { backgroundColor: cfg.color + "22" }]}>
                      <Ionicons name={cfg.icon} size={10} color={cfg.color} />
                      <Text style={[s.badgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── ADD MODAL ── */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>เพิ่มเครื่องคอม</Text>
              <TouchableOpacity onPress={() => { setAddModal(false); setNewName(""); }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={s.modalSub}>ห้อง {selectedRoom} · กลุ่ม {selectedGroup}</Text>

            <Text style={s.fieldLabel}>ชื่อเครื่อง *</Text>
            <TextInput
              style={s.input}
              placeholder="เช่น PC-01, COM-A1..."
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: "#dc2626" }, adding && { opacity: 0.6 }]}
              onPress={addStation} disabled={adding}>
              {adding
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.actionBtnTxt}>เพิ่มเครื่อง</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── EDIT MODAL ── */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>แก้ไขเครื่องคอม</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>ชื่อเครื่อง *</Text>
            <TextInput
              style={s.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="ชื่อเครื่อง"
            />

            <Text style={s.fieldLabel}>กลุ่ม</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {[1,2,3,4,5,6].map(g => (
                <TouchableOpacity key={g}
                  style={[s.grpBtn, editGroup === g && s.grpBtnActive, { marginLeft: 0 }]}
                  onPress={() => setEditGroup(g)}>
                  <Text style={[s.grpTxt, editGroup === g && s.grpTxtActive]}>กลุ่ม {g}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>สถานะ</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <TouchableOpacity key={key}
                  style={[
                    s.statusPill,
                    { borderColor: cfg.color },
                    editStatus === key && { backgroundColor: cfg.color },
                  ]}
                  onPress={() => setEditStatus(key)}>
                  <Text style={[s.statusPillTxt, { color: editStatus === key ? "#fff" : cfg.color }]}>
                    {cfg.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[s.actionBtn, { flex: 1, backgroundColor: "#dc2626" }, editSaving && { opacity: 0.6 }]}
                onPress={saveEdit} disabled={editSaving}>
                {editSaving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.actionBtnTxt}>บันทึก</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { flex: 1, backgroundColor: "#fee2e2" }]}
                onPress={() => { setEditModal(false); deleteStation(editTarget!); }}>
                <Text style={[s.actionBtnTxt, { color: "#dc2626" }]}>ลบเครื่อง</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  header: {
    backgroundColor: "#dc2626", paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerTxt: { color: "#fff", fontSize: 17, fontWeight: "bold" },

  selScroll: { maxHeight: 52 },
  selRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  selBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10, backgroundColor: "#e2e8f0" },
  selBtnActive: { backgroundColor: "#dc2626" },
  selTxt: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  selTxtActive: { color: "#fff" },

  grpBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  grpBtnActive: { backgroundColor: "#1e3a8a", bordercolor: "#1e3a8a" },
  grpTxt: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  grpTxtActive: { color: "#fff" },

  scroll: { padding: 16 },

  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 10, borderLeftWidth: 4, alignItems: "center" },
  statNum: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 10, color: "#94a3b8", marginTop: 2 },

  hint: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff5f5", padding: 10, borderRadius: 10, marginBottom: 12,
  },
  hintTxt: { fontSize: 11, color: "#dc2626" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  card: {
    width: "30%", borderRadius: 14, padding: 12,
    alignItems: "center", gap: 6, borderWidth: 1.5,
  },
  cardName: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  badge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20 },
  badgeTxt: { fontSize: 9, fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTxt: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  emptySub: { color: "#cbd5e1", fontSize: 12 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#1e293b" },
  modalSub: { fontSize: 12, color: "#64748b", marginBottom: 14 },

  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: "#f8fafc", borderRadius: 12, padding: 13, fontSize: 14, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 4 },

  statusPill: { flex: 1, borderWidth: 1.5, borderRadius: 20, padding: 8, alignItems: "center" },
  statusPillTxt: { fontSize: 12, fontWeight: "700" },

  actionBtn: { padding: 16, borderRadius: 12, alignItems: "center", marginTop: 4 },
  actionBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
