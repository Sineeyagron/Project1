import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Modal, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

const STATUS_CONFIG: { [k: string]: { label: string; color: string; bg: string; icon: any; next: string } } = {
  available: { label: "ใช้งานได้", color: "#16a34a", bg: "#dcfce7", icon: "checkmark-circle-outline", next: "repair" },
  repair:    { label: "กำลังซ่อม", color: "#b45309", bg: "#fef3c7", icon: "construct-outline",         next: "broken" },
  broken:    { label: "เสีย",       color: "#dc2626", bg: "#fee2e2", icon: "close-circle-outline",      next: "available" },
};

export default function AdminLanPorts() {
  const router = useRouter();

  const [ports, setPorts]           = useState<any[]>([]);
  const [rooms, setRooms]           = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<number>(1);
  const [groups, setGroups]         = useState<number[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving]         = useState<string | null>(null);

  // Modal เพิ่ม port
  const [addModal, setAddModal]   = useState(false);
  const [newPortNo, setNewPortNo] = useState("");
  const [newLabel, setNewLabel]   = useState("");
  const [adding, setAdding]       = useState(false);

  useEffect(() => { fetchRooms(); }, []);
  useEffect(() => { if (selectedRoom) fetchGroups(); }, [selectedRoom]);
  useEffect(() => { if (selectedRoom) fetchPorts(); }, [selectedRoom, selectedGroup]);

  const fetchRooms = async () => {
    const { data } = await supabase.from("lan_ports").select("room_id");
    if (data) {
      const unique = [...new Set(data.map((r: any) => r.room_id))] as string[];
      setRooms(unique);
      if (unique.length > 0) setSelectedRoom(unique[0]);
    }
    setLoading(false);
  };

  const fetchGroups = async () => {
    const { data } = await supabase
      .from("lan_ports").select("group_no").eq("room_id", selectedRoom);
    if (data) {
      const unique = [...new Set(data.map((r: any) => r.group_no))].sort() as number[];
      setGroups(unique);
      if (unique.length > 0 && !unique.includes(selectedGroup)) setSelectedGroup(unique[0]);
    }
  };

  const fetchPorts = async () => {
    const { data } = await supabase
      .from("lan_ports").select("*")
      .eq("room_id", selectedRoom)
      .eq("group_no", selectedGroup)
      .order("port_no");
    setPorts(data || []);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); fetchPorts(); };

  // กดเปลี่ยนสถานะ (วนซ้ำ)
  const toggleStatus = (port: any) => {
    const next = STATUS_CONFIG[port.status]?.next || "available";
    const nextCfg = STATUS_CONFIG[next];
    Alert.alert(
      "เปลี่ยนสถานะ",
      `Port ${port.port_no}${port.label ? ` (${port.label})` : ""}\n→ "${nextCfg.label}" ?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ยืนยัน",
          onPress: async () => {
            setSaving(port.id);
            const { error } = await supabase
              .from("lan_ports").update({ status: next }).eq("id", port.id);
            if (error) Alert.alert("เกิดข้อผิดพลาด", error.message);
            else setPorts(prev => prev.map(p => p.id === port.id ? { ...p, status: next } : p));
            setSaving(null);
          },
        },
      ]
    );
  };

  // กดค้างเพื่อลบ
  const deletePort = (port: any) => {
    Alert.alert("ลบ Port", `ลบ Port ${port.port_no} ?`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ", style: "destructive",
        onPress: async () => {
          await supabase.from("lan_ports").delete().eq("id", port.id);
          setPorts(prev => prev.filter(p => p.id !== port.id));
        },
      },
    ]);
  };

  // เพิ่ม port ใหม่
  const addPort = async () => {
    if (!newPortNo.trim()) { Alert.alert("กรอกหมายเลข Port ก่อน"); return; }
    setAdding(true);
    const { error } = await supabase.from("lan_ports").insert([{
      room_id: selectedRoom,
      group_no: selectedGroup,
      port_no: parseInt(newPortNo) || 0,
      label: newLabel.trim() || null,
      status: "available",
    }]);
    setAdding(false);
    if (error) { Alert.alert("เพิ่มไม่สำเร็จ", error.message); return; }
    setAddModal(false);
    setNewPortNo(""); setNewLabel("");
    fetchPorts();
  };

  const available = ports.filter(p => p.status === "available").length;
  const repair    = ports.filter(p => p.status === "repair").length;
  const broken    = ports.filter(p => p.status === "broken").length;

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>จัดการ LAN Port</Text>
        <TouchableOpacity onPress={() => setAddModal(true)}>
          <Ionicons name="add-circle-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ROOM SELECTOR */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.selectorScroll} contentContainerStyle={styles.selectorRow}>
        {rooms.map(r => (
          <TouchableOpacity key={r}
            style={[styles.selectorBtn, selectedRoom === r && styles.selectorBtnActive]}
            onPress={() => setSelectedRoom(r)}>
            <Text style={[styles.selectorTxt, selectedRoom === r && styles.selectorTxtActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* GROUP SELECTOR */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.selectorScroll} contentContainerStyle={styles.selectorRow}>
        {groups.map(g => (
          <TouchableOpacity key={g}
            style={[styles.groupBtn, selectedGroup === g && styles.groupBtnActive]}
            onPress={() => setSelectedGroup(g)}>
            <Text style={[styles.groupBtnTxt, selectedGroup === g && styles.groupBtnTxtActive]}>
              กลุ่ม {g}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}>

          {/* สถิติ */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderLeftColor: "#22c55e" }]}>
              <Text style={[styles.statNum, { color: "#16a34a" }]}>{available}</Text>
              <Text style={styles.statLabel}>ใช้งานได้</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#f59e0b" }]}>
              <Text style={[styles.statNum, { color: "#b45309" }]}>{repair}</Text>
              <Text style={styles.statLabel}>ซ่อม</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: "#ef4444" }]}>
              <Text style={[styles.statNum, { color: "#dc2626" }]}>{broken}</Text>
              <Text style={styles.statLabel}>เสีย</Text>
            </View>
          </View>

          {/* คำใบ้ */}
          <View style={styles.hint}>
            <Ionicons name="information-circle-outline" size={15} color="#1d4ed8" />
            <Text style={styles.hintTxt}>กดเพื่อเปลี่ยนสถานะ · กดค้างเพื่อลบ</Text>
          </View>

          {/* PORT GRID */}
          <View style={styles.portGrid}>
            {ports.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="server-outline" size={40} color="#cbd5e1" />
                <Text style={styles.emptyTxt}>ยังไม่มี Port กด + เพื่อเพิ่ม</Text>
              </View>
            ) : (
              ports.map(port => {
                const cfg = STATUS_CONFIG[port.status] || STATUS_CONFIG.available;
                const isSaving = saving === port.id;
                return (
                  <TouchableOpacity
                    key={port.id}
                    style={[styles.portCell, { backgroundColor: cfg.bg, borderColor: cfg.color + "50" }]}
                    onPress={() => !isSaving && toggleStatus(port)}
                    onLongPress={() => deletePort(port)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator size="small" color={cfg.color} />
                    ) : (
                      <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                    )}
                    <Text style={[styles.portNo, { color: cfg.color }]}>Port {port.port_no}</Text>
                    <View style={[styles.portBadge, { backgroundColor: cfg.color + "20" }]}>
                      <Text style={[styles.portBadgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    {port.label ? (
                      <Text style={styles.portLabel} numberOfLines={1}>{port.label}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ADD MODAL */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>เพิ่ม Port ใหม่</Text>
              <TouchableOpacity onPress={() => setAddModal(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>ห้อง {selectedRoom} · กลุ่ม {selectedGroup}</Text>

            <Text style={styles.fieldLabel}>หมายเลข Port *</Text>
            <TextInput
              style={styles.input}
              placeholder="เช่น 1, 2, 3..."
              keyboardType="numeric"
              value={newPortNo}
              onChangeText={setNewPortNo}
            />

            <Text style={styles.fieldLabel}>Label (ไม่บังคับ)</Text>
            <TextInput
              style={styles.input}
              placeholder="เช่น SWITCH L3, Firewall..."
              value={newLabel}
              onChangeText={setNewLabel}
            />

            <TouchableOpacity
              style={[styles.addBtn, adding && { opacity: 0.6 }]}
              onPress={addPort} disabled={adding}>
              {adding
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.addBtnTxt}>เพิ่ม Port</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    backgroundColor: "#1e3a8a", paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerText: { color: "#fff", fontSize: 17, fontWeight: "bold" },

  selectorScroll: { maxHeight: 52 },
  selectorRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  selectorBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10, backgroundColor: "#e2e8f0" },
  selectorBtnActive: { backgroundColor: "#1e3a8a" },
  selectorTxt: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  selectorTxtActive: { color: "#fff" },

  groupBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  groupBtnActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  groupBtnTxt: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  groupBtnTxtActive: { color: "#fff" },

  scroll: { padding: 16 },

  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 12, borderLeftWidth: 4, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 10, color: "#94a3b8", marginTop: 2 },

  hint: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eff6ff", padding: 10, borderRadius: 10, marginBottom: 12 },
  hintTxt: { fontSize: 11, color: "#1d4ed8" },

  portGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  portCell: {
    width: "30%", borderRadius: 12, padding: 10,
    alignItems: "center", gap: 4, borderWidth: 1.5,
  },
  portNo: { fontSize: 12, fontWeight: "700" },
  portBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  portBadgeTxt: { fontSize: 9, fontWeight: "700" },
  portLabel: { fontSize: 8, color: "#94a3b8", textAlign: "center" },

  empty: { width: "100%", alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyTxt: { color: "#94a3b8", fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#1e293b" },
  modalSub: { fontSize: 12, color: "#64748b", marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: "#f8fafc", borderRadius: 12, padding: 13, fontSize: 14, borderWidth: 1, borderColor: "#e2e8f0" },
  addBtn: { backgroundColor: "#1e3a8a", padding: 16, borderRadius: 12, alignItems: "center", marginTop: 16 },
  addBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
