import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";
import { currentUser } from "../../lib/session";
import { goBack } from "../../lib/nav";
import { notify } from "../../lib/notify";
import { isValidDate } from "../../lib/itemInfo";
import { exportCsv, exportPdf } from "../../lib/fileExport";
import {
  DETAIL_HEADER,
  detailRows,
  ReportRecord,
  ReportRequest,
  reportHtml,
  summarize,
  thDate,
  todayBkk,
} from "../../lib/report";
import { W, NG } from "../../lib/theme";

// รายงานการยืม-คืน (เฟส 5.1) — admin + TA / ส่งออก CSV (Excel) และ PDF
// ตรรกะคำนวณอยู่ใน lib/report.ts

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

const OTHER = "อื่นๆ";
type PresetKey = "30d" | "90d" | "year" | "all" | "custom";
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "30d", label: "30 วัน" },
  { key: "90d", label: "3 เดือน" },
  { key: "year", label: "ปีนี้" },
  { key: "all", label: "ทั้งหมด" },
  { key: "custom", label: "กำหนดเอง" },
];

const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0, 10);

function presetRange(key: PresetKey): { from: string | null; to: string } {
  const today = todayBkk();
  if (key === "30d") return { from: addDays(today, -29), to: today };
  if (key === "90d") return { from: addDays(today, -89), to: today };
  if (key === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: null, to: today };
}

export default function BorrowReport() {
  const router = useRouter();
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [customFrom, setCustomFrom] = useState(addDays(todayBkk(), -29));
  const [customTo, setCustomTo] = useState(todayBkk());
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [requests, setRequests] = useState<ReportRequest[]>([]);
  const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  // ช่วงที่ใช้จริง + ตรวจช่องกำหนดเอง
  const customError =
    preset !== "custom"
      ? ""
      : !isValidDate(customFrom.trim()) || !isValidDate(customTo.trim())
        ? "ใส่วันที่แบบ ปปปป-ดด-วว (ค.ศ.) เช่น 2026-06-01"
        : customFrom.trim() > customTo.trim()
          ? "วันเริ่มต้องไม่หลังวันสิ้นสุด"
          : "";
  const range = preset === "custom" ? { from: customFrom.trim(), to: customTo.trim() } : presetRange(preset);
  const rangeLabel = range.from ? `${thDate(range.from)} – ${thDate(range.to)}` : `ทั้งหมด ถึง ${thDate(range.to)}`;

  const load = async () => {
    if (customError) return;
    // ช่วงเป็นวันที่ไทย → แปลงเป็นเวลา UTC สำหรับ borrow_date (timestamptz)
    const fromUtc = range.from ? new Date(`${range.from}T00:00:00+07:00`).toISOString() : null;
    const toUtc = new Date(`${addDays(range.to, 1)}T00:00:00+07:00`).toISOString();

    let recQ = supabase
      .from("borrow_records")
      .select(
        "id, user_id, status, borrow_date, due_date, return_date, return_condition, damage_cost, damage_note, auto_returned, renew_count, items(item_code, name, type, category_id), checker:profiles!borrow_records_return_checked_by_fkey(email)"
      )
      .lt("borrow_date", toUtc)
      .order("borrow_date", { ascending: false });
    let reqQ = supabase.from("borrow_requests").select("kind, status").lt("created_at", toUtc);
    if (fromUtc) {
      recQ = recQ.gte("borrow_date", fromUtc);
      reqQ = reqQ.gte("created_at", fromUtc);
    }

    const [{ data: recs, error }, { data: reqs }, { data: cats }, user] = await Promise.all([
      recQ,
      reqQ,
      supabase.from("categories").select("id, name"),
      currentUser(),
    ]);
    if (error) notify("โหลดรายงานไม่สำเร็จ", error.message);

    // อีเมลผู้ยืม (user_id ไม่มี FK → ดึงแยก)
    const ids = [...new Set((recs || []).map((r: any) => r.user_id).filter(Boolean))];
    const { data: people } = ids.length
      ? await supabase.from("profiles").select("id, email").in("id", ids)
      : { data: [] as any[] };
    const emailOf = new Map((people || []).map((p: any) => [p.id, p.email]));
    const catOf = new Map((cats || []).map((c: any) => [c.id, c.name]));

    setRecords(
      (recs || []).map((r: any) => ({
        ...r,
        item: r.items
          ? {
              item_code: r.items.item_code,
              name: r.items.name,
              category: catOf.get(r.items.category_id) || r.items.type || OTHER,
            }
          : null,
        borrower: emailOf.get(r.user_id) || null,
        checker: r.checker?.email || null,
      }))
    );
    setRequests((reqs || []) as ReportRequest[]);
    setMe(user?.email || "");
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [preset, preset === "custom" ? `${customFrom}|${customTo}` : ""]);

  const s = summarize(records, requests);
  const rows = detailRows(records);
  const fileBase = `รายงานยืมคืน_${range.from || "ทั้งหมด"}_${range.to}`;
  const asciiBase = `labhub-report-${range.from || "all"}-${range.to}`;

  const doCsv = async () => {
    setExporting("csv");
    try {
      await exportCsv([DETAIL_HEADER, ...rows], `${fileBase}.csv`, `${asciiBase}.csv`);
    } catch (e: any) {
      notify("ส่งออก CSV ไม่สำเร็จ", e?.message || String(e));
    } finally {
      setExporting(null);
    }
  };

  const doPdf = async () => {
    setExporting("pdf");
    const opts = { title: "รายงานการยืม-คืนอุปกรณ์ IoT Lab", rangeLabel, generatedBy: me || "-", summary: s, rows };
    try {
      await exportPdf(reportHtml(opts), reportHtml({ ...opts, autoPrint: true }), fileBase, true);
    } catch (e: any) {
      notify("สร้าง PDF ไม่สำเร็จ", e?.message || String(e));
    } finally {
      setExporting(null);
    }
  };

  const Stat = ({ label, value, color }: { label: string; value: string | number; color?: string }) => (
    <View style={st.stat}>
      <Text style={[st.statNum, color ? { color } : null]}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );

  const TopList = ({ title, items }: { title: string; items: [string, number][] }) => (
    <View style={st.card}>
      <Text style={st.cardTitle}>{title}</Text>
      {items.length === 0 && <Text style={st.empty}>-</Text>}
      {items.map(([name, n], i) => (
        <View key={name} style={st.topRow}>
          <Text style={st.topRank}>{i + 1}</Text>
          <Text style={st.topName} numberOfLines={1}>{name}</Text>
          <Text style={st.topCount}>{n}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <KeyboardAvoidingView style={st.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={st.header}>
        <TouchableOpacity style={st.iconBtn} onPress={() => goBack("/admin/home")} activeOpacity={0.82}>
          <Ionicons name="chevron-back" size={22} color="#172033" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.headerTitle}>รายงานการยืม-คืน</Text>
          <Text style={st.headerSub}>สรุปตามช่วงเวลา · ส่งออก Excel / PDF</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={st.body}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.purple} />}
      >
        {/* ช่วงเวลา */}
        <View style={st.card}>
          <Text style={st.cardTitle}>ช่วงเวลา (นับตามวันที่ยืม)</Text>
          <View style={st.chips}>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p.key}
                style={[st.chip, preset === p.key && st.chipOn]}
                onPress={() => setPreset(p.key)}
                activeOpacity={0.8}
              >
                <Text style={[st.chipText, preset === p.key && { color: "#fff" }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {preset === "custom" && (
            <>
              <View style={st.dateRow}>
                <TextInput
                  style={[st.dateInput, !!customError && st.inputError]}
                  value={customFrom}
                  onChangeText={setCustomFrom}
                  placeholder="เริ่ม 2026-06-01"
                  placeholderTextColor={C.faint}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
                <Text style={st.dateDash}>ถึง</Text>
                <TextInput
                  style={[st.dateInput, !!customError && st.inputError]}
                  value={customTo}
                  onChangeText={setCustomTo}
                  placeholder="สิ้นสุด 2026-10-31"
                  placeholderTextColor={C.faint}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
              </View>
              <Text style={[st.help, !!customError && { color: C.red, fontWeight: "700" }]}>
                {customError || "เช่น ภาคเรียน: ใส่วันเปิด–ปิดภาคของ มข. (ปี ค.ศ.)"}
              </Text>
            </>
          )}
          {!customError && <Text style={st.rangeText}>{rangeLabel}</Text>}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 30 }} />
        ) : customError ? null : (
          <>
            <View style={st.statGrid}>
              <Stat label="ยืมทั้งหมด" value={s.borrows} />
              <Stat label="คืนแล้ว" value={s.returned} color={C.green} />
              <Stat label="ยังไม่คืน" value={s.stillOut} color={C.amber} />
              <Stat label="เกินกำหนดตอนนี้" value={s.overdueNow} color={s.overdueNow ? C.red : undefined} />
              <Stat label="คืนช้า" value={s.returnedLate} color={s.returnedLate ? C.amber : undefined} />
              <Stat label="ชำรุด" value={s.damaged} color={s.damaged ? C.red : undefined} />
            </View>

            <View style={st.card}>
              <Text style={st.cardTitle}>คำขอยืม {s.requests.total} รายการ</Text>
              <Text style={st.line}>
                อนุมัติ {s.requests.approved} · ปฏิเสธ {s.requests.declined} · หมดเวลา {s.requests.expired} · ยกเลิก{" "}
                {s.requests.cancelled}
              </Text>
              <Text style={st.line}>
                ยืมต่อ {s.renewed} · คืนอัตโนมัติ (ไม่ได้ตรวจ) {s.autoReturned} · ค่าเสียหายรวม{" "}
                {s.damageCost.toLocaleString("th-TH")} บาท
              </Text>
            </View>

            <TopList title="อุปกรณ์ที่ยืมบ่อย" items={s.topItems} />
            <TopList title="หมวดที่ยืมบ่อย" items={s.topCategories} />
            <TopList title="ผู้ยืมบ่อย" items={s.topBorrowers} />

            <View style={st.card}>
              <Text style={st.cardTitle}>ส่งออกรายงาน ({rows.length} รายการยืม)</Text>
              <Text style={st.help}>
                CSV = เปิดใน Excel/Google Sheets (รายละเอียดทุกรายการ) · PDF = สรุป + ตาราง พร้อมพิมพ์ (A4 แนวนอน)
                {Platform.OS === "web" ? " · PDF บนเว็บ: เลือก “บันทึกเป็น PDF” ในหน้าพิมพ์" : ""}
              </Text>
              <View style={st.exportRow}>
                <TouchableOpacity style={st.exportBtn} onPress={doCsv} disabled={!!exporting} activeOpacity={0.85}>
                  {exporting === "csv" ? <ActivityIndicator color="#fff" /> : <Ionicons name="grid-outline" size={18} color="#fff" />}
                  <Text style={st.exportText}>CSV (Excel)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.exportBtn, st.exportPdf]} onPress={doPdf} disabled={!!exporting} activeOpacity={0.85}>
                  {exporting === "pdf" ? <ActivityIndicator color="#fff" /> : <Ionicons name="document-text-outline" size={18} color="#fff" />}
                  <Text style={st.exportText}>PDF</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
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
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  card: { ...W.card, padding: 14, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "900", color: C.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#fff",
  },
  chipOn: { ...NG, backgroundColor: C.purple, borderColor: C.purple },
  chipText: { fontSize: 14, fontWeight: "700", color: C.ink },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: C.ink,
    backgroundColor: "#f8fafc",
  },
  inputError: { ...NG, borderColor: C.red, backgroundColor: "#fef2f2" },
  dateDash: { fontSize: 14, color: C.muted, fontWeight: "700" },
  help: { fontSize: 12.5, color: C.muted, lineHeight: 18 },
  rangeText: { fontSize: 13.5, fontWeight: "800", color: C.purple },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: {
    ...W.card,
    flexGrow: 1,
    flexBasis: "30%",
    padding: 12,
  },
  statNum: { fontSize: 24, fontWeight: "900", color: C.ink },
  statLabel: { fontSize: 12.5, color: C.muted, fontWeight: "700", marginTop: 2 },
  line: { fontSize: 13.5, color: C.ink, lineHeight: 20 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 },
  topRank: { width: 20, fontSize: 13, fontWeight: "900", color: C.faint },
  topName: { flex: 1, fontSize: 14, color: C.ink },
  topCount: { fontSize: 15, fontWeight: "900", color: C.purple },
  empty: { fontSize: 13, color: C.faint },
  exportRow: { flexDirection: "row", gap: 10 },
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: C.green,
  },
  exportPdf: { backgroundColor: "#dc2626" },
  exportText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
