import React, { useEffect, useRef, useState } from "react";
import supabase from "../lib/supabase";
import { ITEM_STATUS } from "../lib/status";
import { goBack, useRefreshOnFocus } from "../lib/nav";
import { notify } from "../lib/notify";
import AnchoredMenu, { Anchor, measureAnchor } from "../components/AnchoredMenu";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "../components/AppText";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { W, NG } from "../lib/theme";
import TabBar from "../components/TabBar";
import StatWidget from "../components/StatWidget";

// ของที่ยังไม่มีหมวด (ของเก่าก่อนมีตาราง categories) รวมไว้ที่หมวดนี้
const OTHER = "อื่นๆ";

type SortKey = "code" | "available" | "soonest";
// label = ชื่อเต็มในเมนู / short = ชื่อสั้นบนปุ่ม "เรียงตาม"
const SORTS: { key: SortKey; label: string; short: string }[] = [
  { key: "code", label: "รหัสอุปกรณ์ (A–Z)", short: "รหัส A–Z" },
  { key: "available", label: "พร้อมให้ยืมก่อน", short: "พร้อมให้ยืม" },
  { key: "soonest", label: "กำหนดส่งคืนใกล้ที่สุด", short: "กำหนดส่งคืน" },
];

const formatDue = (value: string) =>
  new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

const C = {
  bg: "#EAF1FC",
  header: "#2563eb",
  headerDark: "#1d4ed8",
  purple: "#2563EB",
  ink: "#172033",
  muted: "#64748b",
  faint: "#94a3b8",
  green: "#047857",
  orange: "#B45309",
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
  "อื่นๆ": "ellipsis-horizontal-outline",
};

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string; border: string; action: keyof typeof Ionicons.glyphMap }> = {
  available: { ...ITEM_STATUS.available, action: "information-outline" },
  reserved: { ...ITEM_STATUS.reserved, action: "information-outline" },
  borrowed: { ...ITEM_STATUS.borrowed, action: "information-outline" },
  repair: { ...ITEM_STATUS.repair, action: "information-outline" },
};

export default function Equipment() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState("ทั้งหมด");
  const [categories, setCategories] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const sortBtnRef = useRef<any>(null);
  const [sortAnchor, setSortAnchor] = useState<Anchor | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);
  // กลับมาหน้านี้ (ปุ่ม ← / สลับแท็บ) → โหลดข้อมูลใหม่
  useRefreshOnFocus(() => { fetchItems(); });

  const fetchItems = async () => {
    setLoading(true);
    // ของที่จำหน่ายแล้วไม่แสดงในหน้ายืม (แผน 2.3)
    const [{ data, error }, { data: loans }, { data: cats }] = await Promise.all([
      supabase.from("items").select("*").neq("status", "retired"),
      // RLS: นักศึกษาเห็นแค่ประวัติของตัวเอง → ใช้ RPC ที่คืนแค่ ชิ้นไหน + วันคืน (ไม่บอกผู้ยืม)
      supabase.rpc("item_active_loans"),
      supabase.from("categories").select("id, name, sort_order").eq("active", true).order("sort_order"),
    ]);
    if (error) {
      console.log(error);
      setItems([]);
    } else {
      const catList = cats || [];
      const byId: Record<string, string> = {};
      catList.forEach((c: any) => { byId[c.id] = c.name; });
      // หมวดของแต่ละชิ้น: จาก category_id → ถ้าไม่มีลองจับคู่ชื่อ type เดิม → ไม่เจอ = อื่นๆ
      const categoryOf = (item: any) =>
        byId[item.category_id] ||
        catList.find((c: any) => c.name.toLowerCase() === String(item.type || "").trim().toLowerCase())?.name ||
        OTHER;

      const dueMap: Record<string, string> = {};
      (loans || []).forEach((r: any) => { if (r.item_id && r.due_date) dueMap[r.item_id] = r.due_date; });
      setCategories(catList.map((c: any) => c.name));
      setItems((data || []).map((item: any) => ({ ...item, due_date: dueMap[item.id], category: categoryOf(item) })));
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  // ชิปหมวด: ตามลำดับในตาราง categories แสดงเฉพาะหมวดที่มีของ
  const types = ["ทั้งหมด", ...categories.filter((name) => items.some((item) => item.category === name))];

  // พิมพ์แล้วกรองทันที ไม่สนช่องว่าง/ตัวพิมพ์ ("nodemcu001" เจอ "NodeMCU 001") และหาทุกหมวดระหว่างค้นหา
  const compact = (v?: string) => (v || "").toLowerCase().replace(/[\s\-_.]/g, "");
  const query = compact(search);
  const filtered = items
    .filter((item) => !!query || activeType === "ทั้งหมด" || item.category === activeType)
    .filter((item) =>
      !query ||
      [item.item_code, item.barcode, item.name, item.short_name, item.category, item.description]
        .some((field) => compact(field).includes(query))
    )
    .sort((a, b) => {
      if (sortKey === "available") {
        const rank = (i: any) => (i.status === "available" ? 0 : 1);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
      } else if (sortKey === "soonest") {
        // ของที่ถูกยืม: คืนเร็วสุดขึ้นก่อน (จะว่างเร็วสุด) ของว่างไว้ท้าย
        const due = (i: any) => (i.status === "available" ? "9999" : i.due_date || "9998");
        const byDue = String(due(a)).localeCompare(String(due(b)));
        if (byDue !== 0) return byDue;
      }
      const byPrefix = String(a.item_prefix || a.name || "").localeCompare(String(b.item_prefix || b.name || ""), "th");
      return byPrefix !== 0 ? byPrefix : (a.item_no || 0) - (b.item_no || 0);
    });

  const available = items.filter((item) => item.status === "available").length;
  const borrowed = items.filter((item) => item.status === "borrowed").length;
  const repair = items.filter((item) => item.status === "repair").length;
  const problem = borrowed + repair;

  const openItemAction = (item: any) => {
    const status = STATUS_BADGE[item.status] || STATUS_BADGE.available;
    const label = item.item_code || item.name;
    if (item.status === "available") {
      notify("พร้อมให้ยืม", `${label}\nไปที่ห้องแล้วสแกน QR ที่ตัวอุปกรณ์ (ปุ่ม "สแกนยืม / คืน") เพื่อขอยืม`);
      return;
    }
    const due = item.due_date ? `\nกำหนดคืน ${formatDue(item.due_date)}` : "";
    notify(status.label, `${label}\nสถานะปัจจุบัน: ${status.label}${due}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => goBack("/home")} activeOpacity={0.84}>
            <Ionicons name="chevron-back" size={21} color={C.ink} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerSub}>คลังอุปกรณ์สำหรับนักเรียน</Text>
            <Text style={styles.headerTitle}>อุปกรณ์ IoT</Text>
          </View>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => {
              setSearch("");
              setActiveType("ทั้งหมด");
            }}
            activeOpacity={0.84}
          >
            <Ionicons name="options-outline" size={20} color={C.headerDark} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.scanBtn} onPress={() => router.push("/scan")} activeOpacity={0.88}>
          <Ionicons name="scan" size={18} color="#FFFFFF" />
          <Text style={styles.scanBtnText}>สแกนยืม / คืน</Text>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <StatWidget tone="blue" icon="cube-outline" label="ทั้งหมด" value={items.length} />
          <StatWidget tone="green" icon="checkmark" label="พร้อมใช้" value={available} />
          <StatWidget tone="amber" icon="swap-horizontal" label="ถูกยืม/ซ่อม" value={problem} />
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={19} color={C.faint} />
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
            <TouchableOpacity style={styles.searchAction} onPress={() => router.push("/scan")} activeOpacity={0.82}>
              <Ionicons name="scan-outline" size={17} color={C.purple} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {types.map((type) => {
            const active = activeType === type;
            const count = type === "ทั้งหมด" ? items.length : items.filter((item) => item.category === type).length;
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
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {query ? `ผลการค้นหา · ${filtered.length} รายการ` : "รายการอุปกรณ์"}
        </Text>
        <TouchableOpacity
          ref={sortBtnRef}
          onPress={() => measureAnchor(sortBtnRef, setSortAnchor)}
          activeOpacity={0.82}
        >
          <Text style={styles.sortText}>เรียงตาม {SORTS.find((o) => o.key === sortKey)?.short} ⌄</Text>
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
              const iconName = TYPE_ICONS[item.category] || TYPE_ICONS.Other;
              const isAvailable = item.status === "available";

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.itemCard, { borderLeftColor: badge.border }, !isAvailable && styles.itemCardDim]}
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
                    <Text style={styles.itemName} numberOfLines={1}>{item.item_code || item.name}</Text>
                    <Text style={styles.itemType} numberOfLines={1}>
                      {[item.name, item.category, item.description].filter(Boolean).join(" · ")}
                    </Text>
                    <View style={styles.itemMetaRow}>
                      <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
                        <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
                        <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                      {item.status === "borrowed" && item.due_date ? (
                        <Text style={styles.qtyText}>คืน {formatDue(item.due_date)}</Text>
                      ) : null}
                    </View>
                  </View>

                  {/* ยืมจากรายการไม่ได้ (แผน 2.6) ปุ่มนี้แค่ดูรายละเอียด */}
                  <View style={[styles.actionBtn, styles.actionBtnMuted]}>
                    <Ionicons name={badge.action} size={20} color={C.muted} />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 92 }} />
        </ScrollView>
      )}

      <TabBar current="/equipment" />

      {/* เมนูเรียงตาม โผล่ใต้ปุ่ม (ต้องเป็นลูกตัวสุดท้ายของหน้า จะได้อยู่บนสุด) */}
      <AnchoredMenu
        anchor={sortAnchor}
        title="เรียงลำดับตาม"
        options={SORTS.map((o) => o.label)}
        selected={SORTS.findIndex((o) => o.key === sortKey)}
        onSelect={(i) => setSortKey(SORTS[i].key)}
        onClose={() => setSortAnchor(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 6,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  headerBtn: {
    ...W.small, width: 44, height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSub: { color: "#475569", fontSize: 12 },
  headerTitle: { color: "#172033", fontSize: 22, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  searchBox: {
    ...W.input,
    borderWidth: 0,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingLeft: 14,
    paddingRight: 7,
  },
  searchInput: { flex: 1, color: C.ink, fontSize: 15 },
  searchAction: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#EEF5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  filterWrap: { marginTop: -1, paddingVertical: 11 },
  filterRow: { gap: 8, paddingHorizontal: 18 },
  filterChip: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#D3E0F5",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    boxShadow: "0 2px 6px rgba(37,99,235,0.08)",
  },
  filterChipActive: { ...NG, backgroundColor: C.purple, borderColor: C.purple },
  filterText: { color: "#475569", fontSize: 13, maxWidth: 118 },
  filterTextActive: { color: "#fff", fontWeight: "600" },
  filterCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  filterCountActive: { ...NG, backgroundColor: "rgba(255,255,255,0.2)" },
  filterCountText: { color: C.purple, fontSize: 10, fontWeight: "600" },
  filterCountTextActive: { color: "#fff" },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: C.ink, flexShrink: 1 },
  sortText: { fontSize: 12, color: C.headerDark, overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.9)" },
  list: { paddingHorizontal: 18, paddingTop: 2 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { color: C.faint, fontSize: 14, fontWeight: "600" },
  itemCardDim: { opacity: 0.6 },
  scanBtn: {
    ...W.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    marginBottom: 14,
  },
  scanBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  itemCard: {
    ...W.card,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemImage: { width: 54, height: 54, borderRadius: 16, backgroundColor: "#EEF5FF" },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    boxShadow: "inset 0 1px 0 #FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 15, fontWeight: "600", color: C.ink },
  itemType: { fontSize: 12, color: C.muted, marginTop: 1 },
  itemMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  statusText: { fontSize: 12, fontWeight: "600" },
  qtyText: { color: C.muted, fontSize: 12 },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnMuted: {
    ...NG,
    backgroundColor: "#F5F8FE",
    borderWidth: 1,
    borderColor: "#D3E0F5",
  },
});
