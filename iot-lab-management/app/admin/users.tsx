import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import SearchBar from "../../components/SearchBar";
import { Text, TextInput } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";
import { goBack } from "../../lib/nav";
import { confirmAction, notify, pickOption } from "../../lib/notify";
import { isStaffEmail } from "../../lib/googleAuth";
import { useRole } from "../../lib/roles";
import { W, TOP_INSET } from "../../lib/theme";
import { desktopBody, useIsDesktop } from "../../lib/layout";
import ScreenHeader from "../../components/ScreenHeader";
import { isMissingColumn } from "../../lib/people";
import LoadingState from "../../components/LoadingState";

// จัดการผู้ใช้: รหัสนักศึกษา (admin แก้ให้ได้ ตอน นศ. กรอกผิด — นศ. ตั้งเองได้ครั้งเดียว) + ตั้งสิทธิ์ ผู้ใช้ / TA / admin
// admin เท่านั้น (ด่านใน _layout + RPC set_user_role ตรวจซ้ำในฐานข้อมูล: เปลี่ยนสิทธิ์ตัวเองไม่ได้ / ต้องเหลือ admin ≥ 1 คน)
// บุคลากร มข. (@kku.ac.th — ทุกคณะ) เข้าครั้งแรกเป็นผู้ใช้ทั่วไป ไม่มีรหัส นศ. → admin ตั้งสิทธิ์ให้เองทีละคน

const C = {
  bg: "#EAF1FC",
  purple: "#2563EB",
  ink: "#172033",
  muted: "#475569",
  faint: "#64748B",
  line: "#DCE6F5",
  green: "#047857",
  red: "#dc2626",
};

type Profile = { id: string; email: string | null; role: string; full_name: string | null; student_id: string | null };

// เรียงตามชื่อที่ตั้ง: อังกฤษ A-Z ก่อน แล้วไทย ก-ฮ (ตัวเรียงภาษาไทยปกติเอาไทยขึ้นก่อน → แยกกลุ่มเอง)
//   ยังไม่ตั้งชื่อ → ไว้ท้ายสุด เรียงตามอีเมล
const nameCollator = new Intl.Collator("th", { sensitivity: "base", numeric: true });
const nameGroup = (name: string) => (!name ? 2 : /^[A-Za-z]/.test(name) ? 0 : 1);
const sortByName = (list: Profile[]) =>
  list.slice().sort((a, b) => {
    const na = (a.full_name || "").trim();
    const nb = (b.full_name || "").trim();
    return nameGroup(na) - nameGroup(nb)
      || nameCollator.compare(na, nb)
      || nameCollator.compare(a.email || "", b.email || "");
  });

// ตัวอักษรในวงกลม: ตัวแรกของชื่อ (ไม่มีชื่อ = ตัวแรกของอีเมล) · ไทยขึ้นต้นสระหน้า (เ แ โ ใ ไ) เอาพยัญชนะตามมาด้วย เช่น "เอ"
const initial = (p: Profile) => {
  const src = (p.full_name || "").trim() || p.email || "?";
  return (/^[เแโใไ]/.test(src) ? src.slice(0, 2) : src.charAt(0)).toUpperCase();
};

// พิมพ์ตัวเลขล้วน → ใส่ขีดให้เองหลังหลักที่ 9 (รูปแบบ มข. 633021098-9)
const formatId = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  return d.length > 9 ? `${d.slice(0, 9)}-${d.slice(9)}` : d;
};

type Role = "user" | "ta" | "admin";
const ROLES: Role[] = ["user", "ta", "admin"];
const ROLE_NAME: Record<Role, string> = { user: "ผู้ใช้ทั่วไป", ta: "TA (ผู้ช่วย)", admin: "ผู้ดูแลระบบ (admin)" };

const CAN = ["อนุมัติ / ปฏิเสธคำขอยืม คืน ยืมต่อ", "ตรวจสภาพตอนคืน + ตรวจประจำเทอม", "สแกนดูสถานะ ประวัติ รายงานสต็อก", "พิมพ์ป้าย QR"];
const CANNOT = ["เพิ่ม / แก้ / จำหน่ายอุปกรณ์ แก้ประกัน", "หมวดหมู่ ตั้งค่าระบบ แต่งตั้ง TA", "อนุมัติคำขอของตัวเอง"];

export default function ManageTA() {
  const isDesktop = useIsDesktop(); // เว็บจอใหญ่ → 2 คอลัมน์
  const router = useRouter();
  const { userId } = useRole();
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const load = async () => {
    let { data, error } = await supabase.from("profiles").select("id, email, role, full_name, student_id").order("email");
    // ยังไม่ได้รัน migration profile_student_id → ไม่มีคอลัมน์ชื่อ/รหัส: ดึงแบบเดิมให้หน้ายังใช้ได้
    if (error && isMissingColumn(error)) ({ data, error } = await supabase.from("profiles").select("id, email, role").order("email") as any);
    if (error) notify("โหลดรายชื่อไม่สำเร็จ", error.message);
    setPeople(sortByName((data || []) as Profile[]));
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setRole = (p: Profile, role: Role) => {
    const email = p.email || "(ไม่มีอีเมล)";
    const from = p.role as Role;
    const ask =
      role === "admin"
        ? {
            title: "ตั้งเป็นผู้ดูแลระบบ?",
            body: `${email}\n\nจะทำได้ทุกอย่างเหมือนคุณ: แก้อุปกรณ์ ตั้งค่าระบบ ระบบห้องคอม และตั้ง/ถอดสิทธิ์คนอื่น (เจ้าตัวได้แจ้งเตือนในแอป)` +
              (isStaffEmail(p.email) ? "\n\n⚠ @kku.ac.th เป็นอีเมลของบุคลากร มข. ทุกคณะ ตรวจให้แน่ใจว่าเป็นอาจารย์/เจ้าหน้าที่ของแล็บจริง" : ""),
            ok: "ตั้งเป็นผู้ดูแล",
          }
        : role === "ta"
        ? {
            title: from === "admin" ? "ลดเป็น TA?" : "แต่งตั้งเป็น TA?",
            body: `${email}\n\nจะอนุมัติคำขอ ตรวจสภาพ ดูรายงาน และพิมพ์ป้าย QR ได้` +
              (from === "admin" ? " แต่แก้อุปกรณ์ ตั้งค่าระบบ และสิทธิ์ผู้ใช้ไม่ได้อีก" : " (เจ้าตัวได้แจ้งเตือน กดแล้วเข้าเมนู TA ได้เลย)"),
            ok: from === "admin" ? "ลดเป็น TA" : "แต่งตั้ง",
          }
        : {
            title: from === "admin" ? "ถอดสิทธิ์ผู้ดูแลระบบ?" : "ถอดสิทธิ์ TA?",
            body: `${email}\n\nจะกลับเป็นผู้ใช้ทั่วไป ใช้เมนูผู้ดูแลไม่ได้อีก`,
            ok: "ถอดสิทธิ์",
          };
    // ลดสิทธิ์ / ให้สิทธิ์สูงสุด = ปุ่มยืนยันสีแดง
    const danger = role === "admin" || ROLES.indexOf(role) < ROLES.indexOf(from);
    confirmAction(
      ask.title,
      ask.body,
      ask.ok,
      async () => {
        setBusyId(p.id);
        const { error } = await supabase.rpc("set_user_role", { p_user: p.id, p_role: role });
        setBusyId(null);
        if (error) {
          notify("เปลี่ยนสิทธิ์ไม่สำเร็จ", error.message);
          return;
        }
        notify("เปลี่ยนสิทธิ์แล้ว", `${email} เป็น${ROLE_NAME[role]} — ได้รับแจ้งเตือนในแอปแล้ว`);
        load();
      },
      danger
    );
  };

  // เลือกระดับสิทธิ์ (แผ่นล่างจอ) → ป๊อปอัปยืนยัน · ระดับปัจจุบันมี ✓ เลือกซ้ำ = ไม่ทำอะไร
  const pickRole = (p: Profile) => {
    const current = ROLES.indexOf(p.role as Role);
    pickOption(
      `ตั้งสิทธิ์ ${p.full_name || p.email || ""}`,
      ROLES.map((r) => ROLE_NAME[r]),
      (i) => { if (i !== current) setRole(p, ROLES[i]); },
      current
    );
  };

  // แก้รหัส นศ. (admin) — เว้นว่าง = ล้างรหัส ให้ นศ. กรอกใหม่เอง
  const saveStudentId = async (p: Profile) => {
    const value = editValue.trim();
    if (value && !/^[0-9]{9}-[0-9]$/.test(value)) {
      notify("รูปแบบรหัสไม่ถูกต้อง", "ต้องเป็นเลข 9 หลัก ขีด แล้วเลข 1 หลัก เช่น 633021098-9");
      return;
    }
    setBusyId(p.id);
    const { data, error } = await supabase.from("profiles").update({ student_id: value || null }).eq("id", p.id).select("id");
    setBusyId(null);
    if (error) {
      notify("บันทึกไม่สำเร็จ", error.code === "23505" ? "รหัสนี้เป็นของบัญชีอื่นอยู่แล้ว" : error.message);
      return;
    }
    if (!data || data.length === 0) {
      notify("บันทึกไม่สำเร็จ", "ไม่มีสิทธิ์แก้บัญชีนี้");
      return;
    }
    setEditId(null);
    load();
  };

  const tas = people.filter((p) => p.role === "ta");
  const admins = people.filter((p) => p.role === "admin");
  const q = query.trim().toLowerCase();
  const candidates = people
    .filter((p) => p.role === "user" && (!q || [p.email, p.full_name, p.student_id].some((v) => (v || "").toLowerCase().includes(q))))
    .slice(0, isDesktop ? 200 : 30); // จอใหญ่แสดงได้มากกว่า

  const Person = ({ p, action }: { p: Profile; action?: React.ReactNode }) => (
    <View style={s.person}>
      <View style={[s.avatar, p.role === "ta" && s.avatarTa, p.role === "admin" && s.avatarAdmin]}>
        <Text style={s.avatarText}>{initial(p)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={s.nameRow}>
          <Text style={[s.email, { flexShrink: 1 }]} numberOfLines={1}>{p.full_name || p.email || "(ไม่มีอีเมล)"}</Text>
          {isStaffEmail(p.email) && <Text style={s.staffBadge} numberOfLines={1}>บุคลากร มข.</Text>}
        </View>
        <Text style={s.sub} numberOfLines={1}>
          {[p.student_id || (p.role === "user" && !isStaffEmail(p.email) ? "ยังไม่กรอกรหัส" : null), p.full_name ? p.email : null].filter(Boolean).join(" · ")}
        </Text>
        {p.id === userId && <Text style={s.you}>บัญชีของคุณ</Text>}
      </View>
      {busyId === p.id ? <ActivityIndicator color={C.purple} /> : action}
    </View>
  );

  // บล็อกของหน้า (ใช้ทั้งมือถือและจอใหญ่ — จอใหญ่แค่จัดเป็น 2 คอลัมน์)
  const rulesBlock = (
    <>
        <View style={s.card}>
          <Text style={s.cardTitle}>TA ทำอะไรได้บ้าง</Text>
          {CAN.map((t) => (
            <View key={t} style={s.ruleRow}>
              <Ionicons name="checkmark-circle" size={16} color={C.green} />
              <Text style={s.ruleText}>{t}</Text>
            </View>
          ))}
          {CANNOT.map((t) => (
            <View key={t} style={s.ruleRow}>
              <Ionicons name="close-circle" size={16} color={C.red} />
              <Text style={[s.ruleText, { color: C.muted }]}>{t}</Text>
            </View>
          ))}
        </View>
    </>
  );
  const taBlock = (
    <>
        <Text style={s.section}>TA ตอนนี้ ({tas.length})</Text>
        <View style={s.card}>
          {tas.length === 0 && <Text style={s.empty}>ยังไม่มี TA — ค้นหาอีเมลด้านล่างเพื่อแต่งตั้ง</Text>}
          {tas.map((p) => (
            <Person
              key={p.id}
              p={p}
              action={
                <TouchableOpacity style={s.roleBtn} onPress={() => pickRole(p)} disabled={!!busyId} activeOpacity={0.8}>
                  <Text style={s.roleText}>ตั้งสิทธิ์</Text>
                  <Ionicons name="chevron-down" size={14} color={C.purple} />
                </TouchableOpacity>
              }
            />
          ))}
        </View>
    </>
  );
  const studentBlock = (
    <>
        <Text style={s.section}>นักศึกษา / บุคลากร</Text>
        <View style={s.card}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="ค้นหาชื่อ อีเมล หรือรหัส นศ." style={{ marginBottom: 6 }} />
          {candidates.length === 0 && (
            <Text style={s.empty}>{q ? "ไม่พบผู้ใช้นี้ (ต้องเข้าสู่ระบบแอปครั้งแรกก่อน)" : "ยังไม่มีผู้ใช้"}</Text>
          )}
          {candidates.map((p) => (
            <View key={p.id}>
              <Person
                p={p}
                action={
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {/* บุคลากร มข. ไม่มีรหัส นศ. → ไม่มีปุ่มแก้รหัส */}
                    {!isStaffEmail(p.email) && (
                      <TouchableOpacity
                        style={s.editBtn}
                        onPress={() => { setEditId(editId === p.id ? null : p.id); setEditValue(p.student_id || ""); }}
                        disabled={!!busyId}
                        activeOpacity={0.8}
                        accessibilityLabel="แก้รหัสนักศึกษา"
                      >
                        <Ionicons name="create-outline" size={16} color={C.purple} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={s.addBtn} onPress={() => pickRole(p)} disabled={!!busyId} activeOpacity={0.8}>
                      <Ionicons name="person-add-outline" size={15} color="#fff" />
                      <Text style={s.addText}>ตั้งสิทธิ์</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
              {editId === p.id && (
                <View style={s.editRow}>
                  <TextInput
                    style={s.editInput}
                    value={editValue}
                    onChangeText={(t) => setEditValue(formatId(t))}
                    placeholder="633021098-9 (ว่าง = ล้าง)"
                    placeholderTextColor={C.faint}
                    keyboardType="number-pad"
                    maxLength={11}
                    autoFocus
                  />
                  <TouchableOpacity style={s.saveBtn} onPress={() => saveStudentId(p)} disabled={!!busyId} activeOpacity={0.8}>
                    <Text style={s.addText}>บันทึก</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
    </>
  );
  const adminBlock = (
    <>
        <Text style={s.section}>ผู้ดูแลระบบ ({admins.length})</Text>
        <View style={s.card}>
          {admins.map((p) => (
            <Person
              key={p.id}
              p={p}
              action={
                p.id === userId ? undefined : (
                <TouchableOpacity style={s.roleBtn} onPress={() => pickRole(p)} disabled={!!busyId} activeOpacity={0.8}>
                  <Text style={s.roleText}>ตั้งสิทธิ์</Text>
                  <Ionicons name="chevron-down" size={14} color={C.purple} />
                </TouchableOpacity>
                )
              }
            />
          ))}
          <Text style={s.hint}>เปลี่ยนสิทธิ์ตัวเองไม่ได้ · ต้องมีผู้ดูแลระบบอย่างน้อย 1 คนเสมอ</Text>
        </View>
    </>
  );

  return (
    <View style={s.container}>
      <ScreenHeader
        title={"จัดการผู้ใช้"}
        subtitle={"รหัสนักศึกษา · ตั้งสิทธิ์ TA / ผู้ดูแล"}
        onBack={() => goBack("/admin/home")}
      />

      {loading ? (
        <LoadingState style={{ marginTop: 44 }} />
      ) : (
        <KeyboardAwareScrollView bottomOffset={24}
          contentContainerStyle={[s.body, isDesktop && desktopBody.wide]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.purple} />}
        >
          {isDesktop ? (
            // จอใหญ่: ซ้าย = นักศึกษา (ค้นหา/แก้รหัส/ตั้ง TA) · ขวา = TA ตอนนี้ + สิทธิ์ TA + ผู้ดูแลระบบ
            <View style={s.cols}>
              <View style={s.colMain}>{studentBlock}</View>
              <View style={s.colSide}>{taBlock}{rulesBlock}{adminBlock}</View>
            </View>
          ) : (
            <>
              {rulesBlock}
              {taBlock}
              {studentBlock}
              {adminBlock}
            </>
          )}
        </KeyboardAwareScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  // จอใหญ่
  cols: { flexDirection: "row", gap: 18, alignItems: "flex-start", width: "100%", maxWidth: 1180, alignSelf: "center" },
  colMain: { flex: 1.5, gap: 8, minWidth: 0 },
  colSide: { flex: 1, gap: 8, minWidth: 0 },
  container: { ...W.page, flex: 1 },
  header: { ...W.headerBar,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: TOP_INSET,
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
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  card: { ...W.card, padding: 14, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "900", color: C.ink, marginBottom: 2 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ruleText: { fontSize: 13.5, color: C.ink, flex: 1 },
  section: { fontSize: 15, fontWeight: "900", color: C.ink, marginTop: 8 },
  person: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#DCE6F5", alignItems: "center", justifyContent: "center" },
  avatarTa: { backgroundColor: "#DBEAFE" },
  avatarAdmin: { backgroundColor: "#fee2e2" },
  avatarText: { fontSize: 15, fontWeight: "900", color: C.ink },
  email: { fontSize: 14.5, fontWeight: "700", color: C.ink },
  you: { fontSize: 12, color: C.purple, fontWeight: "700" },
  addBtn: {
    ...W.primarySolid,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 15,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  addText: { color: "#fff", fontSize: 13.5, fontWeight: "800" },
  roleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  roleText: { color: C.purple, fontSize: 13.5, fontWeight: "800" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  staffBadge: { flexShrink: 0, fontSize: 11, fontWeight: "800", color: "#7C3AED", backgroundColor: "#F3E8FF", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: C.ink },
  empty: { fontSize: 13, color: C.faint, paddingVertical: 6 },
  hint: { fontSize: 12, color: C.faint, marginTop: 4 },
  sub: { fontSize: 12, color: C.muted, marginTop: 1 },
  editBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#DBEAFE" },
  editRow: { flexDirection: "row", gap: 8, paddingLeft: 52, paddingBottom: 10 },
  editInput: { flex: 1, height: 40, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: "#FFFFFF", paddingHorizontal: 12, fontSize: 15, color: C.ink },
  saveBtn: { height: 40, borderRadius: 12, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.purple },
});
