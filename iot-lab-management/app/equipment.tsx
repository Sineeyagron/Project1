import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Animated,
  Easing,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import SearchBar from "../components/SearchBar";
import { Text, TextInput } from "../components/AppText";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";
import { ITEM_STATUS } from "../lib/status";
import { goBack, useRefreshOnFocus } from "../lib/nav";
import AnchoredMenu, { Anchor, measureAnchor } from "../components/AnchoredMenu";
import { BADGE_TEXT, C, W, gradient } from "../lib/theme";
import TabBar from "../components/TabBar";
import ScreenHeader from "../components/ScreenHeader";
import { FadeIn, PressScale } from "../components/Motion";
import PickupRequestSheet from "../components/PickupRequestSheet";

// หน้าอุปกรณ์ของนักศึกษา (ดูอย่างเดียว — ยืม/คืนทางเดียวคือสแกน QR ที่ตัวของ แผน 2.6)
// รวมเป็น "การ์ดละรุ่น" (item_prefix / ชื่อ) บอกว่าว่างกี่ชิ้น — นักศึกษาอยากรู้ว่า "DHT22 มีว่างไหม" ไม่ใช่ทีละชิ้น
// กดการ์ด → แผ่นรายละเอียด: รูป คำอธิบาย สถานะแต่ละชิ้น + วันคืน และวิธียืม

const SHEET_TRAVEL = Dimensions.get("window").height; // ระยะเลื่อนแผ่นล่างตอนเปิด/ปิด
const OTHER = "อื่นๆ"; // ของที่ยังไม่มีหมวด (ก่อนมีตาราง categories)
const ALL = "ทั้งหมด";

type SortKey = "available" | "name" | "soonest";
const SORTS: { key: SortKey; label: string; short: string }[] = [
  { key: "available", label: "ว่างมากก่อน", short: "ว่างมากก่อน" },
  { key: "name", label: "ชื่อ ก–ฮ / A–Z", short: "ชื่อ" },
  { key: "soonest", label: "จะว่างเร็วที่สุด", short: "จะว่างเร็วสุด" },
];

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Microcontroller: "hardware-chip-outline",
  SBC: "server-outline",
  Sensor: "pulse-outline",
  Actuator: "flash-outline",
  Module: "cube-outline",
  Kit: "color-wand-outline",
  Cable: "git-branch-outline",
  Other: "ellipsis-horizontal-outline",
  [OTHER]: "ellipsis-horizontal-outline",
};
const iconFor = (category: string) => TYPE_ICONS[category] || "cube-outline";

// สีประจำหมวด (ไอคอนไล่สี + พื้นอ่อน) — ดูปราดเดียวแยกหมวดได้ / หมวดใหม่ที่ไม่มีในนี้ใช้สีฟ้า
const CAT_TONE: Record<string, { from: string; to: string; soft: string }> = {
  Microcontroller: { from: "#7C8CFF", to: "#4F46E5", soft: "#EEF0FF" },
  SBC: { from: "#B58CFF", to: "#7C3AED", soft: "#F4EEFF" },
  Sensor: { from: "#4FD1B5", to: "#0F9D84", soft: "#E6F8F3" },
  Actuator: { from: "#FFB45C", to: "#EA6A1F", soft: "#FFF1E4" },
  Module: { from: "#6AA8FF", to: "#2563EB", soft: "#EAF2FF" },
  Kit: { from: "#FF8FC0", to: "#DB2777", soft: "#FDECF4" },
  Cable: { from: "#94A3B8", to: "#475569", soft: "#EEF2F7" },
};
const toneOf = (category: string) => CAT_TONE[category] || { from: "#8FA6C8", to: "#5B6B85", soft: "#EEF2F7" };

// รูปอุปกรณ์ / ถ้าไม่มีรูป = ไอคอนหมวดบนพื้นสีของหมวด (ขนาดเท่ากันทุกการ์ด)
function Thumb({ image, category, size }: { image: string | null; category: string; size: number }) {
  const tone = toneOf(category);
  const box = { width: size, height: size, borderRadius: size * 0.28 };
  if (image) return <Image source={{ uri: image }} style={[box, { backgroundColor: tone.soft }]} resizeMode="cover" />;
  return (
    <View style={[box, { backgroundColor: tone.soft, alignItems: "center", justifyContent: "center" }]}>
      <View
        style={[
          { width: size * 0.62, height: size * 0.62, borderRadius: size * 0.2, alignItems: "center", justifyContent: "center", backgroundColor: tone.to },
          gradient(`linear-gradient(145deg, ${tone.from} 0%, ${tone.to} 100%)`),
          { boxShadow: `0 4px 10px ${tone.to}40` },
        ]}
      >
        <Ionicons name={iconFor(category)} size={size * 0.34} color="#FFFFFF" />
      </View>
    </View>
  );
}

const formatDue = (value: string) => new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short" });

type Unit = {
  id: string;
  item_code: string | null;
  name: string;
  status: string;
  image_url: string | null;
  description: string | null;
  due_date?: string;
  item_no: number | null;
  location?: string;
};
type Group = {
  key: string;
  name: string;
  category: string;
  image: string | null;
  description: string | null;
  location: string;
  units: Unit[];
  available: number;
  nextDue: string | null; // ชิ้นที่ถูกยืมและจะคืนเร็วสุด
};

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
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pickupModel, setPickupModel] = useState<{ key: string; name: string } | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => { fetchItems(); }, []);
  useRefreshOnFocus(() => { fetchItems(); });

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
  const open = groups.find((g) => g.key === openKey) || null;

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
            shown.map((g, i) => <GroupCard key={g.key} group={g} index={i} onPress={() => setOpenKey(g.key)} />)
          )}
          <View style={{ height: 96 }} />
        </ScrollView>
      )}

      <TabBar current="/equipment" />

      <DetailSheet
        group={open}
        onClose={() => setOpenKey(null)}
        onScan={() => { setOpenKey(null); router.push("/scan"); }}
        onPickup={(g) => { setOpenKey(null); setPickupModel({ key: g.key, name: g.name }); }}
      />
      {/* F2 ขอยืมแบบนัดรับ */}
      <PickupRequestSheet model={pickupModel} onClose={() => setPickupModel(null)} onSent={() => setPickupModel(null)} />

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

// โทนตามจำนวนว่าง: มีว่าง = เขียว / ไม่มีแต่จะคืน = เหลือง / ซ่อมหมด = แดง
function availTone(g: Group) {
  if (g.available > 0) return { fg: C.successInk, bg: C.successBg, bar: C.success };
  if (g.nextDue) return { fg: C.warningInk, bg: C.warningBg, bar: C.warning };
  return { fg: C.errorInk, bg: C.errorBg, bar: C.error };
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

// แผ่นล่าง: ฉากหลังเทา "จาง" เข้า-ออก / แผ่น "เลื่อน" ขึ้น-ลง — คุมเองทั้งคู่ให้ไปพร้อมกัน
// (เดิมใช้ animationType="slide" ของ Modal → ฉากเทาเลื่อนตามแผ่น และตอนปิดลงช้ากว่า)
// ปิด = เล่นแอนิเมชันออกจนจบก่อน แล้วค่อยถอด Modal (เก็บ group ล่าสุดไว้แสดงระหว่างกำลังปิด)
function DetailSheet({ group, onClose, onScan, onPickup }: { group: Group | null; onClose: () => void; onScan: () => void; onPickup: (g: Group) => void }) {
  const [g, setG] = useState<Group | null>(group);
  const [visible, setVisible] = useState(!!group);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (group) {
      setG(group);
      setVisible(true);
      progress.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (visible) {
      // ถอดเฉพาะตอนปิดเล่นจบจริง — เปิดรุ่นใหม่ระหว่างกำลังปิด (finished = false) ต้องไม่ล้าง ไม่งั้นแผ่นว่างค้าง
      Animated.timing(progress, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (!finished) return;
        setVisible(false);
        setG(null);
      });
    }
  }, [group]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [SHEET_TRAVEL, 0] });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: progress }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="ปิด" />
      </Animated.View>
      {g ? (
        <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
          <View style={s.handle} />
          <ScrollView contentContainerStyle={s.sheetBody} showsVerticalScrollIndicator={false}>
            <View style={s.sheetHead}>
              <Thumb image={g.image} category={g.category} size={84} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.sheetName}>{g.name}</Text>
                <Text style={s.sheetSub}>{g.category} · ห้อง {g.location}</Text>
                <View style={[s.sheetAvail, { backgroundColor: availTone(g).bg }]}>
                  <Text style={[s.sheetAvailText, { color: availTone(g).fg }]}>ว่าง {g.available} จาก {g.units.length} ชิ้น</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={8} accessibilityLabel="ปิด">
                <Ionicons name="close" size={20} color={C.muted} />
              </TouchableOpacity>
            </View>

            {g.description ? <Text style={s.desc}>{g.description}</Text> : null}

            {/* วิธียืม — อยู่บนรายการชิ้น (รุ่นที่มีหลายชิ้นจะไม่ดันข้อความนี้ตกจอ) */}
            <View style={s.howTo}>
              <Ionicons name="information-circle" size={20} color={C.primary} />
              <Text style={s.howToText}>
                {g.available > 0
                  ? `ไปที่ห้อง ${g.location} หยิบชิ้นที่ว่าง แล้วสแกน QR ที่ตัวอุปกรณ์เพื่อขอยืม`
                  : g.nextDue
                  ? `ตอนนี้ไม่มีชิ้นว่าง ชิ้นแรกครบกำหนดคืน ${formatDue(g.nextDue)}`
                  : "ตอนนี้ไม่มีชิ้นว่าง ลองกลับมาดูใหม่ภายหลัง"}
              </Text>
            </View>

            <Text style={s.unitsTitle}>แต่ละชิ้น ({g.units.length})</Text>
            <View style={s.units}>
              {g.units.map((u, i) => {
                const st = ITEM_STATUS[u.status] || ITEM_STATUS.available;
                return (
                  <View key={u.id} style={[s.unitRow, i > 0 && s.unitDivider]}>
                    <Text style={s.unitCode}>{u.item_code || u.name}</Text>
                    {u.status === "borrowed" && u.due_date ? <Text style={s.unitDue}>คืน {formatDue(u.due_date)}</Text> : null}
                    <View style={[s.pill, { backgroundColor: st.bg }]}>
                      <Text style={[s.pillText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

          </ScrollView>
          {/* ปุ่มสแกนติดล่างแผ่นเสมอ */}
          {g.available > 0 ? (
            <View style={s.sheetFooter}>
              <PressScale style={s.scanBtn} onPress={onScan}>
                <Ionicons name="scan" size={18} color="#FFFFFF" />
                <Text style={s.scanBtnText}>เปิดกล้องสแกน QR</Text>
              </PressScale>
              <TouchableOpacity style={s.pickupBtn} onPress={() => onPickup(g)} activeOpacity={0.85}>
                <Ionicons name="calendar-outline" size={17} color={C.primaryDark} />
                <Text style={s.pickupBtnText}>ขอยืมแบบนัดรับ</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </Modal>
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

  backdrop: { backgroundColor: "rgba(15,23,42,0.35)" },
  sheet: { ...W.sheet, position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "82%", paddingBottom: 24 },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#CBD5E1", marginTop: 10, marginBottom: 6 },
  sheetBody: { padding: 18, paddingTop: 8 },
  sheetHead: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  sheetImg: { width: 88, height: 88, borderRadius: 20, backgroundColor: "#EAF2FF" },
  sheetName: { color: C.ink, fontSize: 19, fontWeight: "700", lineHeight: 26 },
  sheetSub: { color: C.text2, fontSize: 13, marginTop: 2 },
  sheetAvail: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  sheetAvailText: { fontSize: 13, fontWeight: "700" },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" },
  desc: { color: C.text2, fontSize: 14, lineHeight: 21, marginTop: 14 },
  unitsTitle: { color: C.ink, fontSize: 15, fontWeight: "700", marginTop: 18, marginBottom: 8 },
  units: { borderRadius: 16, backgroundColor: "#F6F9FE", borderWidth: 1, borderColor: "#E3EAF5", paddingHorizontal: 14 },
  unitRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11 },
  unitDivider: { borderTopWidth: 1, borderTopColor: "#E3EAF5" },
  unitCode: { flex: 1, color: C.ink, fontSize: 14, fontWeight: "600" },
  unitDue: { color: C.text2, fontSize: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: "700" },
  sheetFooter: { paddingHorizontal: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E8EEF7" },
  howTo: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: C.primaryTint },
  howToText: { flex: 1, color: C.primaryDark, fontSize: 13, lineHeight: 20 },
  scanBtn: { ...W.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50 },
  scanBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 16, backgroundColor: C.errorBg, borderWidth: 1, borderColor: "#FECACA" },
  errorTitle: { color: C.errorInk, fontSize: 14, fontWeight: "700" },
  errorMsg: { color: C.errorInk, fontSize: 12, marginTop: 1 },
  retryBtn: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#FCA5A5" },
  retryText: { color: C.errorInk, fontSize: 13, fontWeight: "700" },
  pickupBtn: { ...W.small, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, marginTop: 8 },
  pickupBtnText: { color: C.primaryDark, fontSize: 14, fontWeight: "600" },
});
