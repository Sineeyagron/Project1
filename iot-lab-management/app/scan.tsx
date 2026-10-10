import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "../components/AppText";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";
import { goBack } from "../lib/nav";
import { currentUser } from "../lib/session";
import { notify, confirmAction } from "../lib/notify";
import { canTakeLivePhoto, takeLivePhoto, uploadBorrowPhoto } from "../lib/borrowPhotos";
import Countdown from "../components/Countdown";
import ConfirmRulesSheet, { SummaryRow } from "../components/ConfirmRulesSheet";
import { W, NG } from "../lib/theme";
import ScreenHeader from "../components/ScreenHeader";

// นักศึกษาสแกน QR ที่ตัวของ ณ ห้อง → ขอยืม / ขอคืน / ขอยืมต่อ (แผน 2.6)
// กติกาทั้งหมดอยู่ใน RPC ฝั่งฐานข้อมูล หน้านี้แค่เก็บข้อมูลแล้วส่ง

const C = {
  bg: "#EAF1FC",
  header: "#2563eb",
  ink: "#172033",
  muted: "#475569",
  faint: "#64748B",
  line: "#dbe3ec",
  green: "#047857",
  orange: "#B45309",
  red: "#ef4444",
  purple: "#2563EB",
};

type Lookup = {
  found: boolean;
  state?: "available" | "my_pending" | "mine" | "taken" | "unavailable";
  item?: { id: string; item_code: string; name: string; status: string; status_th: string; image_url?: string; location?: string };
  due_date?: string | null;
  can_renew?: boolean;
  overdue?: boolean;
  my_pickup?: { id: string; pickup_at: string; days: number } | null; // F2 มีนัดรับรุ่นนี้
  held?: boolean; // F2 ชิ้นที่เหลือของรุ่นนี้ถูกกันไว้ให้คนที่นัดรับ
  pending?: { id: string; kind: "borrow" | "return" | "renew"; expires_at: string } | null;
  day_options?: number[];
  max_active_borrows?: number;
};

type FormMode = "borrow" | "return" | "renew" | "claim";

const KIND_TH: Record<string, string> = { borrow: "ขอยืม", return: "ขอคืน", renew: "ขอยืมต่อ", claim: "รับของตามนัด" };

// เวลานัด (เวลาไทย) "10 ต.ค. 2569 13:05"
const pickupTime = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 7 * 3600000);
  return `${thaiDate(d.toISOString().slice(0, 10))} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} น.`;
};

const thaiDate = (value?: string | null) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-";

// วันที่ (YYYY-MM-DD ตามเวลาเครื่อง) + n วัน — ใช้สรุปในป๊อปอัปยืนยัน
const addDays = (base: string | null, n: number) => {
  const d = base ? new Date(`${base}T00:00:00`) : new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function StudentScan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);

  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [justSent, setJustSent] = useState("");
  // จำนวนที่ยืม/รออนุมัติอยู่ (นับแบบเดียวกับ RPC request_borrow) — ครบโควตา = เตือนก่อน ไม่ให้กดขอยืม
  const [activeCount, setActiveCount] = useState<number | null>(null);

  // ฟอร์ม
  const [mode, setMode] = useState<FormMode | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [condition, setCondition] = useState<"good" | "damaged" | null>(null);
  const [note, setNote] = useState("");
  const [photoUri, setPhotoUri] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // F1 ป๊อปอัปยืนยัน + กฎ ก่อนส่งคำขอทุกแบบ
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    setActiveCount(null);
    if ((data as Lookup)?.state === "available") loadActiveCount();
  };

  // นับอย่างเดียว (head) ไม่ดึงแถว — ถ้านับไม่ได้ปล่อยปุ่มไว้ ให้ RPC เป็นด่านจริงเหมือนเดิม
  const loadActiveCount = async () => {
    const user = await currentUser();
    if (!user) return;
    const [loans, reqs, pickups] = await Promise.all([
      supabase.from("borrow_records").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).in("status", ["borrowed", "pending_return"]),
      supabase.from("borrow_requests").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("kind", "borrow").eq("status", "pending"),
      // F2 นัดรับที่ยังไม่จบนับโควตาด้วย
      supabase.from("pickup_requests").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).in("status", ["pending", "scheduled"]),
    ]);
    if (loans.error || reqs.error) return;
    setActiveCount((loans.count || 0) + (reqs.count || 0) + (pickups.count || 0));
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
    if (next === "claim") setDays(lookup?.my_pickup?.days ?? 3);
    else if (next !== "return") setDays(lookup?.day_options?.[0] ?? 3);
  };

  const capture = async () => {
    try {
      const uri = await takeLivePhoto();
      if (uri) setPhotoUri(uri);
    } catch (e: any) {
      notify("ถ่ายรูปไม่ได้", e.message);
    }
  };

  const needsEvidence = mode === "borrow" || mode === "return" || mode === "claim";
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
      } else if (mode === "claim") {
        const photoPath = await uploadBorrowPhoto(photoUri);
        ({ error } = await supabase.rpc("claim_pickup", {
          p_item_id: item.id, p_condition: condition, p_note: note, p_photo_path: photoPath,
        }));
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
      setConfirmOpen(false);
      setJustSent(mode === "claim"
        ? `รับ ${item.item_code} ตามนัดแล้ว บันทึกการยืมเรียบร้อย`
        : `ส่ง${KIND_TH[mode]} ${item.item_code} แล้ว รอผู้ดูแลอนุมัติ`);
      await runLookup(item.id);
    } catch (e: any) {
      setConfirmOpen(false);
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
    <ScreenHeader
      title={"สแกนยืม / คืน"}
      subtitle={"สแกน QR ที่ติดบนอุปกรณ์ในห้อง"}
      onBack={() => goBack("/home")}
    />
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
        {state === "available" && !mode && lookup.my_pickup && (
          <>
            <View style={[s.banner, s.bannerOk]}>
              <Ionicons name="calendar-outline" size={18} color={C.green} />
              <Text style={[s.bannerText, { color: "#166534" }]}>
                คุณมีนัดรับรุ่นนี้ · {pickupTime(lookup.my_pickup.pickup_at)}
              </Text>
            </View>
            <TouchableOpacity style={s.primaryBtn} onPress={() => openForm("claim")} activeOpacity={0.85}>
              <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
              <Text style={s.primaryBtnText}>ยืนยันรับของตามนัด</Text>
            </TouchableOpacity>
          </>
        )}

        {state === "available" && !mode && !lookup.my_pickup && lookup.held && (
          <View style={[s.banner, s.bannerWarn]}>
            <Ionicons name="lock-closed-outline" size={18} color={C.orange} />
            <Text style={[s.bannerText, { color: "#92400e" }]}>ชิ้นที่เหลือของรุ่นนี้ถูกกันไว้ให้คนที่นัดรับแล้ว</Text>
          </View>
        )}

        {state === "available" && !mode && !lookup.my_pickup && !lookup.held && (() => {
          const max = lookup.max_active_borrows ?? 3;
          const atLimit = activeCount !== null && activeCount >= max;
          return (
            <>
              <View style={[s.banner, s.bannerOk]}>
                <Ionicons name="checkmark-circle-outline" size={18} color={C.green} />
                <Text style={[s.bannerText, { color: "#166534" }]}>ว่าง พร้อมให้ยืม</Text>
              </View>
              {atLimit ? (
                <View style={[s.banner, s.bannerWarn]}>
                  <Ionicons name="alert-circle-outline" size={18} color="#B45309" />
                  <Text style={[s.bannerText, { color: "#92400E", flex: 1 }]}>
                    คุณยืม/รออนุมัติอยู่ครบ {max} ชิ้นแล้ว คืนของก่อนจึงจะยืมชิ้นใหม่ได้
                  </Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[s.primaryBtn, atLimit && { opacity: 0.45 }]}
                onPress={() => openForm("borrow")}
                disabled={atLimit}
                activeOpacity={0.85}
              >
                <Ionicons name="hand-left-outline" size={18} color="#fff" />
                <Text style={s.primaryBtnText}>ขอยืมอุปกรณ์นี้</Text>
              </TouchableOpacity>
              {atLimit ? (
                <TouchableOpacity style={s.secondaryBtn} onPress={() => router.push("/borrow")} activeOpacity={0.85}>
                  <Text style={s.secondaryBtnText}>ดูของที่ยืมอยู่</Text>
                </TouchableOpacity>
              ) : null}
            </>
          );
        })()}

        {state === "mine" && !mode && (
          <>
            <View style={[s.banner, s.bannerInfo]}>
              <Ionicons name="time-outline" size={18} color={C.header} />
              <Text style={[s.bannerText, { color: "#1D4ED8" }]}>คุณยืมอยู่ · กำหนดคืน {thaiDate(lookup.due_date)}</Text>
            </View>
            <TouchableOpacity style={s.primaryBtn} onPress={() => openForm("return")} activeOpacity={0.85}>
              <Ionicons name="return-down-back-outline" size={18} color="#fff" />
              <Text style={s.primaryBtnText}>ขอคืนอุปกรณ์</Text>
            </TouchableOpacity>
            {lookup.overdue ? (
              <View style={[s.banner, s.bannerBad]}>
                <Ionicons name="alert-circle-outline" size={18} color={C.red} />
                <Text style={[s.bannerText, { color: "#991b1b" }]}>เกินกำหนดแล้ว ยืมต่อไม่ได้ กรุณานำมาคืน</Text>
              </View>
            ) : lookup.can_renew ? (
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

            {(mode === "borrow" || mode === "renew") && (
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
                <Text style={s.label}>สภาพอุปกรณ์{mode === "return" ? "ตอนคืน" : "ก่อนยืม"}</Text>
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
              onPress={() => setConfirmOpen(true)}
              activeOpacity={0.85}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>{mode === "claim" ? "ยืนยันรับของ" : `ส่ง${KIND_TH[mode]}`}</Text>}
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

      <ConfirmRulesSheet
        visible={confirmOpen && !!mode}
        title={mode ? `ยืนยันการ${KIND_TH[mode]}` : ""}
        confirmLabel={mode === "claim" ? "ยืนยันรับของ" : mode ? `ยืนยันส่งคำ${KIND_TH[mode]}` : ""}
        item={{ code: item.item_code, name: item.name, image_url: item.image_url }}
        rows={summaryRows()}
        submitting={submitting}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submit}
      />
    </KeyboardAvoidingView>
  );

  // แถวสรุปในป๊อปอัปยืนยัน
  function summaryRows(): SummaryRow[] {
    const evidence: SummaryRow = condition === "damaged"
      ? { label: "สภาพ + รูปถ่าย", value: "ชำรุด / มีตำหนิ · ถ่ายรูปแล้ว", tone: "bad" }
      : { label: "สภาพ + รูปถ่าย", value: "ปกติ · ถ่ายรูปแล้ว", tone: "ok" };
    if (mode === "borrow" || mode === "claim") {
      return [{ label: "ระยะยืม", value: `${days} วัน · ครบกำหนด ${thaiDate(addDays(null, days || 0))}` }, evidence];
    }
    if (mode === "renew") {
      return [
        { label: "ยืมต่ออีก", value: `${days} วัน` },
        { label: "ครบกำหนด", old: thaiDate(lookup?.due_date), value: thaiDate(addDays(lookup?.due_date ?? null, days || 0)) },
      ];
    }
    return [{ label: "กำหนดคืนเดิม", value: thaiDate(lookup?.due_date) }, evidence];
  }
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  header: { ...W.headerBar,
    paddingTop: 52,
    paddingBottom: 10,
    marginBottom: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerBtn: {
    ...W.iconBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#172033", fontSize: 20, fontWeight: "700" },
  headerSub: { color: "#475569", fontSize: 12, marginTop: 1 },
  body: { padding: 16, paddingTop: 4, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },

  cameraBox: {
    ...W.card,
    height: 280,
    overflow: "hidden",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraAsk: { alignItems: "center", gap: 8 },
  cameraAskText: { color: C.header, fontSize: 14, fontWeight: "600" },
  hint: { textAlign: "center", color: C.muted, fontSize: 12.5 },
  manualRow: { flexDirection: "row", gap: 8 },
  manualInput: {
    flex: 1,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#D3E0F5",
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: C.ink,
  },
  manualBtn: { ...W.primary, paddingHorizontal: 16, justifyContent: "center" },
  manualBtnText: { color: "#fff", fontWeight: "600" },

  itemCard: {
    ...W.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  itemImage: { width: 60, height: 60, borderRadius: 16 },
  itemImageEmpty: { backgroundColor: "#DBEAFE", boxShadow: "inset 0 1px 0 #FFFFFF", alignItems: "center", justifyContent: "center" },
  itemCode: { fontSize: 17, fontWeight: "700", color: C.ink },
  itemName: { fontSize: 12, color: C.muted, marginTop: 1 },
  itemMeta: { fontSize: 12, color: C.faint, marginTop: 2 },

  banner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 15, padding: 12, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" },
  bannerText: { flex: 1, fontSize: 13.5, fontWeight: "600" },
  bannerOk: { ...NG, backgroundColor: "#ECFDF5" },
  bannerInfo: { backgroundColor: "#dbeafe" },
  bannerWarn: { ...NG, backgroundColor: "#fef3c7" },
  bannerBad: { ...NG, backgroundColor: "#fee2e2" },

  pendingBox: { ...W.card, alignItems: "center", gap: 6, padding: 18 },
  countdown: { fontSize: 15, fontWeight: "700", color: C.orange },
  bigText: { fontSize: 16, fontWeight: "600", color: C.ink, textAlign: "center" },
  note: { fontSize: 12, color: C.muted, textAlign: "center" },

  form: { ...W.card, padding: 14, gap: 8 },
  formTitle: { fontSize: 16, fontWeight: "600", color: C.ink },
  label: { fontSize: 13, color: "#475569", marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D3E0F5",
    backgroundColor: "#FFFFFF",
  },
  chipActive: { ...NG, backgroundColor: C.header, borderColor: C.header },
  chipGood: { ...NG, backgroundColor: C.green, borderColor: C.green },
  chipBad: { ...NG, backgroundColor: C.red, borderColor: C.red },
  chipText: { fontSize: 14, color: "#475569" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#D3E0F5",
    backgroundColor: "#F8FAFF",
    borderRadius: 14,
    padding: 12,
    minHeight: 46,
    fontSize: 14,
    color: C.ink,
    textAlignVertical: "top",
  },
  inputError: { borderColor: C.red },
  photo: { width: "100%", height: 220, borderRadius: 18 },
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
  retakeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  photoBtn: {
    height: 96,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#93C5FD",
    backgroundColor: "#EEF5FF",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  photoBtnText: { color: "#1D4ED8", fontWeight: "600", fontSize: 14 },

  primaryBtn: {
    ...W.primary,
    flexDirection: "row",
    gap: 8,
    minHeight: 52,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  secondaryBtn: {
    ...W.small,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#1D4ED8", fontSize: 14, fontWeight: "600" },
  dangerOutline: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FFF5F5",
  },
  dangerOutlineText: { color: "#B91C1C", fontWeight: "600" },
  textBtn: { alignItems: "center", paddingVertical: 10 },
  textBtnText: { color: C.muted, fontSize: 14, fontWeight: "500" },
  footerRow: { flexDirection: "row", justifyContent: "space-around" },
  disabled: { opacity: 0.45 },
});
