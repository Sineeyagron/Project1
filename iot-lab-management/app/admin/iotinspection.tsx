import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const C = {
  bg: "#f4f4f7",
  purple: "#7c3aed",
  purpleDark: "#6d28d9",
  ink: "#111827",
  text: "#1f2937",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#dddde5",
  card: "#ffffff",
  green: "#10b981",
  orange: "#f59e0b",
  red: "#ef4444",
};

const CONDITION_CFG: Record<string, { color: string; bg: string; label: string; short: string; icon: any }> = {
  good: { color: C.green, bg: "#dcfce7", label: "ใช้งานได้", short: "ปกติ", icon: "hardware-chip-outline" },
  damaged: { color: C.orange, bg: "#fef3c7", label: "กำลังซ่อมแซม", short: "ซ่อมแซม", icon: "construct-outline" },
  missing: { color: C.red, bg: "#fee2e2", label: "เสีย", short: "เสีย", icon: "desktop-outline" },
};

type ConditionKey = "good" | "damaged" | "missing";
type FilterKey = "all" | ConditionKey;

function normalizeCondition(item: any, inspection?: any): ConditionKey {
  if (inspection?.condition === "damaged" || inspection?.condition === "missing" || inspection?.condition === "good") {
    return inspection.condition;
  }

  const status = String(item?.status || "").toLowerCase();
  if (status.includes("repair") || status.includes("damaged")) return "damaged";
  if (status.includes("broken") || status.includes("missing")) return "missing";
  return "good";
}

function latestPerItem(inspections: any[]) {
  const map: Record<string, any> = {};
  for (const row of inspections) {
    if (!map[row.item_id]) map[row.item_id] = row;
  }
  return map;
}

function itemIcon(item: any, condition: ConditionKey) {
  const key = `${item?.name || ""} ${item?.type || ""}`.toLowerCase();
  if (key.includes("wifi") || key.includes("ap") || key.includes("router")) return "wifi-outline";
  if (key.includes("sensor") || key.includes("dht") || key.includes("hc-sr") || key.includes("ultra")) return "pulse-outline";
  if (key.includes("rasp") || key.includes("server") || key.includes("gateway")) return "server-outline";
  if (key.includes("monitor") || key.includes("display")) return "desktop-outline";
  return CONDITION_CFG[condition].icon;
}

function itemLocation(item: any) {
  const description = String(item?.description || "").trim();
  if (description) return description;
  const type = String(item?.type || "").trim();
  return type || "ไม่ระบุตำแหน่ง";
}

function formatTermLabel(term: string) {
  return term.trim() || "-";
}

function formatThaiDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

function relativeInspection(value?: string) {
  if (!value) return "ยังไม่เคยตรวจ";
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return "ยังไม่เคยตรวจ";
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "อัปเดตเมื่อสักครู่";
  if (minutes < 60) return `อัปเดต ${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `อัปเดต ${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `อัปเดต ${days} วันที่แล้ว`;
  return `รายงาน ${formatThaiDate(value)}`;
}

export default function IotInspectionPage() {
  const router = useRouter();

  const [term, setTerm] = useState("1/2568");
  const [activeTerm, setActiveTerm] = useState("1/2568");
  const [items, setItems] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [saving, setSaving] = useState(false);

  const [formModal, setFormModal] = useState(false);
  const [formItem, setFormItem] = useState<any>(null);
  const [formCondition, setFormCondition] = useState<ConditionKey>("good");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    fetchData(activeTerm);
  }, []);

  const fetchData = async (termValue = activeTerm) => {
    const cleanTerm = termValue.trim() || "1/2568";
    setLoading(true);

    const [{ data: allItems, error: itemsError }, { data: inspectionRows, error: inspectionError }] = await Promise.all([
      supabase.from("items").select("*").order("name"),
      supabase
        .from("item_inspections")
        .select("*")
        .eq("term", cleanTerm)
        .order("inspected_at", { ascending: false }),
    ]);

    if (itemsError || inspectionError) {
      Alert.alert("โหลดข้อมูลไม่สำเร็จ", itemsError?.message || inspectionError?.message || "กรุณาลองใหม่อีกครั้ง");
    }

    setItems(allItems || []);
    setInspections(inspectionRows || []);
    setActiveTerm(cleanTerm);
    setTerm(cleanTerm);
    setLoading(false);
    setRefreshing(false);
  };

  const submitSearch = () => {
    fetchData(term);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(activeTerm);
  };

  const latestMap = useMemo(() => latestPerItem(inspections), [inspections]);

  const decoratedItems = useMemo(() => {
    return items.map((item) => {
      const inspection = latestMap[item.id];
      const condition = normalizeCondition(item, inspection);
      return { item, inspection, condition, cfg: CONDITION_CFG[condition] };
    });
  }, [items, latestMap]);

  const counts = useMemo(() => {
    const good = decoratedItems.filter((row) => row.condition === "good").length;
    const damaged = decoratedItems.filter((row) => row.condition === "damaged").length;
    const missing = decoratedItems.filter((row) => row.condition === "missing").length;
    return { good, damaged, missing };
  }, [decoratedItems]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return decoratedItems;
    return decoratedItems.filter((row) => row.condition === filter);
  }, [decoratedItems, filter]);

  const openForm = (item: any, condition: ConditionKey, inspection?: any) => {
    setFormItem(item);
    setFormCondition(condition);
    setFormNotes(inspection?.notes || "");
    setFormModal(true);
  };

  const saveInspection = async () => {
    if (!formItem) return;
    const cleanTerm = activeTerm.trim() || "1/2568";
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("item_inspections")
      .upsert(
        {
          term: cleanTerm,
          item_id: formItem.id,
          condition: formCondition,
          notes: formNotes.trim() || null,
          inspector_id: user?.id || null,
          inspected_at: new Date().toISOString(),
        },
        { onConflict: "term,item_id" }
      );

    setSaving(false);

    if (error) {
      Alert.alert("บันทึกไม่สำเร็จ", error.message);
      return;
    }

    setFormModal(false);
    await fetchData(cleanTerm);
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.replace("/admin/home")} activeOpacity={0.82}>
            <Ionicons name="arrow-back" size={21} color="#ffffff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>ตรวจสภาพ IoT ประจำเทอม</Text>
          <View style={s.headerSpacer} />
        </View>

        <View style={s.searchRow}>
          <TextInput
            style={s.termInput}
            value={term}
            onChangeText={setTerm}
            placeholder="1/2568"
            placeholderTextColor="#8b8b95"
            returnKeyType="search"
            onSubmitEditing={submitSearch}
          />
          <TouchableOpacity style={s.searchBtn} onPress={submitSearch} activeOpacity={0.82}>
            <Ionicons name="search-outline" size={22} color="#1f2937" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />}
      >
        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={C.purple} />
            <Text style={s.loadingText}>กำลังโหลดข้อมูลจริง...</Text>
          </View>
        ) : (
          <>
            <View style={s.statGrid}>
              <SummaryCard value={counts.good} label="ใช้งานได้" color={C.green} />
              <SummaryCard value={counts.damaged} label="ซ่อมแซม" color={C.orange} />
              <SummaryCard value={counts.missing} label="เสีย" color={C.red} />
            </View>

            <View style={s.filterRow}>
              <FilterChip label="ทั้งหมด" active={filter === "all"} onPress={() => setFilter("all")} />
              <FilterChip label="ใช้งานได้" active={filter === "good"} onPress={() => setFilter("good")} />
              <FilterChip label="ซ่อมแซม" active={filter === "damaged"} onPress={() => setFilter("damaged")} />
              <FilterChip label="เสีย" active={filter === "missing"} onPress={() => setFilter("missing")} />
            </View>

            <Text style={s.sectionTitle}>อุปกรณ์ทั้งหมด — เทอม {formatTermLabel(activeTerm)}</Text>

            {filteredItems.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="hardware-chip-outline" size={36} color="#cbd5e1" />
                <Text style={s.emptyText}>ไม่พบอุปกรณ์ในสถานะนี้</Text>
              </View>
            ) : (
              <View style={s.list}>
                {filteredItems.map(({ item, inspection, condition, cfg }) => (
                  <TouchableOpacity
                    key={item.id}
                    style={s.itemCard}
                    onPress={() => openForm(item, condition, inspection)}
                    activeOpacity={0.86}
                  >
                    <View style={[s.itemIcon, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={itemIcon(item, condition)} size={23} color={cfg.color} />
                    </View>

                    <View style={s.itemMiddle}>
                      <Text style={s.itemName} numberOfLines={1}>{item.name || "อุปกรณ์"}</Text>
                      <Text style={s.itemLocation} numberOfLines={1}>{itemLocation(item)}</Text>
                      <View style={s.inlineStatus}>
                        <View style={[s.statusDot, { backgroundColor: cfg.color }]} />
                        <Text style={[s.inlineStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    </View>

                    <View style={s.itemRight}>
                      <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
                        <Text style={[s.statusPillText, { color: cfg.color }]}>{cfg.short}</Text>
                      </View>
                      <Text style={s.updatedText} numberOfLines={1}>
                        {inspection?.inspected_at
                          ? relativeInspection(inspection.inspected_at)
                          : item.status === "available"
                            ? "จากสถานะระบบ"
                            : "ยังไม่เคยตรวจ"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

          </>
        )}
      </ScrollView>

      <Modal visible={formModal} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.modalTitle}>{formItem?.name || "อุปกรณ์"}</Text>
                <Text style={s.modalSub}>เทอม {activeTerm}</Text>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={() => setFormModal(false)}>
                <Ionicons name="close" size={22} color={C.muted} />
              </TouchableOpacity>
            </View>

            <Text style={s.modalLabel}>สภาพอุปกรณ์</Text>
            <View style={s.conditionRow}>
              {(["good", "damaged", "missing"] as const).map((key) => {
                const cfg = CONDITION_CFG[key];
                const active = formCondition === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.conditionBtn, { borderColor: cfg.color }, active && { backgroundColor: cfg.bg }]}
                    onPress={() => setFormCondition(key)}
                    activeOpacity={0.82}
                  >
                    <Ionicons name={cfg.icon} size={19} color={cfg.color} />
                    <Text style={[s.conditionText, { color: cfg.color }]}>{cfg.short}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.modalLabel}>หมายเหตุ</Text>
            <TextInput
              style={s.notesInput}
              placeholder="รายละเอียดเพิ่มเติม..."
              placeholderTextColor="#94a3b8"
              value={formNotes}
              onChangeText={setFormNotes}
              multiline
            />

            <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.65 }]} onPress={saveInspection} disabled={saving}>
              {saving ? <ActivityIndicator color="#ffffff" /> : (
                <>
                  <Ionicons name="save-outline" size={18} color="#ffffff" />
                  <Text style={s.saveText}>บันทึกผลตรวจ</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SummaryCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={s.summaryCard}>
      <Text style={[s.summaryValue, { color }]}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.filterChip, active && s.filterChipActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[s.filterText, active && s.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.purple,
    paddingTop: 22,
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  headerSpacer: { width: 36 },
  searchRow: {
    height: 30,
    borderRadius: 4,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  termInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 11,
    color: C.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  searchBtn: {
    width: 37,
    height: 28,
    marginRight: 1,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  loadingBox: { alignItems: "center", paddingVertical: 70, gap: 10 },
  loadingText: { color: C.faint, fontSize: 13, fontWeight: "700" },
  statGrid: { flexDirection: "row", gap: 9, marginBottom: 12 },
  summaryCard: {
    flex: 1,
    minHeight: 60,
    borderRadius: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: { fontSize: 21, fontWeight: "900", lineHeight: 24 },
  summaryLabel: { color: C.ink, fontSize: 10, marginTop: 5, fontWeight: "500" },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 13, flexWrap: "wrap" },
  filterChip: {
    minHeight: 27,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: C.purple,
    borderColor: C.purple,
    shadowColor: C.purple,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  filterText: { color: C.ink, fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: "#ffffff" },
  sectionTitle: { color: C.text, fontSize: 12, fontWeight: "600", marginBottom: 10 },
  list: { gap: 11 },
  itemCard: {
    minHeight: 76,
    backgroundColor: C.card,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    shadowColor: "#94a3b8",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemMiddle: { flex: 1, minWidth: 0 },
  itemName: { color: C.ink, fontSize: 14, fontWeight: "900", lineHeight: 18 },
  itemLocation: { color: "#374151", fontSize: 11, fontWeight: "600", marginTop: 1 },
  inlineStatus: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  inlineStatusText: { fontSize: 11, fontWeight: "800" },
  itemRight: { alignItems: "flex-end", maxWidth: 98 },
  statusPill: {
    minWidth: 77,
    minHeight: 22,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPillText: { fontSize: 10, fontWeight: "900" },
  updatedText: { color: "#374151", fontSize: 10, fontWeight: "600", marginTop: 9, textAlign: "right" },
  emptyBox: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    paddingVertical: 42,
    gap: 8,
  },
  emptyText: { color: C.faint, fontSize: 13, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(17,24,39,0.42)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  modalHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  modalTitle: { color: C.ink, fontSize: 18, fontWeight: "900" },
  modalSub: { color: C.faint, fontSize: 12, fontWeight: "700", marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  modalLabel: { color: C.muted, fontSize: 12, fontWeight: "900", marginBottom: 8, marginTop: 4 },
  conditionRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  conditionBtn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  conditionText: { fontSize: 11, fontWeight: "900" },
  notesInput: {
    minHeight: 82,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#f8fafc",
    padding: 12,
    color: C.ink,
    fontSize: 13,
    textAlignVertical: "top",
  },
  saveBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: C.purpleDark,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveText: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
});
