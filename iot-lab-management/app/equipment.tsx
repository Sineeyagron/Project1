import React, { useEffect, useMemo, useState } from "react";
import supabase from "../lib/supabase";
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const C = {
  bg: "#edf5ff",
  header: "#2563eb",
  headerDark: "#1d4ed8",
  purple: "#7c3aed",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  green: "#16a34a",
  orange: "#d97706",
  red: "#ef4444",
};

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Microcontroller: "hardware-chip-outline",
  SBC: "server-outline",
  Sensor: "pulse-outline",
  Actuator: "flash-outline",
  Module: "cube-outline",
  Kit: "color-wand-outline",
  Cable: "git-branch-outline",
  Other: "ellipsis-horizontal-outline",
};

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string; border: string; action: keyof typeof Ionicons.glyphMap }> = {
  available: { label: "ว่าง", bg: "#dcfce7", color: C.green, border: "#22c55e", action: "add" },
  borrowed: { label: "ถูกยืม", bg: "#fee2e2", color: C.red, border: "#f87171", action: "information-outline" },
  repair: { label: "ซ่อมบำรุง", bg: "#fef3c7", color: C.orange, border: "#f59e0b", action: "information-outline" },
};

export default function Equipment() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState("ทั้งหมด");

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("items").select("*").order("name");
    if (error) {
      console.log(error);
      setItems([]);
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

  const types = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.type || "Other").filter(Boolean)));
    return ["ทั้งหมด", ...unique];
  }, [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((item) => activeType === "ทั้งหมด" || (item.type || "Other") === activeType)
      .filter((item) => {
        if (!query) return true;
        return `${item.name || ""} ${item.type || ""} ${item.description || ""}`.toLowerCase().includes(query);
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "th"));
  }, [items, search, activeType]);

  const available = items.filter((item) => item.status === "available").length;
  const borrowed = items.filter((item) => item.status === "borrowed").length;
  const repair = items.filter((item) => item.status === "repair").length;
  const problem = borrowed + repair;

  const openItemAction = (item: any) => {
    const status = STATUS_BADGE[item.status] || STATUS_BADGE.available;
    if (item.status === "available") {
      Alert.alert("พร้อมให้ยืม", `${item.name}\nกรุณาติดต่อผู้ดูแลหรือสแกน QR กับเจ้าหน้าที่เพื่อยืมอุปกรณ์`);
      return;
    }
    Alert.alert(status.label, `${item.name}\nสถานะปัจจุบัน: ${status.label}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.replace("/home")} activeOpacity={0.84}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => {
              setSearch("");
              setActiveType("ทั้งหมด");
            }}
            activeOpacity={0.84}
          >
            <Ionicons name="options-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.headerSub}>คลังอุปกรณ์สำหรับนักเรียน</Text>
        <Text style={styles.headerTitle}>อุปกรณ์ IoT</Text>

        <View style={styles.statsRow}>
          <HeaderStat icon="cube-outline" label="ทั้งหมด" value={items.length} />
          <HeaderStat dot="#22c55e" label="พร้อมใช้" value={available} />
          <HeaderStat dot="#facc15" label="ถูกยืม/ซ่อม" value={problem} />
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={C.faint} />
          <TextInput
            placeholder="ค้นหาชื่อ หรือ ประเภท..."
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={C.faint}
          />
          {search ? (
            <TouchableOpacity style={styles.searchAction} onPress={() => setSearch("")} activeOpacity={0.82}>
              <Ionicons name="close" size={17} color={C.purple} />
            </TouchableOpacity>
          ) : (
            <View style={styles.searchAction}>
              <Ionicons name="scan-outline" size={17} color={C.purple} />
            </View>
          )}
        </View>
      </View>

      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {types.map((type) => {
            const active = activeType === type;
            const count = type === "ทั้งหมด" ? items.length : items.filter((item) => (item.type || "Other") === type).length;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setActiveType(type)}
                activeOpacity={0.84}
              >
                {type === "ทั้งหมด" ? (
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>ทั้งหมด</Text>
                ) : (
                  <>
                    <Ionicons
                      name={TYPE_ICONS[type] || TYPE_ICONS.Other}
                      size={13}
                      color={active ? "#fff" : C.muted}
                    />
                    <Text style={[styles.filterText, active && styles.filterTextActive]} numberOfLines={1}>
                      {type}
                    </Text>
                  </>
                )}
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>รายการอุปกรณ์</Text>
        <TouchableOpacity activeOpacity={0.82}>
          <Text style={styles.sortText}>เรียงตาม ชื่อ A-Z⌄</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.header} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.header} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={44} color="#bfdbfe" />
              <Text style={styles.emptyText}>ไม่พบอุปกรณ์ที่ค้นหา</Text>
            </View>
          ) : (
            filtered.map((item: any) => {
              const badge = STATUS_BADGE[item.status] || STATUS_BADGE.available;
              const iconName = TYPE_ICONS[item.type] || TYPE_ICONS.Other;
              const isAvailable = item.status === "available";

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.itemCard, { borderLeftColor: badge.border }]}
                  onPress={() => openItemAction(item)}
                  activeOpacity={0.88}
                >
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.itemImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.iconBox, { backgroundColor: isAvailable ? "#bbf7d0" : badge.bg }]}>
                      <Ionicons name={iconName} size={24} color={badge.color} />
                    </View>
                  )}

                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.itemType} numberOfLines={1}>
                      {item.type || "อุปกรณ์"}{item.description ? ` · ${item.description}` : ""}
                    </Text>
                    <View style={styles.itemMetaRow}>
                      <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                        <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
                        <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                      {item.quantity ? (
                        <Text style={styles.qtyText}>มี {item.quantity} ชิ้น</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={[styles.actionBtn, !isAvailable && styles.actionBtnMuted]}>
                    <Ionicons name={badge.action} size={22} color={isAvailable ? "#fff" : C.muted} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 92 }} />
        </ScrollView>
      )}

      <View style={styles.tab}>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push("/home")} activeOpacity={0.82}>
          <Ionicons name="home-outline" size={22} color={C.faint} />
          <Text style={styles.tabText}>ชั้นเรียน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} activeOpacity={0.82}>
          <Ionicons name="cube" size={22} color={C.purple} />
          <Text style={[styles.tabText, styles.tabActive]}>อุปกรณ์</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push("/notifications")} activeOpacity={0.82}>
          <Ionicons name="notifications-outline" size={22} color={C.faint} />
          <Text style={styles.tabText}>แจ้งเตือน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push("/profile")} activeOpacity={0.82}>
          <Ionicons name="person-outline" size={22} color={C.faint} />
          <Text style={styles.tabText}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function HeaderStat({
  icon,
  dot,
  label,
  value,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  dot?: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statCard}>
      {icon ? <Ionicons name={icon} size={14} color="#dbeafe" /> : <View style={[styles.statDot, { backgroundColor: dot }]} />}
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statNumber}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.header,
    paddingHorizontal: 25,
    paddingTop: 35,
    paddingBottom: 30,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 9,
  },
  headerBtn: {
    width: 37,
    height: 37,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.23)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSub: { color: "#dbeafe", fontSize: 11, fontWeight: "800", marginLeft: 58 },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "900", marginLeft: 58, marginTop: 1, marginBottom: 12 },
  statsRow: { flexDirection: "row", gap: 9, marginBottom: 14 },
  statCard: {
    flex: 1,
    minHeight: 66,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.19)",
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  statDot: { width: 7, height: 7, borderRadius: 99, marginBottom: 5 },
  statLabel: { color: "#e0ecff", fontSize: 10, fontWeight: "800" },
  statNumber: { color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 3 },
  searchBox: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingLeft: 14,
    paddingRight: 7,
  },
  searchInput: { flex: 1, color: C.ink, fontSize: 13, fontWeight: "700" },
  searchAction: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#f3e8ff",
    alignItems: "center",
    justifyContent: "center",
  },
  filterWrap: { marginTop: -1, paddingVertical: 11 },
  filterRow: { gap: 8, paddingHorizontal: 24 },
  filterChip: {
    minHeight: 32,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dbe4f0",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#1e3a8a",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  filterChipActive: { backgroundColor: C.purple, borderColor: C.purple },
  filterText: { color: C.muted, fontSize: 12, fontWeight: "900", maxWidth: 118 },
  filterTextActive: { color: "#fff" },
  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  filterCountActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  filterCountText: { color: C.purple, fontSize: 10, fontWeight: "900" },
  filterCountTextActive: { color: "#fff" },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: C.ink },
  sortText: { fontSize: 11, color: C.purple, fontWeight: "900" },
  list: { paddingHorizontal: 24 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { color: C.faint, fontSize: 14, fontWeight: "800" },
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderLeftWidth: 3,
    shadowColor: "#1e3a8a",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  itemImage: { width: 55, height: 55, borderRadius: 14, backgroundColor: "#f1f5f9" },
  iconBox: {
    width: 55,
    height: 55,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: "900", color: C.ink },
  itemType: { fontSize: 10, color: C.muted, marginTop: 2, fontWeight: "700" },
  itemMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusDot: { width: 5, height: 5, borderRadius: 99 },
  statusText: { fontSize: 10, fontWeight: "900" },
  qtyText: { color: C.faint, fontSize: 10, fontWeight: "800" },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.purple,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.purple,
    shadowOpacity: 0.26,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  actionBtnMuted: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbe4f0",
    shadowOpacity: 0,
  },
  tab: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 65,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#dbe4f0",
    flexDirection: "row",
  },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  tabText: { fontSize: 10, color: C.faint, fontWeight: "800" },
  tabActive: { color: C.purple },
});
