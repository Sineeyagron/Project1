import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";
import { ITEM_STATUS, RECORD_STATUS as RECORD_STYLE } from "../../lib/status";
import { goBack } from "../../lib/nav";
import { notify } from "../../lib/notify";
import { photoStamp } from "../../lib/borrowPhotos";
import { ageText, thaiDate, warrantyInfo } from "../../lib/itemInfo";

// Admin สแกน = ดูสถานะอย่างเดียว (แผน 2.6): ชื่อ รหัส สถานะ ผู้ยืม กำหนดคืน อายุ ประกัน ประวัติ
// การยืม/คืนต้องให้นักศึกษาสแกนขอเอง แล้วผู้ดูแลอนุมัติในกล่องคำขอ

const C = {
  bg: "#eef3f8",
  purple: "#7c3aed",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  green: "#16a34a",
  orange: "#c2410c",
  red: "#dc2626",
};

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  ...ITEM_STATUS,
};

const RECORD_STATUS: Record<string, string> = {
  borrowed: RECORD_STYLE.borrowed.label,
  pending_return: RECORD_STYLE.pending_return.label,
  returned: RECORD_STYLE.returned.label,
};

const warrantyText = warrantyInfo;

async function findItem(code: string) {
  const raw = code.trim();
  const upper = raw.toUpperCase();
  const pick = async (q: any) => (await q.limit(1).maybeSingle()).data;

  let item = await pick(supabase.from("items").select("*, borrow_locations(name), categories(name)").eq("barcode", upper));
  if (!item) item = await pick(supabase.from("items").select("*, borrow_locations(name), categories(name)").ilike("item_code", raw));
  if (!item && /^[0-9a-f-]{36}$/i.test(raw)) {
    item = await pick(supabase.from("items").select("*, borrow_locations(name), categories(name)").eq("id", raw));
  }
  if (!item) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.name) {
        item = await pick(supabase.from("items").select("*, borrow_locations(name), categories(name)").ilike("name", parsed.name.trim()));
      }
    } catch { /* ไม่ใช่ QR รุ่นเก่า */ }
  }
  return item;
}

export default function AdminLookup() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [pending, setPending] = useState<any>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [zoom, setZoom] = useState<{ url: string; stamp: string } | null>(null);

  const lookup = async (value: string) => {
    if (!value.trim()) return;
    setLoading(true);
    setNotFound(false);
    const found = await findItem(value);
    if (!found) {
      setItem(null);
      setNotFound(true);
      setLoading(false);
      scanLock.current = false;
      return;
    }

    const [{ data: recs, error }, { data: req }] = await Promise.all([
      supabase
        .from("borrow_records")
        .select("*")
        .eq("item_id", found.id)
        .order("borrow_date", { ascending: false })
        .limit(10),
      supabase
        .from("borrow_requests")
        .select("id, kind, user_id, created_at, expires_at")
        .eq("item_id", found.id)
        .eq("status", "pending")
        .maybeSingle(),
    ]);
    if (error) notify("โหลดประวัติไม่สำเร็จ", error.message);

    const list = recs || [];
    const userIds = [...new Set([...list.map((r: any) => r.user_id), req?.user_id].filter(Boolean))];
    const emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, email").in("id", userIds);
      (profs || []).forEach((p: any) => { emailMap[p.id] = p.email; });
    }

    const paths = list.flatMap((r: any) => [r.borrow_photo_path, r.return_photo_path]).filter(Boolean);
    const photoMap: Record<string, string> = {};
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage.from("borrow-photos").createSignedUrls(paths, 60 * 60);
      (signed || []).forEach((s: any) => { if (s.path && s.signedUrl) photoMap[s.path] = s.signedUrl; });
    }

    setItem(found);
    setRecords(list);
    setPending(req || null);
    setEmails(emailMap);
    setPhotos(photoMap);
    setLoading(false);
  };

  const onBarcode = ({ data }: { data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    lookup(data);
  };

  const reset = () => {
    scanLock.current = false;
    setItem(null);
    setNotFound(false);
    setCode("");
  };

  const active = records.find((r) => r.status === "borrowed" || r.status === "pending_return");
  const overdueDays = active?.due_date
    ? Math.floor((Date.now() - new Date(`${active.due_date}T23:59:59`).getTime()) / 86400000) + 1
    : 0;

  const Thumb = ({ path, label }: { path?: string; label: string }) => {
    const url = path ? photos[path] : null;
    if (!url) return null;
    const stamp = photoStamp(item?.item_code, null);
    return (
      <TouchableOpacity onPress={() => setZoom({ url, stamp: `${label} · ${stamp}` })} activeOpacity={0.9} style={s.thumbWrap}>
        <Image source={{ uri: url }} style={s.thumb} />
        <Text style={s.thumbLabel}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => goBack("/admin/home")} activeOpacity={0.82}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>สแกนดูสถานะ</Text>
          <Text style={s.headerSub}>ดูข้อมูลอุปกรณ์ ผู้ยืม และประวัติ</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {!item && (
          <>
            <View style={s.cameraBox}>
              {loading ? (
                <ActivityIndicator size="large" color={C.purple} />
              ) : permission?.granted ? (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  onBarcodeScanned={onBarcode}
                  barcodeScannerSettings={{ barcodeTypes: ["qr", "code128", "code39", "ean13"] }}
                />
              ) : (
                <TouchableOpacity style={{ alignItems: "center", gap: 8 }} onPress={requestPermission} activeOpacity={0.85}>
                  <Ionicons name="camera-outline" size={42} color={C.purple} />
                  <Text style={s.askText}>แตะเพื่ออนุญาตใช้กล้อง</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.manualRow}>
              <TextInput
                style={s.manualInput}
                value={code}
                onChangeText={setCode}
                placeholder="รหัสสแกน 4 ตัว หรือรหัสเรียก เช่น NodeMCU 001"
                placeholderTextColor={C.faint}
                autoCapitalize="characters"
                onSubmitEditing={() => lookup(code)}
              />
              <TouchableOpacity
                style={[s.manualBtn, !code.trim() && { opacity: 0.45 }]}
                disabled={!code.trim()}
                onPress={() => lookup(code)}
                activeOpacity={0.85}
              >
                <Text style={s.manualBtnText}>ค้นหา</Text>
              </TouchableOpacity>
            </View>
            {notFound && <Text style={s.notFound}>ไม่พบอุปกรณ์นี้ในระบบ</Text>}
          </>
        )}

        {item && (
          <>
            <View style={s.card}>
              <View style={s.itemTop}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={s.itemImage} />
                ) : (
                  <View style={[s.itemImage, s.itemImageEmpty]}>
                    <Ionicons name="cube-outline" size={30} color={C.purple} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.itemCode}>{item.item_code}</Text>
                  <Text style={s.itemName}>{item.name}</Text>
                  <View style={[s.pill, { backgroundColor: (STATUS[item.status] ?? STATUS.available).bg }]}>
                    <Text style={[s.pillText, { color: (STATUS[item.status] ?? STATUS.available).color }]}>
                      {(STATUS[item.status] ?? STATUS.available).label}
                    </Text>
                  </View>
                </View>
              </View>

              <InfoRow label="รหัสสแกน" value={item.barcode} />
              <InfoRow label="หมวดหมู่" value={item.categories?.name || item.type || "-"} />
              <InfoRow label="ห้อง" value={item.borrow_locations?.name || "-"} />
              <InfoRow label="อายุการใช้งาน" value={`${ageText(item.created_at)} (เพิ่มเข้าระบบ ${thaiDate(item.created_at)})`} />
              <InfoRow label="ประกัน" value={warrantyText(item.warranty_expires_at).text} color={warrantyText(item.warranty_expires_at).color} />
              {!!item.manufacturer_serial && <InfoRow label="Serial ผู้ผลิต" value={item.manufacturer_serial} />}
              {item.status === "retired" && (
                <InfoRow label="จำหน่ายออก" value={`${thaiDate(item.retired_at)} · ${item.retire_reason || "-"}`} color={C.red} />
              )}
            </View>

            {pending && (
              <TouchableOpacity
                style={[s.card, s.pendingCard]}
                onPress={() => router.push(`/admin/requests?id=${pending.id}` as any)}
                activeOpacity={0.88}
              >
                <Ionicons name="hourglass-outline" size={22} color={C.orange} />
                <View style={{ flex: 1 }}>
                  <Text style={s.pendingTitle}>
                    มีคำขอ{pending.kind === "borrow" ? "ยืม" : pending.kind === "return" ? "คืน" : "ยืมต่อ"}รออนุมัติ
                  </Text>
                  <Text style={s.pendingSub}>{emails[pending.user_id] || "-"} · แตะเพื่อเปิดในกล่องคำขอ</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={C.orange} />
              </TouchableOpacity>
            )}

            {active && (
              <View style={s.card}>
                <Text style={s.sectionTitle}>ผู้ยืมปัจจุบัน</Text>
                <InfoRow label="ผู้ยืม" value={emails[active.user_id] || "-"} />
                <InfoRow label="ยืมเมื่อ" value={thaiDate(active.borrow_date)} />
                <InfoRow
                  label="กำหนดคืน"
                  value={`${thaiDate(active.due_date)}${overdueDays > 0 ? ` · เกินกำหนด ${overdueDays} วัน` : ""}${active.renew_count > 0 ? " · ยืมต่อแล้ว" : ""}`}
                  color={overdueDays > 0 ? C.red : undefined}
                />
                <InfoRow label="สถานะ" value={RECORD_STATUS[active.status] || active.status} />
                <View style={s.thumbRow}>
                  <Thumb path={active.borrow_photo_path} label="ตอนยืม" />
                </View>
              </View>
            )}

            <View style={s.card}>
              <Text style={s.sectionTitle}>ประวัติการยืม ({records.length})</Text>
              {records.length === 0 ? (
                <Text style={s.empty}>ยังไม่เคยถูกยืม</Text>
              ) : (
                records.map((r) => (
                  <View key={r.id} style={s.historyRow}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.historyEmail} numberOfLines={1}>{emails[r.user_id] || "-"}</Text>
                      <Text style={s.historyMeta}>
                        {thaiDate(r.borrow_date)} → {r.status === "returned" ? thaiDate(r.return_date) : RECORD_STATUS[r.status]}
                      </Text>
                      {r.status === "returned" && (r.auto_returned || r.return_condition === "damaged") && (
                        <Text style={[s.historyMeta, { color: r.auto_returned ? C.orange : C.red }]}>
                          {r.auto_returned
                            ? "คืนอัตโนมัติ ยังไม่ได้ตรวจสภาพ"
                            : `ชำรุด${r.damage_cost != null ? ` · ${r.damage_cost} บาท` : ""}${r.damage_note ? ` · ${r.damage_note}` : ""}`}
                        </Text>
                      )}
                    </View>
                    <View style={s.thumbRow}>
                      <Thumb path={r.borrow_photo_path} label="ยืม" />
                      <Thumb path={r.return_photo_path} label="คืน" />
                    </View>
                  </View>
                ))
              )}
            </View>

            <TouchableOpacity style={s.againBtn} onPress={reset} activeOpacity={0.85}>
              <Ionicons name="scan-outline" size={18} color="#fff" />
              <Text style={s.againText}>สแกนชิ้นอื่น</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <TouchableOpacity style={s.zoomBackdrop} activeOpacity={1} onPress={() => setZoom(null)}>
          {zoom && (
            <>
              <Image source={{ uri: zoom.url }} style={s.zoomImg} resizeMode="contain" />
              <Text style={s.zoomStamp}>{zoom.stamp}</Text>
            </>
          )}
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function InfoRow({ label, value, color }: { label: string; value?: string | null; color?: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, color ? { color } : null]}>{value || "-"}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.purple,
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 21, fontWeight: "900" },
  headerSub: { color: "#ddd6fe", fontSize: 12, fontWeight: "700", marginTop: 2 },
  body: { padding: 16, gap: 12 },

  cameraBox: {
    height: 260,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#c4b5fd",
    alignItems: "center",
    justifyContent: "center",
  },
  askText: { color: C.purple, fontWeight: "800" },
  manualRow: { flexDirection: "row", gap: 8 },
  manualInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: C.ink,
  },
  manualBtn: { backgroundColor: C.purple, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
  manualBtnText: { color: "#fff", fontWeight: "900" },
  notFound: { textAlign: "center", color: C.red, fontWeight: "800" },

  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, gap: 8 },
  itemTop: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 4 },
  itemImage: { width: 72, height: 72, borderRadius: 12 },
  itemImageEmpty: { backgroundColor: "#ede9fe", alignItems: "center", justifyContent: "center" },
  itemCode: { fontSize: 21, fontWeight: "900", color: C.ink },
  itemName: { fontSize: 13, fontWeight: "700", color: C.muted },
  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: "900" },

  infoRow: { flexDirection: "row", gap: 10, paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  infoLabel: { width: 100, fontSize: 12.5, color: C.muted, fontWeight: "700" },
  infoValue: { flex: 1, fontSize: 13, color: C.ink, fontWeight: "800" },

  pendingCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff7ed", borderWidth: 1, borderColor: "#fdba74" },
  pendingTitle: { fontSize: 14.5, fontWeight: "900", color: C.orange },
  pendingSub: { fontSize: 12, fontWeight: "700", color: C.muted, marginTop: 2 },

  sectionTitle: { fontSize: 15, fontWeight: "900", color: C.ink },
  empty: { color: C.faint, fontWeight: "700" },
  historyRow: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  historyEmail: { fontSize: 13, fontWeight: "800", color: C.ink },
  historyMeta: { fontSize: 12, fontWeight: "600", color: C.muted },
  thumbRow: { flexDirection: "row", gap: 6 },
  thumbWrap: { alignItems: "center", gap: 2 },
  thumb: { width: 54, height: 54, borderRadius: 8, backgroundColor: "#f1f5f9" },
  thumbLabel: { fontSize: 10, color: C.muted, fontWeight: "700" },

  againBtn: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: C.purple,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  againText: { color: "#fff", fontSize: 15, fontWeight: "900" },

  zoomBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center", padding: 16, gap: 10 },
  zoomImg: { width: "100%", height: 420 },
  zoomStamp: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
