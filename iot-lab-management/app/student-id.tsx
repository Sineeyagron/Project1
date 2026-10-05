import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, TextInput } from "../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";
import { currentUser } from "../lib/session";
import { confirmAction, notify } from "../lib/notify";
import { C, W, iconDot } from "../lib/theme";

// กรอกรหัสนักศึกษาครั้งแรก (บังคับก่อนใช้งาน — หน้าแรกพามาที่นี่ถ้ายังไม่มี)
// อาจารย์/ผู้ดูแลเห็นรหัสคู่กับชื่อในคำขอยืม-คืน ไม่ต้องไปไล่หาจากอีเมล
// รูปแบบ มข.: 9 หลัก-1 หลัก (เช่น 633021098-9) / ตั้งได้ครั้งเดียว แก้ภายหลัง = ผู้ดูแล (กันที่ trigger profiles_protect)

// พิมพ์ตัวเลขล้วน → ใส่ขีดให้เองหลังหลักที่ 9
function formatId(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  return digits.length > 9 ? `${digits.slice(0, 9)}-${digits.slice(9)}` : digits;
}
const VALID = /^[0-9]{9}-[0-9]$/;

export default function StudentIdScreen() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const valid = VALID.test(value);

  const save = () => {
    if (!valid) return;
    confirmAction(
      `รหัส ${value} ถูกต้องไหม?`,
      "บันทึกแล้วแก้เองไม่ได้ ถ้าผิดต้องติดต่อผู้ดูแล",
      "ถูกต้อง บันทึก",
      async () => {
        setSaving(true);
        const user = await currentUser();
        if (!user) {
          setSaving(false);
          router.replace("/login");
          return;
        }
        const { data, error } = await supabase.from("profiles").update({ student_id: value }).eq("id", user.id).select("id");
        setSaving(false);
        if (error) {
          if (error.code === "23505") notify("รหัสนี้มีคนใช้แล้ว", "ถ้าเป็นรหัสของคุณจริง ติดต่อผู้ดูแลห้องแล็บเพื่อตรวจสอบ");
          else if (error.code === "23514") notify("รูปแบบรหัสไม่ถูกต้อง", "ต้องเป็นเลข 9 หลัก ขีด แล้วเลข 1 หลัก เช่น 633021098-9");
          else notify("บันทึกไม่สำเร็จ", error.message);
          return;
        }
        if (!data || data.length === 0) {
          notify("บันทึกไม่สำเร็จ", "ลองออกจากระบบแล้วเข้าใหม่อีกครั้ง");
          return;
        }
        router.replace("/home");
      }
    );
  };

  const logout = () => {
    confirmAction("ออกจากระบบ", "ต้องการออกจากระบบหรือไม่?", "ออกจากระบบ", async () => {
      await supabase.auth.signOut();
      router.replace("/login");
    }, true);
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.hero}>
          <View style={iconDot(C.primary, 64)}>
            <Ionicons name="id-card-outline" size={30} color="#FFFFFF" />
          </View>
          <Text style={s.title}>กรอกรหัสนักศึกษา</Text>
          <Text style={s.sub}>
            ใช้ครั้งเดียวตอนเริ่มใช้งาน ผู้ดูแลห้องแล็บจะเห็นรหัสนี้คู่กับชื่อของคุณ เวลาติดต่อเรื่องการยืม-คืนอุปกรณ์
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>รหัสนักศึกษา</Text>
          <TextInput
            style={[s.input, value.length > 0 && !valid && s.inputWarn]}
            value={value}
            onChangeText={(t) => setValue(formatId(t))}
            placeholder="633021098-9"
            placeholderTextColor={C.faint}
            keyboardType="number-pad"
            maxLength={11}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
            accessibilityLabel="รหัสนักศึกษา"
          />
          <Text style={s.hint}>
            {value.length === 0
              ? "พิมพ์ตัวเลข 10 หลัก ระบบใส่ขีดให้เอง"
              : valid
              ? "รูปแบบถูกต้อง"
              : `อีก ${10 - value.replace(/\D/g, "").length} หลัก`}
          </Text>

          <TouchableOpacity
            style={[s.primaryBtn, (!valid || saving) && { opacity: 0.45 }]}
            onPress={save}
            disabled={!valid || saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>บันทึกรหัสนักศึกษา</Text>}
          </TouchableOpacity>

          <View style={s.note}>
            <Ionicons name="lock-closed-outline" size={14} color={C.text2} />
            <Text style={s.noteText}>บันทึกแล้วแก้เองไม่ได้ ตรวจให้ถูกก่อนกดบันทึก</Text>
          </View>
        </View>

        <TouchableOpacity onPress={logout} style={s.logout} activeOpacity={0.8}>
          <Text style={s.logoutText}>ไม่ใช่บัญชีของคุณ? ออกจากระบบ</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { ...W.page },
  body: { flexGrow: 1, justifyContent: "center", padding: 20, paddingTop: 72, paddingBottom: 40 },
  hero: { alignItems: "center", gap: 10, marginBottom: 22 },
  title: { color: C.ink, fontSize: 24, fontWeight: "700", marginTop: 6 },
  sub: { color: C.text2, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 320 },
  card: { ...W.card, padding: 18, gap: 10 },
  label: { color: C.ink, fontSize: 14, fontWeight: "600" },
  input: {
    ...(W.input as any),
    height: 56,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
    color: C.ink,
  },
  inputWarn: { borderColor: "#F59E0B" },
  hint: { color: C.text2, fontSize: 12, textAlign: "center" },
  primaryBtn: { ...W.primary, height: 52, alignItems: "center", justifyContent: "center", marginTop: 6 },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  note: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 },
  noteText: { color: C.text2, fontSize: 12 },
  logout: { alignSelf: "center", marginTop: 22, padding: 8 },
  logoutText: { color: C.primaryDark, fontSize: 13, fontWeight: "600" },
});
