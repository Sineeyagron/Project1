import React, { useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Image,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";
import SignatureCanvas, { SignatureCanvasRef } from "../../components/SignatureCanvas";
import { uploadSignature } from "../../lib/uploadSignature";

type Step = "scan" | "confirm" | "signature";

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric",
  });
};

const getDaysLeft = (dueDate: string) => {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export default function ReturnScan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep] = useState<Step>("scan");
  const scanLock = useRef(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sigError, setSigError] = useState(false);

  const [item, setItem] = useState<any>(null);
  const [borrowRecord, setBorrowRecord] = useState<any>(null);
  const [borrowerEmail, setBorrowerEmail] = useState("");

  const sigRef = useRef<SignatureCanvasRef>(null);

  // ── สแกน barcode → ดึงข้อมูลการยืม ──
  const handleScan = async ({ data }: { data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setLoading(true);

    let foundItem: any = null;
    const { data: byBarcode } = await supabase
      .from("items").select("*").eq("barcode", data).single();
    foundItem = byBarcode;

    if (!foundItem) {
      const { data: byId } = await supabase
        .from("items").select("*").eq("id", data).single();
      foundItem = byId;
    }

    if (!foundItem) {
      try {
        const parsed = JSON.parse(data);
        if (parsed?.name) {
          const { data: byName } = await supabase
            .from("items").select("*")
            .ilike("name", parsed.name.trim())
            .limit(1).single();
          foundItem = byName;
        }
      } catch (_) { /* ไม่ใช่ JSON */ }
    }

    if (!foundItem) {
      setLoading(false);
      Alert.alert("ไม่พบอุปกรณ์", `ไม่พบ "${data}" ในระบบ`,
        [{ text: "สแกนใหม่", onPress: () => { scanLock.current = false; } }]);
      return;
    }

    if (foundItem.status !== "borrowed") {
      setLoading(false);
      Alert.alert("ไม่ได้ถูกยืม", `${foundItem.name} ไม่ได้อยู่ในสถานะถูกยืม`,
        [{ text: "สแกนใหม่", onPress: () => { scanLock.current = false; } }]);
      return;
    }

    const { data: record } = await supabase
      .from("borrow_records").select("*")
      .eq("item_id", foundItem.id).eq("status", "borrowed")
      .order("created_at", { ascending: false }).limit(1).single();

    let finalRecord = record;
    if (!finalRecord) {
      const { data: rec2 } = await supabase
        .from("borrow_records").select("*")
        .eq("item_id", foundItem.id).eq("status", "borrowed")
        .limit(1).single();
      finalRecord = rec2;
    }

    setLoading(false);

    if (!finalRecord) {
      Alert.alert("ไม่พบประวัติการยืม", "ไม่พบข้อมูลการยืมในระบบ",
        [{ text: "สแกนใหม่", onPress: () => { scanLock.current = false; } }]);
      return;
    }

    let emailVal = "ไม่ทราบ";
    if (finalRecord.user_id) {
      const { data: prof } = await supabase
        .from("profiles").select("email").eq("id", finalRecord.user_id).single();
      if (prof?.email) emailVal = prof.email;
    }

    setItem(foundItem);
    setBorrowRecord(finalRecord);
    setBorrowerEmail(emailVal);
    setStep("confirm");
  };

  const goToSignature = () => {
    setSigError(false);
    sigRef.current?.clear();
    setStep("signature");
  };

  // ── ยืนยันการคืน (หลังเซ็น) ──
  const confirmReturn = async () => {
    if (sigRef.current?.isEmpty()) {
      setSigError(true);
      return;
    }
    setSigError(false);
    if (!item || !borrowRecord) return;

    setSaving(true);
    try {
      // Upload signature
      const svgString = sigRef.current!.getSvgString();
      const sigUrl = await uploadSignature(svgString, "return", borrowRecord.id);

      // Update borrow_record
      await supabase
        .from("borrow_records")
        .update({ status: "returned", return_signature_url: sigUrl })
        .eq("id", borrowRecord.id);

      // Update item status
      await supabase.from("items").update({ status: "available" }).eq("id", item.id);

      Alert.alert("รับคืนสำเร็จ! ✅", `${item.name} คืนเรียบร้อยแล้ว`,
        [{ text: "โอเค", onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert("เกิดข้อผิดพลาด", e.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep("scan");
    scanLock.current = false;
    setItem(null);
    setBorrowRecord(null);
    setBorrowerEmail("");
    setSigError(false);
  };

  const daysLeft = borrowRecord?.due_date ? getDaysLeft(borrowRecord.due_date) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0;

  // ── STEP: SCAN ──
  if (step === "scan") {
    if (!permission) return <View style={s.center}><ActivityIndicator /></View>;
    if (!permission.granted) {
      return (
        <View style={s.center}>
          <Ionicons name="camera-outline" size={48} color="#94a3b8" />
          <Text style={s.permTxt}>ต้องการสิทธิ์เข้าถึงกล้อง</Text>
          <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
            <Text style={s.permBtnTxt}>อนุญาต</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTxt}>สแกน Barcode คืนของ</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={s.cameraWrap}>
          <CameraView
            style={s.camera}
            onBarcodeScanned={handleScan}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_a"],
            }}
          >
            <View style={s.overlay}>
              <View style={s.frameBox}>
                <View style={[s.corner, s.cTL]} />
                <View style={[s.corner, s.cTR]} />
                <View style={[s.corner, s.cBL]} />
                <View style={[s.corner, s.cBR]} />
              </View>
            </View>
          </CameraView>

          {loading && (
            <View style={s.scanLoading}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={s.scanLoadingTxt}>กำลังค้นหาข้อมูล...</Text>
            </View>
          )}
        </View>

        <View style={s.scanBottom}>
          <Ionicons name="barcode-outline" size={28} color="#f97316" />
          <Text style={s.scanDesc}>สแกน Barcode บนอุปกรณ์ที่จะคืน</Text>
          <Text style={s.scanSub}>รองรับ QR, EAN, Code128, UPC</Text>
        </View>
      </View>
    );
  }

  // ── STEP: CONFIRM ──
  if (step === "confirm") {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={reset}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTxt}>ยืนยันการคืน</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={s.form}>
          {/* STEP INDICATOR */}
          <View style={s.stepRow}>
            <View style={s.stepActive}><Text style={s.stepActiveTxt}>1</Text></View>
            <View style={s.stepLine} />
            <View style={s.stepInactive}><Text style={s.stepInactiveTxt}>2</Text></View>
          </View>
          <Text style={s.stepLabel}>ขั้นตอน 1/2 — ตรวจสอบข้อมูล</Text>

          {/* ITEM CARD */}
          <View style={s.itemCard}>
            {item?.image_url ? (
              <Image source={{ uri: item.image_url }} style={s.itemImg} />
            ) : (
              <View style={s.itemIconBox}>
                <Ionicons name="cube-outline" size={32} color="#f97316" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.itemName}>{item?.name}</Text>
              {item?.type ? <Text style={s.itemType}>{item.type}</Text> : null}
              <View style={s.borrowedBadge}>
                <Text style={s.borrowedBadgeTxt}>📤 กำลังถูกยืม</Text>
              </View>
            </View>
          </View>

          {/* BORROWER INFO */}
          <View style={s.infoCard}>
            <Text style={s.infoTitle}>ข้อมูลการยืม</Text>

            <View style={s.infoRow}>
              <View style={s.infoIcon}>
                <Ionicons name="person-outline" size={16} color="#1d4ed8" />
              </View>
              <View>
                <Text style={s.infoLabel}>ผู้ยืม</Text>
                <Text style={s.infoVal}>{borrowerEmail}</Text>
              </View>
            </View>

            <View style={s.infoRow}>
              <View style={s.infoIcon}>
                <Ionicons name="calendar-outline" size={16} color="#1d4ed8" />
              </View>
              <View>
                <Text style={s.infoLabel}>วันที่ยืม</Text>
                <Text style={s.infoVal}>{formatDate(borrowRecord?.borrow_date)}</Text>
              </View>
            </View>

            <View style={s.infoRow}>
              <View style={[s.infoIcon, { backgroundColor: isOverdue ? "#fee2e2" : "#fef3c7" }]}>
                <Ionicons name="time-outline" size={16} color={isOverdue ? "#dc2626" : "#b45309"} />
              </View>
              <View>
                <Text style={s.infoLabel}>ครบกำหนดคืน</Text>
                <Text style={[s.infoVal, isOverdue && { color: "#dc2626" }]}>
                  {formatDate(borrowRecord?.due_date)}
                  {daysLeft !== null && (
                    isOverdue
                      ? `  ⚠️ เกินกำหนด ${Math.abs(daysLeft)} วัน`
                      : `  (อีก ${daysLeft} วัน)`
                  )}
                </Text>
              </View>
            </View>
          </View>

          {isOverdue && (
            <View style={s.overdueBanner}>
              <Ionicons name="warning-outline" size={20} color="#dc2626" />
              <Text style={s.overdueTxt}>เกินกำหนดคืน {Math.abs(daysLeft!)} วัน</Text>
            </View>
          )}

          {/* NEXT */}
          <TouchableOpacity style={s.confirmBtn} onPress={goToSignature}>
            <Ionicons name="pencil-outline" size={20} color="#fff" />
            <Text style={s.confirmBtnTxt}>  ถัดไป — ลงลายเซ็น</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={reset}>
            <Text style={s.cancelBtnTxt}>← สแกนใหม่</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ── STEP: SIGNATURE ──
  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => setStep("confirm")}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTxt}>ลายเซ็นผู้คืน</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[s.form, { flex: 1 }]}>
        {/* STEP INDICATOR */}
        <View style={s.stepRow}>
          <View style={s.stepDone}><Ionicons name="checkmark" size={14} color="#fff" /></View>
          <View style={[s.stepLine, { backgroundColor: "#f97316" }]} />
          <View style={s.stepActive}><Text style={s.stepActiveTxt}>2</Text></View>
        </View>
        <Text style={s.stepLabel}>ขั้นตอน 2/2 — ลงลายเซ็น</Text>

        {/* SUMMARY */}
        <View style={s.summaryBox}>
          <Text style={s.summaryTitle}>{item?.name}</Text>
          <Text style={s.summaryLine}>
            <Text style={s.summaryKey}>ผู้คืน: </Text>{borrowerEmail}
          </Text>
          {isOverdue && (
            <Text style={[s.summaryLine, { color: "#dc2626" }]}>
              ⚠️ เกินกำหนด {Math.abs(daysLeft!)} วัน
            </Text>
          )}
        </View>

        {/* SIGNATURE PAD */}
        <Text style={s.fieldLabel}>ลายเซ็นผู้คืน — เซ็นด้วยนิ้วในกล่องด้านล่าง</Text>
        <View style={s.sigWrap}>
          <SignatureCanvas
            ref={sigRef}
            strokeColor="#c2410c"
            style={sigError ? s.sigError : undefined}
          />
          {sigError && (
            <Text style={s.sigErrorTxt}>⚠ กรุณาเซ็นลายเซ็นก่อนยืนยัน</Text>
          )}
        </View>

        <TouchableOpacity style={s.clearBtn} onPress={() => sigRef.current?.clear()}>
          <Ionicons name="refresh-outline" size={16} color="#64748b" />
          <Text style={s.clearBtnTxt}>ล้างลายเซ็น</Text>
        </TouchableOpacity>

        {/* CONFIRM */}
        <TouchableOpacity
          style={[s.confirmBtn, saving && s.btnDisabled]}
          onPress={confirmReturn}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={s.confirmBtnTxt}>  ยืนยันรับคืน</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.cancelBtn} onPress={() => setStep("confirm")}>
          <Text style={s.cancelBtnTxt}>← ย้อนกลับ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  header: {
    backgroundColor: "#f97316", paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerTxt: { color: "#fff", fontSize: 17, fontWeight: "bold" },

  permTxt: { fontSize: 14, color: "#64748b" },
  permBtn: { backgroundColor: "#f97316", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  permBtnTxt: { color: "#fff", fontWeight: "600" },

  cameraWrap: { flex: 1, position: "relative" },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  frameBox: { width: 260, height: 160, position: "relative" },
  corner: { position: "absolute", width: 28, height: 28, borderColor: "#fb923c", borderWidth: 3 },
  cTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  cTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  cBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  cBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  scanLoading: {
    position: "absolute", inset: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center", gap: 12,
  },
  scanLoadingTxt: { color: "#fff", fontSize: 14 },

  scanBottom: { padding: 24, alignItems: "center", gap: 6, backgroundColor: "#fff" },
  scanDesc: { fontSize: 14, color: "#1e293b", fontWeight: "600" },
  scanSub: { fontSize: 11, color: "#94a3b8" },

  form: { padding: 16 },

  stepRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  stepActive: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#f97316", justifyContent: "center", alignItems: "center",
  },
  stepActiveTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  stepInactive: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#e2e8f0", justifyContent: "center", alignItems: "center",
  },
  stepInactiveTxt: { color: "#94a3b8", fontWeight: "700", fontSize: 13 },
  stepDone: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#f97316", justifyContent: "center", alignItems: "center",
  },
  stepLine: { flex: 1, height: 2, backgroundColor: "#e2e8f0", marginHorizontal: 6 },
  stepLabel: { fontSize: 11, color: "#64748b", marginBottom: 14 },

  itemCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    flexDirection: "row", gap: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  itemImg: { width: 72, height: 72, borderRadius: 12 },
  itemIconBox: {
    width: 72, height: 72, borderRadius: 12,
    backgroundColor: "#fff7ed", justifyContent: "center", alignItems: "center",
  },
  itemName: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  itemType: { fontSize: 11, color: "#64748b", marginTop: 2 },
  borrowedBadge: { marginTop: 6, backgroundColor: "#fee2e2", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  borrowedBadgeTxt: { fontSize: 10, color: "#dc2626", fontWeight: "700" },

  infoCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    marginBottom: 12, gap: 12,
  },
  infoTitle: { fontSize: 13, fontWeight: "700", color: "#1e293b", marginBottom: 4 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  infoIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: "#eff6ff", justifyContent: "center", alignItems: "center",
  },
  infoLabel: { fontSize: 10, color: "#94a3b8" },
  infoVal: { fontSize: 13, fontWeight: "600", color: "#1e293b", marginTop: 1 },

  overdueBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fee2e2", padding: 12, borderRadius: 12, marginBottom: 12,
  },
  overdueTxt: { fontSize: 13, color: "#dc2626", fontWeight: "700" },

  summaryBox: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0", gap: 4,
  },
  summaryTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginBottom: 4 },
  summaryLine: { fontSize: 13, color: "#475569" },
  summaryKey: { fontWeight: "600", color: "#1e293b" },

  fieldLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 4,
  },
  sigWrap: { alignItems: "center", marginBottom: 6 },
  sigError: { borderColor: "#ef4444", borderStyle: "solid" },
  sigErrorTxt: { color: "#ef4444", fontSize: 12, marginTop: 4, alignSelf: "flex-start" },

  clearBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-end", paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: "#f1f5f9", borderRadius: 8, marginBottom: 16,
  },
  clearBtnTxt: { fontSize: 12, color: "#64748b" },

  confirmBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    backgroundColor: "#f97316", padding: 16, borderRadius: 14, marginBottom: 10,
  },
  confirmBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnDisabled: { backgroundColor: "#94a3b8" },
  cancelBtn: { alignItems: "center", padding: 10 },
  cancelBtnTxt: { color: "#64748b", fontSize: 13 },
});
