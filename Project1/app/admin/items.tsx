import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  Modal, RefreshControl, Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

const DEVICE_TYPES = [
  "Microcontroller", "SBC", "Sensor", "Actuator",
  "Module", "Kit", "Cable", "Other",
];

const STATUS_CFG: { [k: string]: { label: string; color: string; bg: string } } = {
  available: { label: "ว่าง",       color: "#16a34a", bg: "#dcfce7" },
  borrowed:  { label: "ถูกยืม",     color: "#b45309", bg: "#fef3c7" },
  repair:    { label: "ซ่อม",       color: "#dc2626", bg: "#fee2e2" },
};

export default function AdminItems() {
  const router = useRouter();

  const [items, setItems]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]     = useState("");

  // Add modal
  const [addModal, setAddModal] = useState(false);
  const [newName, setNewName]   = useState("");
  const [newBarcode, setNewBarcode] = useState("");
  const [newType, setNewType]   = useState("Microcontroller");
  const [newDesc, setNewDesc]   = useState("");
  const [adding, setAdding]     = useState(false);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("items").select("*").order("name");
    if (!error) setItems(data || []);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); fetchItems(); };

  // ── เพิ่ม item ──
  const addItem = async () => {
    if (!newName.trim()) { Alert.alert("กรอกชื่ออุปกรณ์ก่อน"); return; }
    setAdding(true);
    const { error } = await supabase.from("items").insert([{
      name:        newName.trim(),
      barcode:     newBarcode.trim() || null,
      type:        newType,
      description: newDesc.trim() || null,
      status:      "available",
    }]);
    setAdding(false);
    if (error) { Alert.alert("เพิ่มไม่สำเร็จ", error.message); return; }
    setAddModal(false);
    setNewName(""); setNewBarcode(""); setNewType("Microcontroller"); setNewDesc("");
    fetchItems();
  };

  // ── ลบ item ──
  const deleteItem = (item: any) => {
    Alert.alert("ลบอุปกรณ์", `ลบ "${item.name}" ?`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ", style: "destructive",
        onPress: async () => {
          const { data: active } = await supabase
            .from("borrow_records").select("id")
            .eq("item_id", item.id).eq("status", "borrowed");
          if (active && active.length > 0) {
            Alert.alert("ลบไม่ได้", "อุปกรณ์นี้ยังถูกยืมอยู่"); return;
          }
          const { error } = await supabase.from("items").delete().eq("id", item.id);
          if (error) { Alert.alert("ลบไม่สำเร็จ", error.message); return; }
          fetchItems();
        },
      },
    ]);
  };

  const filtered = items.filter(i =>
    i.name?.toLowerCase().includes(search.toLowerCase()) ||
    i.barcode?.toLowerCase().includes(search.toLowerCase()) ||
    i.type?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={s.container}>

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTxt}>จัดการอุปกรณ์</Text>
        <TouchableOpacity onPress={() => setAddModal(true)}>
          <Ionicons name="add-circle-outline" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* SEARCH */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput
          style={s.searchInput}
          placeholder="ค้นหาชื่อ, barcode, ประเภท..."
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* STATS ROW */}
      <View style={s.statsRow}>
        {Object.entries(STATUS_CFG).map(([key, cfg]) => {
          const count = items.filter(i => i.status === key).length;
          return (
            <View key={key} style={[s.statChip, { backgroundColor: cfg.bg }]}>
              <Text style={[s.statNum, { color: cfg.color }]}>{count}</Text>
              <Text style={[s.statLabel, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          );
        })}
        <View style={[s.statChip, { backgroundColor: "#eff6ff" }]}>
          <Text style={[s.statNum, { color: "#1d4ed8" }]}>{items.length}</Text>
          <Text style={[s.statLabel, { color: "#1d4ed8" }]}>ทั้งหมด</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0ea5e9" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ea5e9" />}>

          {filtered.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={48} color="#cbd5e1" />
              <Text style={s.emptyTxt}>ไม่พบอุปกรณ์</Text>
            </View>
          )}

          {filtered.map(item => {
            const cfg = STATUS_CFG[item.status] || STATUS_CFG.available;
            return (
              <View key={item.id} style={s.card}>
                {/* รูป / icon */}
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={s.itemImg} />
                ) : (
                  <View style={s.itemIconBox}>
                    <Ionicons name="cube-outline" size={24} color="#0ea5e9" />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <View style={s.cardTopRow}>
                    <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
                    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.badgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>

                  {item.type ? (
                    <Text style={s.cardType}>{item.type}</Text>
                  ) : null}

                  {item.barcode ? (
                    <View style={s.barcodeRow}>
                      <Ionicons name="barcode-outline" size={12} color="#94a3b8" />
                      <Text style={s.barcodeVal}>{item.barcode}</Text>
                    </View>
                  ) : (
                    <Text style={s.noBarcodeHint}>ยังไม่มี barcode</Text>
                  )}
                </View>

                <TouchableOpacity style={s.deleteBtn} onPress={() => deleteItem(item)}>
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ADD MODAL */}
      <Modal visible={addModal} transparent animationType="slide">
        <View style={s.overlay}>
          <ScrollView contentContainerStyle={s.modalBox} keyboardShouldPersistTaps="handled">
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>เพิ่มอุปกรณ์ใหม่</Text>
              <TouchableOpacity onPress={() => {
                setAddModal(false);
                setNewName(""); setNewBarcode(""); setNewType("Microcontroller"); setNewDesc("");
              }}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>ชื่ออุปกรณ์ *</Text>
            <TextInput
              style={s.input}
              placeholder="เช่น Arduino Uno, Raspberry Pi..."
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={s.fieldLabel}>Barcode (ถ้ามี)</Text>
            <TextInput
              style={s.input}
              placeholder="หมายเลข barcode บนอุปกรณ์"
              value={newBarcode}
              onChangeText={setNewBarcode}
              keyboardType="default"
            />

            <Text style={s.fieldLabel}>ประเภท</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {DEVICE_TYPES.map(t => (
                <TouchableOpacity key={t}
                  style={[s.typeBtn, newType === t && s.typeBtnActive]}
                  onPress={() => setNewType(t)}>
                  <Text style={[s.typeBtnTxt, newType === t && s.typeBtnTxtActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.fieldLabel}>รายละเอียด (ไม่บังคับ)</Text>
            <TextInput
              style={[s.input, { height: 80, textAlignVertical: "top" }]}
              placeholder="รายละเอียดเพิ่มเติม..."
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
            />

            <TouchableOpacity
              style={[s.addBtn, adding && { opacity: 0.6 }]}
              onPress={addItem} disabled={adding}>
              {adding
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.addBtnTxt}>เพิ่มอุปกรณ์</Text>
              }
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  header: {
    backgroundColor: "#0ea5e9", paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerTxt: { color: "#fff", fontSize: 17, fontWeight: "bold" },

  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", margin: 16, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1e293b" },

  statsRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  statChip: { flex: 1, borderRadius: 10, padding: 8, alignItems: "center" },
  statNum: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 9, fontWeight: "600", marginTop: 1 },

  list: { paddingHorizontal: 16 },

  card: {
    backgroundColor: "#fff", borderRadius: 14, padding: 12,
    flexDirection: "row", alignItems: "center", gap: 12,
    marginBottom: 10, borderWidth: 1, borderColor: "#e2e8f0",
  },
  itemImg: { width: 56, height: 56, borderRadius: 10 },
  itemIconBox: {
    width: 56, height: 56, borderRadius: 10,
    backgroundColor: "#f0f9ff", justifyContent: "center", alignItems: "center",
  },
  cardTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  cardName: { fontSize: 14, fontWeight: "700", color: "#1e293b", flex: 1 },
  cardType: { fontSize: 11, color: "#64748b", marginBottom: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  badgeTxt: { fontSize: 9, fontWeight: "700" },
  barcodeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  barcodeVal: { fontSize: 10, color: "#94a3b8", fontFamily: "monospace" },
  noBarcodeHint: { fontSize: 10, color: "#cbd5e1", fontStyle: "italic" },

  deleteBtn: { padding: 8 },

  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTxt: { color: "#94a3b8", fontSize: 14 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 0,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#1e293b" },

  fieldLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 10,
  },
  input: {
    backgroundColor: "#f8fafc", borderRadius: 12, padding: 13,
    fontSize: 14, borderWidth: 1, borderColor: "#e2e8f0",
  },

  typeBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  typeBtnActive: { backgroundColor: "#0ea5e9", borderColor: "#0ea5e9" },
  typeBtnTxt: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  typeBtnTxtActive: { color: "#fff" },

  addBtn: {
    backgroundColor: "#0ea5e9", padding: 16, borderRadius: 12,
    alignItems: "center", marginTop: 16,
  },
  addBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
