import React, { useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";
import SignatureCanvas, { SignatureCanvasRef } from "../../components/SignatureCanvas";
import { uploadSignature } from "../../lib/uploadSignature";

type Step = "scan" | "confirm" | "signature";

const DURATION_PRESETS = [
  { label: "1 วัน",  days: 1 },
  { label: "3 วัน",  days: 3 },
  { label: "7 วัน",  days: 7 },
  { label: "14 วัน", days: 14 },
];

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric",
  });

export default function BorrowScan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep] = useState<Step>("scan");
  const scanLock = useRef(false);

  const [item, setItem] = useState<any>(null);
  const [itemLoading, setItemLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [emailSuggestions, setEmailSuggestions] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [selectedDays, setSelectedDays] = useState(7);
  const [dueDate, setDueDate] = useState(addDays(7));

  const [saving, setSaving] = useState(false);
  const [sigError, setSigError] = useState(false);

  const sigRef = useRef<SignatureCanvasRef>(null);

  // ── สแกน barcode → หา item ──
  const handleScan = async ({ data }: { data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setItemLoading(true);

    let found: any = null;

    const { data: byBarcode } = await supabase
      .from("items").select("*").eq("barcode", data).single();
    found = byBarcode;

    if (!found) {
      const { data: byId } = await supabase
        .from("items").select("*").eq("id", data).single();
      found = byId;
    }

    if (!found) {
      try {
        const parsed = JSON.parse(data);
        if (parsed?.name) {
          const { data: byName } = await supabase
            .from("items").select("*")
            .ilike("name", parsed.name.trim())
            .limit(1).single();
          found = byName;
        }
      } catch (_) { /* ไม่ใช่ JSON */ }
    }

    setItemLoading(false);

    if (!found) {
      Alert.alert(
        "ไม่พบอุปกรณ์",
        `ไม่พบ "${data}" ในระบบ`,
        [{ text: "สแกนใหม่", onPress: () => { scanLock.current = false; } }]
      );
      return;
    }

    if (found.status === "borrowed") {
      Alert.alert(
        "อุปกรณ์ถูกยืมแล้ว",
        `${found.name} กำลังถูกยืมอยู่`,
        [{ text: "สแกนใหม่", onPress: () => { scanLock.current = false; } }]
      );
      return;
    }

    setItem(found);
    setStep("confirm");
  };

  const searchEmail = async (text: string) => {
    setEmail(text);
    setSelectedUser(null);
    if (text.length < 2) { setEmailSuggestions([]); return; }
    const { data } = await supabase
      .from("profiles").select("id, email")
      .ilike("email", `%${text}%`).limit(5);
    setEmailSuggestions(data || []);
  };

  const selectUser = (user: any) => {
    setSelectedUser(user);
    setEmail(user.email);
    setEmailSuggestions([]);
  };

  const selectDuration = (days: number) => {
    setSelectedDays(days);
    setDueDate(addDays(days));
  };

  // ── ยืนยันขั้นตอนแรก → ไปหน้าเซ็น ──
  const goToSignature = () => {
    if (!selectedUser) { Alert.alert("เลือก User ก่อน"); return; }
    setSigError(false);
    sigRef.current?.clear();
    setStep("signature");
  };

  // ── ยืนยันการยืม (หลังเซ็น) ──
  const confirmBorrow = async () => {
    if (sigRef.current?.isEmpty()) {
      setSigError(true);
      return;
    }
    setSigError(false);
    if (!selectedUser || !item) return;

    setSaving(true);
    try {
      // Insert borrow_record ก่อน เพื่อได้ id
      const { data: record, error: borrowErr } = await supabase
        .from("borrow_records")
        .insert([{
          user_id: selectedUser.id,
          item_id: item.id,
          status: "borrowed",
          due_date: dueDate,
        }])
        .select("id")
        .single();

      if (borrowErr || !record) throw new Error(borrowErr?.message || "Insert failed");

      // Upload signature
      const svgString = sigRef.current!.getSvgString();
      const sigUrl = await uploadSignature(svgString, "borrow", record.id);

      // อัปเดต signature url
      await supabase
        .from("borrow_records")
        .update({ borrow_signature_url: sigUrl })
        .eq("id", record.id);

      // Update item status
      await supabase.from("items").update({ status: "borrowed" }).eq("id", item.id);

      Alert.alert(
        "ยืมสำเร็จ! ✅",
        `${item.name}\nผู้ยืม: ${selectedUser.email}\nครบกำหนด: ${formatDate(dueDate)}`,
        [{ text: "โอเค", onPress: () => router.back() }]
      );
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
    setEmail("");
    setSelectedUser(null);
    setEmailSuggestions([]);
    setSelectedDays(7);
    setDueDate(addDays(7));
    setSigError(false);
  };

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
          <Text style={s.headerTxt}>สแกน Barcode ยืมของ</Text>
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

          {itemLoading && (
            <View style={s.scanLoading}>
              <ActivityIndicator color="#fff" size="large" />
              <Text style={s.scanLoadingTxt}>กำลังค้นหาอุปกรณ์...</Text>
            </View>
          )}
        </View>

        <View style={s.scanBottom}>
          <Ionicons name="barcode-outline" size={28} color="#1e3a8a" />
          <Text style={s.scanDesc}>จ่อ Barcode บนอุปกรณ์ให้อยู่ในกรอบ</Text>
          <Text style={s.scanSub}>รองรับ QR, EAN, Code128, UPC</Text>
        </View>
      </View>
    );
  }

  // ── STEP: CONFIRM ──
  if (step === "confirm") {
    return (
      <KeyboardAvoidingView
        style={s.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={reset}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTxt}>ยืนยันการยืม</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
          {/* STEP INDICATOR */}
          <View style={s.stepRow}>
            <View style={s.stepActive}><Text style={s.stepActiveTxt}>1</Text></View>
            <View style={s.stepLine} />
            <View style={s.stepInactive}><Text style={s.stepInactiveTxt}>2</Text></View>
          </View>
          <Text style={s.stepLabel}>ขั้นตอน 1/2 — ข้อมูลการยืม</Text>

          {/* ITEM CARD */}
          <View style={s.itemCard}>
            {item?.image_url ? (
              <Image source={{ uri: item.image_url }} style={s.itemImg} />
            ) : (
              <View style={s.itemIconBox}>
                <Ionicons name="cube-outline" size={32} color="#1e3a8a" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.itemName}>{item?.name}</Text>
              {item?.type ? <Text style={s.itemType}>{item.type}</Text> : null}
              {item?.description ? <Text style={s.itemDesc} numberOfLines={2}>{item.description}</Text> : null}
              <View style={s.availBadge}>
                <Text style={s.availBadgeTxt}>✅ พร้อมให้ยืม</Text>
              </View>
            </View>
          </View>

          {/* EMAIL INPUT */}
          <Text style={s.fieldLabel}>Email ผู้ยืม *</Text>
          <View style={s.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#94a3b8" />
            <TextInput
              style={s.input}
              placeholder="พิมพ์ email ผู้ยืม..."
              value={email}
              onChangeText={searchEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {selectedUser && <Ionicons name="checkmark-circle" size={20} color="#16a34a" />}
          </View>

          {emailSuggestions.length > 0 && (
            <View style={s.suggestions}>
              {emailSuggestions.map(u => (
                <TouchableOpacity key={u.id} style={s.suggestionItem} onPress={() => selectUser(u)}>
                  <Ionicons name="person-outline" size={16} color="#64748b" />
                  <Text style={s.suggestionTxt}>{u.email}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedUser && (
            <View style={s.selectedUserBox}>
              <Ionicons name="person-circle-outline" size={20} color="#16a34a" />
              <Text style={s.selectedUserTxt}>{selectedUser.email}</Text>
            </View>
          )}

          {/* DURATION */}
          <Text style={s.fieldLabel}>กำหนดวันคืน</Text>
          <View style={s.durationRow}>
            {DURATION_PRESETS.map(p => (
              <TouchableOpacity
                key={p.days}
                style={[s.durationBtn, selectedDays === p.days && s.durationBtnActive]}
                onPress={() => selectDuration(p.days)}
              >
                <Text style={[s.durationBtnTxt, selectedDays === p.days && s.durationBtnTxtActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.dueDateBox}>
            <Ionicons name="calendar-outline" size={18} color="#7c3aed" />
            <Text style={s.dueDateTxt}>ครบกำหนด: <Text style={{ fontWeight: "800" }}>{formatDate(dueDate)}</Text></Text>
          </View>

          {/* NEXT */}
          <TouchableOpacity
            style={[s.confirmBtn, !selectedUser && s.btnDisabled]}
            onPress={goToSignature}
            disabled={!selectedUser}
          >
            <Ionicons name="pencil-outline" size={20} color="#fff" />
            <Text style={s.confirmBtnTxt}>  ถัดไป — ลงลายเซ็น</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.cancelBtn} onPress={reset}>
            <Text style={s.cancelBtnTxt}>← สแกนใหม่</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── STEP: SIGNATURE ──
  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => setStep("confirm")}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTxt}>ลายเซ็นผู้ยืม</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[s.form, { flex: 1 }]}>
        {/* STEP INDICATOR */}
        <View style={s.stepRow}>
          <View style={s.stepDone}><Ionicons name="checkmark" size={14} color="#fff" /></View>
          <View style={[s.stepLine, { backgroundColor: "#16a34a" }]} />
          <View style={s.stepActive}><Text style={s.stepActiveTxt}>2</Text></View>
        </View>
        <Text style={s.stepLabel}>ขั้นตอน 2/2 — ลงลายเซ็น</Text>

        {/* SUMMARY */}
        <View style={s.summaryBox}>
          <Text style={s.summaryTitle}>{item?.name}</Text>
          <Text style={s.summaryLine}>
            <Text style={s.summaryKey}>ผู้ยืม: </Text>{selectedUser?.email}
          </Text>
          <Text style={s.summaryLine}>
            <Text style={s.summaryKey}>ครบกำหนด: </Text>{formatDate(dueDate)}
          </Text>
        </View>

        {/* SIGNATURE PAD */}
        <Text style={s.fieldLabel}>ลายเซ็นผู้ยืม — เซ็นด้วยนิ้วในกล่องด้านล่าง</Text>
        <View style={s.sigWrap}>
          <SignatureCanvas
            ref={sigRef}
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
          onPress={confirmBorrow}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={s.confirmBtnTxt}>  ยืนยันการยืม</Text>
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
    backgroundColor: "#1e3a8a", paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerTxt: { color: "#fff", fontSize: 17, fontWeight: "bold" },

  permTxt: { fontSize: 14, color: "#64748b" },
  permBtn: { backgroundColor: "#1e3a8a", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  permBtnTxt: { color: "#fff", fontWeight: "600" },

  cameraWrap: { flex: 1, position: "relative" },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  frameBox: { width: 260, height: 160, position: "relative" },
  corner: { position: "absolute", width: 28, height: 28, borderColor: "#fff", borderWidth: 3 },
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
    backgroundColor: "#1e3a8a", justifyContent: "center", alignItems: "center",
  },
  stepActiveTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  stepInactive: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#e2e8f0", justifyContent: "center", alignItems: "center",
  },
  stepInactiveTxt: { color: "#94a3b8", fontWeight: "700", fontSize: 13 },
  stepDone: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#16a34a", justifyContent: "center", alignItems: "center",
  },
  stepLine: { flex: 1, height: 2, backgroundColor: "#e2e8f0", marginHorizontal: 6 },
  stepLabel: { fontSize: 11, color: "#64748b", marginBottom: 14 },

  itemCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    flexDirection: "row", gap: 12, marginBottom: 16,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  itemImg: { width: 72, height: 72, borderRadius: 12 },
  itemIconBox: {
    width: 72, height: 72, borderRadius: 12,
    backgroundColor: "#eff6ff", justifyContent: "center", alignItems: "center",
  },
  itemName: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  itemType: { fontSize: 11, color: "#64748b", marginTop: 2 },
  itemDesc: { fontSize: 10, color: "#94a3b8", marginTop: 2 },
  availBadge: {
    marginTop: 6, backgroundColor: "#dcfce7",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start",
  },
  availBadgeTxt: { fontSize: 10, color: "#16a34a", fontWeight: "700" },

  fieldLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 4,
  },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    gap: 8, borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 4,
  },
  input: { flex: 1, fontSize: 14, color: "#1e293b" },

  suggestions: {
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1, borderColor: "#e2e8f0",
    marginBottom: 8, overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  suggestionTxt: { fontSize: 13, color: "#1e293b" },

  selectedUserBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#dcfce7", padding: 10, borderRadius: 10, marginBottom: 8,
  },
  selectedUserTxt: { fontSize: 13, color: "#166534", fontWeight: "600" },

  durationRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  durationBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", alignItems: "center",
  },
  durationBtnActive: { backgroundColor: "#1e3a8a", borderColor: "#1e3a8a" },
  durationBtnTxt: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  durationBtnTxtActive: { color: "#fff" },

  dueDateBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#ede9fe", padding: 12, borderRadius: 10, marginBottom: 16,
  },
  dueDateTxt: { fontSize: 13, color: "#5b21b6" },

  summaryBox: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0", gap: 4,
  },
  summaryTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b", marginBottom: 4 },
  summaryLine: { fontSize: 13, color: "#475569" },
  summaryKey: { fontWeight: "600", color: "#1e293b" },

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
    backgroundColor: "#16a34a", padding: 16, borderRadius: 14, marginBottom: 10,
  },
  confirmBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnDisabled: { backgroundColor: "#94a3b8" },
  cancelBtn: { alignItems: "center", padding: 10 },
  cancelBtnTxt: { color: "#64748b", fontSize: 13 },
});
