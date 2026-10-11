import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Switch,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Text, TextInput } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../../lib/supabase";
import { goBack } from "../../lib/nav";
import { confirmAction, notify } from "../../lib/notify";
import { ALLOWED_DOMAIN } from "../../lib/googleAuth";
import { W, NG } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";
import {
  DEFAULT_RULES, VAR_LABEL, RuleVar, fillRule, fromThaiVars, hasBadVar, ruleParts, rulesFromRows, toThaiVars, varsFromRows,
} from "../../lib/borrowRules";

const VAR_KEYS = Object.keys(VAR_LABEL) as RuleVar[];

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
      { key: "max_active_borrows", label: "ยืมพร้อมกันได้สูงสุด", unit: "ชิ้น/คน", hint: "นับรวมคำขอที่รออนุมัติและคำขอนัดรับ", min: 1, max: 20, fallback: 3 },
      { key: "request_expiry_minutes", label: "คำขอหมดอายุใน", unit: "นาที", hint: "ไม่มีใครตอบภายในเวลานี้ คำขอยืมหมดอายุ / คำขอคืนคืนอัตโนมัติ", min: 5, max: 1440, fallback: 30 },
    ],
  },
];
const FIELDS = GROUPS.flatMap((g) => g.fields);

export default function AdminSettings() {
  const [saved, setSaved] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  // สวิตช์ "รับเฉพาะ @kkumail.com" (app_settings.allowed_email_domain) — ช่วงพัฒนาปิดไว้ เปิดตอน Final Project
  const [restrictDomain, setRestrictDomain] = useState(false);
  const [domainBusy, setDomainBusy] = useState(false);
  // F1 กฎการยืม-คืน (app_settings.borrow_rules) — แสดงในป๊อปอัปยืนยันของ นศ. + หน้าโปรไฟล์
  // savedRules = แบบที่เก็บใน DB ({max}) / rules = แบบที่ admin แก้ ([จำนวนสูงสุด])
  const [savedRules, setSavedRules] = useState<string[]>([]);
  const [rules, setRules] = useState<string[]>([]);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [dayOptions, setDayOptions] = useState<number[]>([3, 5, 7]);
  // แก้ได้ทีละข้อ (null = ดูอย่างเดียว) + ความสูงช่องที่แก้ (ยืดตามข้อความ — เว็บไม่ยืดเอง) + ตำแหน่งเคอร์เซอร์ไว้แทรกตัวแปร
  const [editing, setEditing] = useState<number | null>(null);
  const [ruleHeight, setRuleHeight] = useState(44);
  const ruleInputRef = useRef<React.ElementRef<typeof TextInput>>(null);

  // เปิดแก้ข้อไหน → โฟกัสช่องนั้นหลังแถวกางเสร็จ (autoFocus ยิงก่อนวัดตำแหน่ง แป้นพิมพ์เลยบังช่อง)
  useEffect(() => {
    if (editing === null) return;
    const t = setTimeout(() => ruleInputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [editing]);
  const [sel, setSel] = useState({ start: 0, end: 0 });

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [...FIELDS.map((f) => f.key), "allowed_email_domain", "borrow_rules", "borrow_day_options"]);
    // โหลดพัง = ไม่โชว์ฟอร์ม (ไม่งั้นช่องขึ้นค่าตั้งต้นเหมือนค่าจริง กดบันทึกแล้วทับค่าในฐานข้อมูล)
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    setLoadError("");
    const loadedRules = rulesFromRows(data || []);
    setSavedRules(loadedRules);
    setRules(loadedRules.map(toThaiVars));
    setDayOptions(varsFromRows(data || []).days);
    const domainValue = (data || []).find((r: any) => r.key === "allowed_email_domain")?.value;
    setRestrictDomain(typeof domainValue === "string" && domainValue.trim() !== "");
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

  // แบบที่จะเก็บ DB ({max}) — ใช้ตรวจ/เทียบ/บันทึก
  const cleanRules = rules.map((t) => fromThaiVars(t.trim()));
  const rulesChanged = JSON.stringify(cleanRules) !== JSON.stringify(savedRules);
  const rulesError = cleanRules.length === 0 ? "ต้องมีอย่างน้อย 1 ข้อ"
    : cleanRules.some((t) => !t) ? "มีข้อที่ว่างอยู่ — พิมพ์ข้อความหรือลบข้อนั้น"
    : cleanRules.some(hasBadVar) ? "มีตัวแปรไม่ถูกต้อง — ลบวงเล็บที่เกินออก แล้วกดปุ่ม + เพื่อแทรกใหม่"
    : cleanRules.some((t) => t.length > 300) ? "ข้อความยาวเกิน 300 ตัวอักษร" : "";
  const canSaveRules = rulesChanged && !rulesError && !rulesSaving;
  // ตัวเลขที่เติมแทนตัวแปร = ค่าที่บันทึกแล้วด้านบน (เหมือนที่ นศ. เห็นจริง)
  const vars = {
    max: saved.max_active_borrows ?? 3,
    days: dayOptions,
    expiry: saved.request_expiry_minutes ?? 30,
  };

  const startEdit = (i: number, text = rules[i] ?? "") => {
    setEditing(i);
    setRuleHeight(44);
    setSel({ start: text.length, end: text.length });
  };
  const moveRule = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rules.length) return;
    setRules((r) => { const next = [...r]; [next[i], next[j]] = [next[j], next[i]]; return next; });
    if (editing === i) setEditing(j);
  };
  const removeRule = (i: number) => {
    setRules((r) => r.filter((_, k) => k !== i));
    setEditing(null);
  };
  const addRule = () => {
    startEdit(rules.length, "");
    setRules((r) => [...r, ""]);
  };
  // แทรก [ตัวแปร] ตรงเคอร์เซอร์ของข้อที่กำลังแก้
  const insertVar = (k: RuleVar) => {
    if (editing === null) return;
    const token = `[${VAR_LABEL[k]}]`;
    const t = rules[editing] ?? "";
    const start = Math.min(sel.start, t.length);
    const end = Math.min(Math.max(sel.end, start), t.length);
    setRules((r) => r.map((x, i) => (i === editing ? t.slice(0, start) + token + t.slice(end) : x)));
    setSel({ start: start + token.length, end: start + token.length });
  };

  const saveRules = async () => {
    if (!canSaveRules) return;
    setRulesSaving(true);
    const { data, error } = await supabase
      .from("app_settings")
      .upsert({ key: "borrow_rules", value: cleanRules, updated_at: new Date().toISOString() })
      .select("key");
    setRulesSaving(false);
    if (error || !data?.length) {
      notify("บันทึกกฎไม่สำเร็จ", error?.message || "ไม่มีสิทธิ์แก้ไข");
      return;
    }
    setSavedRules(cleanRules);
    setRules(cleanRules.map(toThaiVars));
    setEditing(null);
    notify("บันทึกกฎแล้ว", "นักศึกษาเห็นกฎใหม่ทันทีในป๊อปอัปยืนยันและหน้าโปรไฟล์");
  };

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
    // ไม่ load() ใหม่ — จะล้างกฎที่กำลังแก้ค้างอยู่
    setSaved((old) => ({ ...old, ...Object.fromEntries(changed.map((f) => [f.key, Number(draft[f.key])])) }));
  };

  return (
    <View style={s.container}>
      <ScreenHeader
        title={"ตั้งค่าระบบ"}
        subtitle={"เกณฑ์แจ้งเตือนและกติกาการยืม"}
        onBack={() => goBack("/admin/home")}
      />

      {loading ? (
        <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 44 }} />
      ) : loadError ? (
        // แถบลองใหม่ของหน้านี้เอง (components/LoadError เป็นของระบบห้อง ระบบยืมห้าม import)
        <View style={s.errorBox}>
          <Ionicons name="cloud-offline-outline" size={20} color="#b91c1c" />
          <View style={{ flex: 1 }}>
            <Text style={s.errorTitle}>โหลดค่าตั้งไม่สำเร็จ</Text>
            <Text style={s.errorMsg} numberOfLines={2}>{loadError}</Text>
          </View>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); load(); }} activeOpacity={0.85}>
            <Text style={s.retryText}>ลองใหม่</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAwareScrollView bottomOffset={editing === null ? 24 : 190} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
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
            <Text style={s.section}>กฎการยืม-คืน</Text>
            <View style={s.card}>
              <View style={s.field}>
                <Text style={[s.hint, { flex: 1, marginTop: 0 }]}>
                  นักศึกษาเห็นกฎนี้ตอนขอยืม/คืน/ยืมต่อ และในหน้าโปรไฟล์ · ตัวเลข<Text style={s.varText}>สีฟ้า</Text>เปลี่ยนตามค่าตั้งด้านบนอัตโนมัติ
                </Text>
              </View>
              {rules.map((t, i) => {
                const template = fromThaiVars(t.trim());
                const bad = hasBadVar(template);
                if (editing !== i) {
                  return (
                    <TouchableOpacity key={i} style={[s.ruleRow, s.divider]} onPress={() => startEdit(i)} activeOpacity={0.7} accessibilityLabel={`แก้กฎข้อ ${i + 1}`}>
                      <Text style={s.ruleNo}>{i + 1}</Text>
                      {!template ? (
                        <Text style={[s.ruleText, { color: C.red }]}>ข้อนี้ว่าง — แตะเพื่อพิมพ์ หรือลบข้อนี้</Text>
                      ) : bad ? (
                        <Text style={[s.ruleText, { color: C.red }]}>{t}</Text>
                      ) : (
                        <Text style={s.ruleText}>
                          {ruleParts(template, vars).map((p, k) =>
                            p.isVar ? <Text key={k} style={s.varText}>{p.text}</Text> : p.text
                          )}
                        </Text>
                      )}
                      <Ionicons name="pencil" size={17} color={C.faint} style={{ marginTop: 2 }} />
                    </TouchableOpacity>
                  );
                }
                return (
                  <View key={i} style={[s.ruleEdit, s.divider]}>
                    <View style={s.ruleEditTop}>
                      <Text style={[s.ruleNo, { marginTop: 11 }]}>{i + 1}</Text>
                      <TextInput
                        style={[s.ruleInput, { height: Math.max(44, ruleHeight) }, (!t.trim() || bad) && s.inputError]}
                        onContentSizeChange={(e) => {
                          const h = Math.ceil(e.nativeEvent.contentSize.height) + 2;
                          setRuleHeight((old) => (old === h ? old : h));
                        }}
                        value={t}
                        onChangeText={(v) => setRules((r) => r.map((x, k) => (k === i ? v : x)))}
                        onSelectionChange={(e) => setSel(e.nativeEvent.selection)}
                        placeholder="พิมพ์กฎข้อนี้"
                        placeholderTextColor={C.faint}
                        multiline
                        ref={ruleInputRef}
                        maxLength={300}
                      />
                    </View>
                    <View style={s.ruleEditBody}>
                      <View style={s.chips}>
                        {VAR_KEYS.map((k) => (
                          <TouchableOpacity key={k} style={s.chip} onPress={() => insertVar(k)} activeOpacity={0.75}>
                            <Text style={s.chipText}>+ {VAR_LABEL[k]}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {bad ? (
                        <Text style={[s.hint, { color: C.red, marginTop: 0 }]}>
                          ตัวแปรไม่ถูกต้อง — ลบวงเล็บที่เกินออก แล้วกดปุ่ม + เพื่อแทรกใหม่
                        </Text>
                      ) : (
                        <View style={s.preview}>
                          <Ionicons name="eye-outline" size={15} color={C.muted} style={{ marginTop: 2 }} />
                          <Text style={s.previewText}>นศ. เห็น: {template ? fillRule(template, vars) : "—"}</Text>
                        </View>
                      )}
                      <View style={s.editTools}>
                        <View style={s.editToolsLeft}>
                          <TouchableOpacity onPress={() => moveRule(i, -1)} disabled={i === 0} hitSlop={8} accessibilityLabel="เลื่อนขึ้น">
                            <Ionicons name="chevron-up" size={20} color={i === 0 ? "#CBD5E1" : C.muted} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => moveRule(i, 1)} disabled={i === rules.length - 1} hitSlop={8} accessibilityLabel="เลื่อนลง">
                            <Ionicons name="chevron-down" size={20} color={i === rules.length - 1 ? "#CBD5E1" : C.muted} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => removeRule(i)} hitSlop={8} style={s.deleteBtn} accessibilityLabel="ลบข้อนี้">
                            <Ionicons name="trash-outline" size={17} color={C.red} />
                            <Text style={s.deleteText}>ลบ</Text>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={() => { Keyboard.dismiss(); setEditing(null); }} hitSlop={8}>
                          <Text style={s.doneText}>เสร็จ</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
              <View style={[s.ruleActions, s.divider]}>
                <TouchableOpacity onPress={addRule} activeOpacity={0.8} style={s.addRule}>
                  <Ionicons name="add" size={18} color={C.purple} />
                  <Text style={s.addRuleText}>เพิ่มข้อ</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setRules(DEFAULT_RULES.map(toThaiVars)); setEditing(null); }} activeOpacity={0.8}>
                  <Text style={s.resetText}>ใช้กฎตั้งต้น</Text>
                </TouchableOpacity>
              </View>
            </View>
            {!!rulesError && <Text style={[s.hint, { color: C.red }]}>{rulesError}</Text>}
            <TouchableOpacity style={[s.saveBtn, !canSaveRules && { opacity: 0.4 }]} disabled={!canSaveRules} onPress={saveRules} activeOpacity={0.85}>
              <Text style={s.saveText}>{rulesSaving ? "กำลังบันทึก..." : rulesChanged ? "บันทึกกฎ" : "กฎยังไม่มีการเปลี่ยนแปลง"}</Text>
            </TouchableOpacity>
          </View>

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
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 12, padding: 12, margin: 16 },
  errorTitle: { color: "#b91c1c", fontSize: 13, fontWeight: "900" },
  errorMsg: { color: "#7f1d1d", fontSize: 11.5, marginTop: 2 },
  retryBtn: { backgroundColor: C.red, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7 },
  retryText: { color: "#fff", fontSize: 12, fontWeight: "900" },
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
  varText: { color: C.purple, fontWeight: "800" },
  ruleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  ruleNo: { width: 18, fontSize: 14, fontWeight: "800", color: C.faint, textAlign: "center" },
  ruleText: { flex: 1, fontSize: 14, lineHeight: 21, color: C.ink },
  ruleEdit: { paddingHorizontal: 14, paddingVertical: 12, gap: 8, backgroundColor: "#F8FBFF" },
  ruleEditTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  ruleEditBody: { paddingLeft: 26, gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: "#BFD3F7", backgroundColor: "#EFF5FF", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { color: "#1D4ED8", fontSize: 12.5, fontWeight: "700" },
  preview: { flexDirection: "row", gap: 6, backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  previewText: { flex: 1, fontSize: 12.5, lineHeight: 19, color: C.muted },
  editTools: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editToolsLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  deleteText: { color: C.red, fontSize: 13, fontWeight: "700" },
  doneText: { color: C.purple, fontSize: 14, fontWeight: "800" },
  ruleInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    lineHeight: 20,
    color: C.ink,
    textAlignVertical: "top",
  },
  ruleActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12 },
  addRule: { flexDirection: "row", alignItems: "center", gap: 4 },
  addRuleText: { color: C.purple, fontSize: 14, fontWeight: "800" },
  resetText: { color: C.muted, fontSize: 13, fontWeight: "700" },
});
