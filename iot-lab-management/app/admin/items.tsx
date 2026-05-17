import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  RefreshControl, Image, Modal, Dimensions, StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

const { width: SW, height: SH } = Dimensions.get("window");

const STATUS_CFG: { [k: string]: { label: string; color: string; bg: string } } = {
  available: { label: "ว่าง",   color: "#16a34a", bg: "#dcfce7" },
  borrowed:  { label: "ถูกยืม", color: "#b45309", bg: "#fef3c7" },
  repair:    { label: "ซ่อม",   color: "#dc2626", bg: "#fee2e2" },
};

function ItemCard({ item, cfg, onDelete, onPressImage, onChangeStatus }: {
  item: any; cfg: any;
  onDelete: (i: any) => void;
  onPressImage: (url: string) => void;
  onChangeStatus: (i: any) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const showIcon = !item.image_url || imgError;
  return (
    <View style={s.card}>
      {showIcon ? (
        <View style={s.itemIconBox}>
          <Ionicons name="cube-outline" size={24} color="#0ea5e9" />
        </View>
      ) : (
        <TouchableOpacity onPress={() => onPressImage(item.image_url)} activeOpacity={0.85}>
          <Image
            source={{ uri: item.image_url }}
            style={s.itemImg}
            onError={() => setImgError(true)}
          />
        </TouchableOpacity>
      )}
      <View style={{ flex: 1 }}>
        <View style={s.cardTopRow}>
          <Text style={s.cardName} numberOfLines={1}>{item.name}</Text>
          <TouchableOpacity
            style={[s.badge, { backgroundColor: cfg.bg }]}
            onPress={() => onChangeStatus(item)}
          >
            <Text style={[s.badgeTxt, { color: cfg.color }]}>{cfg.label} ✎</Text>
          </TouchableOpacity>
        </View>
        {item.type ? <Text style={s.cardType}>{item.type}</Text> : null}
        {item.barcode ? (
          <View style={s.barcodeRow}>
            <Ionicons name="barcode-outline" size={12} color="#94a3b8" />
            <Text style={s.barcodeVal}>{item.barcode}</Text>
          </View>
        ) : (
          <Text style={s.noBarcodeHint}>ยังไม่มี barcode</Text>
        )}
      </View>
      <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(item)}>
        <Ionicons name="trash-outline" size={18} color="#dc2626" />
      </TouchableOpacity>
    </View>
  );
}

export default function AdminItems() {
  const router = useRouter();

  const [items, setItems]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]     = useState("");
  const [viewImg, setViewImg]   = useState<string | null>(null);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase.from("items").select("*").order("name");
    if (!error) setItems(data || []);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); fetchItems(); };

  const changeStatus = (item: any) => {
    const STATUS_OPTS = [
      { label: "✅ ว่าง",    value: "available" },
      { label: "🔧 ซ่อม",   value: "repair" },
    ];
    // ถ้ายืมอยู่ไม่ให้เปลี่ยนจากที่นี่
    if (item.status === "borrowed") {
      Alert.alert("เปลี่ยนไม่ได้", "อุปกรณ์นี้กำลังถูกยืมอยู่\nคืนของก่อนถึงจะเปลี่ยนสถานะได้");
      return;
    }
    Alert.alert(
      `เปลี่ยนสถานะ: ${item.name}`,
      `สถานะปัจจุบัน: ${item.status}`,
      [
        ...STATUS_OPTS.filter(o => o.value !== item.status).map(o => ({
          text: o.label,
          onPress: async () => {
            const { error } = await supabase.from("items").update({ status: o.value }).eq("id", item.id);
            if (error) { Alert.alert("เกิดข้อผิดพลาด", error.message); return; }
            fetchItems();
          },
        })),
        { text: "ยกเลิก", style: "cancel" as const },
      ]
    );
  };

  const deleteItem = (item: any) => {
    Alert.alert("ลบอุปกรณ์", `ลบ "${item.name}" ?`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ", style: "destructive",
        onPress: async () => {
          // ห้ามลบถ้ากำลังยืมอยู่
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
        <View style={{ width: 22 }} />
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
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0ea5e9" />}
        >
          {filtered.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={48} color="#cbd5e1" />
              <Text style={s.emptyTxt}>ไม่พบอุปกรณ์</Text>
            </View>
          )}

          {filtered.map(item => {
            const cfg = STATUS_CFG[item.status] || STATUS_CFG.available;
            return <ItemCard key={item.id} item={item} cfg={cfg} onDelete={deleteItem} onPressImage={setViewImg} onChangeStatus={changeStatus} />;
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
      {/* IMAGE VIEWER */}
      <Modal visible={!!viewImg} transparent animationType="fade" onRequestClose={() => setViewImg(null)}>
        <StatusBar hidden />
        <TouchableOpacity style={s.viewer} activeOpacity={1} onPress={() => setViewImg(null)}>
          <TouchableOpacity style={s.viewerClose} onPress={() => setViewImg(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {viewImg && (
            <Image
              source={{ uri: viewImg }}
              style={s.viewerImg}
              resizeMode="contain"
            />
          )}
          <Text style={s.viewerHint}>กดที่ไหนก็ได้เพื่อปิด</Text>
        </TouchableOpacity>
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

  viewer: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center", alignItems: "center",
  },
  viewerClose: {
    position: "absolute", top: 54, right: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20, padding: 8, zIndex: 10,
  },
  viewerImg: { width: SW, height: SH * 0.75 },
  viewerHint: { color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 16 },
});
