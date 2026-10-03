import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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
import supabase from "../lib/supabase";
import { goBack } from "../lib/nav";
import { notify, confirmAction } from "../lib/notify";
import { canTakeLivePhoto, takeLivePhoto, uploadBorrowPhoto } from "../lib/borrowPhotos";
import Countdown from "../components/Countdown";

// นักศึกษาสแกน QR ที่ตัวของ ณ ห้อง → ขอยืม / ขอคืน / ขอยืมต่อ (แผน 2.6)
// กติกาทั้งหมดอยู่ใน RPC ฝั่งฐานข้อมูล หน้านี้แค่เก็บข้อมูลแล้วส่ง

const C = {
  bg: "#edf5ff",
  header: "#2563eb",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#dbe3ec",
  green: "#16a34a",
  orange: "#d97706",
  red: "#ef4444",
  purple: "#7c3aed",
};

type Lookup = {
  found: boolean;
  state?: "available" | "my_pending" | "mine" | "taken" | "unavailable";
  item?: { id: string; item_code: string; name: string; status: string; status_th: string; image_url?: string; location?: string };
  due_date?: string | null;
  can_renew?: boolean;
  pending?: { id: string; kind: "borrow" | "return" | "renew"; expires_at: string } | null;
  day_options?: number[];
  max_active_borrows?: number;
};

type FormMode = "borrow" | "return" | "renew";

const KIND_TH: Record<string, string> = { borrow: "ขอยืม", return: "ขอคืน", renew: "ขอยืมต่อ" };

const thaiDate = (value?: string | null) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-";

export default function StudentScan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);

  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [justSent, setJustSent] = useState("");

  // ฟอร์ม
  const [mode, setMode] = useState<FormMode | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [condition, setCondition] = useState<"good" | "damaged" | null>(null);
  const [note, setNote] = useState("");
  const [photoUri, setPhotoUri] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setMode(null);
    setDays(null);
    setCondition(null);
    setNote("");
    setPhotoUri("");
  };

  const runLookup = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("scan_lookup", { p_code: code.trim() });
    setLoading(false);
    if (error) {
      notify("สแกนไม่สำเร็จ", error.message);
      scanLock.current = false;
      return;
    }
    resetForm();
    setLookup(data as Lookup);
  };

  const refresh = () => {
    if (lookup?.item) runLookup(lookup.item.id);
  };

  const onBarcode = ({ data }: { data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setJustSent("");
    runLookup(data);
  };

  const scanAgain = () => {
    scanLock.current = false;
    setLookup(null);
    setJustSent("");
    setManualCode("");
    resetForm();
  };

  const openForm = (next: FormMode) => {
    resetForm();
    setMode(next);
    if (next !== "return") setDays(lookup?.day_options?.[0] ?? 3);
  };

  const capture = async () => {
    try {
      const uri = await takeLivePhoto();
      if (uri) setPhotoUri(uri);
    } catch (e: any) {
      notify("ถ่ายรูปไม่ได้", e.message);
    }
  };

  const needsEvidence = mode === "borrow" || mode === "return";
  const formReady =
    !!mode &&
    (mode === "return" || !!days) &&
    (!needsEvidence || (!!condition && !!photoUri && (condition === "good" || !!note.trim())));

  const submit = async () => {
    if (!lookup?.item || !mode || !formReady) return;
    setSubmitting(true);
    try {
      const item = lookup.item;
      let error: any = null;

      if (mode === "renew") {
        ({ error } = await supabase.rpc("request_renew", { p_item_id: item.id, p_days: days }));
      } else {
        const photoPath = await uploadBorrowPhoto(photoUri);
        ({ error } = mode === "borrow"
          ? await supabase.rpc("request_borrow", {
              p_item_id: item.id, p_days: days, p_condition: condition, p_note: note, p_photo_path: photoPath,
            })
          : await supabase.rpc("request_return", {
              p_item_id: item.id, p_condition: condition, p_note: note, p_photo_path: photoPath,
            }));
      }

      if (error) throw error;
      setJustSent(`ส่ง${KIND_TH[mode]} ${item.item_code} แล้ว รอผู้ดูแลอนุมัติ`);
      await runLookup(item.id);
    } catch (e: any) {
      notify("ส่งคำขอไม่สำเร็จ", e.message || "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelPending = () => {
    const pending = lookup?.pending;
    if (!pending) return;
    confirmAction("ยกเลิกคำขอ", `ยกเลิก${KIND_TH[pending.kind]} ${lookup?.item?.item_code} ?`, "ยกเลิกคำขอ", async () => {
      const { error } = await supabase.rpc("cancel_request", { p_request_id: pending.id });
      if (error) {
        notify("ยกเลิกไม่สำเร็จ", error.message);
        return;
      }
      setJustSent("");
      refresh();
    }, true);
  };

  // ── ส่วนหัว ──
  const Header = (
    <View style={s.header}>
      <TouchableOpacity style={s.headerBtn} onPress={() => goBack("/home")} activeOpacity={0.84}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle}>สแกนยืม / คืน</Text>
        <Text style={s.headerSub}>สแกน QR ที่ติดบนอุปกรณ์ในห้อง</Text>
      </View>
    </View>
  );

  // ── ยังไม่ได้สแกน ──
  if (!lookup) {
    return (
      <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {Header}
        <ScrollView contentContainerStyle={s.body}>
          <View style={s.cameraBox}>
            {loading ? (
              <ActivityIndicator size="large" color={C.header} />
            ) : permission?.granted ? (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                onBarcodeScanned={onBarcode}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              />
            ) : (
              <TouchableOpacity style={s.cameraAsk} onPress={requestPermission} activeOpacity={0.85}>
                <Ionicons name="camera-outline" size={44} color={C.header} />
                <Text style={s.cameraAskText}>แตะเพื่ออนุญาตใช้กล้อง</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={s.hint}>ส่องกล้องไปที่ QR บนป้ายอุปกรณ์</Text>

          <View style={s.manualRow}>
            <TextInput
              style={s.manualInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="หรือพิมพ์รหัสสแกน 4 ตัว เช่น A7K2"
              placeholderTextColor={C.faint}
              autoCapitalize="characters"
              maxLength={8}
              onSubmitEditing={() => runLookup(manualCode)}
            />
            <TouchableOpacity
              style={[s.manualBtn, !manualCode.trim() && s.disabled]}
              disabled={!manualCode.trim()}
              onPress={() => runLookup(manualCode)}
              activeOpacity={0.85}
            >
              <Text style={s.manualBtnText}>ค้นหา</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── สแกนแล้วไม่เจอ ──
  if (!lookup.found || !lookup.item) {
    return (
      <View style={s.container}>
        {Header}
        <View style={s.center}>
          <Ionicons name="help-circle-outline" size={52} color={C.faint} />
          <Text style={s.bigText}>ไม่พบอุปกรณ์นี้ในระบบ</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={scanAgain} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>สแกนใหม่</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const item = lookup.item;
  const state = lookup.state;
  const dayOptions = lookup.day_options ?? [3, 5, 7];

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {Header}
      <ScrollView contentContainerStyle={s.body}>
        {/* การ์ดอุปกรณ์ */}
        <View style={s.itemCard}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={s.itemImage} />
          ) : (
            <View style={[s.itemImage, s.itemImageEmpty]}>
              <Ionicons name="cube-outline" size={28} color={C.header} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.itemCode}>{item.item_code}</Text>
            <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={s.itemMeta}>ห้อง {item.location || "-"}</Text>
          </View>
        </View>

        {!!justSent && (
          <View style={[s.banner, s.bannerOk]}>
            <Ionicons name="checkmark-circle" size={18} color={C.green} />
            <Text style={[s.bannerText, { color: "#166534" }]}>{justSent}</Text>
          </View>
        )}

        {/* สถานะ */}
        {state === "available" && !mode && (
          <>
            <View style={[s.banner, s.bannerOk]}>
              <Ionicons name="checkmark-circle-outline" size={18} color={C.green} />
              <Text style={[s.bannerText, { color: "#166534" }]}>ว่าง พร้อมให้ยืม</Text>
            </View>
            <TouchableOpacity style={s.primaryBtn} onPress={() => openForm("borrow")} activeOpacity={0.85}>
              <Ionicons name="hand-left-outline" size={18} color="#fff" />
              <Text style={s.primaryBtnText}>ขอยืมอุปกรณ์นี้</Text>
            </TouchableOpacity>
          </>
        )}

        {state === "mine" && !mode && (
          <>
            <View style={[s.banner, s.bannerInfo]}>
              <Ionicons name="time-outline" size={18} color={C.header} />
              <Text style={[s.bannerText, { color: "#1e3a8a" }]}>คุณยืมอยู่ · กำหนดคืน {thaiDate(lookup.due_date)}</Text>
            </View>
            <TouchableOpacity style={s.primaryBtn} onPress={() => openForm("return")} activeOpacity={0.85}>
              <Ionicons name="return-down-back-outline" size={18} color="#fff" />
              <Text style={s.primaryBtnText}>ขอคืนอุปกรณ์</Text>
            </TouchableOpacity>
            {lookup.can_renew ? (
              <TouchableOpacity style={s.secondaryBtn} onPress={() => openForm("renew")} activeOpacity={0.85}>
                <Text style={s.secondaryBtnText}>ขอยืมต่อ (ได้ 1 ครั้ง)</Text>
              </TouchableOpacity>
            ) : (
              <Text style={s.note}>ใช้สิทธิ์ยืมต่อไปแล้ว</Text>
            )}
          </>
        )}

        {state === "my_pending" && lookup.pending && (
          <View style={s.pendingBox}>
            <Ionicons name="hourglass-outline" size={28} color={C.orange} />
            <Text style={s.bigText}>{KIND_TH[lookup.pending.kind]} รอผู้ดูแลอนุมัติ</Text>
            <Countdown until={lookup.pending.expires_at} onDone={refresh} style={s.countdown} />
            <Text style={s.note}>
              {lookup.pending.kind === "return"
                ? "ถ้าไม่มีผู้ดูแลยืนยันภายในเวลา ระบบจะบันทึกการคืนให้อัตโนมัติ"
                : "ถ้าไม่มีผู้ดูแลตอบภายในเวลา คำขอจะหมดอายุ"}
            </Text>
            <TouchableOpacity style={s.dangerOutline} onPress={cancelPending} activeOpacity={0.85}>
              <Text style={s.dangerOutlineText}>ยกเลิกคำขอ</Text>
            </TouchableOpacity>
          </View>
        )}

        {state === "taken" && (
          <View style={[s.banner, s.bannerWarn]}>
            <Ionicons name="lock-closed-outline" size={18} color={C.orange} />
            <Text style={[s.bannerText, { color: "#92400e" }]}>
              {item.status === "reserved"
                ? "มีคนขอยืมอยู่ กำลังรออนุมัติ"
                : `ถูกยืมอยู่ · กำหนดคืน ${thaiDate(lookup.due_date)}`}
            </Text>
          </View>
        )}

        {state === "unavailable" && (
          <View style={[s.banner, s.bannerBad]}>
            <Ionicons name="close-circle-outline" size={18} color={C.red} />
            <Text style={[s.bannerText, { color: "#991b1b" }]}>ยืมไม่ได้ ({item.status_th})</Text>
          </View>
        )}

        {/* ฟอร์มขอยืม / คืน / ยืมต่อ */}
        {mode && (
          <View style={s.form}>
            <Text style={s.formTitle}>{KIND_TH[mode]}</Text>

            {mode !== "return" && (
              <>
                <Text style={s.label}>{mode === "renew" ? "ขอยืมต่ออีก" : "ระยะเวลายืม"}</Text>
                <View style={s.chipRow}>
                  {dayOptions.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[s.chip, days === d && s.chipActive]}
                      onPress={() => setDays(d)}
                      activeOpacity={0.85}
                    >
                      <Text style={[s.chipText, days === d && s.chipTextActive]}>{d} วัน</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {needsEvidence && (
              <>
                <Text style={s.label}>สภาพอุปกรณ์{mode === "borrow" ? "ก่อนยืม" : "ตอนคืน"}</Text>
                <View style={s.chipRow}>
                  <TouchableOpacity
                    style={[s.chip, condition === "good" && s.chipGood]}
                    onPress={() => setCondition("good")}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.chipText, condition === "good" && s.chipTextActive]}>ปกติ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.chip, condition === "damaged" && s.chipBad]}
                    onPress={() => setCondition("damaged")}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.chipText, condition === "damaged" && s.chipTextActive]}>ชำรุด / มีตำหนิ</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[s.input, condition === "damaged" && !note.trim() && s.inputError]}
                  value={note}
                  onChangeText={setNote}
                  placeholder={condition === "damaged" ? "ระบุจุดที่ชำรุด (จำเป็น)" : "หมายเหตุ (ไม่บังคับ)"}
                  placeholderTextColor={C.faint}
                  multiline
                />

                <Text style={s.label}>รูปถ่ายอุปกรณ์ (ถ่ายสดเท่านั้น)</Text>
                {canTakeLivePhoto ? (
                  photoUri ? (
                    <View>
                      <Image source={{ uri: photoUri }} style={s.photo} />
                      <TouchableOpacity style={s.retake} onPress={capture} activeOpacity={0.85}>
                        <Ionicons name="camera-outline" size={14} color="#fff" />
                        <Text style={s.retakeText}>ถ่ายใหม่</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={s.photoBtn} onPress={capture} activeOpacity={0.85}>
                      <Ionicons name="camera" size={26} color={C.header} />
                      <Text style={s.photoBtnText}>เปิดกล้องถ่ายรูป</Text>
                    </TouchableOpacity>
                  )
                ) : (
                  <View style={[s.banner, s.bannerWarn]}>
                    <Ionicons name="phone-portrait-outline" size={18} color={C.orange} />
                    <Text style={[s.bannerText, { color: "#92400e" }]}>
                      ขอยืม/คืนได้เฉพาะในแอปมือถือ (ต้องถ่ายรูปสดจากกล้อง)
                    </Text>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              style={[s.primaryBtn, (!formReady || submitting) && s.disabled]}
              disabled={!formReady || submitting}
              onPress={submit}
              activeOpacity={0.85}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>ส่ง{KIND_TH[mode]}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={s.textBtn} onPress={resetForm} activeOpacity={0.8}>
              <Text style={s.textBtnText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        )}

        {!mode && (
          <View style={s.footerRow}>
            <TouchableOpacity style={s.textBtn} onPress={scanAgain} activeOpacity={0.8}>
              <Text style={s.textBtnText}>สแกนชิ้นอื่น</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.textBtn} onPress={() => router.push("/borrow")} activeOpacity={0.8}>
              <Text style={s.textBtnText}>ดูการยืมของฉัน</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.header,
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  headerSub: { color: "#dbeafe", fontSize: 12, fontWeight: "700", marginTop: 2 },
  body: { padding: 18, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },

  cameraBox: {
    height: 280,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#93c5fd",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraAsk: { alignItems: "center", gap: 8 },
  cameraAskText: { color: C.header, fontSize: 13, fontWeight: "800" },
  hint: { textAlign: "center", color: C.muted, fontSize: 12.5, fontWeight: "700" },
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
  manualBtn: { backgroundColor: C.header, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" },
  manualBtnText: { color: "#fff", fontWeight: "900" },

  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
  },
  itemImage: { width: 64, height: 64, borderRadius: 12 },
  itemImageEmpty: { backgroundColor: "#dbeafe", alignItems: "center", justifyContent: "center" },
  itemCode: { fontSize: 20, fontWeight: "900", color: C.ink },
  itemName: { fontSize: 13, fontWeight: "700", color: C.muted, marginTop: 2 },
  itemMeta: { fontSize: 12, color: C.faint, marginTop: 2 },

  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12 },
  bannerText: { flex: 1, fontSize: 13.5, fontWeight: "800" },
  bannerOk: { backgroundColor: "#dcfce7" },
  bannerInfo: { backgroundColor: "#dbeafe" },
  bannerWarn: { backgroundColor: "#fef3c7" },
  bannerBad: { backgroundColor: "#fee2e2" },

  pendingBox: { alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 16, padding: 18 },
  countdown: { fontSize: 15, fontWeight: "900", color: C.orange },
  bigText: { fontSize: 16, fontWeight: "900", color: C.ink, textAlign: "center" },
  note: { fontSize: 12, color: C.muted, textAlign: "center" },

  form: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 8 },
  formTitle: { fontSize: 17, fontWeight: "900", color: C.ink },
  label: { fontSize: 12, fontWeight: "800", color: C.muted, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#f8fafc",
  },
  chipActive: { backgroundColor: C.header, borderColor: C.header },
  chipGood: { backgroundColor: C.green, borderColor: C.green },
  chipBad: { backgroundColor: C.red, borderColor: C.red },
  chipText: { fontSize: 13, fontWeight: "800", color: C.muted },
  chipTextActive: { color: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 12,
    minHeight: 48,
    fontSize: 14,
    color: C.ink,
    textAlignVertical: "top",
  },
  inputError: { borderColor: C.red },
  photo: { width: "100%", height: 220, borderRadius: 12 },
  retake: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  retakeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  photoBtn: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#93c5fd",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoBtnText: { color: C.header, fontWeight: "800" },

  primaryBtn: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: C.header,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  secondaryBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: C.header,
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: C.header, fontSize: 14, fontWeight: "900" },
  dangerOutline: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderWidth: 1.5,
    borderColor: C.red,
  },
  dangerOutlineText: { color: C.red, fontWeight: "900" },
  textBtn: { alignItems: "center", paddingVertical: 10 },
  textBtnText: { color: C.muted, fontSize: 13.5, fontWeight: "800" },
  footerRow: { flexDirection: "row", justifyContent: "space-around" },
  disabled: { opacity: 0.45 },
});
