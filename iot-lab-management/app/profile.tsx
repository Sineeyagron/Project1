import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../components/AppText";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";
import { currentUser } from "../lib/session";
import { useRefreshOnFocus } from "../lib/nav";
import { isMissingColumn } from "../lib/people";
import { Role, ROLE_LABEL } from "../lib/roles";
import { confirmAction } from "../lib/notify";
import { C, W, iconDot } from "../lib/theme";
import TabBar from "../components/TabBar";
import { FadeIn, PressScale } from "../components/Motion";

// โปรไฟล์นักศึกษา (ล็อกอินด้วย Google @kkumail.com):
//   ตัวตน = ชื่อ/รูป/อีเมลจาก Google + รหัส นศ. (แก้เองไม่ได้)
//   เน้น "ตอนนี้ยืมอะไรอยู่ คืนเมื่อไร ยืมได้อีกกี่ชิ้น" + กติกาการยืม (จาก app_settings ตรงกับระบบเสมอ)

type Loan = { id: string; status: string; due_date: string | null; itemName: string };
type Data = {
  email: string;
  role: string;
  fullName: string;
  avatarUrl: string;
  studentId: string;
  loans: Loan[];
  pendingBorrows: number;
  maxActive: number;
  dayOptions: number[];
  expiryMinutes: number;
};

// ข้อมูลชุดล่าสุด (หน่วยความจำ) — เปิดซ้ำไม่ต้องรอหมุน / ล้างเมื่อออกจากระบบ (กันคนถัดไปบนเครื่องเดียวกันเห็น)
let cache: Data | null = null;
supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") cache = null; });

const settingNum = (rows: any[], key: string, fallback: number) => {
  const n = Number(rows.find((r) => r.key === key)?.value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const settingList = (rows: any[], key: string, fallback: number[]) => {
  let v = rows.find((r) => r.key === key)?.value;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = null; } }
  return Array.isArray(v) && v.length ? v.map(Number).filter((n) => n > 0) : fallback;
};

// วันครบกำหนด → ข้อความ + โทนสี
function dueInfo(date: string | null) {
  if (!date) return { text: "ไม่ระบุกำหนดคืน", tone: "ok" as const };
  const due = new Date(date);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { text: `เกินกำหนด ${-diff} วัน`, tone: "late" as const };
  if (diff === 0) return { text: "ครบกำหนดวันนี้", tone: "soon" as const };
  if (diff === 1) return { text: "คืนพรุ่งนี้", tone: "soon" as const };
  return { text: `เหลืออีก ${diff} วัน`, tone: "ok" as const };
}
const TONE = {
  ok: { fg: C.successInk, bg: C.successBg },
  soon: { fg: C.warningInk, bg: C.warningBg },
  late: { fg: C.errorInk, bg: C.errorBg },
};

export default function Profile() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(cache);
  const [canChangePassword, setCanChangePassword] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);
  useRefreshOnFocus(() => { load(); });

  const load = async () => {
    const user = await currentUser();
    if (!user) { setRefreshing(false); return; }
    // ล็อกอินด้วย Google ไม่มีรหัสผ่านในระบบเรา → ซ่อน "เปลี่ยนรหัสผ่าน" (โชว์เฉพาะบัญชีที่สมัครด้วยอีเมล)
    const providers: string[] = (user.app_metadata as any)?.providers ?? [(user.app_metadata as any)?.provider];
    setCanChangePassword(providers.includes("email"));

    // ยิงพร้อมกันรอบเดียว / ชื่ออุปกรณ์ดึงมากับรายการยืมผ่าน FK item_id
    const [profileRes, loansRes, pendingRes, settingsRes] = await Promise.all([
      supabase.from("profiles").select("email, role, full_name, avatar_url, student_id").eq("id", user.id).maybeSingle()
        // ยังไม่ได้รัน migration profile_student_id → ดึงแค่อีเมล/บทบาท (บทบาทต้องถูก ไม่งั้น TA ขึ้นว่า "นักศึกษา")
        .then((res) => (res.error && isMissingColumn(res.error) ? supabase.from("profiles").select("email, role").eq("id", user.id).maybeSingle() : res)),
      supabase
        .from("borrow_records")
        .select("id, status, due_date, items(name, item_code)")
        .eq("user_id", user.id)
        .in("status", ["borrowed", "pending_return"])
        .order("due_date", { ascending: true }),
      supabase
        .from("borrow_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("kind", "borrow")
        .eq("status", "pending"),
      supabase.from("app_settings").select("key, value").in("key", ["max_active_borrows", "borrow_day_options", "request_expiry_minutes"]),
    ]);

    const p: any = profileRes.data || {};
    const meta: any = user.user_metadata || {};
    const rows = settingsRes.data || [];
    const next: Data = {
      email: p.email || user.email || "",
      role: p.role || "user",
      fullName: p.full_name || meta.full_name || meta.name || "",
      avatarUrl: p.avatar_url || meta.avatar_url || meta.picture || "",
      studentId: p.student_id || "",
      loans: (loansRes.data || []).map((r: any) => ({
        id: r.id,
        status: r.status,
        due_date: r.due_date,
        itemName: r.items?.item_code || r.items?.name || "อุปกรณ์",
      })),
      pendingBorrows: pendingRes.count || 0,
      maxActive: settingNum(rows, "max_active_borrows", 3),
      dayOptions: settingList(rows, "borrow_day_options", [3, 5, 7]),
      expiryMinutes: settingNum(rows, "request_expiry_minutes", 30),
    };
    cache = next;
    setData(next);
    setRefreshing(false);
  };

  const logout = () => {
    confirmAction("ออกจากระบบ", "ต้องการออกจากระบบหรือไม่?", "ออกจากระบบ", async () => {
      cache = null;
      await supabase.auth.signOut();
      router.replace("/login");
    }, true);
  };

  if (!data) {
    return (
      <View style={[s.container, s.centered]}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  const name = data.fullName || data.email.split("@")[0] || "นักศึกษา";
  const used = data.loans.length + data.pendingBorrows;
  const left = Math.max(data.maxActive - used, 0);
  const overdue = data.loans.filter((l) => dueInfo(l.due_date).tone === "late").length;

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
      >
        <View style={s.headerTop}>
          <View>
            <Text style={s.kicker}>บัญชีของฉัน</Text>
            <Text style={s.title}>โปรไฟล์</Text>
          </View>
        </View>

        {/* ตัวตน — มาจากบัญชีมหาวิทยาลัย แก้ในแอปไม่ได้ */}
        <FadeIn style={s.idCard}>
          <View style={s.idTop}>
            {data.avatarUrl ? (
              <Image source={{ uri: data.avatarUrl }} style={s.avatar} accessibilityIgnoresInvertColors />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.name} numberOfLines={2}>{name}</Text>
              <View style={s.rolePill}>
                <Ionicons name="school-outline" size={11} color={C.primaryDark} />
                <Text style={s.roleText}>{ROLE_LABEL[data.role as Role] || ROLE_LABEL.user}</Text>
              </View>
            </View>
          </View>
          <View style={s.idRows}>
            <InfoRow icon="id-card-outline" label="รหัสนักศึกษา" value={data.studentId || "ยังไม่ได้กรอก"} strong={!!data.studentId} />
            <InfoRow icon="mail-outline" label="อีเมล" value={data.email} />
          </View>
          {!data.studentId && data.role === "user" ? (
            <PressScale style={s.fillBtn} onPress={() => router.push("/student-id" as any)}>
              <Text style={s.fillBtnText}>กรอกรหัสนักศึกษา</Text>
            </PressScale>
          ) : null}
        </FadeIn>

        {/* สิทธิ์การยืม */}
        <FadeIn delay={70} style={s.card}>
          <View style={s.quotaHead}>
            <Text style={s.cardTitle}>สิทธิ์การยืม</Text>
            <Text style={s.quotaNum}>
              <Text style={{ color: left === 0 ? C.errorInk : C.primary }}>{used}</Text> / {data.maxActive} ชิ้น
            </Text>
          </View>
          <View style={s.quotaBar}>
            {Array.from({ length: data.maxActive }).map((_, i) => (
              <View key={i} style={[s.quotaSeg, i < used && { backgroundColor: left === 0 ? C.error : C.primary }]} />
            ))}
          </View>
          <Text style={s.quotaSub}>
            {left > 0 ? `ยืมได้อีก ${left} ชิ้น` : "ยืมครบแล้ว คืนของก่อนจึงจะยืมชิ้นใหม่ได้"}
            {data.pendingBorrows > 0 ? ` · รออนุมัติ ${data.pendingBorrows} คำขอ` : ""}
          </Text>
          {overdue > 0 ? (
            <View style={s.lateBanner}>
              <Ionicons name="alert-circle" size={18} color={C.errorInk} />
              <Text style={s.lateText}>มีของเกินกำหนดคืน {overdue} ชิ้น กรุณานำไปคืนโดยเร็ว</Text>
            </View>
          ) : null}
        </FadeIn>

        {/* ของที่ยืมอยู่ */}
        <FadeIn delay={140}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>ของที่ยืมอยู่</Text>
            <PressScale onPress={() => router.push("/borrow")} hitSlop={8}>
              <Text style={s.viewAll}>ประวัติทั้งหมด ›</Text>
            </PressScale>
          </View>
          {data.loans.length === 0 ? (
            <View style={[s.card, s.empty]}>
              <Ionicons name="cube-outline" size={28} color={C.primarySoft} />
              <Text style={s.emptyText}>ยังไม่ได้ยืมอุปกรณ์</Text>
              <PressScale style={s.scanBtn} onPress={() => router.push("/scan")}>
                <Ionicons name="scan" size={16} color="#FFFFFF" />
                <Text style={s.scanBtnText}>สแกน QR เพื่อยืม</Text>
              </PressScale>
            </View>
          ) : (
            data.loans.map((loan) => {
              const due = dueInfo(loan.due_date);
              const tone = TONE[due.tone];
              const returning = loan.status === "pending_return";
              return (
                <PressScale key={loan.id} style={s.loanCard} onPress={() => router.push("/borrow")} scaleTo={0.98}>
                  <View style={iconDot(due.tone === "late" ? C.error : C.primary, 40)}>
                    <Ionicons name="hardware-chip-outline" size={19} color="#FFFFFF" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.loanName} numberOfLines={1}>{loan.itemName}</Text>
                    <Text style={s.loanSub}>{returning ? "ส่งคำขอคืนแล้ว รอผู้ดูแลตรวจรับ" : "กำลังยืม"}</Text>
                  </View>
                  <View style={[s.duePill, { backgroundColor: tone.bg }]}>
                    <Text style={[s.dueText, { color: tone.fg }]}>{due.text}</Text>
                  </View>
                </PressScale>
              );
            })
          )}
        </FadeIn>

        {/* กติกา */}
        <FadeIn delay={210} style={s.card}>
          <Text style={s.cardTitle}>กติกาการยืม</Text>
          <Rule icon="layers-outline" text={`ยืมพร้อมกันได้สูงสุด ${data.maxActive} ชิ้น (นับรวมที่รออนุมัติ)`} />
          <Rule icon="calendar-outline" text={`เลือกระยะยืมได้ ${data.dayOptions.join(" / ")} วัน · ยืมต่อได้ 1 ครั้ง`} />
          <Rule icon="timer-outline" text={`คำขอรอผู้ดูแลอนุมัติภายใน ${data.expiryMinutes} นาที ไม่มีคนตอบ = หมดอายุ`} />
          <Rule icon="scan-outline" text="ยืม/คืน ทำได้ทางเดียวคือสแกน QR ที่ตัวอุปกรณ์ในห้อง" />
        </FadeIn>

        {/* บัญชี */}
        <FadeIn delay={280} style={s.menu}>
          {canChangePassword ? (
            <MenuRow icon="key-outline" color={C.primary} title="เปลี่ยนรหัสผ่าน" onPress={() => router.push("/reset-password?mode=change" as any)} />
          ) : null}
          <MenuRow icon="log-out-outline" color={C.error} title="ออกจากระบบ" danger onPress={logout} />
        </FadeIn>
        <Text style={s.version}>IoT Lab Management · v1.0.0</Text>

        <View style={{ height: 92 }} />
      </ScrollView>

      <TabBar current="/profile" />
    </View>
  );
}

function InfoRow({ icon, label, value, strong }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; strong?: boolean }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={16} color={C.text2} />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, strong && s.infoStrong]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Rule({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.rule}>
      <Ionicons name={icon} size={16} color={C.primary} style={{ marginTop: 2 }} />
      <Text style={s.ruleText}>{text}</Text>
    </View>
  );
}

function MenuRow({ icon, color, title, danger, onPress }: { icon: keyof typeof Ionicons.glyphMap; color: string; title: string; danger?: boolean; onPress: () => void }) {
  return (
    <PressScale style={s.menuRow} onPress={onPress} scaleTo={0.98}>
      <View style={iconDot(color, 34)}>
        <Ionicons name={icon} size={17} color="#FFFFFF" />
      </View>
      <Text style={[s.menuTitle, danger && { color: C.errorInk }]}>{title}</Text>
      <Ionicons name="chevron-forward" size={18} color={C.faint} />
    </PressScale>
  );
}

const s = StyleSheet.create({
  container: { ...W.page },
  centered: { alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 16, paddingTop: 0 },
  headerTop: {
    ...W.headerBar,
    marginHorizontal: -16,
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 10,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kicker: { color: C.text2, fontSize: 13, marginBottom: 2 },
  title: { color: C.ink, fontSize: 26, fontWeight: "700", lineHeight: 34 },

  idCard: { ...W.card, padding: 16, marginBottom: 12 },
  idTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: "#FFFFFF", backgroundColor: C.primaryTint },
  avatarFallback: { backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 26, fontWeight: "700" },
  name: { color: C.ink, fontSize: 18, fontWeight: "700", lineHeight: 26 },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: C.primaryTint },
  roleText: { color: C.primaryDark, fontSize: 12, fontWeight: "600" },
  idRows: { marginTop: 14, gap: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLabel: { color: C.text2, fontSize: 13, width: 92 },
  infoValue: { flex: 1, color: C.ink, fontSize: 14, textAlign: "right" },
  infoStrong: { fontWeight: "700", letterSpacing: 0.5 },
  fillBtn: { ...W.primary, marginTop: 12, height: 44, alignItems: "center", justifyContent: "center" },
  fillBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },

  card: { ...W.card, padding: 16, marginBottom: 12 },
  cardTitle: { color: C.ink, fontSize: 16, fontWeight: "700", marginBottom: 8 },
  quotaHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  quotaNum: { color: C.ink, fontSize: 15, fontWeight: "700" },
  quotaBar: { flexDirection: "row", gap: 6, marginTop: 2 },
  quotaSeg: { flex: 1, height: 10, borderRadius: 5, backgroundColor: "#DCE6F5" },
  quotaSub: { color: C.text2, fontSize: 13, marginTop: 8 },
  lateBanner: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: C.errorBg },
  lateText: { flex: 1, color: C.errorInk, fontSize: 13, fontWeight: "600" },

  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 10 },
  sectionTitle: { color: C.ink, fontSize: 16, fontWeight: "700" },
  viewAll: { color: C.primaryDark, fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 20 },
  emptyText: { color: C.text2, fontSize: 14 },
  scanBtn: { ...W.primary, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, height: 40, marginTop: 4 },
  scanBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  loanCard: { ...W.card, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 10 },
  loanName: { color: C.ink, fontSize: 15, fontWeight: "700" },
  loanSub: { color: C.text2, fontSize: 12, marginTop: 1 },
  duePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  dueText: { fontSize: 12, fontWeight: "700" },

  rule: { flexDirection: "row", gap: 10, marginTop: 6 },
  ruleText: { flex: 1, color: C.text2, fontSize: 13, lineHeight: 20 },

  menu: { ...W.card, paddingVertical: 4, marginTop: 6 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  menuTitle: { flex: 1, color: C.ink, fontSize: 15, fontWeight: "600" },
  version: { textAlign: "center", color: C.faint, fontSize: 12, marginTop: 16 },
});
