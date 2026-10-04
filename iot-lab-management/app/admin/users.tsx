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
import { goBack } from "../../lib/nav";
import { confirmAction, notify } from "../../lib/notify";
import { useRole } from "../../lib/roles";
import { W } from "../../lib/theme";

// จัดการ TA (เฟส 4.1) — admin เท่านั้น (ด่านใน _layout + RPC set_user_role ตรวจซ้ำในฐานข้อมูล)
// แต่งตั้ง/ถอดได้แค่ ผู้ใช้ ↔ TA / ตั้ง admin หรือแตะบัญชี admin ในแอปไม่ได้ / เปลี่ยนสิทธิ์ตัวเองไม่ได้

const C = {
  bg: "#EAF1FC",
  purple: "#2563EB",
  ink: "#172033",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#DCE6F5",
  green: "#047857",
  red: "#dc2626",
};

type Profile = { id: string; email: string | null; role: string };

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

  const load = async () => {
    const { data, error } = await supabase.from("profiles").select("id, email, role").order("email");
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

  const tas = people.filter((p) => p.role === "ta");
  const admins = people.filter((p) => p.role === "admin");
  const q = query.trim().toLowerCase();
  const candidates = people
    .filter((p) => p.role === "user" && (!q || (p.email || "").toLowerCase().includes(q)))
    .slice(0, 30);

  const Person = ({ p, action }: { p: Profile; action?: React.ReactNode }) => (
    <View style={s.person}>
      <View style={[s.avatar, p.role === "ta" && s.avatarTa, p.role === "admin" && s.avatarAdmin]}>
        <Text style={s.avatarText}>{(p.email || "?").charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.email} numberOfLines={1}>{p.email || "(ไม่มีอีเมล)"}</Text>
        {p.id === userId && <Text style={s.you}>บัญชีของคุณ</Text>}
      </View>
      {busyId === p.id ? <ActivityIndicator color={C.purple} /> : action}
    </View>
  );

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => goBack("/admin/home")} activeOpacity={0.82}>
          <Ionicons name="chevron-back" size={22} color="#172033" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>จัดการ TA</Text>
          <Text style={s.headerSub}>แต่งตั้ง / ถอดผู้ช่วยดูแลการยืมคืน</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 44 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
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

          <Text style={s.section}>แต่งตั้ง TA</Text>
          <View style={s.card}>
            <View style={s.searchWrap}>
              <Ionicons name="search-outline" size={18} color={C.faint} />
              <TextInput
                style={s.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="ค้นหาอีเมลนักศึกษา"
                placeholderTextColor={C.faint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              {!!query && (
                <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={C.faint} />
                </TouchableOpacity>
              )}
            </View>
            {candidates.length === 0 && (
              <Text style={s.empty}>{q ? "ไม่พบอีเมลนี้ (ต้องสมัครแอปก่อน)" : "ยังไม่มีผู้ใช้"}</Text>
            )}
            {candidates.map((p) => (
              <Person
                key={p.id}
                p={p}
                action={
                  <TouchableOpacity style={s.addBtn} onPress={() => setRole(p, "ta")} disabled={!!busyId} activeOpacity={0.8}>
                    <Ionicons name="person-add-outline" size={15} color="#fff" />
                    <Text style={s.addText}>ตั้งเป็น TA</Text>
                  </TouchableOpacity>
                }
              />
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
  header: {
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
});
