import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";
import { goBack } from "../../lib/nav";
import { confirmAction, notify } from "../../lib/notify";
import { ALLOWED_DOMAIN } from "../../lib/googleAuth";
import { W, NG } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";

// ตั้งค่าระบบ (ตาราง app_settings) — แก้ได้เฉพาะ admin (RLS)
// ค่าเหล่านี้ RPC ฝั่งฐานข้อมูลอ่านเองทุกครั้ง เปลี่ยนแล้วมีผลทันที

const C = {
  bg: "#EAF1FC",
  purple: "#2563EB",
  ink: "#172033",
  muted: "#475569",
  faint: "#64748B",
  line: "#DCE6F5",
  red: "#dc2626",
};

type Field = { key: string; label: string; unit: string; hint: string; min: number; max: number; fallback: number };

const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "แจ้งเตือนอุปกรณ์",
    fields: [
      { key: "warranty_warn_days", label: "เตือนก่อนประกันหมด", unit: "วัน", hint: "แจ้งผู้ดูแลเมื่อประกันเหลือไม่เกินจำนวนวันนี้", min: 1, max: 365, fallback: 30 },
      { key: "age_warn_years", label: "อายุที่ควรตรวจสภาพ", unit: "ปี", hint: "นับจากวันที่เพิ่มเข้าระบบ", min: 1, max: 30, fallback: 3 },
      { key: "age_replace_years", label: "อายุที่ควรเปลี่ยน", unit: "ปี", hint: "ต้องมากกว่าอายุที่ควรตรวจสภาพ", min: 1, max: 30, fallback: 4 },
    ],
  },
  {
    title: "การยืม",
    fields: [
      { key: "max_active_borrows", label: "ยืมพร้อมกันได้สูงสุด", unit: "ชิ้น/คน", hint: "รวมคำขอที่รออนุมัติ", min: 1, max: 20, fallback: 3 },
      { key: "request_expiry_minutes", label: "คำขอหมดอายุใน", unit: "นาที", hint: "ไม่มีใครตอบภายในเวลานี้ คำขอยืมหมดอายุ / คำขอคืนคืนอัตโนมัติ", min: 5, max: 1440, fallback: 30 },
    ],
  },
];
const FIELDS = GROUPS.flatMap((g) => g.fields);

export default function AdminSettings() {
  const router = useRouter();
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // สวิตช์ "รับเฉพาะ @kkumail.com" (app_settings.allowed_email_domain) — ช่วงพัฒนาปิดไว้ เปิดตอน Final Project
  const [restrictDomain, setRestrictDomain] = useState(false);
  const [domainBusy, setDomainBusy] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [...FIELDS.map((f) => f.key), "allowed_email_domain"]);
    const domainValue = (data || []).find((r: any) => r.key === "allowed_email_domain")?.value;
    setRestrictDomain(typeof domainValue === "string" && domainValue.trim() !== "");
    if (error) notify("โหลดค่าตั้งไม่สำเร็จ", error.message);
    const values: Record<string, number> = {};
    FIELDS.forEach((f) => {
      const n = Number((data || []).find((r: any) => r.key === f.key)?.value);
      values[f.key] = Number.isFinite(n) ? n : f.fallback;
    });
    setSaved(values);
    setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, String(values[f.key])])));
    setLoading(false);
  };

  // ตรวจทีละช่อง → ข้อความผิด (ว่าง = ถูก)
  const errors: Record<string, string> = {};
  FIELDS.forEach((f) => {
    const raw = (draft[f.key] || "").trim();
    const n = Number(raw);
    if (!/^\d+$/.test(raw)) errors[f.key] = "ใส่เป็นตัวเลขจำนวนเต็ม";
    else if (n < f.min || n > f.max) errors[f.key] = `ใส่ได้ ${f.min}–${f.max}`;
  });
  if (!errors.age_warn_years && !errors.age_replace_years &&
      Number(draft.age_replace_years) <= Number(draft.age_warn_years)) {
    errors.age_replace_years = "ต้องมากกว่าอายุที่ควรตรวจสภาพ";
  }

  const changed = FIELDS.filter((f) => Number(draft[f.key]) !== saved[f.key]);
  const canSave = changed.length > 0 && Object.keys(errors).length === 0 && !saving;

  const toggleDomain = (on: boolean) => {
    confirmAction(
      on ? `รับเฉพาะอีเมล @${ALLOWED_DOMAIN}?` : "เปิดให้ทุกอีเมลใช้ได้?",
      on
        ? `ล็อกอินด้วย Google ได้เฉพาะ @${ALLOWED_DOMAIN} และสมัครบัญชีใหม่ได้เฉพาะ @${ALLOWED_DOMAIN} (บัญชีเดิมทั้งหมดยังใช้ได้)

อย่าลืมเปิด Auth Hook "Before User Created" ใน Supabase ด้วย ไม่งั้นด่านฝั่งเซิร์ฟเวอร์ยังไม่ทำงาน`
        : "ทุกอีเมลล็อกอินด้วย Google และสมัครบัญชีใหม่ได้ (ใช้ช่วงพัฒนา/ทดสอบ)",
      on ? "เปิดใช้" : "ปิด",
      async () => {
        setDomainBusy(true);
        const { error } = await supabase
          .from("app_settings")
          .upsert({ key: "allowed_email_domain", value: on ? ALLOWED_DOMAIN : "", updated_at: new Date().toISOString() });
        setDomainBusy(false);
        if (error) {
          notify("บันทึกไม่สำเร็จ", error.message);
          return;
        }
        setRestrictDomain(on);
      },
      on
    );
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(changed.map((f) => ({ key: f.key, value: Number(draft[f.key]), updated_at: new Date().toISOString() })));
    setSaving(false);
    if (error) {
      notify("บันทึกไม่สำเร็จ", error.message);
      return;
    }
    notify("บันทึกแล้ว", "ค่าใหม่มีผลทันที");
    load();
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader
        title={"ตั้งค่าระบบ"}
        subtitle={"เกณฑ์แจ้งเตือนและกติกาการยืม"}
        onBack={() => goBack("/admin/home")}
      />

      {loading ? (
        <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 44 }} />
      ) : (
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {GROUPS.map((g) => (
            <View key={g.title} style={{ gap: 8 }}>
              <Text style={s.section}>{g.title}</Text>
              <View style={s.card}>
                {g.fields.map((f, idx) => (
                  <View key={f.key} style={[s.field, idx > 0 && s.divider]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>{f.label}</Text>
                      <Text style={[s.hint, !!errors[f.key] && { color: C.red }]}>{errors[f.key] || f.hint}</Text>
                    </View>
                    <TextInput
                      style={[s.input, !!errors[f.key] && s.inputError]}
                      value={draft[f.key]}
                      onChangeText={(t) => setDraft((d) => ({ ...d, [f.key]: t.replace(/[^\d]/g, "") }))}
                      keyboardType="number-pad"
                      maxLength={4}
                      selectTextOnFocus
                    />
                    <Text style={s.unit}>{f.unit}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <View style={{ gap: 8 }}>
            <Text style={s.section}>การเข้าสู่ระบบ</Text>
            <View style={s.card}>
              <View style={s.field}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>รับเฉพาะอีเมล @{ALLOWED_DOMAIN}</Text>
                  <Text style={s.hint}>
                    {restrictDomain
                      ? "เปิดอยู่ — ล็อกอิน Google / สมัครใหม่ได้เฉพาะอีเมลมหาวิทยาลัย"
                      : "ปิดอยู่ (ช่วงพัฒนา) — ทุกอีเมลใช้ได้ · เปิดตอน Final Project"}
                  </Text>
                </View>
                {domainBusy ? (
                  <ActivityIndicator color={C.purple} />
                ) : (
                  <Switch value={restrictDomain} onValueChange={toggleDomain} trackColor={{ true: C.purple }} />
                )}
              </View>
            </View>
          </View>

          <TouchableOpacity style={[s.saveBtn, !canSave && { opacity: 0.4 }]} disabled={!canSave} onPress={save} activeOpacity={0.85}>
            <Text style={s.saveText}>{saving ? "กำลังบันทึก..." : changed.length ? `บันทึก (${changed.length} ค่า)` : "ยังไม่มีการเปลี่ยนแปลง"}</Text>
          </TouchableOpacity>
          <Text style={s.note}>ระบบตรวจประกัน/อายุทุกวัน 08:00 แต่ละชิ้นเตือนครั้งเดียวต่อเรื่อง</Text>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  header: { ...W.headerBar,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 10,
    marginBottom: 8,
  },
  iconBtn: {
    ...W.iconBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#172033", fontSize: 21, fontWeight: "900" },
  headerSub: { color: "#475569", fontSize: 12, fontWeight: "700", marginTop: 2 },
  body: { padding: 16, gap: 14, paddingBottom: 40 },
  section: { fontSize: 15, fontWeight: "900", color: C.ink },
  card: { ...W.card },
  field: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: C.line },
  label: { fontSize: 15, fontWeight: "800", color: C.ink },
  hint: { fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 17 },
  input: {
    width: 64,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#f8fafc",
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
    color: C.ink,
  },
  inputError: { ...NG, borderColor: C.red, backgroundColor: "#fef2f2" },
  unit: { width: 48, fontSize: 13, color: C.muted, fontWeight: "700" },
  saveBtn: { ...W.primarySolid, borderRadius: 15, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  note: { fontSize: 12, color: C.faint, textAlign: "center" },
});
