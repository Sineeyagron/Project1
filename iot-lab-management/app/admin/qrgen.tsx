import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import supabase from "../../lib/supabase";

const FS = FileSystem as any;

const C = {
  bg: "#eef3f8",
  purple: "#7c3aed",
  purpleDeep: "#6d28d9",
  purpleDark: "#3f2a8f",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#dbe3ec",
  card: "#ffffff",
  greenBg: "#dcfce7",
  green: "#16a34a",
};

const SIZE_OPTIONS = [
  { key: "small", label: "เล็ก", detail: "2x2 cm", px: 220 },
  { key: "medium", label: "กลาง", detail: "4x4 cm", px: 320 },
  { key: "large", label: "ใหญ่", detail: "6x6 cm", px: 420 },
] as const;

const FORMAT_OPTIONS = [
  { key: "png", label: "PNG", icon: "image-outline" },
  { key: "pdf", label: "PDF", icon: "document-text-outline" },
  { key: "svg", label: "SVG", icon: "crop-outline" },
] as const;

type SizeKey = typeof SIZE_OPTIONS[number]["key"];
type FormatKey = typeof FORMAT_OPTIONS[number]["key"];

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

function makeDeviceCode(seed: string, used: Set<string>) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const digits = "23456789";
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let hash = 0;

  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  for (let salt = 0; salt < 5000; salt += 1) {
    let value = (hash + salt * 97) >>> 0;
    let code = "";
    for (let i = 0; i < 4; i += 1) {
      code += alphabet[value % alphabet.length];
      value = Math.floor(value / alphabet.length);
    }

    if (!/[A-Z]/.test(code)) code = `${letters[(hash + salt) % letters.length]}${code.slice(1)}`;
    if (!/\d/.test(code)) code = `${code.slice(0, 3)}${digits[(hash + salt) % digits.length]}`;

    if (!used.has(code)) {
      used.add(code);
      return code;
    }
  }

  throw new Error("ไม่สามารถสร้างรหัสอุปกรณ์ที่ไม่ซ้ำได้");
}

function itemCode(item?: any) {
  const code = String(item?.barcode || "").trim().toUpperCase();
  return isValidDeviceCode(code) ? code : "----";
}

function qrImageUrl(value: string, size: number, format: FormatKey = "png") {
  const fmt = format === "svg" ? "&format=svg" : "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(value)}${fmt}`;
}

function typeIcon(type?: string) {
  const key = normalize(type);
  if (key.includes("sensor")) return "pulse-outline";
  if (key.includes("sbc") || key.includes("rasp")) return "server-outline";
  return "hardware-chip-outline";
}

function typeShort(type?: string) {
  const key = (type || "Mic").trim();
  return key.length > 8 ? key.slice(0, 3) : key;
}

export default function QRGen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"single" | "batch">("batch");
  const [search, setSearch] = useState("");
  const [sizeKey, setSizeKey] = useState<SizeKey>("medium");
  const [format, setFormat] = useState<FormatKey>("pdf");
  const [includeName, setIncludeName] = useState(true);
  const [includeCode, setIncludeCode] = useState(true);
  const [includeLocation, setIncludeLocation] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("name");

    if (error) {
      Alert.alert("โหลดอุปกรณ์ไม่สำเร็จ", error.message);
    } else {
      const list = await ensureDeviceCodes(data || []);
      setItems(list);
      setSelectedId((current) => current || list[0]?.id || "");
      setSelectedIds((current) => current.length > 0 ? current : list[0]?.id ? [list[0].id] : []);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const ensureDeviceCodes = async (list: any[]) => {
    const used = new Set<string>();
    const next = [...list];
    const updates: Array<{ id: string; barcode: string }> = [];

    next.forEach((item) => {
      const code = String(item.barcode || "").trim().toUpperCase();
      if (isValidDeviceCode(code) && !used.has(code)) {
        used.add(code);
      }
    });

    next.forEach((item) => {
      const code = String(item.barcode || "").trim().toUpperCase();
      if (isValidDeviceCode(code) && used.has(code) && next.filter((row) => String(row.barcode || "").trim().toUpperCase() === code).indexOf(item) === 0) {
        item.barcode = code;
        return;
      }

      if (!isValidDeviceCode(code) || next.filter((row) => String(row.barcode || "").trim().toUpperCase() === code).length > 1) {
        const newCode = makeDeviceCode(`${item.id}-${item.name || ""}`, used);
        item.barcode = newCode;
        updates.push({ id: item.id, barcode: newCode });
      }
    });

    await Promise.all(updates.map((item) =>
      supabase.from("items").update({ barcode: item.barcode }).eq("id", item.id)
    ));

    return next;
  };

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
      normalize(item.name).includes(q) ||
      normalize(item.type).includes(q) ||
      normalize(item.description).includes(q) ||
      normalize(item.barcode).includes(q)
    );
  }, [items, search]);

  const size = SIZE_OPTIONS.find((option) => option.key === sizeKey) || SIZE_OPTIONS[1];
  const qrUrl = previewItem ? qrImageUrl(qrValue(previewItem), size.px, format) : "";
  const selectedIndex = Math.max(0, items.findIndex((item) => item.id === previewItem?.id));

  const goBack = () => router.replace("/admin/home");

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

  const downloadWeb = (url: string, filename: string) => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const buildPrintHtml = (targets: any[]) => {
    const cards = targets.map((item, index) => {
      const code = itemCode(item);
      const image = qrImageUrl(qrValue(item), size.px, "png");
      return `
        <section class="label">
          <div class="brand">LABHUB</div>
          ${includeName ? `<h2>${item.name || "ไม่มีชื่ออุปกรณ์"}</h2>` : ""}
          ${includeCode ? `<p># ${code}</p>` : ""}
          <img src="${image}" />
          ${includeLocation ? `<small>CP9524 · ชั้น 5</small>` : ""}
          <footer>สแกนเพื่อยืม-คืน</footer>
        </section>
      `;
    }).join("");

    return `<!doctype html>
      <html>
        <head>
          <title>LabHub QR Labels</title>
          <style>
            body { margin: 0; padding: 24px; font-family: Arial, sans-serif; background: #fff; color: #0f172a; }
            .sheet { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; }
            .label { border: 1px dashed #c4b5fd; border-radius: 18px; padding: 18px; text-align: center; page-break-inside: avoid; }
            .brand { text-align: left; color: #94a3b8; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
            h2 { margin: 4px 0 0; font-size: 18px; }
            p { margin: 4px 0 10px; color: #64748b; font-size: 13px; font-weight: 700; }
            img { width: 170px; height: 170px; object-fit: contain; }
            small { display: block; color: #64748b; font-size: 12px; margin-top: 8px; }
            footer { border-top: 1px dashed #e2e8f0; margin-top: 12px; padding-top: 10px; color: #94a3b8; font-size: 12px; font-weight: 700; }
          </style>
        </head>
        <body><main class="sheet">${cards}</main><script>window.onload = () => window.print();</script></body>
      </html>`;
  };

  const handleDownload = async () => {
    if (printTargets.length === 0 || !previewItem || !qrUrl) return;
    const code = itemCode(previewItem);
    const filename = `LabHub_QR_${code}.${format === "pdf" ? "html" : format}`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (format === "pdf") {
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(buildPrintHtml(printTargets));
          win.document.close();
        } else {
          window.print();
        }
        return;
      }
      downloadWeb(qrUrl, filename);
      return;
    }

    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("ต้องการสิทธิ์เข้าถึง Gallery", "กรุณาอนุญาตเพื่อบันทึก QR Code ลงเครื่อง");
        return;
      }
      const fileUri = (FS.documentDirectory ?? "") + `LabHub_QR_${code}.png`;
      const { uri } = await FS.downloadAsync(qrImageUrl(qrValue(previewItem), size.px, "png"), fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("บันทึกสำเร็จ", "QR Code ถูกบันทึกลง Gallery แล้ว");
    } catch (e: any) {
      Alert.alert("บันทึกไม่สำเร็จ", e.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (printTargets.length === 0 || typeof window === "undefined") return;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(buildPrintHtml(printTargets));
      win.document.close();
    } else {
      window.print();
    }
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity style={s.iconBtn} onPress={goBack} activeOpacity={0.82}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.titleWrap}>
            <View style={s.titleRow}>
              <Text style={s.headerTitle}>สร้าง QR Code</Text>
              <View style={s.adminPill}>
                <Ionicons name="shield-checkmark" size={11} color="#fff" />
                <Text style={s.adminPillText}>Admin</Text>
              </View>
            </View>
            <View style={s.subtitleRow}>
              <Ionicons name="information-circle-outline" size={12} color="#ddd6fe" />
              <Text style={s.headerSub}>พิมพ์ติดอุปกรณ์เพื่อสแกนยืม-คืน</Text>
            </View>
          </View>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/admin/history" as any)} activeOpacity={0.82}>
            <Ionicons name="time-outline" size={21} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={s.modeTabs}>
          <TouchableOpacity
            style={[s.modeTab, mode === "single" && s.modeTabActive]}
            onPress={() => setMode("single")}
            activeOpacity={0.84}
          >
            <Ionicons name="grid-outline" size={14} color="#fff" />
            <Text style={s.modeTabText}>ทีละตัว</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeTab, mode === "batch" && s.modeTabActive]}
            onPress={() => setMode("batch")}
            activeOpacity={0.84}
          >
            <Ionicons name="albums-outline" size={14} color="#ddd6fe" />
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
        >
          <Section index={1} title="เลือกอุปกรณ์" right={`เลือก ${printTargets.length} รายการ`} />

          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={18} color={C.faint} />
            <TextInput
              style={s.searchInput}
              placeholder="ค้นหาอุปกรณ์..."
              placeholderTextColor={C.faint}
              value={search}
              onChangeText={setSearch}
            />
            <TouchableOpacity style={s.filterBtn} onPress={() => setSearch("")} activeOpacity={0.82}>
              <Ionicons name="options-outline" size={18} color={C.purple} />
            </TouchableOpacity>
          </View>

          <View style={s.itemList}>
            {filtered.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>ไม่พบอุปกรณ์ในระบบ</Text>
              </View>
            ) : filtered.map((item) => {
              const active = mode === "batch" ? selectedIds.includes(item.id) : item.id === selectedItem?.id;
              const index = items.findIndex((i) => i.id === item.id);
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
                    <Text style={s.itemName} numberOfLines={1}>{item.name || "ไม่มีชื่ออุปกรณ์"}</Text>
                  <Text style={s.itemMeta} numberOfLines={1}>{item.type || "อุปกรณ์"} · รหัส #{itemCode(item)}</Text>
                  </View>
                  <View style={[s.checkBox, active && s.checkBoxActive]}>
                    {active && <Ionicons name="checkmark" size={15} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Section index={2} title="ตั้งค่ารูปแบบ" />
          <View style={s.settingsCard}>
            <View style={s.settingHeader}>
              <Text style={s.settingTitle}>ขนาด QR Code</Text>
              <Text style={s.settingHint}>{size.label} · {size.detail}</Text>
            </View>
            <View style={s.optionRow}>
              {SIZE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[s.optionBox, sizeKey === option.key && s.optionBoxActive]}
                  onPress={() => setSizeKey(option.key)}
                  activeOpacity={0.84}
                >
                  <Text style={[s.optionLabel, sizeKey === option.key && s.optionLabelActive]}>{option.label}</Text>
                  <Text style={s.optionDetail}>{option.detail}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.divider} />
            <Text style={s.settingTitle}>รวมข้อมูลในป้าย</Text>
            <ToggleRow icon="pricetag-outline" label="ชื่ออุปกรณ์" value={includeName} onChange={setIncludeName} />
            <ToggleRow icon="barcode-outline" label="รหัสอุปกรณ์" value={includeCode} onChange={setIncludeCode} />
            <ToggleRow icon="business-outline" label="ห้อง/ตำแหน่ง" value={includeLocation} onChange={setIncludeLocation} />

            <View style={s.divider} />
            <Text style={s.settingTitle}>รูปแบบไฟล์</Text>
            <View style={s.optionRow}>
              {FORMAT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[s.formatBox, format === option.key && s.optionBoxActive]}
                  onPress={() => setFormat(option.key)}
                  activeOpacity={0.84}
                >
                  <Ionicons name={option.icon as any} size={20} color={format === option.key ? C.purple : C.muted} />
                  <Text style={[s.formatText, format === option.key && s.optionLabelActive]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Section index={3} title="Preview ก่อนพิมพ์" />
          <View style={s.previewList}>
            {printTargets.length > 0 ? (
              printTargets.map((target) => (
                <QrPreviewCard
                  key={target.id}
                  item={target}
                  index={items.findIndex((item) => item.id === target.id)}
                  imageUrl={qrImageUrl(qrValue(target), size.px, format)}
                  includeName={includeName}
                  includeCode={includeCode}
                  includeLocation={includeLocation}
                />
              ))
            ) : (
              <View style={s.previewCard}>
                <Text style={s.emptyText}>เลือกอุปกรณ์เพื่อสร้าง QR</Text>
              </View>
            )}
          </View>

          <View style={s.actionRow}>
            <TouchableOpacity style={s.downloadBtn} onPress={handleDownload} disabled={printTargets.length === 0 || saving} activeOpacity={0.84}>
              {saving ? <ActivityIndicator color={C.muted} /> : <Ionicons name="download-outline" size={22} color={C.muted} />}
            </TouchableOpacity>
            <TouchableOpacity style={[s.printBtn, printTargets.length === 0 && s.disabledBtn]} onPress={handlePrint} disabled={printTargets.length === 0} activeOpacity={0.9}>
              <Ionicons name="print-outline" size={18} color="#fff" />
              <Text style={s.printText}>พิมพ์ QR Code</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.noteText}>รองรับเครื่องพิมพ์ Label · A4 และ Thermal Printer</Text>
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

function ToggleRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: any;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={s.toggleRow}>
      <View style={s.toggleLabelRow}>
        <Ionicons name={icon} size={17} color={C.muted} />
        <Text style={s.toggleLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#e2e8f0", true: C.purple }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

function QrPreviewCard({
  item,
  index,
  imageUrl,
  includeName,
  includeCode,
  includeLocation,
}: {
  item: any;
  index: number;
  imageUrl: string;
  includeName: boolean;
  includeCode: boolean;
  includeLocation: boolean;
}) {
  return (
    <View style={s.previewCard}>
      <View style={s.previewTop}>
        <View>
          <Text style={s.brandText}>LABHUB</Text>
          {includeName && <Text style={s.previewName} numberOfLines={1}>{item.name}</Text>}
          {includeCode && <Text style={s.previewCode}># {itemCode(item)}</Text>}
        </View>
        <View style={s.typeBadge}><Text style={s.typeBadgeText}>{typeShort(item.type)}</Text></View>
      </View>
      <Image source={{ uri: imageUrl }} style={s.qrImage} resizeMode="contain" />
      {includeLocation && (
        <View style={s.locationRow}>
          <Ionicons name="pin" size={11} color="#ef4444" />
          <Text style={s.locationText}>CP9524 · ชั้น 5</Text>
        </View>
      )}
      <View style={s.previewFooter}>
        <Ionicons name="scan-outline" size={12} color={C.faint} />
        <Text style={s.previewFooterText}>สแกนเพื่อยืม-คืน · ใบที่ {index + 1}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.purple,
    paddingTop: 52,
    paddingHorizontal: 31,
    paddingBottom: 9,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  titleWrap: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "900", lineHeight: 28 },
  adminPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  adminPillText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  headerSub: { color: "#ddd6fe", fontSize: 11, fontWeight: "900" },
  modeTabs: {
    minHeight: 39,
    flexDirection: "row",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
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
  modeTabActive: { backgroundColor: C.purpleDark },
  modeTabText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  newPill: { backgroundColor: "#fde047", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  newPillText: { color: "#854d0e", fontSize: 9, fontWeight: "900" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 31, paddingTop: 15, paddingBottom: 28 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: 9 },
  stepBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" },
  stepText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  sectionTitle: { color: C.ink, fontSize: 14, fontWeight: "900" },
  sectionRight: { color: C.muted, fontSize: 11, fontWeight: "900" },
  searchBox: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 6,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: C.ink, fontSize: 13, fontWeight: "700", paddingVertical: 10 },
  filterBtn: { width: 34, height: 34, borderRadius: 9, backgroundColor: "#f3e8ff", alignItems: "center", justifyContent: "center" },
  itemList: { gap: 9, marginBottom: 18 },
  itemCard: {
    minHeight: 60,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dbe3ec",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  itemCardActive: { borderColor: C.purple, backgroundColor: "#f5f3ff" },
  itemIcon: { width: 45, height: 45, borderRadius: 11, backgroundColor: C.greenBg, alignItems: "center", justifyContent: "center" },
  itemTextWrap: { flex: 1, minWidth: 0 },
  itemName: { color: C.ink, fontSize: 14, fontWeight: "900" },
  itemMeta: { color: C.muted, fontSize: 10.5, fontWeight: "800", marginTop: 3 },
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
    backgroundColor: C.purple,
    borderColor: C.purple,
  },
  emptyCard: { minHeight: 60, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  emptyText: { color: C.faint, fontSize: 13, fontWeight: "800" },
  settingsCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 13,
    marginBottom: 18,
  },
  settingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  settingTitle: { color: C.ink, fontSize: 12.5, fontWeight: "900" },
  settingHint: { color: C.purple, fontSize: 11, fontWeight: "900" },
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
  optionBoxActive: { borderColor: C.purple, backgroundColor: "#faf5ff" },
  optionLabel: { color: C.ink, fontSize: 12, fontWeight: "900" },
  optionLabelActive: { color: C.purple },
  optionDetail: { color: C.muted, fontSize: 10.5, fontWeight: "700", marginTop: 2 },
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
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#c4b5fd",
    padding: 19,
  },
  previewTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandText: { color: C.faint, fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  previewName: { color: C.ink, fontSize: 16, fontWeight: "900", marginTop: 2 },
  previewCode: { color: C.muted, fontSize: 12, fontWeight: "900", marginTop: 2 },
  typeBadge: { backgroundColor: "#ede9fe", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  typeBadgeText: { color: C.purple, fontSize: 10, fontWeight: "900" },
  qrImage: { width: 178, height: 178, alignSelf: "center", marginTop: 11 },
  locationRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 },
  locationText: { color: C.muted, fontSize: 11, fontWeight: "800" },
  previewFooter: { borderTopWidth: 1, borderStyle: "dashed", borderTopColor: C.line, marginTop: 12, paddingTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  previewFooterText: { color: C.faint, fontSize: 11, fontWeight: "900" },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 11 },
  downloadBtn: { width: 47, height: 47, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  printBtn: { flex: 1, minHeight: 47, borderRadius: 12, backgroundColor: C.purpleDeep, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  disabledBtn: { opacity: 0.55 },
  printText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  noteText: { color: C.faint, fontSize: 10.5, fontWeight: "800", textAlign: "center" },
});
