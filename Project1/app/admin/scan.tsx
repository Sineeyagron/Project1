import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
  Image, KeyboardAvoidingView, Platform, TextInput,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

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

      // Upload รูปจริงไป Supabase Storage
      if (photoUri) {
        const fileName = `items/${Date.now()}_${name.replace(/\s+/g, "_")}.jpg`;
        const response = await fetch(photoUri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from("item-images")
          .upload(fileName, blob, { contentType: "image/jpeg", upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from("item-images")
            .getPublicUrl(fileName);
          finalImageUrl = publicUrl;
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
        [{ text: "โอเค", onPress: () => router.back() }]
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
    if (!permission) return <View style={styles.center}><ActivityIndicator /></View>;

    if (!permission.granted) {
      return (
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={48} color="#94a3b8" />
          <Text style={styles.permText}>ต้องการสิทธิ์เข้าถึงกล้อง</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>อนุญาตให้เข้าถึงกล้อง</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerText}>สแกน QR อุปกรณ์</Text>
          <View style={{ width: 22 }} />
        </View>

        <StepBar />

        <View style={styles.scanWrap}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={handleBarcodeScan}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39"],
            }}
          >
            {/* กรอบสแกน */}
            <View style={styles.overlay}>
              <View style={styles.frameBox}>
                <View style={[styles.corner, styles.cTL]} />
                <View style={[styles.corner, styles.cTR]} />
                <View style={[styles.corner, styles.cBL]} />
                <View style={[styles.corner, styles.cBR]} />
                <Text style={styles.frameHint}>จ่อ QR ให้อยู่ในกรอบ</Text>
              </View>
            </View>
          </CameraView>
        </View>

        <View style={styles.scanBottom}>
          <Text style={styles.scanDesc}>
            สแกน QR Code ที่แปะบนอุปกรณ์{"\n"}ข้อมูลจะขึ้นมาอัตโนมัติ
          </Text>

          {/* ปุ่มไปหน้า QR Generator */}
          <TouchableOpacity
            style={styles.qrGenBtn}
            onPress={() => router.push("/admin/qrgen")}
          >
            <Ionicons name="qr-code-outline" size={16} color="#7c3aed" />
            <Text style={styles.qrGenText}>ยังไม่มี QR? กดสร้าง QR ที่นี่</Text>
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
          <TouchableOpacity onPress={resetAll}>
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
        <TouchableOpacity onPress={() => setStep("details")}>
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
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 20 },
  header: {
    backgroundColor: "#1e3a8a", paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerText: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  permText: { fontSize: 14, color: "#64748b", textAlign: "center" },
  permBtn: { backgroundColor: "#1e3a8a", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  permBtnText: { color: "#fff", fontWeight: "600" },

  // Scan
  scanWrap: { flex: 1 },
  camera: { flex: 1 },
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
  scanDesc: { fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 20 },
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
