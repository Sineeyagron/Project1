import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
  Image, KeyboardAvoidingView, Platform, TextInput,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

const FS = FileSystem as any;
const SUPABASE_URL = "https://enupmlxmajjwskvzgcdq.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudXBtbHhtYWpqd3NrdnpnY2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDIxMDUsImV4cCI6MjA4OTMxODEwNX0.px5ah-o_guGnQ8lTP7oJIwZXJEDiAcicuQTo3A_4aqE";

type Step = "scan" | "details" | "preview";

export default function Scan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep] = useState<Step>("scan");
  const [scanned, setScanned] = useState(false);

  // ข้อมูลที่ได้จาก QR
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");

  // รูปภาพจริง
  const [photoUri, setPhotoUri] = useState("");

  const [saving, setSaving] = useState(false);
  const [cameraRequested, setCameraRequested] = useState(false);

  useEffect(() => {
    if (step !== "scan" || cameraRequested || permission?.granted) return;
    if (permission && !permission.canAskAgain) return;
    setCameraRequested(true);
    requestPermission();
  }, [cameraRequested, permission, requestPermission, step]);

  // ── สแกน QR → parse JSON ──
  const handleBarcodeScan = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const parsed = JSON.parse(data);
      // เป็น QR ที่สร้างจากระบบ (มี name field)
      if (parsed.name) {
        setName(parsed.name || "");
        setType(parsed.type || "");
        setDescription(parsed.description || "");
        setStep("details");
        return;
      }
    } catch {
      // ไม่ใช่ JSON → ใช้ค่าดิบเป็นชื่อ
    }

    // QR ทั่วไป → ใช้ค่าเป็นชื่อเริ่มต้น
    setName(data);
    setStep("details");
  };

  // ── ถ่ายรูปอุปกรณ์ ──
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("ต้องการสิทธิ์กล้อง");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  // ── เลือกรูปจาก Gallery แทน ──
  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  // ── Upload รูป + บันทึก items ──
  const handleSave = async () => {
    if (!name.trim()) { Alert.alert("กรอกชื่ออุปกรณ์ก่อน"); return; }
    const qty = parseInt(quantity) || 1;
    setSaving(true);

    try {
      let finalImageUrl = "";

      // Upload รูปจริงไป Supabase Storage ด้วย FileSystem.uploadAsync (reliable ที่สุดใน RN)
      if (photoUri) {
        const ext = photoUri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
        const fileName = `items/${Date.now()}_${name.replace(/\s+/g, "_")}.${ext}`;
        const contentType = ext === "png" ? "image/png" : "image/jpeg";

        const uploadRes = await FS.uploadAsync(
          `${SUPABASE_URL}/storage/v1/object/item-images/${fileName}`,
          photoUri,
          {
            uploadType: FS.FileSystemUploadType.BINARY_CONTENT,
            mimeType: contentType,
            httpMethod: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_ANON}`,
              "Content-Type": contentType,
              "x-upsert": "true",
            },
          }
        );

        if (uploadRes.status === 200 || uploadRes.status === 201) {
          const { data: { publicUrl } } = supabase.storage
            .from("item-images").getPublicUrl(fileName);
          finalImageUrl = publicUrl;
        } else {
          Alert.alert("อัปโหลดรูปไม่สำเร็จ", `status: ${uploadRes.status}\n${uploadRes.body}`);
        }
      }

      // Insert items (1 row ต่อ 1 ชิ้น)
      const insertData = Array.from({ length: qty }, () => ({
        name: name.trim(),
        status: "available",
        image_url: finalImageUrl || null,
        description: description.trim() || null,
      }));

      const { error } = await supabase.from("items").insert(insertData);
      if (error) throw error;

      Alert.alert(
        "บันทึกสำเร็จ! 🎉",
        `เพิ่ม "${name}" จำนวน ${qty} ชิ้นเข้าระบบแล้ว`,
        [{ text: "โอเค", onPress: () => router.replace("/admin/home") }]
      );
    } catch (e: any) {
      Alert.alert("เกิดข้อผิดพลาด", e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setStep("scan");
    setScanned(false);
    setName(""); setType(""); setDescription("");
    setQuantity("1"); setPhotoUri("");
  };

  const goBack = () => {
    router.replace("/admin/home");
  };

  const startManualAdd = () => {
    setScanned(false);
    setName("");
    setType("");
    setDescription("");
    setQuantity("1");
    setPhotoUri("");
    setStep("details");
  };

  // ── STEP INDICATOR ──
  const StepBar = () => (
    <View style={si.row}>
      {["สแกน QR", "รายละเอียด", "บันทึก"].map((label, i) => {
        const num = i + 1;
        const current = step === "scan" ? 1 : step === "details" ? 2 : 3;
        const done = num < current;
        const active = num === current;
        return (
          <React.Fragment key={i}>
            <View style={si.step}>
              <View style={[si.circle, done && si.done, active && si.active]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color="#fff" />
                  : <Text style={[si.num, active && { color: "#fff" }]}>{num}</Text>
                }
              </View>
              <Text style={[si.label, active && si.labelActive]}>{label}</Text>
            </View>
            {i < 2 && <View style={[si.line, done && si.lineDone]} />}
          </React.Fragment>
        );
      })}
    </View>
  );

  // ── RENDER: Step 1 — Scan ──
  if (step === "scan") {
    return (
      <View style={styles.container}>
        <View style={styles.scanHeader}>
          <TouchableOpacity style={styles.scanBackBtn} onPress={goBack} activeOpacity={0.82}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.scanHeaderTitleWrap}>
            <Text style={styles.scanHeaderTitle}>สแกน & เพิ่มอุปกรณ์</Text>
            <Text style={styles.scanHeaderSub}>สแกนแล้วเพิ่มเข้าระบบ</Text>
          </View>
        </View>

        <View style={styles.scanBody}>
          <View style={styles.scannerPanel}>
            {permission?.granted ? (
              <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={handleBarcodeScan}
                barcodeScannerSettings={{
                  barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39"],
                }}
              >
                <View style={styles.cameraOverlay}>
                  <View style={styles.scanLine} />
                </View>
              </CameraView>
            ) : (
              <TouchableOpacity style={styles.permissionPanel} onPress={requestPermission} activeOpacity={0.84}>
                <Ionicons name="qr-code-outline" size={58} color="rgba(15,118,110,0.18)" />
                <Text style={styles.permissionText}>
                  {permission ? "แตะเพื่ออนุญาตกล้อง" : "กำลังเชื่อมต่อกล้อง..."}
                </Text>
                <View style={styles.scanLine} />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.scanTitle}>ส่องบาร์โค้ดหรือ QR code</Text>
          <Text style={styles.scanDesc}>สแกนบาร์โค้ดจากคู่มือ — ระบบจะแสดงฟอร์มกรอกข้อมูล</Text>

          <View style={styles.autoInfo}>
            <Ionicons name="information-circle-outline" size={20} color="#0891b2" />
            <View style={styles.autoInfoTextWrap}>
              <Text style={styles.autoInfoTitle}>ระบบจะเปิดฟอร์มอัตโนมัติ</Text>
              <Text style={styles.autoInfoText}>ใส่ ชื่อ ประเภท คำอธิบาย และรูป — บันทึกลงระบบทันที</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.manualBtn} onPress={startManualAdd} activeOpacity={0.9}>
            <Ionicons name="add-circle-outline" size={16} color="#ffffff" />
            <Text style={styles.manualBtnText}>เพิ่มด้วยตนเอง</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── RENDER: Step 2 — Details + Photo ──
  if (step === "details") {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.scanBackBtn} onPress={resetAll} activeOpacity={0.82}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerText}>ตรวจสอบข้อมูล</Text>
          <View style={{ width: 22 }} />
        </View>

        <StepBar />

        <ScrollView contentContainerStyle={styles.form}>

          {/* auto-fill badge */}
          <View style={styles.autoFillBadge}>
            <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
            <Text style={styles.autoFillText}>ข้อมูลจาก QR Code ขึ้นอัตโนมัติ — แก้ไขได้</Text>
          </View>

          <Text style={styles.fieldLabel}>ชื่ออุปกรณ์ *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />

          <Text style={styles.fieldLabel}>ประเภท</Text>
          <TextInput style={styles.input} value={type} onChangeText={setType} placeholder="เช่น Microcontroller, Sensor" />

          <Text style={styles.fieldLabel}>รายละเอียด</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={description} onChangeText={setDescription}
            multiline numberOfLines={2}
            placeholder="คุณสมบัติ, รุ่น, หมายเหตุ..."
          />

          <Text style={styles.fieldLabel}>จำนวนที่เพิ่ม</Text>
          <View style={styles.qtyRow}>
            <TouchableOpacity style={styles.qtyBtn}
              onPress={() => setQuantity(q => String(Math.max(1, parseInt(q) - 1)))}>
              <Ionicons name="remove" size={20} color="#1e3a8a" />
            </TouchableOpacity>
            <TextInput
              style={styles.qtyInput} value={quantity}
              onChangeText={setQuantity} keyboardType="numeric" textAlign="center"
            />
            <TouchableOpacity style={styles.qtyBtn}
              onPress={() => setQuantity(q => String(parseInt(q) + 1))}>
              <Ionicons name="add" size={20} color="#1e3a8a" />
            </TouchableOpacity>
          </View>

          {/* PHOTO SECTION */}
          <Text style={styles.fieldLabel}>ถ่ายรูปอุปกรณ์จริง</Text>

          {photoUri ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: photoUri }} style={styles.photoImage} />
              <TouchableOpacity style={styles.retakeBtn} onPress={handleTakePhoto}>
                <Ionicons name="camera-outline" size={14} color="#fff" />
                <Text style={styles.retakeBtnText}>ถ่ายใหม่</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto}>
                <Ionicons name="camera-outline" size={24} color="#1e3a8a" />
                <Text style={styles.photoBtnText}>ถ่ายรูป</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto}>
                <Ionicons name="image-outline" size={24} color="#1e3a8a" />
                <Text style={styles.photoBtnText}>เลือกจาก Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.nextBtn, !name.trim() && styles.btnDisabled]}
            onPress={() => { if (name.trim()) setStep("preview"); }}
            disabled={!name.trim()}
          >
            <Text style={styles.nextBtnText}>ดูสรุปก่อนบันทึก →</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── RENDER: Step 3 — Preview & Save ──
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.scanBackBtn} onPress={() => setStep("details")} activeOpacity={0.82}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>ยืนยัน & บันทึก</Text>
        <View style={{ width: 22 }} />
      </View>

      <StepBar />

      <ScrollView contentContainerStyle={styles.form}>

        {/* รูปภาพ */}
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.previewImg} />
        ) : (
          <View style={styles.noPhoto}>
            <Ionicons name="image-outline" size={36} color="#cbd5e1" />
            <Text style={styles.noPhotoText}>ไม่มีรูปภาพ</Text>
          </View>
        )}

        {/* สรุปข้อมูล */}
        <View style={styles.summaryBox}>
          {[
            { label: "ชื่ออุปกรณ์", val: name },
            { label: "ประเภท", val: type || "-" },
            { label: "รายละเอียด", val: description || "-" },
            { label: "จำนวน", val: `${quantity} ชิ้น` },
            { label: "สถานะ", val: "available" },
          ].map((r) => (
            <View key={r.label} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{r.label}</Text>
              <Text style={[
                styles.summaryVal,
                r.label === "สถานะ" && { color: "#16a34a" }
              ]}>{r.val}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>  บันทึกเข้าระบบ</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={resetAll}>
          <Text style={styles.cancelBtnText}>← สแกนใหม่</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// Step indicator styles
const si = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10 },
  step: { alignItems: "center", gap: 3 },
  circle: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  active: { backgroundColor: "#1e3a8a" },
  done: { backgroundColor: "#16a34a" },
  num: { fontSize: 11, fontWeight: "700", color: "#94a3b8" },
  label: { fontSize: 9, color: "#94a3b8" },
  labelActive: { color: "#1e3a8a", fontWeight: "700" },
  line: { flex: 1, height: 2, backgroundColor: "#e2e8f0", marginBottom: 12 },
  lineDone: { backgroundColor: "#16a34a" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#eef3f8" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 20 },
  header: {
    backgroundColor: "#7c3aed", paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerText: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  permText: { fontSize: 14, color: "#64748b", textAlign: "center" },
  permBtn: { backgroundColor: "#7c3aed", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  permBtnText: { color: "#fff", fontWeight: "600" },

  // Scan
  scanHeader: {
    minHeight: 114,
    backgroundColor: "#7c3aed",
    paddingTop: 54,
    paddingHorizontal: 30,
    paddingBottom: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  scanBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanHeaderTitleWrap: {
    flex: 1,
  },
  scanHeaderTitle: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 29,
  },
  scanHeaderSub: {
    color: "#ddd6fe",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },
  scanBody: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 21,
    alignItems: "center",
  },
  scannerPanel: {
    width: 200,
    height: 200,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#0d9488",
    backgroundColor: "#f8fafc",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  camera: {
    width: "100%",
    height: "100%",
  },
  cameraOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  permissionPanel: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  permissionText: {
    color: "#0d9488",
    fontSize: 12,
    fontWeight: "900",
  },
  scanLine: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 31,
    height: 1,
    backgroundColor: "#14b8a6",
    opacity: 0.7,
  },
  scanTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 12,
  },
  scanDesc: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center",
    marginTop: 7,
  },
  autoInfo: {
    width: "100%",
    maxWidth: 420,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: "#cffafe",
    borderWidth: 1,
    borderColor: "#67e8f9",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginTop: 20,
  },
  autoInfoTextWrap: {
    flex: 1,
  },
  autoInfoTitle: {
    color: "#0f766e",
    fontSize: 13,
    fontWeight: "900",
  },
  autoInfoText: {
    color: "#0f766e",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  manualBtn: {
    width: "100%",
    maxWidth: 420,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: "#7c3aed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 19,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.35,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 7,
  },
  manualBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  scanWrap: { flex: 1 },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  frameBox: {
    width: 240, height: 240, position: "relative",
    justifyContent: "flex-end", alignItems: "center",
  },
  corner: { position: "absolute", width: 28, height: 28, borderColor: "#fff", borderWidth: 3 },
  cTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  cTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  cBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  cBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  frameHint: { color: "#fff", fontSize: 12, marginBottom: 8, backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },

  scanBottom: { padding: 20, alignItems: "center", gap: 12, backgroundColor: "#f1f5f9" },
  qrGenBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#ede9fe", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
  },
  qrGenText: { color: "#7c3aed", fontSize: 12, fontWeight: "600" },

  // Form
  form: { padding: 16 },
  autoFillBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#dcfce7", padding: 10, borderRadius: 10, marginBottom: 12,
  },
  autoFillText: { fontSize: 11, color: "#166534", flex: 1 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 5, marginTop: 12 },
  input: { backgroundColor: "#fff", borderRadius: 12, padding: 13, fontSize: 14, borderWidth: 1, borderColor: "#e2e8f0" },
  inputMulti: { height: 72, textAlignVertical: "top" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  qtyBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", justifyContent: "center", alignItems: "center" },
  qtyInput: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 10, fontSize: 18, fontWeight: "700", borderWidth: 1, borderColor: "#e2e8f0" },

  // Photo
  photoActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  photoBtn: {
    flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 16,
    alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#e2e8f0",
  },
  photoBtnText: { fontSize: 11, color: "#1e3a8a", fontWeight: "600" },
  photoPreview: { borderRadius: 12, overflow: "hidden", position: "relative", marginTop: 4 },
  photoImage: { width: "100%", height: 180, borderRadius: 12 },
  retakeBtn: {
    position: "absolute", bottom: 10, right: 10,
    backgroundColor: "rgba(0,0,0,0.6)", flexDirection: "row", alignItems: "center",
    gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  retakeBtnText: { color: "#fff", fontSize: 11 },

  nextBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    backgroundColor: "#1e3a8a", padding: 16, borderRadius: 14, marginTop: 16,
  },
  nextBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnDisabled: { backgroundColor: "#94a3b8" },

  // Preview
  previewImg: { width: "100%", height: 200, borderRadius: 14, marginBottom: 12, resizeMode: "cover" },
  noPhoto: { height: 120, backgroundColor: "#fff", borderRadius: 14, justifyContent: "center", alignItems: "center", gap: 6, marginBottom: 12 },
  noPhotoText: { color: "#94a3b8", fontSize: 12 },
  summaryBox: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 14 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#f8fafc" },
  summaryLabel: { fontSize: 12, color: "#64748b" },
  summaryVal: { fontSize: 12, fontWeight: "700", color: "#1e293b", flex: 1, textAlign: "right" },
  saveBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    backgroundColor: "#16a34a", padding: 16, borderRadius: 14, marginBottom: 10,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cancelBtn: { alignItems: "center", padding: 10 },
  cancelBtnText: { color: "#64748b", fontSize: 13 },
});
