import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Text, TextInput } from "../../components/AppText";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { ITEM_PHOTO_MAX, shrinkPhoto } from "../../lib/shrinkPhoto";
import supabase from "../../lib/supabase";
import { goBack as navBack } from "../../lib/nav";
import { parseThaiDate } from "../../lib/itemInfo";
import WarrantyDateField, { warrantyBlocked } from "../../components/borrow/WarrantyDateField";
import { notify } from "../../lib/notify";
import { C, W, NG, gradient } from "../../lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { desktopBody, desktopCols, useIsDesktop } from "../../lib/layout";
import ScreenHeader from "../../components/ScreenHeader";
import DesktopBox from "../../components/desktop/DesktopBox";

const FS = FileSystem as any;
const SUPABASE_URL = "https://enupmlxmajjwskvzgcdq.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudXBtbHhtYWpqd3NrdnpnY2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDIxMDUsImV4cCI6MjA4OTMxODEwNX0.px5ah-o_guGnQ8lTP7oJIwZXJEDiAcicuQTo3A_4aqE";

// เพิ่มอุปกรณ์: กรอก → ยืนยัน (QR ป้ายสร้างทีหลังที่หน้า qrgen ไม่ได้สแกนตอนเพิ่มแล้ว)
type Step = "details" | "preview";
type Category = { id: string; name: string };

// ตัดช่องว่าง/สัญลักษณ์แบบเดียวกับ alloc_item_code() ในฐานข้อมูล ใช้แค่แสดงตัวอย่างรหัส
const codePrefixPreview = (name: string, shortName: string) =>
  (shortName.trim() || name.trim()).replace(/[\s!-/:-@[-`{-~]/g, "") || "Item";

const formatThaiDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
  });

export default function Scan() {
  const isDesktop = useIsDesktop(); // เว็บจอใหญ่ → 2 คอลัมน์

  const [step, setStep] = useState<Step>("details");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");

  // ข้อมูลเพิ่มเติม (เฟส 1)
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [shortName, setShortName] = useState("");
  const [serial, setSerial] = useState("");
  const [warranty, setWarranty] = useState("");

  // รูปภาพจริง
  const [photoUri, setPhotoUri] = useState("");

  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();
  // ส่วน "ข้อมูลเพิ่มเติม" พับเก็บไว้ก่อน
  const [showMore, setShowMore] = useState(false);
  // เลขถัดไปของรุ่นนี้ (แค่แสดงช่วงรหัสตัวอย่าง)
  const [nextNo, setNextNo] = useState<number | null>(null);
  // เลื่อนจอให้การ์ด "ข้อมูลเพิ่มเติม" ขึ้นมาอยู่บนสุดตอนเปิด/กดพิมพ์ในการ์ดนี้
  const scrollRef = useRef<any>(null);
  const moreY = useRef(0);
  const focusMore = () => scrollRef.current?.scrollTo({ y: Math.max(0, moreY.current - 8), animated: true });

  useEffect(() => {
    supabase
      .from("categories")
      .select("id, name")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setCategories(data || []));
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  // ช่องประกันพิมพ์ วว/ดด/ปปปป (พ.ศ.) → warrantyIso = ปปปป-ดด-วว (ค.ศ.) ที่บันทึกลงฐานข้อมูล
  const warrantyIso = parseThaiDate(warranty);
  const warrantyInvalid = warrantyBlocked(warranty);
  const canContinue = !!name.trim() && !warrantyInvalid;
  // วันที่ผิด = เปิดส่วนข้อมูลเพิ่มเติมเองให้เห็นช่องที่ผิด
  const moreOpen = showMore || warrantyInvalid;
  const moreSummary =
    [serial.trim() && `Serial ${serial.trim()}`, warrantyIso && `ประกันถึง ${formatThaiDate(warrantyIso)}`, description.trim() && "มีรายละเอียด"]
      .filter(Boolean)
      .join(" · ") || "Serial, วันหมดประกัน, รายละเอียด";

  // หาเลขล่าสุดของรุ่นนี้ (หน่วง 400 ms ระหว่างพิมพ์)
  useEffect(() => {
    const prefix = codePrefixPreview(name, shortName);
    if (!name.trim()) {
      setNextNo(null);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("items")
        .select("item_no")
        .ilike("item_prefix", prefix)
        .order("item_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (alive) setNextNo(error ? null : (data?.item_no ?? 0) + 1);
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [name, shortName]);

  // ── ถ่ายรูปอุปกรณ์ ──
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      notify("ต้องการสิทธิ์กล้อง");
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
    if (!name.trim()) { notify("กรอกชื่ออุปกรณ์ก่อน"); return; }
    if (warrantyInvalid) {
      notify("วันหมดประกันไม่ถูกต้อง", "ใช้รูปแบบ วัน/เดือน/ปี พ.ศ. เช่น 31/12/2570");
      return;
    }
    // พิมพ์ติดลบ/ตัวอักษร/เยอะเกิน → เดิมบันทึก 0 แถวแต่ขึ้นว่าสำเร็จ หรือเพิ่มของทีละหลายร้อยชิ้นโดยไม่ตั้งใจ
    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty < 1 || qty > 200) {
      notify("จำนวนไม่ถูกต้อง", "ใส่จำนวน 1–200 ชิ้น");
      return;
    }
    setSaving(true);

    try {
      let finalImageUrl = "";

      if (photoUri) {
        // ชื่อไฟล์ใช้แค่ ASCII: Storage ไม่รับ key ที่มีตัวอักษรไทย
        const fileBase = `items/${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        let fileName = "";
        let uploadError = "";
        // ย่อเหลือด้านยาว 1000px + JPEG ก่อนอัปโหลด (รูปกล้องเต็มขนาดหนักเกินที่แอปใช้ — lib/shrinkPhoto)
        const uploadUri = await shrinkPhoto(photoUri, ITEM_PHOTO_MAX);

        if (Platform.OS === "web") {
          // บนเว็บรูปเป็น blob:/data: URL และไม่มี FileSystem.uploadAsync → อัปโหลดผ่าน supabase-js
          const blob = await (await fetch(uploadUri)).blob();
          const ext = blob.type === "image/png" ? "png" : "jpg";
          fileName = `${fileBase}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("item-images")
            .upload(fileName, blob, { contentType: blob.type || "image/jpeg", upsert: true });
          if (upErr) uploadError = upErr.message;
        } else {
          // มือถือ: FileSystem.uploadAsync (reliable ที่สุดใน RN, กัน bug ไฟล์ 0 ไบต์)
          const ext = uploadUri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
          fileName = `${fileBase}.${ext}`;
          const contentType = ext === "png" ? "image/png" : "image/jpeg";
          // Storage อนุญาตเฉพาะ admin → ต้องส่ง token ของผู้ใช้ที่ล็อกอิน ไม่ใช่ anon key
          const { data: { session } } = await supabase.auth.getSession();

          const uploadRes = await FS.uploadAsync(
            `${SUPABASE_URL}/storage/v1/object/item-images/${fileName}`,
            uploadUri,
            {
              uploadType: FS.FileSystemUploadType.BINARY_CONTENT,
              mimeType: contentType,
              httpMethod: "POST",
              headers: {
                Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON}`,
                apikey: SUPABASE_ANON,
                "Content-Type": contentType,
                "x-upsert": "true",
              },
            }
          );
          if (uploadRes.status !== 200 && uploadRes.status !== 201) {
            uploadError = `status: ${uploadRes.status}\n${uploadRes.body}`;
          }
        }

        if (uploadError) {
          notify("อัปโหลดรูปไม่สำเร็จ", `${uploadError}\n\nจะบันทึกอุปกรณ์โดยไม่มีรูป`);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from("item-images").getPublicUrl(fileName);
          finalImageUrl = publicUrl;
        }
      }

      // Insert items (1 row ต่อ 1 ชิ้น) — item_code, barcode, location_id ฐานข้อมูลสร้างให้เอง
      const insertData = Array.from({ length: qty }, () => ({
        name: name.trim(),
        status: "available",
        image_url: finalImageUrl || null,
        description: description.trim() || null,
        category_id: categoryId || null,
        type: selectedCategory?.name || null,
        short_name: shortName.trim() || null,
        manufacturer_serial: serial.trim() || null,
        warranty_expires_at: warrantyIso,
      }));

      const { data: saved, error } = await supabase
        .from("items")
        .insert(insertData)
        .select("item_no, item_code, barcode");
      if (error) throw error;

      const codes = (saved || [])
        .sort((a, b) => a.item_no - b.item_no)
        .map((row) => `${row.item_code}  (สแกน ${row.barcode})`)
        .join("\n");

      notify(
        "บันทึกสำเร็จ! 🎉",
        `เพิ่ม "${name}" จำนวน ${qty} ชิ้นเข้าระบบแล้ว\n\n${codes}`,
        () => navBack("/admin/home")
      );
    } catch (e: any) {
      notify("เกิดข้อผิดพลาด", e.message);
    } finally {
      setSaving(false);
    }
  };

  const clearForm = () => {
    setName("");
    setCategoryId("");
    setDescription("");
    setQuantity("1");
    setPhotoUri("");
    setShortName("");
    setSerial("");
    setWarranty("");
    setShowMore(false);
  };

  const resetAll = () => {
    setStep("details");
    clearForm();
  };

  const goBack = () => {
    navBack("/admin/home");
  };

  const prefix = codePrefixPreview(name, shortName);
  const qtyNum = Math.max(1, parseInt(quantity, 10) || 1);
  // ช่วงรหัสที่จะได้ (ประมาณจากเลขล่าสุดของรุ่นนี้ — ฐานข้อมูลออกเลขจริงตอนบันทึก)
  const codeRange =
    nextNo == null
      ? `${prefix} ###`
      : qtyNum === 1
      ? `${prefix} ${pad3(nextNo)}`
      : `${prefix} ${pad3(nextNo)}–${pad3(nextNo + qtyNum - 1)}`;

  // ── ขั้น 1: รายละเอียด (แบบ ก 11 ต.ค. 2569: รูปขึ้นก่อน + การ์ดตามกลุ่ม + ส่วนไม่บังคับพับเก็บ + ปุ่มติดล่าง) ──
  if (step === "details") {
    return (
      <View style={styles.container}>
        <ScreenHeader title={"เพิ่มอุปกรณ์"} onBack={() => goBack()} />
        <DesktopBox><StepBar step={step} /></DesktopBox>

        <KeyboardAwareScrollView ref={scrollRef} bottomOffset={24} contentContainerStyle={[styles.form, isDesktop && desktopBody.wide]}>
          {isDesktop ? (
            // จอใหญ่: ซ้าย = รูป · ขวา = ข้อมูลหลัก/จำนวน/ข้อมูลเพิ่มเติม
            <View style={desktopCols.row}>
              <View style={desktopCols.side}>
          {/* รูป — แตะกรอบ = ถ่ายรูป / ลิงก์ล่าง = เลือกจากคลังรูป */}
          {photoUri ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: photoUri }} style={styles.photoImage} />
              <View style={styles.photoTools}>
                <TouchableOpacity style={styles.photoTool} onPress={handleTakePhoto} activeOpacity={0.85}>
                  <Ionicons name="camera-outline" size={15} color="#fff" />
                  <Text style={styles.photoToolText}>ถ่ายใหม่</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoTool} onPress={handlePickPhoto} activeOpacity={0.85}>
                  <Ionicons name="images-outline" size={15} color="#fff" />
                  <Text style={styles.photoToolText}>เลือกรูปอื่น</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.photoEmpty}>
              <TouchableOpacity style={styles.photoTap} onPress={handleTakePhoto} activeOpacity={0.85} accessibilityLabel="ถ่ายรูปอุปกรณ์">
                <View style={styles.photoIcon}>
                  <Ionicons name="camera" size={24} color="#fff" />
                </View>
                <Text style={styles.photoTitle}>ถ่ายรูปอุปกรณ์จริง</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickPhoto} hitSlop={8} activeOpacity={0.7}>
                <Text style={styles.photoLink}>หรือเลือกจากคลังรูป</Text>
              </TouchableOpacity>
            </View>
          )}

              </View>
              <View style={desktopCols.main}>
          {/* 1 ข้อมูลหลัก */}
          <View style={styles.card}>
            <SectionTitle no="1" title="ข้อมูลหลัก" />
            <Text style={styles.fieldLabel}>ชื่ออุปกรณ์ *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="เช่น เซนเซอร์อุณหภูมิ DHT22" placeholderTextColor="#94A3B8" />

            <Text style={styles.fieldLabel}>ชื่อย่อสำหรับรหัส</Text>
            <TextInput
              style={styles.input}
              value={shortName}
              onChangeText={setShortName}
              placeholder="ไม่บังคับ — ใช้เมื่อชื่อยาว เช่น DHT22"
              placeholderTextColor="#94A3B8"
            />
            {!!name.trim() && (
              <View style={styles.codeHint}>
                <Ionicons name="pricetag-outline" size={13} color="#1D4ED8" />
                <Text style={styles.codeHintText}>
                  รหัสที่จะได้: {nextNo == null ? `${prefix} 001, 002, …` : codeRange} (นับต่อจากของเดิมให้เอง)
                </Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>หมวดหมู่</Text>
            <View style={styles.chipWrap}>
              {categories.map((c) => {
                const active = c.id === categoryId;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategoryId(active ? "" : c.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 2 จำนวน */}
          <View style={[styles.card, styles.qtyCard]}>
            <SectionTitle no="2" title="จำนวนที่เพิ่ม" />
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => String(Math.max(1, (parseInt(q, 10) || 1) - 1)))}
                accessibilityLabel="ลดจำนวน"
              >
                <Ionicons name="remove" size={20} color="#1D4ED8" />
              </TouchableOpacity>
              <TextInput style={styles.qtyInput} value={quantity} onChangeText={setQuantity} keyboardType="numeric" textAlign="center" />
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => String(Math.min(200, (parseInt(q, 10) || 0) + 1)))}
                accessibilityLabel="เพิ่มจำนวน"
              >
                <Ionicons name="add" size={20} color="#1D4ED8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ข้อมูลเพิ่มเติม (ไม่บังคับ) — พับเก็บ / เปิดเองถ้าวันที่ผิด */}
          <View style={styles.card} onLayout={(e) => (moreY.current = e.nativeEvent.layout.y)}>
            <TouchableOpacity
              style={styles.moreHead}
              onPress={() => {
                if (moreOpen) return setShowMore(false);
                setShowMore(true);
                setTimeout(focusMore, 80); // รอให้ช่องกรอกโผล่ก่อนค่อยเลื่อน
              }}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.moreTitle}>
                  ข้อมูลเพิ่มเติม <Text style={styles.moreOptional}>· ไม่บังคับ</Text>
                </Text>
                {!moreOpen && <Text style={styles.moreSub}>{moreSummary}</Text>}
              </View>
              <Ionicons name={moreOpen ? "chevron-up" : "chevron-down"} size={18} color="#1D4ED8" />
            </TouchableOpacity>

            {moreOpen && (
              <>
                <Text style={styles.fieldLabel}>Serial ผู้ผลิต</Text>
                <TextInput
                  style={styles.input}
                  value={serial}
                  onChangeText={setSerial}
                  onFocus={focusMore}
                  placeholder="เลขที่พิมพ์บนตัวอุปกรณ์"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                />

                <Text style={styles.fieldLabel}>วันหมดประกัน</Text>
                <WarrantyDateField value={warranty} onChange={setWarranty} inputStyle={styles.input} onFocus={focusMore} />

                <Text style={styles.fieldLabel}>รายละเอียด</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={2}
                  placeholder="คุณสมบัติ, รุ่น, หมายเหตุ..."
                  placeholderTextColor="#94A3B8"
                />
              </>
            )}
          </View>
              </View>
            </View>
          ) : (
            <>
          {/* รูป — แตะกรอบ = ถ่ายรูป / ลิงก์ล่าง = เลือกจากคลังรูป */}
          {photoUri ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: photoUri }} style={styles.photoImage} />
              <View style={styles.photoTools}>
                <TouchableOpacity style={styles.photoTool} onPress={handleTakePhoto} activeOpacity={0.85}>
                  <Ionicons name="camera-outline" size={15} color="#fff" />
                  <Text style={styles.photoToolText}>ถ่ายใหม่</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoTool} onPress={handlePickPhoto} activeOpacity={0.85}>
                  <Ionicons name="images-outline" size={15} color="#fff" />
                  <Text style={styles.photoToolText}>เลือกรูปอื่น</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.photoEmpty}>
              <TouchableOpacity style={styles.photoTap} onPress={handleTakePhoto} activeOpacity={0.85} accessibilityLabel="ถ่ายรูปอุปกรณ์">
                <View style={styles.photoIcon}>
                  <Ionicons name="camera" size={24} color="#fff" />
                </View>
                <Text style={styles.photoTitle}>ถ่ายรูปอุปกรณ์จริง</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickPhoto} hitSlop={8} activeOpacity={0.7}>
                <Text style={styles.photoLink}>หรือเลือกจากคลังรูป</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 1 ข้อมูลหลัก */}
          <View style={styles.card}>
            <SectionTitle no="1" title="ข้อมูลหลัก" />
            <Text style={styles.fieldLabel}>ชื่ออุปกรณ์ *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="เช่น เซนเซอร์อุณหภูมิ DHT22" placeholderTextColor="#94A3B8" />

            <Text style={styles.fieldLabel}>ชื่อย่อสำหรับรหัส</Text>
            <TextInput
              style={styles.input}
              value={shortName}
              onChangeText={setShortName}
              placeholder="ไม่บังคับ — ใช้เมื่อชื่อยาว เช่น DHT22"
              placeholderTextColor="#94A3B8"
            />
            {!!name.trim() && (
              <View style={styles.codeHint}>
                <Ionicons name="pricetag-outline" size={13} color="#1D4ED8" />
                <Text style={styles.codeHintText}>
                  รหัสที่จะได้: {nextNo == null ? `${prefix} 001, 002, …` : codeRange} (นับต่อจากของเดิมให้เอง)
                </Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>หมวดหมู่</Text>
            <View style={styles.chipWrap}>
              {categories.map((c) => {
                const active = c.id === categoryId;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCategoryId(active ? "" : c.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 2 จำนวน */}
          <View style={[styles.card, styles.qtyCard]}>
            <SectionTitle no="2" title="จำนวนที่เพิ่ม" />
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => String(Math.max(1, (parseInt(q, 10) || 1) - 1)))}
                accessibilityLabel="ลดจำนวน"
              >
                <Ionicons name="remove" size={20} color="#1D4ED8" />
              </TouchableOpacity>
              <TextInput style={styles.qtyInput} value={quantity} onChangeText={setQuantity} keyboardType="numeric" textAlign="center" />
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => String(Math.min(200, (parseInt(q, 10) || 0) + 1)))}
                accessibilityLabel="เพิ่มจำนวน"
              >
                <Ionicons name="add" size={20} color="#1D4ED8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ข้อมูลเพิ่มเติม (ไม่บังคับ) — พับเก็บ / เปิดเองถ้าวันที่ผิด */}
          <View style={styles.card} onLayout={(e) => (moreY.current = e.nativeEvent.layout.y)}>
            <TouchableOpacity
              style={styles.moreHead}
              onPress={() => {
                if (moreOpen) return setShowMore(false);
                setShowMore(true);
                setTimeout(focusMore, 80); // รอให้ช่องกรอกโผล่ก่อนค่อยเลื่อน
              }}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.moreTitle}>
                  ข้อมูลเพิ่มเติม <Text style={styles.moreOptional}>· ไม่บังคับ</Text>
                </Text>
                {!moreOpen && <Text style={styles.moreSub}>{moreSummary}</Text>}
              </View>
              <Ionicons name={moreOpen ? "chevron-up" : "chevron-down"} size={18} color="#1D4ED8" />
            </TouchableOpacity>

            {moreOpen && (
              <>
                <Text style={styles.fieldLabel}>Serial ผู้ผลิต</Text>
                <TextInput
                  style={styles.input}
                  value={serial}
                  onChangeText={setSerial}
                  onFocus={focusMore}
                  placeholder="เลขที่พิมพ์บนตัวอุปกรณ์"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                />

                <Text style={styles.fieldLabel}>วันหมดประกัน</Text>
                <WarrantyDateField value={warranty} onChange={setWarranty} inputStyle={styles.input} onFocus={focusMore} />

                <Text style={styles.fieldLabel}>รายละเอียด</Text>
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={2}
                  placeholder="คุณสมบัติ, รุ่น, หมายเหตุ..."
                  placeholderTextColor="#94A3B8"
                />
              </>
            )}
          </View>
            </>
          )}
        </KeyboardAwareScrollView>

        {/* ปุ่มหลักติดขอบล่างเสมอ */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <DesktopBox bleed={16}>
          <TouchableOpacity
            style={[styles.nextBtn, !canContinue && styles.btnDisabled]}
            onPress={() => {
              if (canContinue) setStep("preview");
            }}
            disabled={!canContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.nextBtnText}>ดูสรุปก่อนบันทึก</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </TouchableOpacity>
          </DesktopBox>
        </View>
      </View>
    );
  }

  // ── ขั้น 2: ยืนยัน & บันทึก — การ์ดตัวอย่าง (แบบที่ นศ. จะเห็น) + สรุป ──
  return (
    <View style={styles.container}>
      <ScreenHeader title="ยืนยัน & บันทึก" onBack={() => setStep("details")} />
      <DesktopBox><StepBar step={step} /></DesktopBox>

      <ScrollView contentContainerStyle={[styles.form, isDesktop && desktopBody.wide, { paddingBottom: 150 + insets.bottom }]}>
        <View style={isDesktop ? desktopCols.row : { gap: 12 }}>
        <View style={[styles.hero, isDesktop && desktopCols.side]}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.heroImg} />
          ) : (
            <View style={[styles.heroImg, styles.heroEmpty]}>
              <Ionicons name="cube-outline" size={40} color="#93C5FD" />
              <Text style={styles.noPhotoText}>ไม่มีรูปภาพ</Text>
            </View>
          )}
          <View style={styles.heroBody}>
            <Text style={styles.heroCode}>
              {codeRange} <Text style={styles.heroQty}>· {qtyNum} ชิ้น</Text>
            </Text>
            <Text style={styles.heroName} numberOfLines={2}>
              {name}
              {selectedCategory ? ` · ${selectedCategory.name}` : ""}
            </Text>
          </View>
        </View>

        <View style={isDesktop ? desktopCols.main : { gap: 12 }}>
        <View style={styles.card}>
          {[
            { label: "Serial ผู้ผลิต", val: serial || "-" },
            { label: "หมดประกัน", val: warrantyIso ? formatThaiDate(warrantyIso) : "-" },
            { label: "รายละเอียด", val: description || "-" },
            { label: "สถานะเริ่มต้น", val: "ว่าง", ok: true },
          ].map((r, i) => (
            <View key={r.label} style={[styles.summaryRow, i === 0 && { borderTopWidth: 0 }]}>
              <Text style={styles.summaryLabel}>{r.label}</Text>
              <Text style={[styles.summaryVal, r.ok && { color: "#047857" }]}>{r.val}</Text>
            </View>
          ))}
        </View>

        <View style={styles.infoNote}>
          <Ionicons name="information-circle-outline" size={16} color="#1D4ED8" />
          <Text style={styles.infoNoteText}>ระบบออกรหัสอุปกรณ์ + รหัสสแกนให้เองตอนบันทึก · พิมพ์ป้าย QR ได้ที่เมนู "สร้าง QR"</Text>
        </View>
        </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <DesktopBox bleed={16}>
        <TouchableOpacity style={[styles.nextBtn, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.nextBtnText}>บันทึกเข้าระบบ</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={resetAll} disabled={saving}>
          <Text style={styles.cancelBtnText}>ล้างแล้วเริ่มใหม่</Text>
        </TouchableOpacity>
        </DesktopBox>
      </View>
    </View>
  );
}

const pad3 = (n: number) => String(n).padStart(3, "0");

// ── ตัวบอกขั้น 1 → 2 ──
const StepBar = ({ step }: { step: Step }) => {
  const current = step === "details" ? 1 : 2;
  return (
    <View style={si.row}>
      {["รายละเอียด", "ยืนยัน & บันทึก"].map((label, i) => {
        const num = i + 1;
        const done = num < current;
        const active = num === current;
        return (
          <React.Fragment key={label}>
            <View style={si.step}>
              <View style={[si.circle, (active || done) && si.active]}>
                {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text style={[si.num, active && { color: "#fff" }]}>{num}</Text>}
              </View>
              <Text style={[si.label, (active || done) && si.labelActive]}>{label}</Text>
            </View>
            {i < 1 && <View style={[si.line, done && si.lineDone]} />}
          </React.Fragment>
        );
      })}
    </View>
  );
};

function SectionTitle({ no, title }: { no: string; title: string }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionNo}>
        <Text style={styles.sectionNoText}>{no}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ตัวบอกขั้น
const si = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 2, paddingBottom: 10 },
  step: { flexDirection: "row", alignItems: "center", gap: 6 },
  circle: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#DCE6F5", alignItems: "center", justifyContent: "center" },
  active: { backgroundColor: C.primary },
  num: { fontSize: 11, fontWeight: "700", color: C.text2 },
  label: { fontSize: 12, color: C.text2 },
  labelActive: { color: C.primaryDark, fontWeight: "700" },
  line: { flex: 1, height: 2, borderRadius: 1, backgroundColor: "#DCE6F5", marginHorizontal: 10 },
  lineDone: { ...NG, backgroundColor: C.primary },
});

const styles = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  form: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 130, gap: 12 },

  // รูป
  photoEmpty: {
    height: 160,
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#93C5FD",
    backgroundColor: "rgba(255,255,255,0.65)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  photoTap: { alignItems: "center", gap: 8 },
  photoIcon: { ...W.primary, width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  photoTitle: { fontSize: 15, fontWeight: "700", color: C.ink },
  photoLink: { fontSize: 13, color: C.primaryDark, fontWeight: "600" },
  photoPreview: { height: 200, borderRadius: 22, overflow: "hidden", backgroundColor: "#DBEAFE" },
  photoImage: { width: "100%", height: "100%" },
  photoTools: { position: "absolute", right: 10, bottom: 10, flexDirection: "row", gap: 8 },
  photoTool: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(15,23,42,0.6)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  photoToolText: { color: "#fff", fontSize: 12.5, fontWeight: "600" },

  // การ์ด
  card: { ...W.card, padding: 14 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  sectionNo: { width: 22, height: 22, borderRadius: 8, backgroundColor: C.primarySoft, alignItems: "center", justifyContent: "center" },
  sectionNoText: { fontSize: 12, fontWeight: "700", color: C.primaryDark },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: C.ink },
  fieldLabel: { fontSize: 13, color: C.text2, marginTop: 12, marginBottom: 6 },
  input: { ...(W.input as {}), paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: C.ink },
  inputMulti: { minHeight: 70, textAlignVertical: "top" },
  codeHint: { flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: 8, padding: 8, borderRadius: 10, backgroundColor: C.primaryTint },
  codeHintText: { flex: 1, fontSize: 12.5, color: C.primaryDark, lineHeight: 18 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#DCE6F5" },
  chipActive: { ...NG, backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, color: C.text2, fontWeight: "600" },
  chipTextActive: { color: "#fff" },

  // จำนวน
  qtyCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EEF4FF", alignItems: "center", justifyContent: "center" },
  qtyInput: { width: 54, fontSize: 20, fontWeight: "700", color: C.ink, paddingVertical: 4 },

  // ข้อมูลเพิ่มเติม
  moreHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  moreTitle: { fontSize: 15, fontWeight: "700", color: C.ink },
  moreOptional: { fontSize: 13, fontWeight: "400", color: C.faint },
  moreSub: { fontSize: 12.5, color: C.faint, marginTop: 2 },

  // ปุ่มติดล่าง
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    ...gradient("linear-gradient(180deg, rgba(234,241,252,0) 0%, #EAF1FC 32%)"),
  },
  nextBtn: { ...W.primary, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  nextBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnDisabled: { opacity: 0.45 },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelBtnText: { color: C.faint, fontSize: 14, fontWeight: "600" },

  // ขั้น 2
  hero: { ...W.card, overflow: "hidden" },
  heroImg: { width: "100%", height: 190, backgroundColor: "#DBEAFE" },
  heroEmpty: { alignItems: "center", justifyContent: "center", gap: 6 },
  noPhotoText: { fontSize: 13, color: C.faint },
  heroBody: { padding: 14, gap: 2 },
  heroCode: { fontSize: 20, fontWeight: "700", color: C.ink },
  heroQty: { fontSize: 14, fontWeight: "400", color: C.faint },
  heroName: { fontSize: 14, color: C.text2 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#EEF2F7" },
  summaryLabel: { fontSize: 14, color: C.text2 },
  summaryVal: { flex: 1, textAlign: "right", fontSize: 14, fontWeight: "600", color: C.ink },
  infoNote: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 14, backgroundColor: C.primaryTint },
  infoNoteText: { flex: 1, fontSize: 12.5, color: C.primaryDark, lineHeight: 19 },
});
