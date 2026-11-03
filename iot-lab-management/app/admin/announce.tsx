import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Switch, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Text, TextInput } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../../lib/supabase";
import { goBack } from "../../lib/nav";
import { confirmAction, notify } from "../../lib/notify";
import { W } from "../../lib/theme";
import { desktopBody, useIsDesktop } from "../../lib/layout";
import { thaiDateTime } from "../../lib/itemInfo";
import ScreenHeader from "../../components/ScreenHeader";
import LoadingState from "../../components/LoadingState";

// ประกาศถึงนักศึกษา — admin เท่านั้น (RPC เช็ก is_admin เอง)
//   อัตโนมัติ: สวิตช์ใน app_settings (announce_new_items / announce_invite) cron ยิงตอน 08:00
//   ส่งเอง: send_announcement · ทดสอบ = ส่งหาตัวเองคนเดียว (ไม่ถึง นศ.)
// ผู้รับเห็นในกระดิ่งของตัวเอง + push (trigger เดิมของ notifications)

const C = {
  blue: "#2563EB",
  ink: "#172033",
  muted: "#475569",
  faint: "#64748B",
  line: "#DCE6F5",
  red: "#dc2626",
};

type AutoKey = "announce_new_items" | "announce_invite";
type Audience = "all" | "borrowing";
type History = {
  id: string; kind: string; title: string; body: string; audience: string;
  sender: string | null; recipients: number; read_count: number; created_at: string;
};

const AUTO: { key: AutoKey; kind: "new_items" | "invite"; icon: any; color: string; bg: string; label: string; hint: string }[] = [
  {
    key: "announce_new_items", kind: "new_items", icon: "gift-outline", color: "#2563EB", bg: "#DBEAFE",
    label: "ของใหม่มาแล้ว",
    hint: "ทุกวัน 08:00 · มีรุ่นใหม่เข้าระบบเมื่อวาน → ส่งรวม 1 ข้อความถึงนักศึกษา + TA ทุกคน",
  },
  {
    key: "announce_invite", kind: "invite", icon: "rocket-outline", color: "#047857", bg: "#ECFDF5",
    label: "ชวนมายืม",
    hint: "ทุกวันจันทร์ 08:00 · คนที่ไม่ได้ยืมเกิน 30 วัน (รวมคนที่ไม่เคยยืม) · คนละไม่เกินเดือนละครั้ง",
  },
];

// ข้อความตั้งต้น (แก้ต่อได้) — ปิดเทอมเลือกกลุ่ม "ยืมค้าง" ให้เลย
const TEMPLATES: { label: string; title: string; body: string; audience?: Audience }[] = [
  {
    label: "ช่วงสอบ",
    title: "ใกล้สอบแล้ว ยืมอุปกรณ์ได้นะ",
    body: "ช่วงสอบนี้ยืมบอร์ดและเซนเซอร์ไปทบทวนหรือทำงานได้ตามปกติ ขอยืมผ่านแอปได้เลย",
  },
  {
    label: "ส่งโปรเจกต์",
    title: "ใกล้ส่งโปรเจกต์แล้ว",
    body: "ใครยังขาดอุปกรณ์สำหรับโปรเจกต์ ยืมได้ที่แล็บ หรือขอนัดรับผ่านแอปได้เลย",
  },
  {
    label: "ปิดเทอม · ตามของคืน",
    title: "ใกล้ปิดเทอม กรุณาคืนอุปกรณ์",
    body: "ใครยังยืมอุปกรณ์อยู่ กรุณานำมาคืนก่อนปิดเทอม ขอบคุณครับ",
    audience: "borrowing",
  },
  { label: "พิมพ์เอง", title: "", body: "" },
];

// ปุ่ม "ทดสอบส่งหาตัวเอง" เฉพาะ dev server ในเครื่อง (__DEV__) — เว็บจริงไม่แสดง
const SHOW_TEST = __DEV__;

// ประวัติ: โหลดล่าสุด 100 รายการ (เพดานของ RPC) แต่โชว์ทีละ 5
const HIST_MAX = 100;
const HIST_STEP = 5;

const TITLE_MAX = 80;
const BODY_MAX = 300;

const KIND_BADGE: Record<string, { text: string; color: string; bg: string }> = {
  auto: { text: "อัตโนมัติ", color: "#1D4ED8", bg: "#EEF5FF" },
  manual: { text: "admin ส่ง", color: "#92400E", bg: "#FFFBEB" },
  test: { text: "ทดสอบ", color: "#475569", bg: "#F1F5F9" },
};
// โหลดทั้งหน้า: สวิตช์ + จำนวนผู้รับ + ประวัติ
const fetchAll = () =>
  Promise.all([
    supabase.from("app_settings").select("key, value").in("key", AUTO.map((a) => a.key)),
    supabase.rpc("announcement_audience_counts"),
    supabase.rpc("announcement_history", { p_limit: HIST_MAX }),
  ]);

const badgeOf = (h: History) => (h.audience === "test" ? KIND_BADGE.test : h.kind === "manual" ? KIND_BADGE.manual : KIND_BADGE.auto);

export default function AdminAnnounce() {
  const isDesktop = useIsDesktop();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [auto, setAuto] = useState<Record<AutoKey, boolean>>({ announce_new_items: false, announce_invite: false });
  const [counts, setCounts] = useState<Record<Audience, number>>({ all: 0, borrowing: 0 });
  const [history, setHistory] = useState<History[]>([]);
  const [histShown, setHistShown] = useState(HIST_STEP); // ประวัติยาว → โชว์ทีละชุด กด "ดูเพิ่ม" เอง
  const [template, setTemplate] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [busy, setBusy] = useState<string | null>(null); // ปุ่มที่กำลังทำงาน (กันกดซ้ำ)

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.rpc("announcement_history", { p_limit: HIST_MAX });
    if (data) setHistory(data as History[]);
  }, []);

  const apply = useCallback(([settings, aud, hist]: Awaited<ReturnType<typeof fetchAll>>) => {
    const error = settings.error || aud.error || hist.error;
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    setAuto({
      announce_new_items: (settings.data || []).some((r: any) => r.key === "announce_new_items" && r.value === true),
      announce_invite: (settings.data || []).some((r: any) => r.key === "announce_invite" && r.value === true),
    });
    const row = (aud.data as any[])?.[0];
    setCounts({ all: row?.all_count ?? 0, borrowing: row?.borrowing_count ?? 0 });
    setHistory((hist.data as History[]) || []);
    setLoadError("");
    setLoading(false);
  }, []);

  const load = useCallback(() => fetchAll().then(apply), [apply]);
  useEffect(() => { load(); }, [load]);

  // เปิด-ปิดอัตโนมัติ: เปลี่ยนจอก่อน บันทึกไม่ได้ = คืนค่าเดิม
  const toggleAuto = async (key: AutoKey, on: boolean) => {
    setAuto((a) => ({ ...a, [key]: on }));
    const { data, error } = await supabase
      .from("app_settings")
      .upsert({ key, value: on, updated_at: new Date().toISOString() })
      .select("key");
    if (error || !data?.length) {
      setAuto((a) => ({ ...a, [key]: !on }));
      notify("บันทึกไม่สำเร็จ", error?.message || "ไม่มีสิทธิ์แก้การตั้งค่า");
    }
  };

  const testAuto = async (kind: "new_items" | "invite", label: string) => {
    setBusy(`auto-${kind}`);
    const { data, error } = await supabase.rpc("test_auto_announcement", { p_kind: kind });
    setBusy(null);
    if (error) return notify("ทดสอบไม่สำเร็จ", error.message);
    if (!data) {
      return notify(
        "ตอนนี้ยังไม่มีอะไรให้ส่ง",
        kind === "new_items" ? "ไม่มีรุ่นใหม่ที่เพิ่มใน 7 วันนี้ (หรือรุ่นใหม่ยังไม่มีชิ้นว่าง)" : "ตอนนี้ไม่มีอุปกรณ์ว่างให้ยืม",
      );
    }
    notify("ส่งหาตัวเองแล้ว", `ดู "${label}" ได้ที่กระดิ่งในโหมดนักศึกษา (แท็บแจ้งเตือนด้านล่าง)`);
    loadHistory();
  };

  const pickTemplate = (i: number) => {
    const t = TEMPLATES[i];
    setTemplate(i);
    setTitle(t.title);
    setBody(t.body);
    setAudience(t.audience ?? "all");
  };

  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  const formError =
    !cleanTitle ? "ใส่หัวข้อ" : cleanTitle.length > TITLE_MAX ? `หัวข้อยาวได้ไม่เกิน ${TITLE_MAX} ตัวอักษร`
    : !cleanBody ? "ใส่ข้อความ" : cleanBody.length > BODY_MAX ? `ข้อความยาวได้ไม่เกิน ${BODY_MAX} ตัวอักษร` : "";
  const count = counts[audience];
  const canSend = !formError && !busy && count > 0;

  const send = async (target: Audience | "test") => {
    setBusy(target === "test" ? "test" : "send");
    const { data, error } = await supabase.rpc("send_announcement", { p_title: cleanTitle, p_body: cleanBody, p_audience: target });
    setBusy(null);
    if (error) return notify("ส่งไม่สำเร็จ", error.message);
    if (target === "test") {
      notify("ส่งหาตัวเองแล้ว", "ดูได้ที่กระดิ่งในโหมดนักศึกษา (แท็บแจ้งเตือนด้านล่าง)");
    } else {
      notify("ส่งประกาศแล้ว", `ส่งถึง ${data ?? 0} คน`);
      setTemplate(null);
      setTitle("");
      setBody("");
      setAudience("all");
    }
    loadHistory();
  };

  const confirmSend = () => {
    if (!canSend) return;
    confirmAction(
      "ส่งประกาศ?",
      `"${cleanTitle}"\nถึง${audience === "all" ? "นักศึกษา + TA ทุกคน" : "คนที่ยังยืมของค้าง"} ${count} คน · ส่งแล้วยกเลิกไม่ได้`,
      `ส่งถึง ${count} คน`,
      () => send(audience),
    );
  };

  return (
    <View style={s.container}>
      <ScreenHeader
        title={"ประกาศถึงนักศึกษา"}
        subtitle={"ส่งอัตโนมัติ และส่งประกาศเอง"}
        onBack={() => goBack("/admin/home")}
      />

      {loading ? (
        <LoadingState style={{ marginTop: 44 }} />
      ) : loadError ? (
        <View style={s.errorBox}>
          <Ionicons name="cloud-offline-outline" size={20} color="#b91c1c" />
          <View style={{ flex: 1 }}>
            <Text style={s.errorTitle}>โหลดไม่สำเร็จ</Text>
            <Text style={s.errorMsg} numberOfLines={2}>{loadError}</Text>
          </View>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setLoading(true); load(); }} activeOpacity={0.85}>
            <Text style={s.retryText}>ลองใหม่</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={[s.body, isDesktop && desktopBody.wide, isDesktop && { maxWidth: 720 }]} keyboardShouldPersistTaps="handled">
          {/* ส่งอัตโนมัติ */}
          <View style={{ gap: 8 }}>
            <Text style={s.section}>ส่งอัตโนมัติ</Text>
            <View style={s.card}>
              {AUTO.map((a, idx) => (
                <View key={a.key} style={[s.autoRow, idx > 0 && s.divider]}>
                  <View style={s.autoTop}>
                    <View style={[s.iconBox, { backgroundColor: a.bg }]}>
                      <Ionicons name={a.icon} size={20} color={a.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>{a.label}</Text>
                      <Text style={s.hint}>{a.hint}</Text>
                    </View>
                    <Switch
                      value={auto[a.key]}
                      onValueChange={(v) => toggleAuto(a.key, v)}
                      trackColor={{ false: "#CBD5E1", true: C.blue }}
                      thumbColor="#fff"
                      accessibilityLabel={`${a.label}: ${auto[a.key] ? "เปิดอยู่" : "ปิดอยู่"}`}
                    />
                  </View>
                  {SHOW_TEST && (
                    <TouchableOpacity
                      style={s.testLink}
                      onPress={() => testAuto(a.kind, a.label)}
                      disabled={!!busy}
                      hitSlop={6}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="paper-plane-outline" size={14} color={C.blue} />
                      <Text style={s.testLinkText}>{busy === `auto-${a.kind}` ? "กำลังส่ง..." : "ทดสอบส่งหาตัวเอง"}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* ส่งเอง */}
          <View style={{ gap: 8 }}>
            <Text style={s.section}>ส่งประกาศเอง</Text>
            <View style={[s.card, s.compose]}>
              <Text style={s.fieldLabel}>เริ่มจากข้อความตั้งต้น</Text>
              <View style={s.chips}>
                {TEMPLATES.map((t, i) => (
                  <TouchableOpacity
                    key={t.label}
                    style={[s.chip, template === i && s.chipOn]}
                    onPress={() => pickTemplate(i)}
                    activeOpacity={0.75}
                    accessibilityState={{ selected: template === i }}
                  >
                    <Text style={[s.chipText, template === i && s.chipTextOn]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>หัวข้อ</Text>
              <TextInput
                style={s.input}
                value={title}
                onChangeText={setTitle}
                placeholder="เช่น ใกล้สอบแล้ว ยืมอุปกรณ์ได้นะ"
                placeholderTextColor={C.faint}
                maxLength={TITLE_MAX}
              />

              <Text style={s.fieldLabel}>ข้อความ</Text>
              <TextInput
                style={[s.input, s.textarea]}
                value={body}
                onChangeText={setBody}
                placeholder="รายละเอียดที่อยากบอกนักศึกษา"
                placeholderTextColor={C.faint}
                maxLength={BODY_MAX}
                multiline
              />
              <Text style={s.counter}>{body.length}/{BODY_MAX}</Text>

              <Text style={s.fieldLabel}>ส่งถึง</Text>
              <View style={s.audienceBox}>
                {(["all", "borrowing"] as Audience[]).map((a, idx) => (
                  <TouchableOpacity
                    key={a}
                    style={[s.audienceRow, idx > 0 && s.divider]}
                    onPress={() => setAudience(a)}
                    activeOpacity={0.75}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: audience === a }}
                  >
                    <Ionicons name={audience === a ? "radio-button-on" : "radio-button-off"} size={22} color={audience === a ? C.blue : "#94A3B8"} />
                    <Text style={s.audienceText}>{a === "all" ? "นักศึกษา + TA ทุกคน" : "คนที่ยังยืมของค้าง"}</Text>
                    <Text style={s.audienceCount}>{counts[a]} คน</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!!cleanTitle && !!cleanBody && (
                <>
                  <Text style={s.fieldLabel}>ตัวอย่างที่นักศึกษาเห็น</Text>
                  <View style={s.preview}>
                    <View style={[s.iconBox, { backgroundColor: "#fef3c7" }]}>
                      <Ionicons name="newspaper-outline" size={20} color="#b45309" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.previewTitle}>{cleanTitle}</Text>
                      <Text style={s.previewBody}>{cleanBody}</Text>
                    </View>
                  </View>
                </>
              )}

              {!!formError && (title || body) ? <Text style={[s.hint, { color: C.red }]}>{formError}</Text> : null}

              <View style={s.sendRow}>
                {SHOW_TEST && (
                  <TouchableOpacity
                    style={[s.secondaryBtn, (!!formError || !!busy) && { opacity: 0.4 }]}
                    disabled={!!formError || !!busy}
                    onPress={() => send("test")}
                    activeOpacity={0.85}
                  >
                    <Text style={s.secondaryText}>{busy === "test" ? "กำลังส่ง..." : "ทดสอบส่งหาตัวเอง"}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.sendBtn, !canSend && { opacity: 0.4 }]}
                  disabled={!canSend}
                  onPress={confirmSend}
                  activeOpacity={0.85}
                >
                  <Text style={s.sendText}>{busy === "send" ? "กำลังส่ง..." : count > 0 ? `ส่งถึง ${count} คน` : "ไม่มีผู้รับ"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ประวัติ */}
          <View style={{ gap: 8 }}>
            <Text style={s.section}>ประวัติการส่ง</Text>
            <View style={s.card}>
              {history.length === 0 ? (
                <Text style={[s.hint, { padding: 14, marginTop: 0 }]}>ยังไม่เคยส่งประกาศ</Text>
              ) : (
                history.slice(0, histShown).map((h, idx) => {
                  const b = badgeOf(h);
                  return (
                    <View key={h.id} style={[s.histRow, idx > 0 && s.divider]}>
                      <View style={s.histTop}>
                        <Text style={s.histTitle} numberOfLines={1}>{h.title}</Text>
                        <Text style={s.histTime}>{thaiDateTime(h.created_at)}</Text>
                      </View>
                      <Text style={s.histBody} numberOfLines={2}>{h.body}</Text>
                      <View style={s.histMeta}>
                        <View style={[s.badge, { backgroundColor: b.bg }]}>
                          <Text style={[s.badgeText, { color: b.color }]}>{b.text}</Text>
                        </View>
                        <Text style={s.histStat}>
                          ส่งถึง {h.recipients} คน · อ่านแล้ว {h.read_count}
                          {h.kind === "manual" && h.sender ? ` · ${h.sender}` : ""}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
              {history.length > histShown && (
                <TouchableOpacity
                  style={[s.moreBtn, s.divider]}
                  onPress={() => setHistShown((n) => n + HIST_STEP)}
                  activeOpacity={0.7}
                >
                  <Text style={s.moreText}>ดูเพิ่ม (อีก {history.length - histShown} รายการ)</Text>
                  <Ionicons name="chevron-down" size={16} color={C.blue} />
                </TouchableOpacity>
              )}
            </View>
          </View>
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
  body: { padding: 16, gap: 18, paddingBottom: 48 },
  section: { fontSize: 15, fontWeight: "900", color: C.ink },
  card: { ...W.card },
  divider: { borderTopWidth: 1, borderTopColor: C.line },
  autoRow: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  autoTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 15, fontWeight: "800", color: C.ink },
  hint: { fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 18 },
  testLink: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginLeft: 52, paddingVertical: 4 },
  testLinkText: { color: C.blue, fontSize: 13, fontWeight: "700" },
  compose: { padding: 14, gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: "800", color: C.muted, marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  chipOn: { borderColor: C.blue, backgroundColor: "#EEF5FF" },
  chipText: { color: C.ink, fontSize: 13.5, fontWeight: "600" },
  chipTextOn: { color: "#1D4ED8", fontWeight: "800" },
  input: {
    minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "#f8fafc",
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.ink,
  },
  textarea: { minHeight: 96, textAlignVertical: "top", lineHeight: 21 },
  counter: { fontSize: 11.5, color: C.faint, alignSelf: "flex-end", marginTop: -4 },
  audienceBox: { borderWidth: 1, borderColor: C.line, borderRadius: 12, overflow: "hidden", backgroundColor: "#fff" },
  audienceRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, minHeight: 48 },
  audienceText: { flex: 1, fontSize: 15, color: C.ink },
  audienceCount: { fontSize: 13, color: C.faint, fontWeight: "700" },
  preview: { flexDirection: "row", gap: 12, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, backgroundColor: "#fff" },
  previewTitle: { fontSize: 14.5, fontWeight: "800", color: C.ink },
  previewBody: { fontSize: 13, color: C.muted, lineHeight: 19, marginTop: 2 },
  sendRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  secondaryBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: "#BFD3F7", backgroundColor: "#EFF5FF", paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "#1D4ED8", fontSize: 14, fontWeight: "800" },
  sendBtn: { ...W.primarySolid, flex: 1.3, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  sendText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  histRow: { paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  histTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  histTitle: { flex: 1, fontSize: 14.5, fontWeight: "800", color: C.ink },
  histTime: { fontSize: 12, color: C.faint },
  histBody: { fontSize: 13, color: C.muted, lineHeight: 19 },
  histMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11.5, fontWeight: "800" },
  histStat: { fontSize: 12, color: C.faint },
  moreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 46 },
  moreText: { color: C.blue, fontSize: 14, fontWeight: "800" },
});
