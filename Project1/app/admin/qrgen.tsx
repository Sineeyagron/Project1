import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";

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

  // สร้าง QR URL จาก qrserver.com (ฟรี ไม่ต้อง API key)
  const handleGenerate = () => {
    if (!name.trim()) { Alert.alert("กรอกชื่ออุปกรณ์ก่อน"); return; }

    const payload = JSON.stringify({
      name: name.trim(),
      type,
      description: description.trim(),
    });

    const encoded = encodeURIComponent(payload);
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}&margin=10`;
    setQrUrl(url);
  };

  // บันทึก QR ลง Gallery
  const handleSave = async () => {
    if (!qrUrl) return;
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("ต้องการสิทธิ์เข้าถึง Gallery");
        setSaving(false);
        return;
      }

      // Download รูปก่อน แล้วค่อยบันทึก
      const fileName = `QR_${name.replace(/\s+/g, "_")}_${Date.now()}.png`;
      const FS = FileSystem as any;
      const fileUri = (FS.documentDirectory ?? "") + fileName;

      const { uri } = await FS.downloadAsync(qrUrl, fileUri);
      await MediaLibrary.saveToLibraryAsync(uri);

      Alert.alert(
        "บันทึกสำเร็จ! 📸",
        "QR Code ถูกบันทึกลง Gallery แล้ว\nนำไปปรื้นแล้วแปะที่อุปกรณ์ได้เลย",
        [{ text: "โอเค" }]
      );
    } catch (e: any) {
      Alert.alert("เกิดข้อผิดพลาด", e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setName("");
    setType("Microcontroller");
    setDescription("");
    setQrUrl("");
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>สร้าง QR อุปกรณ์</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* HOW TO */}
        <View style={styles.howTo}>
          <Text style={styles.howToTitle}>📌 วิธีใช้</Text>
          <Text style={styles.howToText}>
            1. กรอกข้อมูลอุปกรณ์ → กดสร้าง QR{"\n"}
            2. กดบันทึก QR ลง Gallery{"\n"}
            3. ส่งไปปรื้น → แปะที่กล่อง/อุปกรณ์{"\n"}
            4. ใช้หน้าสแกนเพื่อเพิ่มอุปกรณ์เข้าระบบ
          </Text>
        </View>

        {/* FORM */}
        <Text style={styles.label}>ชื่ออุปกรณ์ *</Text>
        <TextInput
          style={styles.input}
          placeholder="เช่น ESP32, Arduino Uno, Raspberry Pi 4B"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>ประเภท</Text>
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.typeScroll}
          contentContainerStyle={styles.typeRow}
        >
          {DEVICE_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, type === t && styles.typeBtnActive]}
              onPress={() => setType(t)}
            >
              <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>รายละเอียด (ไม่บังคับ)</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="คุณสมบัติ, รุ่น, หมายเหตุ..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={2}
        />

        <TouchableOpacity
          style={[styles.genBtn, !name.trim() && styles.btnDisabled]}
          onPress={handleGenerate}
          disabled={!name.trim()}
        >
          <Ionicons name="qr-code-outline" size={18} color="#fff" />
          <Text style={styles.genBtnText}>  สร้าง QR Code</Text>
        </TouchableOpacity>

        {/* QR PREVIEW */}
        {qrUrl ? (
          <View style={styles.qrCard}>
            <Text style={styles.qrCardTitle}>QR Code พร้อมใช้งาน</Text>

            <View style={styles.qrImageBox}>
              <Image
                source={{ uri: qrUrl }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>

            {/* INFO */}
            <View style={styles.qrInfo}>
              <View style={styles.qrInfoRow}>
                <Text style={styles.qrInfoLabel}>ชื่อ</Text>
                <Text style={styles.qrInfoVal}>{name}</Text>
              </View>
              <View style={styles.qrInfoRow}>
                <Text style={styles.qrInfoLabel}>ประเภท</Text>
                <Text style={styles.qrInfoVal}>{type}</Text>
              </View>
              {description ? (
                <View style={styles.qrInfoRow}>
                  <Text style={styles.qrInfoLabel}>รายละเอียด</Text>
                  <Text style={styles.qrInfoVal}>{description}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.qrHint}>
              📲 สแกน QR นี้จะได้ข้อมูลอุปกรณ์ขึ้นอัตโนมัติ
            </Text>

            {/* ACTION BUTTONS */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.btnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>บันทึกลง Gallery</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Ionicons name="refresh-outline" size={16} color="#64748b" />
                <Text style={styles.resetBtnText}>สร้างใหม่</Text>
              </TouchableOpacity>
            </View>

          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    backgroundColor: "#1e3a8a",
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  scroll: { padding: 16 },

  howTo: {
    backgroundColor: "#eff6ff", borderRadius: 12,
    padding: 12, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: "#3b82f6",
  },
  howToTitle: { fontSize: 12, fontWeight: "700", color: "#1e3a8a", marginBottom: 4 },
  howToText: { fontSize: 11, color: "#475569", lineHeight: 18 },

  label: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    fontSize: 14, borderWidth: 1, borderColor: "#e2e8f0",
  },
  inputMulti: { height: 72, textAlignVertical: "top" },

  typeScroll: { marginBottom: 4 },
  typeRow: { gap: 8, paddingVertical: 4 },
  typeBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  typeBtnActive: { backgroundColor: "#1e3a8a", borderColor: "#1e3a8a" },
  typeBtnText: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  typeBtnTextActive: { color: "#fff" },

  genBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    backgroundColor: "#1e3a8a", padding: 16, borderRadius: 14, marginTop: 16,
  },
  genBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnDisabled: { backgroundColor: "#94a3b8" },

  // QR Card
  qrCard: {
    backgroundColor: "#fff", borderRadius: 16,
    padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  qrCardTitle: {
    fontSize: 13, fontWeight: "700", color: "#1e293b",
    textAlign: "center", marginBottom: 12,
  },
  qrImageBox: {
    alignItems: "center", backgroundColor: "#fff",
    padding: 8, borderRadius: 12,
    borderWidth: 1, borderColor: "#f1f5f9",
  },
  qrImage: { width: 220, height: 220 },
  qrInfo: {
    marginTop: 12, backgroundColor: "#f8fafc",
    borderRadius: 10, padding: 10,
  },
  qrInfoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  qrInfoLabel: { fontSize: 11, color: "#94a3b8" },
  qrInfoVal: { fontSize: 11, fontWeight: "700", color: "#1e293b" },
  qrHint: {
    fontSize: 10, color: "#64748b", textAlign: "center",
    marginTop: 10, marginBottom: 12,
  },
  actionRow: { flexDirection: "row", gap: 10 },
  saveBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#16a34a", padding: 12, borderRadius: 12, gap: 6,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  resetBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#f1f5f9", padding: 12, borderRadius: 12, gap: 6,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  resetBtnText: { color: "#64748b", fontWeight: "600", fontSize: 13 },
});
