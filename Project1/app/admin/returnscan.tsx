import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Image,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

type Step = "scan" | "confirm";

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
  const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
};

export default function ReturnScan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep] = useState<Step>("scan");
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ข้อมูลที่ดึงมา
  const [item, setItem]         = useState<any>(null);
  const [borrowRecord, setBorrowRecord] = useState<any>(null);
  const [borrowerEmail, setBorrowerEmail] = useState("");

  // ── สแกน barcode → ดึงข้อมูลการยืม ──
  const handleScan = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setLoading(true);

    // 1. หา item จาก barcode field
    let foundItem: any = null;
    const { data: byBarcode } = await supabase
      .from("items").select("*").eq("barcode", data).single();
    foundItem = byBarcode;

    // 2. ลอง id (UUID)
    if (!foundItem) {
      const { data: byId } = await supabase
        .from("items").select("*").eq("id", data).single();
      foundItem = byId;
    }

    // 3. ถ้าสแกนได้ JSON (จาก QRGen) → parse แล้วหาด้วย name
    if (!foundItem) {
      try {
        const parsed = JSON.parse(data);
        if (parsed?.name) {
          const { data: byName } = await supabase
            .from("items").select("*")
            .ilike("name", parsed.name.trim())
            .limit(1)
            .single();
          foundItem = byName;
        }
      } catch (_) { /* ไม่ใช่ JSON — ข้าม */ }
    }

    if (!foundItem) {
      setLoading(false);
      Alert.alert(
        "ไม่พบอุปกรณ์",
        `ไม่พบ "${data}" ในระบบ\nลองสแกนใหม่หรือตรวจสอบว่าอุปกรณ์ถูกเพิ่มเข้าระบบแล้ว`,
        [{ text: "สแกนใหม่", onPress: () => setScanned(false) }]
      );
      return;
    }

    if (foundItem.status !== "borrowed") {
      setLoading(false);
      Alert.alert(
        "ไม่ได้ถูกยืม",
        `${foundItem.name} ไม่ได้อยู่ในสถานะถูกยืม`,
        [{ text: "สแกนใหม่", onPress: () => setScanned(false) }]
      );
      return;
    }

    // ดึง borrow_record ล่าสุดของ item นี้ (ไม่ join profiles เพื่อหลีกเลี่ยง FK issue)
    const { data: record, error: recQueryErr } = await supabase
      .from("borrow_records")
      .select("*")
      .eq("item_id", foundItem.id)
      .eq("status", "borrowed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // ถ้า created_at ไม่มี ลองไม่ order
    let finalRecord = record;
    if (!finalRecord) {
      const { data: rec2 } = await supabase
        .from("borrow_records")
        .select("*")
        .eq("item_id", foundItem.id)
        .eq("status", "borrowed")
        .limit(1)
        .single();
      finalRecord = rec2;
    }

    setLoading(false);

    if (!finalRecord) {
      Alert.alert(
        "ไม่พบประวัติการยืม",
        "ไม่พบข้อมูลการยืมในระบบ อาจถูกบันทึกด้วยสถานะอื่น",
        [{ text: "สแกนใหม่", onPress: () => setScanned(false) }]
      );
      return;
    }

    // ดึง email ผู้ยืมแยก
    let emailVal = "ไม่ทราบ";
    if (finalRecord.user_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", finalRecord.user_id)
        .single();
      if (prof?.email) emailVal = prof.email;
    }

    setItem(foundItem);
    setBorrowRecord(finalRecord);
    setBorrowerEmail(emailVal);
    setStep("confirm");
  };

  // ── ยืนยันการคืน ──
  const confirmReturn = async () => {
    if (!item || !borrowRecord) return;
    setSaving(true);

    const { error: recErr } = await supabase
      .from("borrow_records")
      .update({ status: "returned" })
      .eq("id", borrowRecord.id);

    if (recErr) {
      Alert.alert("เกิดข้อผิดพลาด", recErr.message);
      setSaving(false);
      return;
    }

    await supabase.from("items").update({ status: "available" }).eq("id", item.id);

    setSaving(false);
    Alert.alert(
      "รับคืนสำเร็จ! ✅",
      `${item.name} คืนเรียบร้อยแล้ว`,
      [{ text: "โอเค", onPress: () => router.back() }]
    );
  };

  const reset = () => {
    setStep("scan");
    setScanned(false);
    setItem(null);
    setBorrowRecord(null);
    setBorrowerEmail("");
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
  const daysLeft = borrowRecord?.due_date ? getDaysLeft(borrowRecord.due_date) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0;

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
              <Ionicons
                name="time-outline" size={16}
                color={isOverdue ? "#dc2626" : "#b45309"}
              />
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

        {/* เกินกำหนด banner */}
        {isOverdue && (
          <View style={s.overdueBanner}>
            <Ionicons name="warning-outline" size={20} color="#dc2626" />
            <Text style={s.overdueTxt}>เกินกำหนดคืน {Math.abs(daysLeft!)} วัน</Text>
          </View>
        )}

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

        <TouchableOpacity style={s.cancelBtn} onPress={reset}>
          <Text style={s.cancelBtnTxt}>← สแกนใหม่</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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

  confirmBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    backgroundColor: "#f97316", padding: 16, borderRadius: 14, marginBottom: 10,
  },
  confirmBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnDisabled: { backgroundColor: "#94a3b8" },
  cancelBtn: { alignItems: "center", padding: 10 },
  cancelBtnTxt: { color: "#64748b", fontSize: 13 },
});
