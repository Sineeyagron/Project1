import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import SearchBar from "../../components/SearchBar";
import { Text, TextInput } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as MediaLibrary from "expo-media-library/legacy";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import Svg, { Path } from "react-native-svg";
import supabase from "../../lib/supabase";
import { goBack as navBack, useRefreshOnFocus } from "../../lib/nav";
import { useRole } from "../../lib/roles";
import { notify } from "../../lib/notify";
import { LABELS_PER_SHEET, buildLabelSheetHtml, formatItemNo, qrMatrix } from "../../lib/labels";
import { W, NG } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";

const FS = FileSystem as any;

const C = {
  bg: "#EAF1FC",
  purple: "#2563EB",
  purpleDeep: "#1D4ED8",
  purpleDark: "#1D4ED8",
  ink: "#172033",
  muted: "#475569",
  faint: "#64748B",
  line: "#dbe3ec",
  card: "#ffffff",
  greenBg: "#ECFDF5",
  green: "#047857",
};

function normalize(value?: string) {
  return (value || "").trim().toLowerCase();
}

function qrValue(item?: any) {
  if (!item) return "";
  return String(item.barcode || item.id || "");
}

function isValidDeviceCode(value?: string) {
  const code = (value || "").trim().toUpperCase();
  return /^[A-Z0-9]{4}$/.test(code) && /[A-Z]/.test(code) && /\d/.test(code);
}

function itemCode(item?: any) {
  const code = String(item?.barcode || "").trim().toUpperCase();
  return isValidDeviceCode(code) ? code : "----";
}

// ใช้เฉพาะปุ่มบันทึก QR ลงแกลเลอรี่ในมือถือ (ป้ายพิมพ์สร้าง QR เองใน lib/labels.ts)
function qrImageUrl(value: string, size: number) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(value)}`;
}

function typeIcon(type?: string) {
  const key = normalize(type);
  if (key.includes("sensor")) return "pulse-outline";
  if (key.includes("sbc") || key.includes("rasp")) return "server-outline";
  return "hardware-chip-outline";
}

function compareItems(a: any, b: any) {
  const byPrefix = (a.item_prefix || a.name || "").localeCompare(b.item_prefix || b.name || "", "th");
  return byPrefix !== 0 ? byPrefix : (a.item_no || 0) - (b.item_no || 0);
}

export default function QRGen() {
  const { role } = useRole();
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"single" | "batch">("batch");
  const [search, setSearch] = useState("");
  const [startAt, setStartAt] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);
  // กลับมาหน้านี้ (ปุ่ม ← / สลับแท็บ) → โหลดข้อมูลใหม่
  useRefreshOnFocus(() => { fetchItems(); });

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("items")
      .select("*, borrow_locations(name)")
      .neq("status", "retired");

    if (error) {
      notify("โหลดอุปกรณ์ไม่สำเร็จ", error.message);
    } else {
      const rows = (data || [])
        .map((row: any) => ({ ...row, location_name: row.borrow_locations?.name || "" }))
        .sort(compareItems);
      const list = await ensureDeviceCodes(rows);
      setItems(list);
      setSelectedId((current) => current || list[0]?.id || "");
      setSelectedIds((current) => current.length > 0 ? current : list[0]?.id ? [list[0].id] : []);
    }

    setLoading(false);
    setRefreshing(false);
  };

  // รหัสสแกน 4 ตัว (barcode) ฐานข้อมูลออกให้ตอนเพิ่มของ ไม่ซ้ำ และล็อกไว้ — หน้านี้แค่อ่านไปพิมพ์
  // (เดิมหน้านี้สุ่มรหัสใหม่แล้วเขียนทับ ถ้าเห็นว่ารหัสเดิมผิดรูปแบบ → ป้ายที่ติดไปแล้วสแกนไม่เจอ
  //  และบัญชี TA เขียนไม่ได้ ป้ายจะพิมพ์รหัสที่ไม่มีในระบบ)
  const ensureDeviceCodes = async (list: any[]) =>
    list.map((item) => ({ ...item, barcode: String(item.barcode || "").trim().toUpperCase() }));

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || items[0],
    [items, selectedId]
  );
  const batchItems = useMemo(
    () => selectedIds.map((id) => items.find((item) => item.id === id)).filter(Boolean),
    [items, selectedIds]
  );
  const previewItem = mode === "batch" ? batchItems[0] : selectedItem;
  const printTargets = mode === "batch" ? batchItems : selectedItem ? [selectedItem] : [];

  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return items;
    return items.filter((item) =>
      normalize(item.item_code).includes(q) ||
      normalize(item.name).includes(q) ||
      normalize(item.type).includes(q) ||
      normalize(item.description).includes(q) ||
      normalize(item.barcode).includes(q)
    );
  }, [items, search]);

  const sheetCount = Math.ceil((startAt - 1 + printTargets.length) / LABELS_PER_SHEET);

  const goBack = () => navBack("/admin/home");

  const onRefresh = () => {
    setRefreshing(true);
    fetchItems();
  };

  const toggleItem = (item: any) => {
    if (mode === "single") {
      setSelectedId(item.id);
      setSelectedIds([item.id]);
      return;
    }

    setSelectedIds((current) => {
      if (current.includes(item.id)) {
        const next = current.filter((id) => id !== item.id);
        if (selectedId === item.id && next[0]) setSelectedId(next[0]);
        return next;
      }
      setSelectedId(item.id);
      return [...current, item.id];
    });
  };

  const selectAllShown = () => {
    setMode("batch");
    setSelectedIds(filtered.map((item) => item.id));
    if (filtered[0]) setSelectedId(filtered[0].id);
  };

  // มือถือ: บันทึกรูป QR ของชิ้นที่เลือกลงแกลเลอรี่
  const handleDownload = async () => {
    if (!previewItem) return;
    const code = itemCode(previewItem);
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        notify("ต้องการสิทธิ์เข้าถึง Gallery", "กรุณาอนุญาตเพื่อบันทึก QR Code ลงเครื่อง");
        return;
      }
      const fileUri = (FS.documentDirectory ?? "") + `LabHub_QR_${code}.png`;
      const { uri } = await FS.downloadAsync(qrImageUrl(qrValue(previewItem), 420), fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      notify("บันทึกสำเร็จ", "QR Code ถูกบันทึกลง Gallery แล้ว");
    } catch (e: any) {
      notify("บันทึกไม่สำเร็จ", e.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  // มือถือ: สร้างแผ่นป้าย A4 เป็น PDF แล้วเปิดเมนูแชร์ (LINE, อีเมล, Drive, บันทึกลงเครื่อง)
  const handleSharePdf = async () => {
    if (printTargets.length === 0) return;
    setSaving(true);
    try {
      const { uri } = await Print.printToFileAsync({
        html: buildLabelSheetHtml(printTargets, startAt, false),
        width: 595,   // A4 = 595 × 842 pt
        height: 842,
        margins: { top: 23, bottom: 23, left: 28, right: 28 }, // 8 มม. / 10 มม. (iOS)
      });
      if (!(await Sharing.isAvailableAsync())) {
        notify("แชร์ไม่ได้ในเครื่องนี้", `ไฟล์อยู่ที่ ${uri}`);
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: `ป้าย QR ${printTargets.length} ชิ้น`,
      });
    } catch (e: any) {
      notify("สร้าง PDF ไม่สำเร็จ", e.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  // เว็บ: เปิดแผ่นป้าย A4 แล้วเด้งกล่องพิมพ์ (เลือก Save as PDF ได้)
  const handlePrint = () => {
    if (printTargets.length === 0) return;
    if (Platform.OS !== "web" || typeof window === "undefined") {
      handleSharePdf();
      return;
    }
    const win = window.open("", "_blank");
    if (!win) {
      notify("เปิดหน้าพิมพ์ไม่ได้", "เบราว์เซอร์บล็อกหน้าต่างใหม่ อนุญาต pop-up ให้เว็บนี้แล้วลองอีกครั้ง");
      return;
    }
    win.document.write(buildLabelSheetHtml(printTargets, startAt));
    win.document.close();
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <ScreenHeader
          title={"สร้าง QR Code"}
          subtitle={"พิมพ์ติดอุปกรณ์เพื่อสแกนยืม-คืน"}
          onBack={() => goBack()}
          bleed={16}
          style={{ marginBottom: 0 }}
        />

        <View style={s.modeTabs}>
          <TouchableOpacity
            style={[s.modeTab, mode === "single" && s.modeTabActive]}
            onPress={() => setMode("single")}
            activeOpacity={0.84}
          >
            <Ionicons name="grid-outline" size={14} color="#1D4ED8" />
            <Text style={s.modeTabText}>ทีละตัว</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeTab, mode === "batch" && s.modeTabActive]}
            onPress={() => setMode("batch")}
            activeOpacity={0.84}
          >
            <Ionicons name="albums-outline" size={14} color="#1D4ED8" />
            <Text style={s.modeTabText}>หลายตัว (Batch)</Text>
            <View style={s.newPill}><Text style={s.newPillText}>ใหม่</Text></View>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={s.loading}><ActivityIndicator size="large" color={C.purple} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />}
          showsVerticalScrollIndicator
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.sectionWithAction}>
            <Section index={1} title="เลือกอุปกรณ์" right={`เลือก ${printTargets.length} รายการ`} />
            {filtered.length > 1 && (
              <TouchableOpacity onPress={selectAllShown} activeOpacity={0.8}>
                <Text style={s.selectAllText}>เลือกทั้งหมดที่แสดง ({filtered.length})</Text>
              </TouchableOpacity>
            )}
          </View>

          <SearchBar value={search} onChangeText={setSearch} placeholder="ค้นหาอุปกรณ์" />

          <View style={s.itemList}>
            {filtered.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>ไม่พบอุปกรณ์ในระบบ</Text>
              </View>
            ) : filtered.map((item) => {
              const active = mode === "batch" ? selectedIds.includes(item.id) : item.id === selectedItem?.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.itemCard, active && s.itemCardActive]}
                  onPress={() => toggleItem(item)}
                  activeOpacity={0.86}
                >
                  <View style={s.itemIcon}>
                    <Ionicons name={typeIcon(item.type || item.description) as any} size={23} color={C.green} />
                  </View>
                  <View style={s.itemTextWrap}>
                    <Text style={s.itemName} numberOfLines={1}>{item.item_code || item.name || "ไม่มีชื่ออุปกรณ์"}</Text>
                    <Text style={s.itemMeta} numberOfLines={1}>{item.name} · สแกน {itemCode(item)}</Text>
                  </View>
                  <View style={[s.checkBox, active && s.checkBoxActive]}>
                    {active && <Ionicons name="checkmark" size={15} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Section index={2} title="แผ่นสติกเกอร์" />
          <View style={s.settingsCard}>
            <View style={s.settingHeader}>
              <Text style={s.settingTitle}>ป้าย 6 × 2.8 ซม. · A4 แผ่นละ {LABELS_PER_SHEET} ชิ้น</Text>
            </View>
            <Text style={s.settingHint}>พิมพ์ที่ขนาด 100% ห้ามเลือก "ย่อให้พอดีหน้า"</Text>

            <View style={s.divider} />
            <View style={s.settingHeader}>
              <Text style={s.settingTitle}>เริ่มพิมพ์ที่ช่องที่</Text>
              <View style={s.stepper}>
                <TouchableOpacity
                  style={s.stepperBtn}
                  onPress={() => setStartAt((n) => Math.max(1, n - 1))}
                  activeOpacity={0.8}
                >
                  <Ionicons name="remove" size={16} color={C.purple} />
                </TouchableOpacity>
                <Text style={s.stepperValue}>{startAt}</Text>
                <TouchableOpacity
                  style={s.stepperBtn}
                  onPress={() => setStartAt((n) => Math.min(LABELS_PER_SHEET, n + 1))}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={16} color={C.purple} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={s.settingHint}>
              ใช้กับแผ่นที่ลอกไปแล้วบางส่วน นับซ้ายไปขวา บนลงล่าง (แถวละ 3 ช่อง)
              {printTargets.length > 0 ? ` · ใช้ ${sheetCount} แผ่น` : ""}
            </Text>
          </View>

          <Section index={3} title="Preview ก่อนพิมพ์" />
          <View style={s.previewList}>
            {printTargets.length > 0 ? (
              printTargets.map((target) => <LabelPreview key={target.id} item={target} />)
            ) : (
              <View style={s.previewCard}>
                <Text style={s.emptyText}>เลือกอุปกรณ์เพื่อสร้าง QR</Text>
              </View>
            )}
          </View>

          <View style={s.actionRow}>
            {Platform.OS !== "web" && (
              <TouchableOpacity style={s.downloadBtn} onPress={handleDownload} disabled={!previewItem || saving} activeOpacity={0.84}>
                {saving ? <ActivityIndicator color={C.muted} /> : <Ionicons name="download-outline" size={22} color={C.muted} />}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.printBtn, (printTargets.length === 0 || saving) && s.disabledBtn]}
              onPress={handlePrint}
              disabled={printTargets.length === 0 || saving}
              activeOpacity={0.9}
            >
              <Ionicons name={Platform.OS === "web" ? "print-outline" : "share-outline"} size={18} color="#fff" />
              <Text style={s.printText}>
                {Platform.OS === "web" ? "พิมพ์ป้าย" : "บันทึก / แชร์ PDF"}
                {printTargets.length > 0 ? ` ${printTargets.length} ชิ้น` : ""}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={s.noteText}>
            {Platform.OS === "web"
              ? "เลือก Save as PDF ในหน้าพิมพ์ได้ · พิมพ์ที่ 100% บน A4"
              : "ส่ง PDF ไป LINE / อีเมล / Drive แล้วพิมพ์ที่ 100% บน A4"}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

function Section({ index, title, right }: { index: number; title: string; right?: string }) {
  return (
    <View style={s.sectionRow}>
      <View style={s.sectionLeft}>
        <View style={s.stepBadge}><Text style={s.stepText}>{index}</Text></View>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {right ? <Text style={s.sectionRight}>{right}</Text> : null}
    </View>
  );
}

// ตัวอย่างป้ายบนจอ สัดส่วนเดียวกับป้ายจริง (60×28 มม. → 1 มม. = 5 px)
function LabelPreview({ item }: { item: any }) {
  const { size, path } = useMemo(() => qrMatrix(qrValue(item)), [item]);
  const room = item.location_name ? `ห้อง ${item.location_name}` : "";
  return (
    <View style={s.label}>
      <Svg width={120} height={120} viewBox={`-1 -1 ${size + 2} ${size + 2}`}>
        <Path d={path} fill="#000" />
      </Svg>
      <View style={s.labelText}>
        <Text style={s.labelPrefix} numberOfLines={1}>{item.item_prefix || item.name}</Text>
        <Text style={s.labelNo}>{formatItemNo(item.item_no)}</Text>
        <Text style={s.labelName} numberOfLines={1}>{item.name}</Text>
        <Text style={s.labelSub} numberOfLines={1}>{[itemCode(item), room].filter(Boolean).join(" · ")}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: {
    width: 300,
    height: 140,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#aaa",
    overflow: "hidden",
  },
  labelText: { flex: 1, minWidth: 0 },
  labelPrefix: { fontSize: 21, fontWeight: "700", color: "#000", lineHeight: 23 },
  labelNo: { fontSize: 32, fontWeight: "700", color: "#000", lineHeight: 34 },
  labelName: { fontSize: 13, color: "#000", marginTop: 4 },
  labelSub: { fontSize: 12, color: "#444", marginTop: 3 },
  sectionWithAction: { gap: 2 },
  selectAllText: { color: C.purple, fontSize: 12, fontWeight: "800", textAlign: "right", marginBottom: 8 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepperBtn: {
    width: 30, height: 30, borderRadius: 8,
    borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center",
  },
  stepperValue: { minWidth: 24, textAlign: "center", fontSize: 15, fontWeight: "900", color: C.ink },
  container: { ...W.page, flex: 1 },
  header: {
    paddingTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 9,
  },
  headerTop: {
    ...W.headerBar, marginHorizontal: -16, paddingTop: 52, paddingHorizontal: 16, paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    ...W.iconBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  titleWrap: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { color: "#172033", fontSize: 20, fontWeight: "700", lineHeight: 28 },
  adminPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.78)", boxShadow: "inset 0 1px 0 #FFFFFF, 0 2px 8px rgba(37,99,235,0.10)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  adminPillText: { color: "#475569", fontSize: 10, fontWeight: "900" },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  headerSub: { color: "#475569", fontSize: 12 },
  modeTabs: {
    minHeight: 39,
    flexDirection: "row",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.78)", boxShadow: "inset 0 1px 0 #FFFFFF, 0 2px 8px rgba(37,99,235,0.10)",
    borderWidth: 1,
    borderColor: "#D3E0F5",
    borderRadius: 11,
    padding: 4,
    marginTop: 18,
  },
  modeTab: {
    flex: 1,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  modeTabActive: { ...NG, backgroundColor: "#FFFFFF", boxShadow: "0 2px 6px rgba(37,99,235,0.18)" },
  modeTabText: { color: "#172033", fontSize: 13, fontWeight: "600" },
  newPill: { backgroundColor: "#fde047", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  newPillText: { color: "#854d0e", fontSize: 9, fontWeight: "900" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 31, paddingTop: 15, paddingBottom: 28 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: 9 },
  stepBadge: { ...NG, width: 22, height: 22, borderRadius: 11, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" },
  stepText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  sectionTitle: { color: C.ink, fontSize: 14, fontWeight: "900" },
  sectionRight: { color: C.muted, fontSize: 12, fontWeight: "900" },
  searchBox: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    ...W.input,
    borderWidth: 0,
    paddingLeft: 14,
    paddingRight: 6,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: C.ink, fontSize: 13, fontWeight: "700", paddingVertical: 10 },
  filterBtn: { width: 34, height: 34, borderRadius: 9, backgroundColor: "#EEF5FF", alignItems: "center", justifyContent: "center" },
  itemList: { gap: 9, marginBottom: 18 },
  itemCard: {
    ...W.card,
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  itemCardActive: { ...NG, borderColor: C.purple, backgroundColor: "#EEF5FF" },
  itemIcon: { width: 45, height: 45, borderRadius: 11, backgroundColor: C.greenBg, alignItems: "center", justifyContent: "center" },
  itemTextWrap: { flex: 1, minWidth: 0 },
  itemName: { color: C.ink, fontSize: 14, fontWeight: "900" },
  itemMeta: { color: C.muted, fontSize: 12, fontWeight: "800", marginTop: 3 },
  checkBox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxActive: {
    ...NG,
    backgroundColor: C.purple,
    borderColor: C.purple,
  },
  emptyCard: { ...W.card, minHeight: 60, alignItems: "center", justifyContent: "center" },
  emptyText: { color: C.faint, fontSize: 13, fontWeight: "800" },
  settingsCard: {
    ...W.card,
    padding: 13,
    marginBottom: 18,
  },
  settingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  settingTitle: { color: C.ink, fontSize: 12.5, fontWeight: "900" },
  settingHint: { color: C.purple, fontSize: 12, fontWeight: "900" },
  optionRow: { flexDirection: "row", gap: 8 },
  optionBox: {
    flex: 1,
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  optionBoxActive: { ...NG, borderColor: C.purple, backgroundColor: "#F5F9FF" },
  optionLabel: { color: C.ink, fontSize: 12, fontWeight: "900" },
  optionLabelActive: { color: C.purple },
  optionDetail: { color: C.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 14 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 37 },
  toggleLabelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggleLabel: { color: C.ink, fontSize: 12.5, fontWeight: "900" },
  formatBox: {
    flex: 1,
    minHeight: 61,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  formatText: { color: C.muted, fontSize: 12, fontWeight: "900" },
  previewList: {
    gap: 12,
    marginBottom: 16,
  },
  previewCard: {
    ...W.card,
    borderStyle: "dashed",
    padding: 19,
  },
  previewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandText: { color: C.faint, fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },
  previewName: { color: C.ink, fontSize: 16, fontWeight: "900", marginTop: 2 },
  previewCode: { color: C.muted, fontSize: 12, fontWeight: "900", marginTop: 2 },
  typeBadge: { ...NG, backgroundColor: "#DBEAFE", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  typeBadgeText: { color: C.purple, fontSize: 10, fontWeight: "900" },
  qrImage: { width: 178, height: 178, alignSelf: "center", marginTop: 11 },
  locationRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 },
  locationText: { color: C.muted, fontSize: 12, fontWeight: "800" },
  previewFooter: { borderTopWidth: 1, borderStyle: "dashed", borderTopColor: C.line, marginTop: 12, paddingTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  previewFooterText: { color: C.faint, fontSize: 12, fontWeight: "900" },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 11 },
  downloadBtn: { width: 47, height: 47, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  printBtn: { flex: 1, minHeight: 47, borderRadius: 12, backgroundColor: C.purpleDeep, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  disabledBtn: { opacity: 0.55 },
  printText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  noteText: { color: C.faint, fontSize: 12, fontWeight: "800", textAlign: "center" },
});
