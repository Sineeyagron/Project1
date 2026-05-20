import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";

const FS = FileSystem as any;

const DEVICE_TYPES = [
  "Microcontroller", "SBC", "Sensor", "Actuator",
  "Module", "Kit", "Cable", "Other",
];

export default function QRGen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [type, setType] = useState("Microcontroller");
  const [description, setDescription] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const handleGenerate = () => {
    if (!name.trim()) { Alert.alert("กรอกชื่ออุปกรณ์ก่อน"); return; }
    const payload = JSON.stringify({ name: name.trim(), type, description: description.trim() });
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}&margin=10`;
    setQrUrl(url);
  };

  const handleSave = async () => {
    if (!qrUrl) return;
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") { Alert.alert("ต้องการสิทธิ์เข้าถึง Gallery"); setSaving(false); return; }
      const fileName = `QR_${name.replace(/\s+/g, "_")}_${Date.now()}.png`;
      const fileUri = (FS.documentDirectory ?? "") + fileName;
      const { uri } = await FS.downloadAsync(qrUrl, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("บันทึกสำเร็จ", "QR Code ถูกบันทึกลง Gallery แล้ว");
    } catch (e: any) {
      Alert.alert("เกิดข้อผิดพลาด", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setName(""); setType("Microcontroller"); setDescription(""); setQrUrl("");
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>สร้าง QR อุปกรณ์</Text>
          <Text style={s.headerSub}>กรอกข้อมูล → สร้าง → บันทึกลง Gallery</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">

        {/* FORM CARD */}
        <View style={s.formCard}>
          <Text style={s.sectionLabel}>ข้อมูลอุปกรณ์</Text>

          <Text style={s.fieldLabel}>ชื่ออุปกรณ์ *</Text>
          <View style={s.inputWrap}>
            <Ionicons name="cube-outline" size={18} color="#94a3b8" />
            <TextInput
              style={s.input}
              placeholder="เช่น ESP32, Arduino Uno..."
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
            />
          </View>

          <Text style={s.fieldLabel}>ประเภท</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.typeRow}>
            {DEVICE_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[s.typeBtn, type === t && s.typeBtnActive]}
                onPress={() => setType(t)}
              >
                <Text style={[s.typeBtnTxt, type === t && s.typeBtnTxtActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.fieldLabel}>รายละเอียด (ไม่บังคับ)</Text>
          <TextInput
            style={s.inputMulti}
            placeholder="คุณสมบัติ, รุ่น, หมายเหตุ..."
            placeholderTextColor="#94a3b8"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={2}
          />

          <TouchableOpacity
            style={[s.genBtn, !name.trim() && s.btnDisabled]}
            onPress={handleGenerate}
            disabled={!name.trim()}
          >
            <Ionicons name="qr-code-outline" size={20} color="#fff" />
            <Text style={s.genBtnTxt}>สร้าง QR Code</Text>
          </TouchableOpacity>
        </View>

        {/* QR RESULT */}
        {qrUrl ? (
          <View style={s.qrCard}>
            <Text style={s.sectionLabel}>QR Code พร้อมใช้งาน</Text>

            {/* QR IMAGE */}
            <View style={s.qrImageBox}>
              <Image source={{ uri: qrUrl }} style={s.qrImage} resizeMode="contain" />
            </View>

            {/* INFO */}
            <View style={s.infoBox}>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>ชื่อ</Text>
                <Text style={s.infoVal}>{name}</Text>
              </View>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>ประเภท</Text>
                <Text style={s.infoVal}>{type}</Text>
              </View>
              {description ? (
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>รายละเอียด</Text>
                  <Text style={s.infoVal}>{description}</Text>
                </View>
              ) : null}
            </View>

            <Text style={s.hint}>สแกน QR นี้ในหน้า &quot;สแกน & เพิ่ม&quot; เพื่อเพิ่มอุปกรณ์เข้าระบบ</Text>

            {/* ACTIONS */}
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.saveBtn, saving && s.btnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Ionicons name="download-outline" size={18} color="#fff" />
                    <Text style={s.saveBtnTxt}>บันทึกลง Gallery</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={s.resetBtn} onPress={handleReset}>
                <Ionicons name="refresh-outline" size={18} color="#64748b" />
                <Text style={s.resetBtnTxt}>สร้างใหม่</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  header: {
    backgroundColor: "#1e3a8a",
    paddingTop: 54, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold", textAlign: "center" },
  headerSub:   { color: "#93c5fd", fontSize: 12, textAlign: "center", marginTop: 2 },

  body: { padding: 16 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14,
  },

  // Form Card
  formCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#475569", marginBottom: 6, marginTop: 12 },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#f8fafc", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  input: { flex: 1, fontSize: 14, color: "#1e293b" },
  inputMulti: {
    backgroundColor: "#f8fafc", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: "#e2e8f0",
    fontSize: 14, color: "#1e293b",
    minHeight: 70, textAlignVertical: "top",
  },

  typeRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  typeBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0",
  },
  typeBtnActive: { backgroundColor: "#1e3a8a", bordercolor: "#1e3a8a" },
  typeBtnTxt: { fontSize: 12, fontWeight: "600", color: "#64748b" },
  typeBtnTxtActive: { color: "#fff" },

  genBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8,
    backgroundColor: "#1e3a8a", padding: 15, borderRadius: 12, marginTop: 16,
  },
  genBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnDisabled: { backgroundColor: "#94a3b8" },

  // QR Card
  qrCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  qrImageBox: {
    alignItems: "center", backgroundColor: "#f8fafc",
    borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: "#e2e8f0", marginBottom: 14,
  },
  qrImage: { width: 200, height: 200 },

  infoBox: {
    backgroundColor: "#f8fafc", borderRadius: 12,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  infoLabel: { fontSize: 12, color: "#94a3b8" },
  infoVal:   { fontSize: 12, fontWeight: "700", color: "#1e293b", flex: 1, textAlign: "right" },

  hint: { fontSize: 11, color: "#64748b", textAlign: "center", marginBottom: 14, lineHeight: 16 },

  actionRow: { flexDirection: "row", gap: 10 },
  saveBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#16a34a", padding: 13, borderRadius: 12,
  },
  saveBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  resetBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#f1f5f9", padding: 13, borderRadius: 12,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  resetBtnTxt: { color: "#64748b", fontWeight: "600", fontSize: 13 },
});
