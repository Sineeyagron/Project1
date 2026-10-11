import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import SearchBar from "../components/SearchBar";
import { Text, TextInput } from "../components/AppText";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";
import { goBack, useRefreshOnFocus } from "../lib/nav";
import AnchoredMenu, { Anchor, measureAnchor } from "../components/AnchoredMenu";
import { BADGE_TEXT, C, W } from "../lib/theme";
import TabBar from "../components/TabBar";
import ScreenHeader from "../components/ScreenHeader";
import { FadeIn, PressScale } from "../components/Motion";
import { Group, OTHER, Thumb, availTone, formatDue, iconFor, setSelectedGroup, takePendingAction, toneOf } from "../components/EquipmentParts";

// หน้าอุปกรณ์ของนักศึกษา (ดูอย่างเดียว — ยืม/คืนทางเดียวคือสแกน QR ที่ตัวของ แผน 2.6)
// รวมเป็น "การ์ดละรุ่น" (item_prefix / ชื่อ) บอกว่าว่างกี่ชิ้น — นักศึกษาอยากรู้ว่า "DHT22 มีว่างไหม" ไม่ใช่ทีละชิ้น
// กดการ์ด → แผ่นรายละเอียด (app/equipment-sheet — แผ่นมาตรฐานของ iOS): รูป คำอธิบาย สถานะแต่ละชิ้น + วันคืน และวิธียืม

const ALL = "ทั้งหมด";

type SortKey = "available" | "name" | "soonest";
const SORTS: { key: SortKey; label: string; short: string }[] = [
  { key: "available", label: "ว่างมากก่อน", short: "ว่างมากก่อน" },
  { key: "name", label: "ชื่อ ก–ฮ / A–Z", short: "ชื่อ" },
  { key: "soonest", label: "จะว่างเร็วที่สุด", short: "จะว่างเร็วสุด" },
];

// ข้อมูลชุดล่าสุด (หน่วยความจำ) — เปิดหน้าซ้ำเห็นรายการทันที แล้วค่อยโหลดใหม่เบื้องหลัง / ล้างเมื่อออกจากระบบ
let cache: { items: any[]; categories: string[] } | null = null;
supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") cache = null; });

export default function Equipment() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>(cache?.items ?? []);
  const [categories, setCategories] = useState<string[]>(cache?.categories ?? []);
  const [loading, setLoading] = useState(!cache);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeType, setActiveType] = useState(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("available");
  const sortBtnRef = useRef<any>(null);
  const [sortAnchor, setSortAnchor] = useState<Anchor | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => { fetchItems(); }, []);
  useRefreshOnFocus(() => { fetchItems(); });
  // กลับมาจากแผ่นรายละเอียดที่กด "เปิดกล้องสแกน" → ไปหน้าสแกนหลังแผ่นปิด (push จากในแผ่นจะไปซ้อนในแผ่น)
  useFocusEffect(
    React.useCallback(() => {
      if (takePendingAction() === "scan") {
        const t = setTimeout(() => router.push("/scan"), 50);
        return () => clearTimeout(t);
      }
    }, []),
  );

  const openSheet = (g: Group) => {
    setSelectedGroup(g);
    router.push("/equipment-sheet");
  };

  const fetchItems = async () => {
    // ยิงพร้อมกันรอบเดียว / ของที่จำหน่ายแล้วไม่แสดง (แผน 2.3)
    const [{ data, error }, { data: loans }, { data: cats }, { data: locs }] = await Promise.all([
      supabase.from("items").select("*").neq("status", "retired"),
      // RLS: นักศึกษาเห็นแค่ประวัติของตัวเอง → RPC คืนแค่ ชิ้นไหน + วันคืน (ไม่บอกผู้ยืม)
      supabase.rpc("item_active_loans"),
      supabase.from("categories").select("id, name, sort_order").eq("active", true).order("sort_order"),
      supabase.from("borrow_locations").select("id, name"),
    ]);
    setLoadError(error ? error.message : "");
    if (!error) {
      const catList = cats || [];
      const byId: Record<string, string> = {};
      catList.forEach((c: any) => { byId[c.id] = c.name; });
      // หมวด: category_id → ชื่อ type เดิมที่ตรงกับหมวด → อื่นๆ
      const categoryOf = (item: any) =>
        byId[item.category_id] ||
        catList.find((c: any) => c.name.toLowerCase() === String(item.type || "").trim().toLowerCase())?.name ||
        OTHER;
      const locName: Record<string, string> = {};
      (locs || []).forEach((l: any) => { locName[l.id] = l.name; });
      const dueMap: Record<string, string> = {};
      (loans || []).forEach((r: any) => { if (r.item_id && r.due_date) dueMap[r.item_id] = r.due_date; });
      const nextItems = (data || []).map((item: any) => ({
        ...item,
        due_date: dueMap[item.id],
        category: categoryOf(item),
        location: locName[item.location_id],
      }));
      const nextCats = catList.map((c: any) => c.name);
      cache = { items: nextItems, categories: nextCats };
      setCategories(nextCats);
      setItems(nextItems);
    }
    setLoading(false);
    setRefreshing(false);
  };

  // รวมเป็นรุ่น: item_prefix (เช่น DHT22) → ไม่มีใช้ชื่อ
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    items.forEach((it: any) => {
      const key = String(it.item_prefix || it.name || it.id).trim().toLowerCase();
      let g = map.get(key);
      if (!g) {
        g = { key, name: it.name || it.item_prefix, category: it.category, image: null, description: null, location: it.location || "IoT Lab", units: [], available: 0, nextDue: null };
        map.set(key, g);
      }
      g.units.push(it);
      if (!g.image && it.image_url) g.image = it.image_url;
      if (!g.description && it.description) g.description = it.description;
      if (it.status === "available") g.available += 1;
      if (it.status === "borrowed" && it.due_date && (!g.nextDue || it.due_date < g.nextDue)) g.nextDue = it.due_date;
    });
    map.forEach((g) => g.units.sort((a, b) => (a.item_no || 0) - (b.item_no || 0)));
    return [...map.values()];
  }, [items]);

  // พิมพ์แล้วกรองทันที ไม่สนช่องว่าง/ตัวพิมพ์ ("dht22002" เจอ "DHT22 002") / ระหว่างค้นหา หาทุกหมวด
  const compact = (v?: string | null) => (v || "").toLowerCase().replace(/[\s\-_.]/g, "");
  const query = compact(search);
  const shown = groups
    .filter((g) => !!query || activeType === ALL || g.category === activeType)
    .filter((g) => !query || [g.name, g.category, g.description, ...g.units.flatMap((u: any) => [u.item_code, u.barcode, u.short_name])]
      .some((f) => compact(f).includes(query)))
    .sort((a, b) => {
      if (sortKey === "available") {
        if ((a.available > 0) !== (b.available > 0)) return a.available > 0 ? -1 : 1;
        if (a.available !== b.available) return b.available - a.available;
      } else if (sortKey === "soonest") {
        // ว่างอยู่แล้วขึ้นก่อน ตามด้วยรุ่นที่จะมีชิ้นคืนเร็วสุด
        const rank = (g: Group) => (g.available > 0 ? "0" : g.nextDue || "9999");
        const r = rank(a).localeCompare(rank(b));
        if (r !== 0) return r;
      }
      return a.name.localeCompare(b.name, "th");
    });

  const types = [ALL, ...categories.filter((name) => groups.some((g) => g.category === name)), ...(groups.some((g) => g.category === OTHER) && !categories.includes(OTHER) ? [OTHER] : [])];
  const totalAvailable = items.filter((i) => i.status === "available").length;

  return (
    <View style={s.container}>
      <ScreenHeader
        title="อุปกรณ์ IoT"
        subtitle={loading ? "กำลังโหลด..." : `พร้อมให้ยืม ${totalAvailable} จาก ${items.length} ชิ้น`}
        onBack={() => goBack("/home")}
        style={{ marginBottom: 10 }}
      />

      {/* ค้นหา + ปุ่มสแกนในช่องเดียว */}
      <SearchBar
        style={s.search}
        value={search}
        onChangeText={setSearch}
        placeholder="ค้นหาชื่อ รหัส หรือหมวด"
        onFocusChange={setSearchFocused}
        accessory={
          <PressScale style={s.scanAction} onPress={() => router.push("/scan")} accessibilityLabel="สแกนยืม / คืน">
            <Ionicons name="scan" size={16} color="#FFFFFF" />
            <Text style={s.scanActionText}>สแกน</Text>
          </PressScale>
        }
      />

      {/* หมวด — ซ่อนระหว่างค้นหา (ค้นหาทุกหมวดอยู่แล้ว ผลจะขยับขึ้นใกล้นิ้ว) */}
      <View style={(searchFocused || !!query) && { display: "none" }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {types.map((type) => {
            const active = activeType === type && !query;
            return (
              <PressScale key={type} style={[s.chip, active && s.chipActive]} onPress={() => setActiveType(type)} scaleTo={0.94}>
                {type !== ALL ? <Ionicons name={iconFor(type)} size={14} color={active ? "#FFFFFF" : toneOf(type).to} /> : null}
                <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>{type}</Text>
              </PressScale>
            );
          })}
        </ScrollView>
      </View>

      <View style={s.titleRow}>
        <Text style={s.sectionTitle} numberOfLines={1}>
          {query ? `ผลการค้นหา · ${shown.length} รุ่น` : `${shown.length} รุ่น`}
        </Text>
        <TouchableOpacity ref={sortBtnRef} onPress={() => measureAnchor(sortBtnRef, setSortAnchor)} style={s.sortBtn} activeOpacity={0.8}>
          <Ionicons name="swap-vertical" size={14} color={C.primaryDark} />
          <Text style={s.sortText}>{SORTS.find((o) => o.key === sortKey)?.short}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.list, (searchFocused || !!query) && { paddingTop: 10 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchItems(); }} tintColor={C.primary} />}
        >
          {loadError ? (
            <View style={s.errorBox}>
              <Ionicons name="cloud-offline-outline" size={20} color="#b91c1c" />
              <View style={{ flex: 1 }}>
                <Text style={s.errorTitle}>โหลดรายการอุปกรณ์ไม่สำเร็จ</Text>
                <Text style={s.errorMsg} numberOfLines={2}>{loadError}</Text>
              </View>
              <TouchableOpacity style={s.retryBtn} onPress={() => { setRefreshing(true); fetchItems(); }} activeOpacity={0.85}>
                <Text style={s.retryText}>ลองใหม่</Text>
              </TouchableOpacity>
            </View>
          ) : shown.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="search-outline" size={44} color={C.primarySoft} />
              <Text style={s.emptyText}>ไม่พบอุปกรณ์ที่ค้นหา</Text>
            </View>
          ) : (
            shown.map((g, i) => <GroupCard key={g.key} group={g} index={i} onPress={() => openSheet(g)} />)
          )}
          <View style={{ height: 96 }} />
        </ScrollView>
      )}

      <TabBar current="/equipment" />


      {/* เมนูเรียง (ลูกตัวสุดท้าย = อยู่บนสุด) */}
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


function GroupCard({ group: g, index, onPress }: { group: Group; index: number; onPress: () => void }) {
  const tone = availTone(g);
  const total = g.units.length;
  const ratio = total ? g.available / total : 0;
  // ข้อความใต้แถบ: มีว่าง = ไม่ต้องพูดซ้ำ (ตัวเลขขวาบอกแล้ว) / ไม่มีว่าง = บอกว่าจะว่างเมื่อไร
  const note = g.available > 0 ? null : g.nextDue ? `ว่างอีกครั้ง ~${formatDue(g.nextDue)}` : "ไม่ว่างตอนนี้";
  return (
    <FadeIn delay={Math.min(index, 8) * 40}>
      <PressScale style={s.card} onPress={onPress} scaleTo={0.98} accessibilityLabel={`${g.name} ว่าง ${g.available} จาก ${total}`}>
        <Thumb image={g.image} category={g.category} size={56} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardName} numberOfLines={1}>{g.name}</Text>
          <Text style={s.cardSub} numberOfLines={1}>{g.category}</Text>
          {/* แถบสัดส่วนที่ว่าง — ยาวเท่ากันทุกการ์ด */}
          <View style={s.bar}>
            <View style={[s.barFill, { width: `${Math.max(ratio * 100, ratio > 0 ? 6 : 0)}%`, backgroundColor: tone.bar }]} />
          </View>
          {note ? <Text style={[s.cardNote, { color: tone.fg }]} numberOfLines={1}>{note}</Text> : null}
        </View>
        {/* ตัวเลขว่าง: คอลัมน์กว้างคงที่ ตัวเลขใหญ่บรรทัดเดียว + "จาก N" ใต้ → ขอบขวาตรงกันทุกการ์ด */}
        <View style={[s.availBox, { backgroundColor: tone.bg }]}>
          <Text style={[s.availNum, { color: tone.fg }]}>{g.available}</Text>
          <Text style={[s.availOf, { color: tone.fg }]}>จาก {total}</Text>
        </View>
      </PressScale>
    </FadeIn>
  );
}


const s = StyleSheet.create({
  container: { ...W.page },

  search: { marginHorizontal: 16 },
  searchBox: {
    ...(W.input as any),
    marginHorizontal: 16,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.ink, paddingVertical: 0 },
  searchAction: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF3FB" },
  scanAction: { ...W.primary, flexDirection: "row", alignItems: "center", gap: 5, height: 38, paddingHorizontal: 12, borderRadius: 12 },
  scanActionText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  chipRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderWidth: 1,
    borderColor: "#DCE6F5",
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary, boxShadow: "0 4px 10px rgba(37,99,235,0.28)" },
  chipText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },

  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 8 },
  sectionTitle: { color: C.ink, fontSize: 16, fontWeight: "700" },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.8)" },
  sortText: { color: C.primaryDark, fontSize: 13, fontWeight: "600" },

  list: { paddingHorizontal: 16, paddingTop: 2 },
  card: { ...W.card, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, paddingRight: 10, marginBottom: 10 },
  cardName: { color: C.ink, fontSize: 15.5, fontWeight: "700" },
  cardSub: { color: C.text2, fontSize: 12.5, marginTop: 1 },
  bar: { height: 6, borderRadius: 3, backgroundColor: "#E2E9F4", marginTop: 8, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  cardNote: { fontSize: 12, fontWeight: "600", marginTop: 5 },
  availBox: { width: 60, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  availNum: { ...BADGE_TEXT, fontSize: 22, lineHeight: 26 },
  availOf: { fontSize: 11, fontWeight: "600", marginTop: 0 },

  empty: { alignItems: "center", gap: 10, paddingTop: 50 },
  emptyText: { color: C.text2, fontSize: 14 },

  errorBox: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, backgroundColor: C.errorBg, borderWidth: 1, borderColor: "#FECACA" },
  errorTitle: { color: C.errorInk, fontSize: 14, fontWeight: "700" },
  errorMsg: { color: C.errorInk, fontSize: 12, marginTop: 1 },
  retryBtn: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#FCA5A5" },
  retryText: { color: C.errorInk, fontSize: 13, fontWeight: "700" },
});
