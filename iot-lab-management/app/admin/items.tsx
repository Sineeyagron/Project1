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

const C = {
  bg: "#eef3f8",
  purple: "#7c3aed",
  purpleSoft: "#8b5cf6",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  card: "#ffffff",
  green: "#22c55e",
  orange: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; cta: "add" | "info" }> = {
  available: { label: "ว่าง", color: "#16a34a", bg: "#dcfce7", border: "#22c55e", cta: "add" },
  borrowed: { label: "ถูกยืม", color: "#b45309", bg: "#fef3c7", border: "#f59e0b", cta: "info" },
  repair: { label: "ซ่อมบำรุง", color: "#dc2626", bg: "#fee2e2", border: "#ef4444", cta: "info" },
};

const TYPE_CFG: Record<string, { icon: any; color: string; bg: string; filter: string; label: string }> = {
  microcontroller: { icon: "hardware-chip-outline", color: "#16a34a", bg: "#dcfce7", filter: "microcontroller", label: "Microcontroller" },
  sensor: { icon: "pulse-outline", color: "#16a34a", bg: "#dcfce7", filter: "sensor", label: "Sensor" },
  module: { icon: "cube-outline", color: "#ef4444", bg: "#fee2e2", filter: "module", label: "Module" },
  default: { icon: "cube-outline", color: "#d97706", bg: "#fef3c7", filter: "other", label: "อื่นๆ" },
};

type FilterKey = "all" | "microcontroller" | "sensor" | "module" | "other";

function normalize(value?: string) {
  return (value || "").trim().toLowerCase();
}

function getTypeConfig(type?: string) {
  const key = normalize(type);
  if (key.includes("micro") || key.includes("esp") || key.includes("arduino")) return TYPE_CFG.microcontroller;
  if (key.includes("sensor")) return TYPE_CFG.sensor;
  if (key.includes("module")) return TYPE_CFG.module;
  return TYPE_CFG.default;
}

function formatDue(dateValue?: string) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function ItemCard({
  item,
  dueDate,
  onChangeStatus,
  onDelete,
}: {
  item: any;
  dueDate?: string;
  onChangeStatus: (item: any) => void;
  onDelete: (item: any) => void;
}) {
  const status = STATUS_CFG[item.status] || STATUS_CFG.available;
  const typeCfg = getTypeConfig(item.type || item.description || item.name);
  const meta = [item.type || typeCfg.label, item.description || item.barcode].filter(Boolean).join(" · ");
  const dateText = item.status === "borrowed" && dueDate ? `คืน ${formatDue(dueDate)}` : "";

  return (
    <TouchableOpacity
      style={[s.card, { borderLeftColor: status.border }]}
      activeOpacity={0.88}
      onPress={() => onChangeStatus(item)}
      onLongPress={() => onDelete(item)}
    >
      <View style={[s.itemIconBox, { backgroundColor: typeCfg.bg }]}>
        <Ionicons name={typeCfg.icon} size={24} color={typeCfg.color} />
      </View>

      <View style={s.cardBody}>
        <Text style={s.cardName} numberOfLines={1}>{item.name || "ไม่มีชื่ออุปกรณ์"}</Text>
        <Text style={s.cardMeta} numberOfLines={1}>{meta || "ยังไม่มีรายละเอียด"}</Text>
        <View style={s.cardFooter}>
          <View style={[s.statusPill, { backgroundColor: status.bg }]}>
            <Text style={[s.statusText, { color: status.color }]}>• {status.label}</Text>
          </View>
          <Text style={s.qtyText}>{dateText || "มี 1 ชิ้น"}</Text>
        </View>
      </View>

      <View style={[s.cardAction, status.cta === "add" ? s.cardActionPrimary : s.cardActionMuted]}>
        <Ionicons
          name={status.cta === "add" ? "add" : "information"}
          size={status.cta === "add" ? 24 : 18}
          color={status.cta === "add" ? "#ffffff" : "#64748b"}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function AdminItems() {
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [borrowMap, setBorrowMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    fetchItems();
  }, []);

  const goBack = () => {
    router.replace("/admin/home");
  };

  const fetchItems = async () => {
    const [{ data, error }, { data: borrows }] = await Promise.all([
      supabase.from("items").select("*").order("name"),
      supabase
        .from("borrow_records")
        .select("item_id, due_date")
        .in("status", ["borrowed", "pending_return"]),
    ]);

    if (error) {
      Alert.alert("โหลดข้อมูลไม่สำเร็จ", error.message);
    } else {
      setItems(data || []);
    }

    const nextBorrowMap: Record<string, string> = {};
    (borrows || []).forEach((record: any) => {
      if (record.item_id && record.due_date) nextBorrowMap[record.item_id] = record.due_date;
    });
    setBorrowMap(nextBorrowMap);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const availableCount = items.filter((i) => i.status === "available").length;
  const borrowedCount = items.filter((i) => i.status === "borrowed").length;
  const repairCount = items.filter((i) => i.status === "repair").length;

  const chips = useMemo(() => {
    const countByFilter = (key: FilterKey) =>
      key === "all"
        ? items.length
        : items.filter((item) => getTypeConfig(item.type || item.description || item.name).filter === key).length;

    return [
      { key: "all" as const, label: "ทั้งหมด", icon: "cube-outline", count: countByFilter("all") },
      { key: "microcontroller" as const, label: "Microcontroller", icon: "hardware-chip-outline", count: countByFilter("microcontroller") },
      { key: "sensor" as const, label: "Sensor", icon: "pulse-outline", count: countByFilter("sensor") },
      { key: "module" as const, label: "Module", icon: "cube-outline", count: countByFilter("module") },
    ].filter((chip) => chip.key === "all" || chip.count > 0);
  }, [items]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return items.filter((item) => {
      const typeCfg = getTypeConfig(item.type || item.description || item.name);
      const matchesFilter = filter === "all" || typeCfg.filter === filter;
      const matchesSearch =
        !q ||
        normalize(item.name).includes(q) ||
        normalize(item.type).includes(q) ||
        normalize(item.description).includes(q) ||
        normalize(item.barcode).includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [items, search, filter]);

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
        <View style={s.headerTop}>
          <TouchableOpacity style={s.iconBtn} onPress={goBack} activeOpacity={0.82}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} activeOpacity={0.82}>
            <Ionicons name="options-outline" size={21} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={s.titleBlock}>
          <Text style={s.headerSub}>ระบบจัดการอุปกรณ์ IoT</Text>
          <Text style={s.headerTitle}>อุปกรณ์ IoT</Text>
        </View>

        <View style={s.statRow}>
          <HeaderStat icon="cube-outline" label="ทั้งหมด" value={items.length} dotColor="#ffffff" />
          <HeaderStat icon="ellipse" label="พร้อมใช้" value={availableCount} dotColor="#22c55e" />
          <HeaderStat icon="ellipse" label="ถูกยืม/ซ่อม" value={borrowedCount + repairCount} dotColor="#facc15" />
        </View>

        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={19} color="#94a3b8" />
          <TextInput
            style={s.searchInput}
            placeholder="ค้นหาชื่อ หรือ ประเภท..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          <TouchableOpacity style={s.scanBtn} onPress={() => router.push("/admin/scan" as any)} activeOpacity={0.82}>
            <Ionicons name="scan-outline" size={20} color={C.purple} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 44 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />}
          showsVerticalScrollIndicator
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {chips.map((chip) => {
              const active = filter === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[s.chip, active && s.chipActive]}
                  activeOpacity={0.82}
                  onPress={() => setFilter(chip.key)}
                >
                  <Ionicons name={chip.icon as any} size={13} color={active ? "#fff" : "#64748b"} />
                  <Text style={[s.chipText, active && s.chipTextActive]}>{chip.label}</Text>
                  <Text style={[s.chipCount, active && s.chipCountActive]}>{chip.count}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={s.listHeader}>
            <Text style={s.listTitle}>รายการอุปกรณ์</Text>
            <TouchableOpacity style={s.sortBtn} activeOpacity={0.75}>
              <Text style={s.sortMuted}>เรียงตาม</Text>
              <Text style={s.sortText}>ชื่อ A-Z</Text>
              <Ionicons name="chevron-down" size={13} color={C.purple} />
            </TouchableOpacity>
          </View>

          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={46} color="#cbd5e1" />
              <Text style={s.emptyTxt}>ไม่พบอุปกรณ์</Text>
            </View>
          ) : (
            filtered.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                dueDate={borrowMap[item.id]}
                onChangeStatus={changeStatus}
                onDelete={deleteItem}
              />
            ))
          )}
          <View style={{ height: 28 }} />
        </ScrollView>
      )}
    </View>
  );
}

function HeaderStat({
  icon,
  label,
  value,
  dotColor,
}: {
  icon: any;
  label: string;
  value: number;
  dotColor: string;
}) {
  return (
    <View style={s.headerStat}>
      <View style={s.headerStatLabelRow}>
        <Ionicons name={icon} size={12} color={dotColor} />
        <Text style={s.headerStatLabel}>{label}</Text>
      </View>
      <Text style={s.headerStatValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    backgroundColor: C.purple,
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 17,
  },
  headerTop: {
    position: "absolute",
    left: 20,
    right: 20,
    top: 56,
    zIndex: 2,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    alignItems: "center",
    marginTop: 2,
    marginBottom: 14,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32,
  },
  headerSub: {
    color: "#ddd6fe",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 2,
  },
  statRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  headerStat: {
    flex: 1,
    minHeight: 64,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  headerStatLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  headerStatLabel: {
    color: "#ede9fe",
    fontSize: 10,
    fontWeight: "900",
  },
  headerStatValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 6,
  },
  searchWrap: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 7,
  },
  searchInput: {
    flex: 1,
    color: "#1e293b",
    fontSize: 14,
    fontWeight: "800",
    paddingVertical: 12,
  },
  scanBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f5f3ff",
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 28,
  },
  chipRow: {
    gap: 8,
    paddingRight: 18,
    marginBottom: 16,
  },
  chip: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipActive: {
    backgroundColor: C.purple,
    borderColor: C.purple,
    shadowColor: C.purple,
    shadowOpacity: 0.3,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  chipText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "900",
  },
  chipTextActive: {
    color: "#fff",
  },
  chipCount: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "900",
  },
  chipCountActive: {
    color: "#fff",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },
  listTitle: {
    color: C.ink,
    fontSize: 15,
    fontWeight: "900",
  },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sortMuted: {
    color: C.faint,
    fontSize: 11,
    fontWeight: "800",
  },
  sortText: {
    color: C.purple,
    fontSize: 11,
    fontWeight: "900",
  },
  card: {
    minHeight: 82,
    backgroundColor: C.card,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 13,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.04)",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.16,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  itemIconBox: {
    width: 46,
    height: 46,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    color: C.ink,
    fontSize: 14.5,
    fontWeight: "900",
    marginBottom: 3,
  },
  cardMeta: {
    color: C.muted,
    fontSize: 10.5,
    fontWeight: "800",
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: "900",
  },
  qtyText: {
    color: C.faint,
    fontSize: 10.5,
    fontWeight: "900",
  },
  cardAction: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardActionPrimary: {
    backgroundColor: C.purpleSoft,
    shadowColor: C.purple,
    shadowOpacity: 0.38,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  cardActionMuted: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyTxt: {
    color: C.faint,
    fontSize: 14,
    fontWeight: "800",
  },
});
