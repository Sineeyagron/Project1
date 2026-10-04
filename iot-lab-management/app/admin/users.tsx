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
import SearchBar from "../../components/SearchBar";
import { Text, TextInput } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";
import { goBack } from "../../lib/nav";
import { confirmAction, notify } from "../../lib/notify";
import { useRole } from "../../lib/roles";
import { W } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";

// จัดการผู้ใช้: รหัสนักศึกษา (admin แก้ให้ได้ ตอน นศ. กรอกผิด — นศ. ตั้งเองได้ครั้งเดียว) + แต่งตั้ง TA
// จัดการ TA (เฟส 4.1) — admin เท่านั้น (ด่านใน _layout + RPC set_user_role ตรวจซ้ำในฐานข้อมูล)
// แต่งตั้ง/ถอดได้แค่ ผู้ใช้ ↔ TA / ตั้ง admin หรือแตะบัญชี admin ในแอปไม่ได้ / เปลี่ยนสิทธิ์ตัวเองไม่ได้

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

// พิมพ์ตัวเลขล้วน → ใส่ขีดให้เองหลังหลักที่ 9 (รูปแบบ มข. 633021098-9)
const formatId = (raw: string) => {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  return d.length > 9 ? `${d.slice(0, 9)}-${d.slice(9)}` : d;
};

const CAN = ["อนุมัติ / ปฏิเสธคำขอยืม คืน ยืมต่อ", "ตรวจสภาพตอนคืน + ตรวจประจำเทอม", "สแกนดูสถานะ ประวัติ รายงานสต็อก", "พิมพ์ป้าย QR"];
const CANNOT = ["เพิ่ม / แก้ / จำหน่ายอุปกรณ์ แก้ประกัน", "หมวดหมู่ ตั้งค่าระบบ แต่งตั้ง TA", "อนุมัติคำขอของตัวเอง"];

export default function ManageTA() {
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
    const { data, error } = await supabase.from("profiles").select("id, email, role, full_name, student_id").order("email");
    if (error) notify("โหลดรายชื่อไม่สำเร็จ", error.message);
    setPeople((data || []) as Profile[]);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  const setRole = (p: Profile, role: "ta" | "user") => {
    const email = p.email || "(ไม่มีอีเมล)";
    confirmAction(
      role === "ta" ? "แต่งตั้งเป็น TA?" : "ถอดสิทธิ์ TA?",
      role === "ta"
        ? `${email}\n\nจะอนุมัติคำขอ ตรวจสภาพ ดูรายงาน และพิมพ์ป้าย QR ได้ (เจ้าตัวได้แจ้งเตือน กดแล้วเข้าเมนู TA ได้เลย)`
        : `${email}\n\nจะกลับเป็นผู้ใช้ทั่วไป ใช้เมนู TA ไม่ได้อีก`,
      role === "ta" ? "แต่งตั้ง" : "ถอดสิทธิ์",
      async () => {
        setBusyId(p.id);
        const { error } = await supabase.rpc("set_user_role", { p_user: p.id, p_role: role });
        setBusyId(null);
        if (error) {
          notify("เปลี่ยนสิทธิ์ไม่สำเร็จ", error.message);
          return;
        }
        notify(role === "ta" ? "แต่งตั้งแล้ว" : "ถอดสิทธิ์แล้ว", `${email} ได้รับแจ้งเตือนในแอปแล้ว`);
        load();
      },
      role === "user"
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
    .slice(0, 30);

  const Person = ({ p, action }: { p: Profile; action?: React.ReactNode }) => (
    <View style={s.person}>
      <View style={[s.avatar, p.role === "ta" && s.avatarTa, p.role === "admin" && s.avatarAdmin]}>
        <Text style={s.avatarText}>{(p.email || "?").charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.email} numberOfLines={1}>{p.full_name || p.email || "(ไม่มีอีเมล)"}</Text>
        <Text style={s.sub} numberOfLines={1}>
          {[p.student_id || (p.role === "user" ? "ยังไม่กรอกรหัส" : null), p.full_name ? p.email : null].filter(Boolean).join(" · ")}
        </Text>
        {p.id === userId && <Text style={s.you}>บัญชีของคุณ</Text>}
      </View>
      {busyId === p.id ? <ActivityIndicator color={C.purple} /> : action}
    </View>
  );

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader
        title={"จัดการผู้ใช้"}
        subtitle={"รหัสนักศึกษา · แต่งตั้ง TA"}
        onBack={() => goBack("/admin/home")}
      />

      {loading ? (
        <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 44 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.purple} />}
        >
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

          <Text style={s.section}>TA ตอนนี้ ({tas.length})</Text>
          <View style={s.card}>
            {tas.length === 0 && <Text style={s.empty}>ยังไม่มี TA — ค้นหาอีเมลด้านล่างเพื่อแต่งตั้ง</Text>}
            {tas.map((p) => (
              <Person
                key={p.id}
                p={p}
                action={
                  <TouchableOpacity style={s.removeBtn} onPress={() => setRole(p, "user")} disabled={!!busyId} activeOpacity={0.8}>
                    <Text style={s.removeText}>ถอดสิทธิ์</Text>
                  </TouchableOpacity>
                }
              />
            ))}
          </View>

          <Text style={s.section}>นักศึกษา</Text>
          <View style={s.card}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="ค้นหาชื่อ อีเมล หรือรหัส นศ." style={{ marginBottom: 6 }} />
            {candidates.length === 0 && (
              <Text style={s.empty}>{q ? "ไม่พบผู้ใช้นี้ (ต้องสมัครแอปก่อน)" : "ยังไม่มีผู้ใช้"}</Text>
            )}
            {candidates.map((p) => (
              <View key={p.id}>
                <Person
                  p={p}
                  action={
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <TouchableOpacity
                        style={s.editBtn}
                        onPress={() => { setEditId(editId === p.id ? null : p.id); setEditValue(p.student_id || ""); }}
                        disabled={!!busyId}
                        activeOpacity={0.8}
                        accessibilityLabel="แก้รหัสนักศึกษา"
                      >
                        <Ionicons name="create-outline" size={16} color={C.purple} />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.addBtn} onPress={() => setRole(p, "ta")} disabled={!!busyId} activeOpacity={0.8}>
                        <Ionicons name="person-add-outline" size={15} color="#fff" />
                        <Text style={s.addText}>TA</Text>
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

          <Text style={s.section}>ผู้ดูแลระบบ ({admins.length})</Text>
          <View style={s.card}>
            {admins.map((p) => <Person key={p.id} p={p} />)}
            <Text style={s.hint}>เพิ่ม/ถอดผู้ดูแลระบบ (admin) ทำในแอปไม่ได้ เพื่อความปลอดภัย</Text>
          </View>
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
  removeBtn: {
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 40,
    justifyContent: "center",
  },
  removeText: { color: C.red, fontSize: 13.5, fontWeight: "800" },
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
