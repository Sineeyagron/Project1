import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";
import { ITEM_STATUS, RECORD_STATUS } from "../../lib/status";
import { goBack as navBack, useRefreshOnFocus } from "../../lib/nav";
import { notify } from "../../lib/notify";
import AnchoredMenu, { Anchor, measureAnchor } from "../../components/AnchoredMenu";
import { addYears, isValidDate, thaiDate } from "../../lib/itemInfo";
import { W, NG } from "../../lib/theme";
import StatWidget from "../../components/StatWidget";

const C = {
  bg: "#EAF1FC",
  purple: "#2563EB",
  purpleSoft: "#3B82F6",
  ink: "#172033",
  muted: "#64748b",
  faint: "#94a3b8",
  card: "#ffffff",
  green: "#10B981",
  orange: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; cta: "add" | "info" }> = {
  available: { ...ITEM_STATUS.available, cta: "add" },
  reserved: { ...ITEM_STATUS.reserved, cta: "info" },
  borrowed: { ...ITEM_STATUS.borrowed, cta: "info" },
  repair: { ...ITEM_STATUS.repair, cta: "info" },
  retired: { ...ITEM_STATUS.retired, cta: "info" },
};

const TYPE_CFG: Record<string, { icon: any; color: string; bg: string; filter: string; label: string }> = {
  microcontroller: { icon: "hardware-chip-outline", color: "#047857", bg: "#ECFDF5", filter: "microcontroller", label: "Microcontroller" },
  sensor: { icon: "pulse-outline", color: "#047857", bg: "#ECFDF5", filter: "sensor", label: "Sensor" },
  module: { icon: "cube-outline", color: "#ef4444", bg: "#fee2e2", filter: "module", label: "Module" },
  default: { icon: "cube-outline", color: "#B45309", bg: "#fef3c7", filter: "other", label: "อื่นๆ" },
};

// "all" | "retired" | ชื่อหมวด (จากตาราง categories)
type FilterKey = string;
const OTHER = "อื่นๆ";

// ไม่มี "ชื่อ" เพราะรหัสสร้างจากชื่อ เรียงแล้วได้ลำดับเดียวกับรหัส
type SortKey = "code" | "status" | "due" | "warranty" | "oldest" | "newest";
// label = ชื่อเต็มในเมนู / short = ชื่อสั้นบนปุ่ม "เรียงตาม"
const SORTS: { key: SortKey; label: string; short: string }[] = [
  { key: "code", label: "รหัสอุปกรณ์ (A–Z)", short: "รหัส A–Z" },
  { key: "status", label: "สถานะที่ต้องดำเนินการ", short: "สถานะ" },
  { key: "due", label: "กำหนดส่งคืนใกล้ที่สุด", short: "กำหนดส่งคืน" },
  { key: "warranty", label: "การรับประกันใกล้สิ้นสุด", short: "การรับประกัน" },
  { key: "oldest", label: "อายุการใช้งานมากที่สุด", short: "อายุการใช้งาน" },
  { key: "newest", label: "วันที่เพิ่มเข้าระบบล่าสุด", short: "เพิ่มล่าสุด" },
];
const STATUS_ORDER: Record<string, number> = { repair: 0, reserved: 1, borrowed: 2, available: 3, retired: 4 };

type SheetAction = { label: string; icon: any; tone?: "danger"; onPress: () => void };
type Sheet = { title: string; message?: string; actions: SheetAction[] };

function normalize(value?: string) {
  return (value || "").trim().toLowerCase();
}

// ค้นแบบไม่สนช่องว่าง/ตัวพิมพ์: "nodemcu001" เจอ "NodeMCU 001"
function compact(value?: string) {
  return normalize(value).replace(/[\s\-_.]/g, "");
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

function warrantyText(dateValue?: string) {
  if (!dateValue) return "";
  const end = new Date(`${dateValue}T23:59:59`);
  if (Number.isNaN(end.getTime())) return "";
  if (end.getTime() < Date.now()) return "หมดประกันแล้ว";
  return `ประกันถึง ${end.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}`;
}

// เรียงตามชื่อรหัส แล้วตามเลขจริง (002 ก่อน 010)
function compareItems(a: any, b: any) {
  const byPrefix = (a.item_prefix || a.name || "").localeCompare(b.item_prefix || b.name || "", "th");
  return byPrefix !== 0 ? byPrefix : (a.item_no || 0) - (b.item_no || 0);
}

function ItemCard({
  item,
  dueDate,
  onPress,
}: {
  item: any;
  dueDate?: string;
  onPress: (item: any) => void;
}) {
  const status = STATUS_CFG[item.status] || STATUS_CFG.available;
  const typeCfg = getTypeConfig(item.category === OTHER ? item.type || item.name : item.category);
  const meta = [item.name, item.category, item.barcode && `สแกน ${item.barcode}`]
    .filter(Boolean).join(" · ");
  const footText = item.status === "borrowed" && dueDate
    ? `คืน ${formatDue(dueDate)}`
    : item.status === "retired"
      ? item.retire_reason || ""
      : warrantyText(item.warranty_expires_at);

  return (
    <TouchableOpacity
      style={[s.card, item.status === "retired" && s.cardRetired]}
      activeOpacity={0.88}
      onPress={() => onPress(item)}
    >
      <View style={[s.itemIconBox, { backgroundColor: typeCfg.bg }]}>
        <Ionicons name={typeCfg.icon} size={24} color={typeCfg.color} />
      </View>

      <View style={s.cardBody}>
        <Text style={s.cardName} numberOfLines={1}>{item.item_code || item.name || "ไม่มีชื่ออุปกรณ์"}</Text>
        <Text style={s.cardMeta} numberOfLines={1}>{meta || "ยังไม่มีรายละเอียด"}</Text>
        <View style={s.cardFooter}>
          <View style={[s.statusPill, { backgroundColor: status.bg }]}>
            <Text style={[s.statusText, { color: status.color }]}>• {status.label}</Text>
          </View>
          {!!footText && <Text style={s.qtyText} numberOfLines={1}>{footText}</Text>}
        </View>
      </View>

      <View style={[s.cardAction, s.cardActionMuted]}>
        <Ionicons name="ellipsis-vertical" size={18} color="#64748b" />
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
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [retireTarget, setRetireTarget] = useState<any>(null);
  const [retireReason, setRetireReason] = useState("");
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editWarranty, setEditWarranty] = useState("");
  const [editSerial, setEditSerial] = useState("");
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchItems();
  }, []);
  // กลับมาหน้านี้ (ปุ่ม ← / สลับแท็บ) → โหลดข้อมูลใหม่
  useRefreshOnFocus(() => { fetchItems(); });

  const goBack = () => {
    navBack("/admin/home");
  };

  const fetchItems = async () => {
    const [{ data, error }, { data: borrows }, { data: cats }] = await Promise.all([
      supabase.from("items").select("*"),
      supabase
        .from("borrow_records")
        .select("item_id, due_date")
        .in("status", ["borrowed", "pending_return"]),
      supabase.from("categories").select("id, name").eq("active", true).order("sort_order").order("name"),
    ]);

    // หมวดของแต่ละชิ้น: category_id → ชื่อในช่อง type ที่ตรงกับหมวด → "อื่นๆ" (เหมือนหน้า นศ.)
    const catList = cats || [];
    const byId: Record<string, string> = {};
    catList.forEach((c: any) => { byId[c.id] = c.name; });
    const categoryOf = (item: any) =>
      byId[item.category_id] ||
      catList.find((c: any) => c.name.toLowerCase() === String(item.type || "").trim().toLowerCase())?.name ||
      OTHER;
    setCategories(catList);

    if (error) {
      notify("โหลดข้อมูลไม่สำเร็จ", error.message);
    } else {
      setItems((data || []).map((item: any) => ({ ...item, category: categoryOf(item) })).sort(compareItems));
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

  // ของที่จำหน่ายแล้วไม่นับในสต็อก
  const activeItems = items.filter((i) => i.status !== "retired");
  const retiredCount = items.length - activeItems.length;
  const availableCount = activeItems.filter((i) => i.status === "available").length;
  const borrowedCount = activeItems.filter((i) => i.status === "borrowed").length;
  const repairCount = activeItems.filter((i) => i.status === "repair").length;

  // ชิปหมวดดึงจากตาราง categories (โชว์เฉพาะหมวดที่มีของ)
  const chips = [
    { key: "all", label: "ทั้งหมด", icon: "cube-outline", count: activeItems.length },
    ...categories.map((c) => ({
      key: c.name,
      label: c.name,
      icon: getTypeConfig(c.name === OTHER ? "" : c.name).icon,
      count: activeItems.filter((item) => item.category === c.name).length,
    })),
    { key: "retired", label: "จำหน่ายแล้ว", icon: "archive-outline", count: retiredCount },
  ].filter((chip) => chip.key === "all" || chip.count > 0);

  // คำนวณใหม่ทุกครั้งที่ render (รายการไม่กี่ร้อยชิ้น) — พิมพ์แล้วกรองทันที
  const filtered = (() => {
    const q = compact(search);
    const list = items.filter((item) => {
      // ระหว่างค้นหา หาในทุกหมวด (ยกเว้นของที่จำหน่ายแล้ว ถ้าไม่ได้เลือกตัวกรองนั้น)
      const matchesFilter =
        filter === "retired"
          ? item.status === "retired"
          : item.status !== "retired" && (!!q || filter === "all" || item.category === filter);
      const matchesSearch =
        !q ||
        [item.item_code, item.name, item.short_name, item.category, item.type, item.description, item.barcode, item.manufacturer_serial]
          .some((field) => compact(field).includes(q));
      return matchesFilter && matchesSearch;
    });
    const sorted = [...list];
    // ค่าที่ไม่มี (ไม่มีกำหนดคืน / ไม่มีประกัน) ไว้ท้ายสุด
    const byText = (pick: (i: any) => string | undefined) => (a: any, b: any) =>
      String(pick(a) || "9999").localeCompare(String(pick(b) || "9999")) || compareItems(a, b);
    if (sortKey === "status") {
      sorted.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || compareItems(a, b));
    } else if (sortKey === "due") {
      sorted.sort(byText((i) => borrowMap[i.id]));
    } else if (sortKey === "warranty") {
      sorted.sort(byText((i) => i.warranty_expires_at));
    } else if (sortKey === "oldest") {
      sorted.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    } else if (sortKey === "newest") {
      sorted.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    } else {
      sorted.sort(compareItems);
    }
    return sorted;
  })();

  const sortBtnRef = useRef<any>(null);
  const headerSortRef = useRef<any>(null);
  const [sortAnchor, setSortAnchor] = useState<Anchor | null>(null);
  const openSort = (ref: React.RefObject<any>) => measureAnchor(ref, setSortAnchor);

  const label = (item: any) => item.item_code || item.name;

  const run = async (task: () => PromiseLike<{ error: any }>, failTitle: string) => {
    setBusy(true);
    const { error } = await task();
    setBusy(false);
    if (error) {
      notify(failTitle, error.message);
      return false;
    }
    fetchItems();
    return true;
  };

  const setStatus = (item: any, status: string) => {
    setSheet(null);
    run(() => supabase.from("items").update({ status }).eq("id", item.id), "เปลี่ยนสถานะไม่สำเร็จ");
  };

  const restore = (item: any) => {
    setSheet(null);
    run(
      () => supabase.from("items")
        .update({ status: "available", retired_at: null, retire_reason: null })
        .eq("id", item.id),
      "ยกเลิกการจำหน่ายไม่สำเร็จ"
    );
  };

  const hardDelete = (item: any) => {
    setSheet({
      title: `ลบ ${label(item)} ถาวร?`,
      message: "ลบแล้วกู้คืนไม่ได้ เลขรหัสนี้จะไม่ถูกนำกลับมาใช้อีก",
      actions: [{
        label: "ลบถาวร", icon: "trash-outline", tone: "danger",
        onPress: () => {
          setSheet(null);
          run(() => supabase.from("items").delete().eq("id", item.id), "ลบไม่สำเร็จ");
        },
      }],
    });
  };

  // เปลี่ยนหมวด: เลือกจากหมวดที่เปิดอยู่ (แก้ช่อง type ตามด้วย ให้ของเก่าแสดงตรงกัน)
  const pickCategory = (item: any) => {
    setSheet({
      title: `เปลี่ยนหมวด ${label(item)}`,
      message: `ตอนนี้: ${item.category}`,
      actions: categories.map((c) => ({
        label: c.name,
        icon: c.name === item.category ? "checkmark-circle" : "ellipse-outline",
        onPress: () => {
          setSheet(null);
          if (c.name === item.category && item.category_id === c.id) return;
          run(
            () => supabase.from("items").update({ category_id: c.id, type: c.name }).eq("id", item.id),
            "เปลี่ยนหมวดไม่สำเร็จ"
          );
        },
      })),
    });
  };

  // แก้วันหมดประกัน / Serial (ชื่อ-รหัสแก้ไม่ได้ เพราะติดป้ายไปแล้ว)
  const openEdit = (item: any) => {
    setSheet(null);
    setEditWarranty(item.warranty_expires_at || "");
    setEditSerial(item.manufacturer_serial || "");
    setEditTarget(item);
  };

  const editWarrantyInvalid = !!editWarranty.trim() && !isValidDate(editWarranty.trim());

  const saveEdit = async () => {
    if (editWarrantyInvalid) return;
    const ok = await run(
      () => supabase.from("items")
        .update({
          warranty_expires_at: editWarranty.trim() || null,
          manufacturer_serial: editSerial.trim() || null,
        })
        .eq("id", editTarget.id),
      "บันทึกไม่สำเร็จ"
    );
    if (ok) setEditTarget(null);
  };

  const openRetire = (item: any) => {
    setSheet(null);
    setRetireReason("");
    setRetireTarget(item);
  };

  const confirmRetire = async () => {
    if (!retireReason.trim()) return;
    const item = retireTarget;
    const ok = await run(
      () => supabase.from("items")
        .update({ status: "retired", retired_at: new Date().toISOString(), retire_reason: retireReason.trim() })
        .eq("id", item.id),
      "จำหน่ายออกไม่สำเร็จ"
    );
    if (ok) setRetireTarget(null);
  };

  // กดการ์ด → เมนูจัดการ ตามกฎแผนข้อ 2.3
  const openManage = async (item: any) => {
    if (item.status === "retired") {
      setSheet({
        title: label(item),
        message: `จำหน่ายแล้ว: ${item.retire_reason || "-"}`,
        actions: [{ label: "ยกเลิกการจำหน่าย (กลับเป็นว่าง)", icon: "arrow-undo-outline", onPress: () => restore(item) }],
      });
      return;
    }

    setBusy(true);
    const { data: records } = await supabase
      .from("borrow_records")
      .select("status")
      .eq("item_id", item.id);
    setBusy(false);

    // reserved = มีคำขอยืมรออยู่ ห้ามแก้สถานะเองไม่งั้นคำขอค้าง (ให้อนุมัติ/ปฏิเสธในกล่องคำขอ)
    const onLoan = item.status === "borrowed" || item.status === "reserved" ||
      (records || []).some((r: any) => r.status === "borrowed" || r.status === "pending_return");
    if (onLoan) {
      setSheet({
        title: label(item),
        message: item.status === "reserved"
          ? "มีคำขอยืมรออนุมัติอยู่ ต้องอนุมัติหรือปฏิเสธคำขอก่อน"
          : "กำลังถูกยืมอยู่ ต้องคืนของก่อนถึงจะเปลี่ยนสถานะ ลบ หรือจำหน่ายได้",
        actions: [
          { label: "แก้ประกัน / Serial", icon: "create-outline", onPress: () => openEdit(item) },
          { label: "เปลี่ยนหมวด", icon: "pricetag-outline", onPress: () => pickCategory(item) },
        ],
      });
      return;
    }

    const everBorrowed = (records || []).length > 0;
    const actions: SheetAction[] = [
      { label: "แก้ประกัน / Serial", icon: "create-outline", onPress: () => openEdit(item) },
      { label: `เปลี่ยนหมวด (ตอนนี้: ${item.category})`, icon: "pricetag-outline", onPress: () => pickCategory(item) },
    ];
    if (item.status !== "available") {
      actions.push({ label: "เปลี่ยนเป็น ว่าง", icon: "checkmark-circle-outline", onPress: () => setStatus(item, "available") });
    }
    if (item.status !== "repair") {
      actions.push({ label: "เปลี่ยนเป็น ซ่อมบำรุง", icon: "construct-outline", onPress: () => setStatus(item, "repair") });
    }
    actions.push({ label: "จำหน่ายออก", icon: "archive-outline", tone: "danger", onPress: () => openRetire(item) });
    if (!everBorrowed) {
      actions.push({ label: "ลบถาวร", icon: "trash-outline", tone: "danger", onPress: () => hardDelete(item) });
    }

    setSheet({
      title: label(item),
      message: everBorrowed
        ? `${item.name} · เคยถูกยืมแล้ว จึงลบถาวรไม่ได้ (เก็บไว้ในประวัติ) จำหน่ายออกได้`
        : item.name,
      actions,
    });
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity style={s.iconBtn} onPress={goBack} activeOpacity={0.82}>
            <Ionicons name="chevron-back" size={22} color="#172033" />
          </TouchableOpacity>
          <TouchableOpacity ref={headerSortRef} style={s.iconBtn} onPress={() => openSort(headerSortRef)} activeOpacity={0.82}>
            <Ionicons name="options-outline" size={21} color="#1D4ED8" />
          </TouchableOpacity>
        </View>

        <View style={s.titleBlock}>
          <Text style={s.headerSub}>ระบบจัดการอุปกรณ์ IoT</Text>
          <Text style={s.headerTitle}>อุปกรณ์ IoT</Text>
        </View>

        <View style={s.statRow}>
          <StatWidget tone="blue" icon="cube-outline" label="ทั้งหมด" value={activeItems.length} />
          <StatWidget tone="green" icon="checkmark" label="พร้อมใช้" value={availableCount} />
          <StatWidget tone="amber" icon="swap-horizontal" label="ถูกยืม/ซ่อม" value={borrowedCount + repairCount} />
        </View>

        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={19} color="#94a3b8" />
          <TextInput
            style={s.searchInput}
            placeholder="พิมพ์ชื่อ รหัส หรือรหัสสแกน..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {!!search && (
            <TouchableOpacity style={s.clearBtn} onPress={() => setSearch("")} activeOpacity={0.8}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.scanBtn} onPress={() => router.push("/admin/scan" as any)} activeOpacity={0.82}>
            <Ionicons name="add" size={22} color={C.purple} />
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
            <TouchableOpacity
              style={[s.chip, s.chipManage]}
              activeOpacity={0.82}
              onPress={() => router.push("/admin/categories" as any)}
            >
              <Ionicons name="settings-outline" size={13} color={C.purple} />
              <Text style={[s.chipText, { color: C.purple }]}>จัดการหมวด</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={s.listHeader}>
            <Text style={s.listTitle}>
              {search.trim() ? `ผลการค้นหา "${search.trim()}" · ${filtered.length} รายการ` : "รายการอุปกรณ์"}
            </Text>
            <TouchableOpacity ref={sortBtnRef} style={s.sortBtn} onPress={() => openSort(sortBtnRef)} activeOpacity={0.75}>
              <Text style={s.sortMuted}>เรียงตาม</Text>
              <Text style={s.sortText}>{SORTS.find((o) => o.key === sortKey)?.short}</Text>
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
                onPress={openManage}
              />
            ))
          )}
          <View style={{ height: 28 }} />
        </ScrollView>
      )}

      {/* เมนูจัดการ (ใช้แทน Alert ที่ไม่ทำงานบนเว็บ) */}
      {/* ไม่ซ้อนปุ่มในปุ่ม: พื้นหลังกดปิดเป็นชั้นแยก อยู่ "ข้าง" แผ่นเมนู (บนมือถือปุ่มชั้นนอกแย่งการกด) */}
      <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <View style={s.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheet(null)} accessibilityLabel="ปิดเมนู" />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{sheet?.title}</Text>
            {!!sheet?.message && <Text style={s.sheetMessage}>{sheet.message}</Text>}
            {sheet?.actions.map((a) => (
              <Pressable
                key={a.label}
                style={({ pressed }) => [s.sheetBtn, pressed && { opacity: 0.7 }]}
                onPress={a.onPress}
              >
                <Ionicons name={a.icon} size={18} color={a.tone === "danger" ? C.red : C.purple} />
                <Text style={[s.sheetBtnText, a.tone === "danger" && { color: C.red }]}>{a.label}</Text>
              </Pressable>
            ))}
            <Pressable style={s.sheetCancel} onPress={() => setSheet(null)}>
              <Text style={s.sheetCancelText}>ปิด</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* จำหน่ายออก: ต้องใส่เหตุผล */}
      <Modal visible={!!retireTarget} transparent animationType="fade" onRequestClose={() => setRetireTarget(null)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>จำหน่ายออก {retireTarget && label(retireTarget)}</Text>
            <Text style={s.sheetMessage}>
              ของจะหายจากสต็อกและหน้ายืม แต่ยังอยู่ในประวัติ/รายงาน รหัสเดิมไม่ถูกนำกลับมาใช้
            </Text>
            <TextInput
              style={s.reasonInput}
              value={retireReason}
              onChangeText={setRetireReason}
              placeholder="เหตุผล เช่น ชำรุดซ่อมไม่ได้, สูญหาย"
              placeholderTextColor={C.faint}
              autoFocus
            />
            <TouchableOpacity
              style={[s.sheetPrimary, !retireReason.trim() && { opacity: 0.4 }]}
              disabled={!retireReason.trim() || busy}
              onPress={confirmRetire}
              activeOpacity={0.85}
            >
              <Text style={s.sheetPrimaryText}>{busy ? "กำลังบันทึก..." : "ยืนยันจำหน่ายออก"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetCancel} onPress={() => setRetireTarget(null)} activeOpacity={0.8}>
              <Text style={s.sheetCancelText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* แก้ประกัน / Serial */}
      <Modal visible={!!editTarget} transparent animationType="fade" onRequestClose={() => setEditTarget(null)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>แก้ข้อมูล {editTarget && label(editTarget)}</Text>
            <Text style={s.sheetMessage}>
              ตอนนี้: {editTarget?.warranty_expires_at ? `ประกันถึง ${thaiDate(editTarget.warranty_expires_at)}` : "ไม่มีประกัน"}
            </Text>

            <Text style={s.editLabel}>วันหมดประกัน (เว้นว่าง = ไม่มีประกัน)</Text>
            <TextInput
              style={[s.reasonInput, editWarrantyInvalid && s.inputError]}
              value={editWarranty}
              onChangeText={setEditWarranty}
              placeholder="ปปปป-ดด-วว เช่น 2027-10-02"
              placeholderTextColor={C.faint}
              keyboardType="numbers-and-punctuation"
            />
            {editWarrantyInvalid && (
              <Text style={s.editError}>วันที่ไม่ถูกต้อง ใช้รูปแบบ ปปปป-ดด-วว (ค.ศ.)</Text>
            )}
            <View style={s.editChips}>
              {[1, 2, 3].map((y) => (
                <TouchableOpacity key={y} style={s.editChip} onPress={() => setEditWarranty(addYears(y))} activeOpacity={0.8}>
                  <Text style={s.editChipText}>+{y} ปีจากวันนี้</Text>
                </TouchableOpacity>
              ))}
              {!!editWarranty && (
                <TouchableOpacity style={s.editChip} onPress={() => setEditWarranty("")} activeOpacity={0.8}>
                  <Text style={s.editChipText}>ไม่มีประกัน</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={s.editLabel}>Serial ผู้ผลิต</Text>
            <TextInput
              style={s.reasonInput}
              value={editSerial}
              onChangeText={setEditSerial}
              placeholder="เลขที่พิมพ์บนตัวอุปกรณ์"
              placeholderTextColor={C.faint}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={[s.sheetPrimary, (editWarrantyInvalid || busy) && { opacity: 0.4 }]}
              disabled={editWarrantyInvalid || busy}
              onPress={saveEdit}
              activeOpacity={0.85}
            >
              <Text style={s.sheetPrimaryText}>{busy ? "กำลังบันทึก..." : "บันทึก"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sheetCancel} onPress={() => setEditTarget(null)} activeOpacity={0.8}>
              <Text style={s.sheetCancelText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {busy && !retireTarget && !editTarget && (
        <View style={s.busyOverlay} pointerEvents="none">
          <ActivityIndicator color={C.purple} />
        </View>
      )}

      {/* เมนูเรียงตาม โผล่ใต้ปุ่มที่กด */}
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

const s = StyleSheet.create({
  container: {
    ...W.page,
    flex: 1,
  },
  header: {
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
    ...W.iconBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    alignItems: "center",
    marginTop: 2,
    marginBottom: 14,
  },
  headerTitle: {
    color: "#172033",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32,
  },
  headerSub: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 2,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  searchWrap: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...W.input,
    borderWidth: 0,
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
    backgroundColor: "#EEF5FF",
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
    borderColor: "#DCE6F5",
  },
  editLabel: { fontSize: 13, fontWeight: "800", color: C.ink, marginTop: 4 },
  editError: { fontSize: 12.5, color: C.red, fontWeight: "700" },
  inputError: { ...NG, borderColor: C.red, backgroundColor: "#fef2f2" },
  editChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  editChip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.purpleSoft,
    backgroundColor: "#EEF5FF",
  },
  editChipText: { fontSize: 13, fontWeight: "700", color: C.purple },
  chipManage: { borderStyle: "dashed", borderColor: C.purpleSoft, backgroundColor: "#EEF5FF" },
  chipActive: {
    ...NG,
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
    ...W.card,
    minHeight: 82,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 13,
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
    ...NG,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#DCE6F5",
  },
  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  clearBtn: {
    padding: 4,
  },
  cardRetired: {
    opacity: 0.6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    gap: 8,
  },
  sheetTitle: {
    color: C.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  sheetMessage: {
    color: C.muted,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 6,
  },
  sheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#DCE6F5",
  },
  sheetBtnText: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  sheetPrimary: {
    backgroundColor: C.red,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  sheetPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  sheetCancel: {
    alignItems: "center",
    paddingVertical: 12,
  },
  sheetCancelText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: "800",
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: "#DCE6F5",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.ink,
  },
  busyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.35)",
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
