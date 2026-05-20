import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  available: { label: "ว่าง", color: "#16a34a", bg: "#dcfce7", border: "#22c55e" },
  borrowed: { label: "ถูกยืม", color: "#dc2626", bg: "#fee2e2", border: "#f59e0b" },
  repair: { label: "ซ่อมบำรุง", color: "#b45309", bg: "#fef3c7", border: "#ef4444" },
};

const TYPE_CFG: Record<string, { icon: any; color: string; bg: string }> = {
  microcontroller: { icon: "hardware-chip-outline", color: "#16a34a", bg: "#dcfce7" },
  sensor: { icon: "pulse-outline", color: "#16a34a", bg: "#dcfce7" },
  module: { icon: "cube-outline", color: "#dc2626", bg: "#fee2e2" },
  default: { icon: "cube-outline", color: "#ea580c", bg: "#fef3c7" },
};

function normalize(value?: string) {
  return (value || "").trim().toLowerCase();
}

function getTypeConfig(type?: string) {
  const key = normalize(type);
  if (key.includes("micro")) return TYPE_CFG.microcontroller;
  if (key.includes("sensor")) return TYPE_CFG.sensor;
  if (key.includes("module")) return TYPE_CFG.module;
  return TYPE_CFG.default;
}

function ItemCard({
  item,
  onChangeStatus,
  onDelete,
}: {
  item: any;
  onChangeStatus: (item: any) => void;
  onDelete: (item: any) => void;
}) {
  const status = STATUS_CFG[item.status] || STATUS_CFG.available;
  const typeCfg = getTypeConfig(item.type);
  const meta = [item.type, item.description || item.barcode].filter(Boolean).join(" · ");

  return (
    <TouchableOpacity
      style={[s.card, { borderLeftColor: status.border }]}
      activeOpacity={0.86}
      onPress={() => onChangeStatus(item)}
      onLongPress={() => onDelete(item)}
    >
      <View style={[s.itemIconBox, { backgroundColor: typeCfg.bg }]}>
        <Ionicons name={typeCfg.icon} size={24} color={typeCfg.color} />
      </View>

      <View style={s.cardBody}>
        <Text style={s.cardName} numberOfLines={1}>{item.name || "ไม่มีชื่ออุปกรณ์"}</Text>
        <View style={s.metaRow}>
          <Ionicons name="pricetag-outline" size={12} color="#94a3b8" />
          <Text style={s.cardMeta} numberOfLines={1}>{meta || "ยังไม่มีรายละเอียด"}</Text>
        </View>
      </View>

      <View style={[s.badge, { backgroundColor: status.bg }]}>
        <Text style={[s.badgeTxt, { color: status.color }]}>{status.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function AdminItems() {
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase.from("items").select("*").order("name");
    if (error) {
      Alert.alert("โหลดข้อมูลไม่สำเร็จ", error.message);
    } else {
      setItems(data || []);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const availableCount = items.filter((i) => i.status === "available").length;

  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return items;
    return items.filter((item) =>
      normalize(item.name).includes(q) ||
      normalize(item.type).includes(q) ||
      normalize(item.description).includes(q) ||
      normalize(item.barcode).includes(q)
    );
  }, [items, search]);

  const changeStatus = (item: any) => {
    if (item.status === "borrowed") {
      Alert.alert("เปลี่ยนไม่ได้", "อุปกรณ์นี้กำลังถูกยืมอยู่\nคืนของก่อนถึงจะเปลี่ยนสถานะได้");
      return;
    }

    const options = [
      { label: "ว่าง", value: "available" },
      { label: "ซ่อมบำรุง", value: "repair" },
    ].filter((option) => option.value !== item.status);

    Alert.alert(`เปลี่ยนสถานะ: ${item.name}`, "เลือกสถานะใหม่", [
      ...options.map((option) => ({
        text: option.label,
        onPress: async () => {
          const { error } = await supabase.from("items").update({ status: option.value }).eq("id", item.id);
          if (error) {
            Alert.alert("เกิดข้อผิดพลาด", error.message);
            return;
          }
          fetchItems();
        },
      })),
      { text: "ยกเลิก", style: "cancel" as const },
    ]);
  };

  const deleteItem = (item: any) => {
    Alert.alert("ลบอุปกรณ์", `ลบ "${item.name}" ?`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ",
        style: "destructive",
        onPress: async () => {
          const { data: active } = await supabase
            .from("borrow_records")
            .select("id")
            .eq("item_id", item.id)
            .eq("status", "borrowed");

          if (active && active.length > 0) {
            Alert.alert("ลบไม่ได้", "อุปกรณ์นี้ยังถูกยืมอยู่");
            return;
          }

          const { error } = await supabase.from("items").delete().eq("id", item.id);
          if (error) {
            Alert.alert("ลบไม่สำเร็จ", error.message);
            return;
          }
          fetchItems();
        },
      },
    ]);
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={23} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerTextWrap}>
          <Text style={s.headerTitle}>อุปกรณ์ IoT</Text>
          <Text style={s.headerSub}>{items.length} รายการทั้งหมด · พร้อมยืม {availableCount}</Text>
        </View>
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={20} color="#94a3b8" />
        <TextInput
          style={s.searchInput}
          placeholder="ค้นหาชื่อ ประเภท หรือคำอธิบาย..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      <View style={s.listHeader}>
        <Text style={s.listTitle}>รายการอุปกรณ์</Text>
        <Text style={s.listCount}>{filtered.length} จาก {items.length} รายการ</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}
          showsVerticalScrollIndicator
        >
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={48} color="#cbd5e1" />
              <Text style={s.emptyTxt}>ไม่พบอุปกรณ์</Text>
            </View>
          ) : (
            filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onChangeStatus={changeStatus}
                onDelete={deleteItem}
              />
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  header: {
    minHeight: 102,
    backgroundColor: "#2f63df",
    paddingTop: 18,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 28,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 29,
  },
  headerSub: {
    color: "#dbeafe",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  searchWrap: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    marginHorizontal: 17,
    marginTop: 17,
    marginBottom: 28,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    color: "#1e293b",
    fontSize: 14,
    fontWeight: "700",
    paddingVertical: 12,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  listTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  listCount: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
  },
  list: {
    paddingHorizontal: 17,
    paddingBottom: 28,
  },
  card: {
    minHeight: 68,
    backgroundColor: "#fff",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    elevation: 2,
  },
  itemIconBox: {
    width: 44,
    height: 44,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBody: {
    flex: 1,
  },
  cardName: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardMeta: {
    flex: 1,
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  badge: {
    minWidth: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeTxt: {
    fontSize: 11,
    fontWeight: "900",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyTxt: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "800",
  },
});
