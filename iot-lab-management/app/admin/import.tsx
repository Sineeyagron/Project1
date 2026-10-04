import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { File as FSFile, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import supabase from "../../lib/supabase";
import { goBack } from "../../lib/nav";
import { confirmAction, notify } from "../../lib/notify";
import { toCsv } from "../../lib/csv";
import { thaiDate } from "../../lib/itemInfo";
import {
  Category,
  checkCsv,
  decodeBytes,
  ExistingItem,
  keyOf,
  MAX_PER_ROW,
  MAX_TOTAL,
  OTHER,
  Row,
  summary,
} from "../../lib/importItems";
import { W, NG } from "../../lib/theme";

// นำเข้าอุปกรณ์จาก CSV (แผนเฟส 2 ข้อ 3) — ตรรกะตรวจทั้งหมดอยู่ใน lib/importItems.ts
// ขั้นตอน: เลือกไฟล์ (เว็บ/มือถือ) หรือวางข้อความ → ตรวจ+พรีวิว → แก้หมวดในแอปได้ → ติ๊กรับทราบคำเตือน
// → ตรวจซ้ำกับข้อมูลล่าสุด → ยืนยัน → insert ครั้งเดียว (ผิดแถวเดียว = ไม่บันทึกเลย) → ยกเลิกการนำเข้าได้

const C = {
  bg: "#EAF1FC",
  purple: "#2563EB",
  ink: "#172033",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#DCE6F5",
  green: "#047857",
  amber: "#b45309",
  red: "#dc2626",
};

const TEMPLATE = [
  ["ชื่อ", "หมวด", "จำนวน", "วันหมดประกัน", "ชื่อย่อ"],
  ["NodeMCU ESP8266", "Module", "5", "2027-10-31", "NodeMCU"],
  ["DHT22 Temperature Sensor", "Sensor", "10", "", "DHT22"],
];

type Imported = { id: string; item_code: string; barcode: string };

export default function ImportItems() {
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const [categories, setCategories] = useState<Category[]>([]);
  const [existing, setExisting] = useState<ExistingItem[]>([]);
  const [ready, setReady] = useState(false);

  const [source, setSource] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [loadError, setLoadError] = useState("");
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(!isWeb);
  const [fixes, setFixes] = useState<Record<string, string>>({});
  const [ack, setAck] = useState(false);
  const [problemsOnly, setProblemsOnly] = useState(false);

  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Imported[] | null>(null);
  const [undone, setUndone] = useState(false);
  const importingRef = useRef(false);

  const loadContext = async () => {
    const [{ data: cats, error: e1 }, { data: items, error: e2 }] = await Promise.all([
      supabase.from("categories").select("id, name, active").order("sort_order"),
      supabase.from("items").select("name, item_prefix, status"),
    ]);
    if (e1 || e2) notify("โหลดข้อมูลไม่สำเร็จ", (e1 || e2)?.message);
    const ctx = { categories: (cats || []) as Category[], existing: (items || []) as ExistingItem[] };
    setCategories(ctx.categories);
    setExisting(ctx.existing);
    setReady(true);
    return ctx;
  };

  useEffect(() => {
    loadContext();
  }, []);

  const check = source ? checkCsv(source, { categories, existing, categoryFixes: fixes }) : null;
  const sum = check ? summary(check.rows) : null;
  const tooMany = !!sum && sum.total > MAX_TOTAL;
  const canImport =
    !!check && !check.fileError && !!sum && check.rows.length > 0 && sum.bad === 0 && !tooMany &&
    (sum.warn === 0 || ack) && !saving;

  // ข้อมูลใหม่ → ล้างการแก้หมวด / การรับทราบคำเตือนของไฟล์เก่า
  const applySource = (text: string, label: string) => {
    setSource(text);
    setSourceLabel(label);
    setLoadError("");
    setFixes({});
    setAck(false);
    setProblemsOnly(false);
    setResult(null);
    setUndone(false);
  };

  const loadBytes = (bytes: Uint8Array, name: string) => {
    const decoded = decodeBytes(bytes);
    if (decoded.error) {
      applySource("", "");
      setLoadError(decoded.error);
      return;
    }
    applySource(decoded.text || "", name);
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext && !["csv", "txt", "tsv"].includes(ext)) {
      setLoadError(`ไฟล์ .${ext} อาจไม่ใช่ CSV — ตรวจผลด้านล่างให้ดี`);
    }
  };

  const pickFile = async () => {
    if (isWeb) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".csv,.txt,text/csv,text/plain";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (file) loadBytes(new Uint8Array(await file.arrayBuffer()), file.name);
      };
      input.click();
      return;
    }
    try {
      const picked = await FSFile.pickFileAsync({ mimeTypes: "*/*" });
      if (picked.canceled || !picked.result) return;
      loadBytes(await picked.result.bytes(), picked.result.name);
    } catch (e: any) {
      notify("เปิดไฟล์ไม่ได้", `${e?.message || e}\n\nใช้วิธีวางข้อความแทนได้`);
      setShowPaste(true);
    }
  };

  const shareTemplate = async () => {
    // BOM ให้ Excel อ่านภาษาไทยถูก
    const csv = "﻿" + toCsv(TEMPLATE);
    if (isWeb) {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "แม่แบบ-นำเข้าอุปกรณ์.csv";
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    try {
      const file = new FSFile(Paths.cache, "labhub-import-template.csv");
      if (file.exists) file.delete();
      file.create();
      file.write(csv);
      if (!(await Sharing.isAvailableAsync())) {
        notify("แชร์ไม่ได้บนเครื่องนี้");
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: "text/csv",
        UTI: "public.comma-separated-values-text",
        dialogTitle: "แม่แบบนำเข้าอุปกรณ์",
      });
    } catch (e: any) {
      notify("สร้างไฟล์แม่แบบไม่สำเร็จ", e?.message || String(e));
    }
  };

  const setFix = (raw: string, name: string | null) => {
    setAck(false);
    setFixes((f) => {
      const next = { ...f };
      if (name) next[keyOf(raw)] = name;
      else delete next[keyOf(raw)];
      return next;
    });
  };

  const doImport = async () => {
    if (!canImport || importingRef.current || !check || !sum) return;
    importingRef.current = true;
    setSaving(true);
    // ตรวจซ้ำกับข้อมูลล่าสุด (ระหว่างนี้อาจมีคนปิดหมวด / เพิ่มของ)
    const ctx = await loadContext();
    const fresh = checkCsv(source, { ...ctx, categoryFixes: fixes });
    const freshSum = summary(fresh.rows);
    setSaving(false);
    importingRef.current = false;
    if (fresh.fileError || freshSum.bad || freshSum.total !== sum.total || freshSum.warn > sum.warn) {
      setAck(false);
      notify("ข้อมูลในระบบเปลี่ยนไป", "ตรวจผลใหม่ด้านล่างอีกครั้ง ยังไม่มีอะไรถูกบันทึก");
      return;
    }

    const catNames = [...new Set(fresh.rows.map((r) => r.category))];
    confirmAction(
      `ยืนยันเพิ่ม ${freshSum.total} ชิ้น?`,
      `${fresh.rows.length} รายการ · หมวด ${catNames.join(", ")}` +
        (freshSum.warn ? `\nมีคำเตือน ${freshSum.warn} แถว (รับทราบแล้ว)` : "") +
        "\n\nระบบจะออกรหัสให้ทุกชิ้น ยกเลิกได้ทันทีหลังนำเข้า",
      "เพิ่มเลย",
      () => insertRows(fresh.rows)
    );
  };

  const insertRows = async (rows: Row[]) => {
    if (importingRef.current) return;
    importingRef.current = true;
    setSaving(true);
    // insert ครั้งเดียว = สำเร็จทั้งหมดหรือไม่บันทึกเลย
    const payload = rows.flatMap((r) =>
      Array.from({ length: r.qty }, () => ({
        name: r.name,
        status: "available",
        category_id: r.categoryId,
        type: r.category,
        short_name: r.short || null,
        warranty_expires_at: r.warranty,
      }))
    );
    const { data, error } = await supabase
      .from("items")
      .insert(payload)
      .select("id, item_code, barcode, item_prefix, item_no");
    setSaving(false);
    importingRef.current = false;
    if (error) {
      notify("นำเข้าไม่สำเร็จ", `${error.message}\n\nไม่มีอุปกรณ์ถูกเพิ่ม`);
      return;
    }
    const sorted = (data || []).sort(
      (a: any, b: any) => String(a.item_prefix).localeCompare(String(b.item_prefix)) || a.item_no - b.item_no
    );
    setResult(sorted as Imported[]);
    setUndone(false);
    setSource("");
    setSourceLabel("");
    setPasted("");
    loadContext();
  };

  // ยกเลิกการนำเข้า: ลบชิ้นที่เพิ่งเพิ่ม (เฉพาะที่ยังว่าง = ยังไม่มีใครขอยืม)
  const undoImport = () => {
    if (!result) return;
    confirmAction(
      `ยกเลิกการนำเข้า ${result.length} ชิ้น?`,
      "อุปกรณ์ที่เพิ่งเพิ่มจะถูกลบ (เลขรหัสที่ออกไปแล้วจะไม่ถูกนำกลับมาใช้)",
      "ลบทั้งหมด",
      async () => {
        setSaving(true);
        const { data, error } = await supabase
          .from("items")
          .delete()
          .in("id", result.map((r) => r.id))
          .eq("status", "available")
          .select("id");
        setSaving(false);
        if (error) {
          notify("ยกเลิกไม่สำเร็จ", error.message);
          return;
        }
        const removed = (data || []).length;
        const left = result.length - removed;
        setUndone(true);
        loadContext();
        notify(
          "ยกเลิกแล้ว",
          left
            ? `ลบ ${removed} ชิ้น · อีก ${left} ชิ้นมีคนขอยืมแล้ว ลบไม่ได้ (จัดการที่หน้าอุปกรณ์)`
            : `ลบครบ ${result.length} ชิ้น`
        );
      },
      true
    );
  };

  const activeCats = categories.filter((c) => c.active);
  const shownRows = check
    ? problemsOnly
      ? check.rows.filter((r) => r.errors.length || r.warnings.length)
      : check.rows
    : [];

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => goBack("/admin/home")} activeOpacity={0.82}>
          <Ionicons name="chevron-back" size={22} color="#172033" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>นำเข้าจาก CSV</Text>
          <Text style={s.headerSub}>เพิ่มอุปกรณ์ทีละหลายรายการ</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {result ? (
          <View style={s.card}>
            <View style={s.rowCenter}>
              <Ionicons
                name={undone ? "arrow-undo-circle" : "checkmark-circle"}
                size={26}
                color={undone ? C.muted : C.green}
              />
              <Text style={s.doneTitle}>{undone ? "ยกเลิกการนำเข้าแล้ว" : `เพิ่มแล้ว ${result.length} ชิ้น`}</Text>
            </View>
            {!undone && (
              <>
                <Text style={s.doneCodes} selectable>
                  {result.map((r) => `${r.item_code}  (สแกน ${r.barcode})`).join("\n")}
                </Text>
                <TouchableOpacity style={s.primaryBtn} onPress={() => router.push("/admin/qrgen" as any)} activeOpacity={0.85}>
                  <Ionicons name="qr-code-outline" size={18} color="#fff" />
                  <Text style={s.primaryText}>ไปพิมพ์ป้าย QR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.dangerBtn} onPress={undoImport} disabled={saving} activeOpacity={0.85}>
                  <Ionicons name="arrow-undo-outline" size={18} color={C.red} />
                  <Text style={s.dangerText}>นำเข้าผิด? ยกเลิกการนำเข้านี้</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={s.linkBtn} onPress={() => setResult(null)}>
              <Text style={s.linkText}>นำเข้าไฟล์อื่น</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* 1. เตรียมไฟล์ */}
            <View style={s.card}>
              <Text style={s.stepTitle}>1. เตรียมไฟล์</Text>
              <Text style={s.help}>
                คอลัมน์: <Text style={s.bold}>ชื่อ</Text> (บังคับ), หมวด, จำนวน, วันหมดประกัน, ชื่อย่อ{"\n"}
                • หมวดต้องมีในระบบ (สะกดผิดเลือกแก้ในหน้านี้ได้) เว้นว่าง = "{OTHER}"{"\n"}
                • จำนวน 1–{MAX_PER_ROW} ต่อแถว เว้นว่าง = 1 · รวมไม่เกิน {MAX_TOTAL} ชิ้นต่อครั้ง{"\n"}
                • วันหมดประกัน ปปปป-ดด-วว หรือ วว/ดด/ปปปป (ปี พ.ศ. แปลงให้) เว้นว่าง = ไม่มีประกัน{"\n"}
                • Excel: "บันทึกเป็น" → "CSV UTF-8" · หรือก๊อปเซลล์จาก Excel/Google Sheets มาวาง
              </Text>
              <TouchableOpacity style={s.outlineBtn} onPress={shareTemplate} activeOpacity={0.85}>
                <Ionicons name={isWeb ? "download-outline" : "share-outline"} size={18} color={C.purple} />
                <Text style={s.outlineText}>{isWeb ? "ดาวน์โหลดไฟล์แม่แบบ" : "ส่งไฟล์แม่แบบ (บันทึก/แชร์)"}</Text>
              </TouchableOpacity>
            </View>

            {/* 2. เลือกไฟล์ / วางข้อความ */}
            <View style={s.card}>
              <Text style={s.stepTitle}>2. เลือกไฟล์ หรือวางข้อความ</Text>
              <TouchableOpacity
                style={[s.primaryBtn, !ready && { opacity: 0.4 }]}
                onPress={pickFile}
                disabled={!ready}
                activeOpacity={0.85}
              >
                <Ionicons name="document-attach-outline" size={18} color="#fff" />
                <Text style={s.primaryText} numberOfLines={1}>
                  {sourceLabel && sourceLabel !== "ข้อความที่วาง" ? `เปลี่ยนไฟล์ (${sourceLabel})` : "เลือกไฟล์ CSV"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.linkBtn} onPress={() => setShowPaste((v) => !v)}>
                <Text style={s.linkText}>{showPaste ? "ซ่อนช่องวางข้อความ" : "หรือวางข้อความแทน"}</Text>
              </TouchableOpacity>
              {showPaste && (
                <>
                  <TextInput
                    style={s.pasteBox}
                    value={pasted}
                    onChangeText={setPasted}
                    placeholder={"วางข้อมูลที่ก๊อปจาก Excel / Google Sheets / ไฟล์ CSV (รวมแถวหัวคอลัมน์)\n\n" + toCsv(TEMPLATE.slice(0, 2))}
                    placeholderTextColor={C.faint}
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                  />
                  <TouchableOpacity
                    style={[s.outlineBtn, (!pasted.trim() || !ready) && { opacity: 0.4 }]}
                    onPress={() => applySource(pasted, "ข้อความที่วาง")}
                    disabled={!pasted.trim() || !ready}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-done-outline" size={18} color={C.purple} />
                    <Text style={s.outlineText}>ตรวจข้อความที่วาง</Text>
                  </TouchableOpacity>
                </>
              )}
              {!!loadError && <Text style={s.errorText}>{loadError}</Text>}
              {!!check?.fileError && <Text style={s.errorText}>{check.fileError}</Text>}
              {check?.fileNotes.map((n) => (
                <Text key={n} style={s.noteText}>ⓘ {n}</Text>
              ))}
            </View>

            {/* แก้หมวดที่ไม่มีในระบบ / ปิดอยู่ */}
            {!!check?.unknownCategories.length && (
              <View style={[s.card, check.unknownCategories.some((u) => !u.fixed) && s.cardWarn]}>
                <Text style={s.stepTitle}>
                  {check.unknownCategories.every((u) => u.fixed) ? "✓ แก้หมวดแล้ว (เปลี่ยนได้)" : "แก้หมวดให้ตรงกับระบบ"}
                </Text>
                <Text style={s.help}>
                  เลือกหมวดที่ถูกต้องแทนได้เลย ไม่ต้องกลับไปแก้ไฟล์ (หรือเพิ่มหมวดใหม่ที่หน้า "หมวดหมู่" แล้วเลือกไฟล์ใหม่)
                </Text>
                {check.unknownCategories.map((u) => {
                  const chosen = fixes[keyOf(u.raw)];
                  return (
                    <View key={u.raw} style={s.fixBlock}>
                      <Text style={s.fixTitle}>
                        "{u.raw}" · แถว {u.lines.slice(0, 8).join(", ")}
                        {u.lines.length > 8 ? ` และอีก ${u.lines.length - 8}` : ""}
                      </Text>
                      <View style={s.chips}>
                        {[...activeCats]
                          .sort((a, b) => (a.name === u.suggestion ? -1 : b.name === u.suggestion ? 1 : 0))
                          .map((c) => {
                            const on = chosen === c.name;
                            const suggested = c.name === u.suggestion;
                            return (
                              <TouchableOpacity
                                key={c.id}
                                style={[s.chip, suggested && s.chipSuggest, on && s.chipOn]}
                                onPress={() => setFix(u.raw, on ? null : c.name)}
                                activeOpacity={0.8}
                              >
                                {suggested && !on && <Ionicons name="sparkles-outline" size={13} color={C.purple} />}
                                <Text style={[s.chipText, on && { color: "#fff" }]}>{c.name}</Text>
                              </TouchableOpacity>
                            );
                          })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* 3. ตรวจก่อนบันทึก */}
            {check && sum && check.rows.length > 0 && (
              <View style={s.card}>
                <Text style={s.stepTitle}>3. ตรวจก่อนบันทึก</Text>
                <View style={s.sumRow}>
                  <SumPill color={C.green} icon="checkmark-circle" label={`ถูก ${sum.ok}`} />
                  <SumPill color={C.amber} icon="alert-circle" label={`เตือน ${sum.warn}`} />
                  <SumPill color={C.red} icon="close-circle" label={`ผิด ${sum.bad}`} />
                </View>
                <Text style={[s.summary, { color: sum.bad ? C.red : C.ink }]}>
                  {sum.bad
                    ? `แก้แถวที่ผิด ${sum.bad} แถวก่อน (แก้ไฟล์แล้วเลือกใหม่ หรือแก้หมวดด้านบน) — ยังไม่มีอะไรถูกบันทึก`
                    : `${check.rows.length} รายการ · จะเพิ่ม ${sum.total} ชิ้น`}
                </Text>
                {tooMany && <Text style={s.errorText}>รวม {sum.total} ชิ้น เกินครั้งละ {MAX_TOTAL} ชิ้น — แบ่งไฟล์</Text>}

                {(sum.bad > 0 || sum.warn > 0) && (
                  <TouchableOpacity style={s.toggleRow} onPress={() => setProblemsOnly((v) => !v)} activeOpacity={0.8}>
                    <Ionicons name={problemsOnly ? "checkbox" : "square-outline"} size={20} color={C.purple} />
                    <Text style={s.toggleText}>แสดงเฉพาะแถวที่มีปัญหา</Text>
                  </TouchableOpacity>
                )}

                {shownRows.map((r) => {
                  const tone = r.errors.length ? "bad" : r.warnings.length ? "warn" : "ok";
                  return (
                    <View key={r.line} style={[s.row, tone === "bad" && s.rowBad, tone === "warn" && s.rowWarn]}>
                      <Text style={s.rowLine}>แถว {r.line}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowName}>{r.name || "(ไม่มีชื่อ)"} × {r.qty || "?"}</Text>
                        <Text style={s.rowMeta}>
                          {r.category} · รหัส {r.prefix} xxx ·{" "}
                          {r.warranty ? `ประกันถึง ${thaiDate(r.warranty)}` : "ไม่มีประกัน"}
                        </Text>
                        {r.errors.map((e) => <Text key={e} style={s.rowError}>✕ {e}</Text>)}
                        {r.warnings.map((w) => <Text key={w} style={s.rowWarnText}>⚠ {w}</Text>)}
                        {r.notes.map((n) => <Text key={n} style={s.rowNote}>ⓘ {n}</Text>)}
                      </View>
                    </View>
                  );
                })}

                {sum.warn > 0 && sum.bad === 0 && (
                  <Pressable style={s.ackRow} onPress={() => setAck((v) => !v)}>
                    <Ionicons name={ack ? "checkbox" : "square-outline"} size={22} color={C.amber} />
                    <Text style={s.ackText}>ตรวจคำเตือน {sum.warn} แถวแล้ว ยืนยันว่าถูกต้อง</Text>
                  </Pressable>
                )}

                <TouchableOpacity
                  style={[s.primaryBtn, !canImport && { opacity: 0.4 }]}
                  disabled={!canImport}
                  onPress={doImport}
                  activeOpacity={0.85}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="cloud-upload-outline" size={18} color="#fff" />}
                  <Text style={s.primaryText}>{saving ? "กำลังตรวจ/บันทึก..." : sum.bad ? `แก้แถวที่ผิด ${sum.bad} แถวก่อน` : sum.warn && !ack ? "ติ๊กยืนยันคำเตือนก่อน" : `เพิ่ม ${sum.total} ชิ้น`}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.linkBtn} onPress={() => applySource("", "")}>
                  <Text style={[s.linkText, { color: C.muted }]}>ล้าง เริ่มใหม่</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SumPill({ color, icon, label }: { color: string; icon: any; label: string }) {
  return (
    <View style={[s.sumPill, { borderColor: color }]}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[s.sumPillText, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  header: {
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    ...W.small, width: 44, height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#172033", fontSize: 21, fontWeight: "900" },
  headerSub: { color: "#475569", fontSize: 12, fontWeight: "700", marginTop: 2 },
  body: { padding: 16, gap: 12, paddingBottom: 48 },
  card: { ...W.card, padding: 14, gap: 10 },
  cardWarn: { ...NG, borderColor: "#fcd34d", backgroundColor: "#fffbeb" },
  stepTitle: { fontSize: 15.5, fontWeight: "900", color: C.ink },
  help: { fontSize: 13, color: C.muted, lineHeight: 20 },
  bold: { fontWeight: "800", color: C.ink },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  primaryBtn: {
    ...W.primarySolid,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 15,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "800", flexShrink: 1 },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.purple,
    borderRadius: 12,
    minHeight: 46,
  },
  outlineText: { color: C.purple, fontSize: 15, fontWeight: "800" },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    minHeight: 46,
  },
  dangerText: { color: C.red, fontSize: 14.5, fontWeight: "800" },
  pasteBox: {
    minHeight: 140,
    maxHeight: 280,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: C.ink,
    textAlignVertical: "top",
    backgroundColor: "#f8fafc",
  },
  errorText: { fontSize: 13.5, color: C.red, fontWeight: "700", lineHeight: 20 },
  noteText: { fontSize: 12.5, color: C.muted, lineHeight: 18 },
  fixBlock: { gap: 8, paddingTop: 4 },
  fixTitle: { fontSize: 14, fontWeight: "800", color: C.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#fff",
  },
  chipSuggest: { borderColor: C.purple, borderStyle: "dashed" },
  chipOn: { ...NG, backgroundColor: C.purple, borderColor: C.purple, borderStyle: "solid" },
  chipText: { fontSize: 14, fontWeight: "700", color: C.ink },
  sumRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  sumPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sumPillText: { fontSize: 13, fontWeight: "800" },
  summary: { fontSize: 14, fontWeight: "800", lineHeight: 20 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40 },
  toggleText: { fontSize: 13.5, color: C.ink, fontWeight: "700" },
  row: { flexDirection: "row", gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.line },
  rowBad: { ...NG, backgroundColor: "#fef2f2", marginHorizontal: -14, paddingHorizontal: 14 },
  rowWarn: { ...NG, backgroundColor: "#fffbeb", marginHorizontal: -14, paddingHorizontal: 14 },
  rowLine: { width: 46, fontSize: 12, color: C.faint, fontWeight: "700", paddingTop: 2 },
  rowName: { fontSize: 14.5, fontWeight: "800", color: C.ink },
  rowMeta: { fontSize: 12.5, color: C.muted, marginTop: 2 },
  rowError: { fontSize: 12.5, color: C.red, fontWeight: "700", marginTop: 3, lineHeight: 18 },
  rowWarnText: { fontSize: 12.5, color: C.amber, fontWeight: "700", marginTop: 3, lineHeight: 18 },
  rowNote: { fontSize: 12, color: C.muted, marginTop: 3 },
  ackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  ackText: { flex: 1, fontSize: 14, fontWeight: "800", color: C.amber },
  doneTitle: { fontSize: 18, fontWeight: "900", color: C.ink },
  doneCodes: { fontSize: 13.5, color: C.ink, lineHeight: 22, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  linkBtn: { alignSelf: "center", paddingVertical: 8, minHeight: 36, justifyContent: "center" },
  linkText: { fontSize: 14, color: C.purple, fontWeight: "800" },
});
