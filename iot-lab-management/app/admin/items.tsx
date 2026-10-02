import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { notify } from "../../lib/notify";

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
  reserved: { label: "รออนุมัติยืม", color: "#c2410c", bg: "#ffedd5", border: "#fb923c", cta: "info" },
  borrowed: { label: "ถูกยืม", color: "#b45309", bg: "#fef3c7", border: "#f59e0b", cta: "info" },
  repair: { label: "ซ่อมบำรุง", color: "#dc2626", bg: "#fee2e2", border: "#ef4444", cta: "info" },
  retired: { label: "จำหน่ายแล้ว", color: "#64748b", bg: "#e2e8f0", border: "#94a3b8", cta: "info" },
};

const TYPE_CFG: Record<string, { icon: any; color: string; bg: string; filter: string; label: string }> = {
  microcontroller: { icon: "hardware-chip-outline", color: "#16a34a", bg: "#dcfce7", filter: "microcontroller", label: "Microcontroller" },
  sensor: { icon: "pulse-outline", color: "#16a34a", bg: "#dcfce7", filter: "sensor", label: "Sensor" },
  module: { icon: "cube-outline", color: "#ef4444", bg: "#fee2e2", filter: "module", label: "Module" },
  default: { icon: "cube-outline", color: "#d97706", bg: "#fef3c7", filter: "other", label: "อื่นๆ" },
};

type FilterKey = "all" | "microcontroller" | "sensor" | "module" | "other" | "retired";

type SheetAction = { label: string; icon: any; tone?: "danger"; onPress: () => void };
type Sheet = { title: string; message?: string; actions: SheetAction[] };

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
  const typeCfg = getTypeConfig(item.type || item.description || item.name);
  const meta = [item.name, item.type || typeCfg.label, item.barcode && `สแกน ${item.barcode}`]
    .filter(Boolean).join(" · ");
  const footText = item.status === "borrowed" && dueDate
    ? `คืน ${formatDue(dueDate)}`
    : item.status === "retired"
      ? item.retire_reason || ""
      : warrantyText(item.warranty_expires_at);

  return (
    <TouchableOpacity
      style={[s.card, { borderLeftColor: status.border }, item.status === "retired" && s.cardRetired]}
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
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [retireTarget, setRetireTarget] = useState<any>(null);
  const [retireReason, setRetireReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const goBack = () => {
    router.replace("/admin/home");
  };

  const fetchItems = async () => {
    const [{ data, error }, { data: borrows }] = await Promise.all([
      supabase.from("items").select("*"),
      supabase
        .from("borrow_records")
        .select("item_id, due_date")
        .in("status", ["borrowed", "pending_return"]),
    ]);

    if (error) {
      notify("โหลดข้อมูลไม่สำเร็จ", error.message);
    } else {
      setItems((data || []).sort(compareItems));
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

  const chips = useMemo(() => {
    const countByFilter = (key: FilterKey) =>
      key === "all"
        ? activeItems.length
        : key === "retired"
          ? retiredCount
          : activeItems.filter((item) => getTypeConfig(item.type || item.description || item.name).filter === key).length;

    return [
      { key: "all" as const, label: "ทั้งหมด", icon: "cube-outline", count: countByFilter("all") },
      { key: "microcontroller" as const, label: "Microcontroller", icon: "hardware-chip-outline", count: countByFilter("microcontroller") },
      { key: "sensor" as const, label: "Sensor", icon: "pulse-outline", count: countByFilter("sensor") },
      { key: "module" as const, label: "Module", icon: "cube-outline", count: countByFilter("module") },
      { key: "retired" as const, label: "จำหน่ายแล้ว", icon: "archive-outline", count: countByFilter("retired") },
    ].filter((chip) => chip.key === "all" || chip.count > 0);
  }, [items]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return items.filter((item) => {
      const typeCfg = getTypeConfig(item.type || item.description || item.name);
      const matchesFilter =
        filter === "retired"
          ? item.status === "retired"
          : item.status !== "retired" && (filter === "all" || typeCfg.filter === filter);
      const matchesSearch =
        !q ||
        normalize(item.item_code).includes(q) ||
        normalize(item.name).includes(q) ||
        normalize(item.type).includes(q) ||
        normalize(item.description).includes(q) ||
        normalize(item.barcode).includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [items, search, filter]);

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
        actions: [],
      });
      return;
    }

    const everBorrowed = (records || []).length > 0;
    const actions: SheetAction[] = [];
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
          <HeaderStat icon="cube-outline" label="ทั้งหมด" value={activeItems.length} dotColor="#ffffff" />
          <HeaderStat icon="ellipse" label="พร้อมใช้" value={availableCount} dotColor="#22c55e" />
          <HeaderStat icon="ellipse" label="ถูกยืม/ซ่อม" value={borrowedCount + repairCount} dotColor="#facc15" />
        </View>

        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={19} color="#94a3b8" />
          <TextInput
            style={s.searchInput}
            placeholder="ค้นหารหัส ชื่อ หรือ ประเภท..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
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
          </ScrollView>

          <View style={s.listHeader}>
            <Text style={s.listTitle}>รายการอุปกรณ์</Text>
            <TouchableOpacity style={s.sortBtn} activeOpacity={0.75}>
              <Text style={s.sortMuted}>เรียงตาม</Text>
              <Text style={s.sortText}>รหัส</Text>
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
      <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setSheet(null)}>
          <TouchableOpacity style={s.sheet} activeOpacity={1}>
            <Text style={s.sheetTitle}>{sheet?.title}</Text>
            {!!sheet?.message && <Text style={s.sheetMessage}>{sheet.message}</Text>}
            {sheet?.actions.map((a) => (
              <TouchableOpacity key={a.label} style={s.sheetBtn} onPress={a.onPress} activeOpacity={0.8}>
                <Ionicons name={a.icon} size={18} color={a.tone === "danger" ? C.red : C.purple} />
                <Text style={[s.sheetBtnText, a.tone === "danger" && { color: C.red }]}>{a.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.sheetCancel} onPress={() => setSheet(null)} activeOpacity={0.8}>
              <Text style={s.sheetCancelText}>ปิด</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
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

      {busy && !retireTarget && (
        <View style={s.busyOverlay} pointerEvents="none">
          <ActivityIndicator color={C.purple} />
        </View>
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
    borderColor: "#e2e8f0",
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
    borderColor: "#e2e8f0",
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
