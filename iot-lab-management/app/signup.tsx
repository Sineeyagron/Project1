import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";
import { goBack } from "../lib/nav";
import { notify } from "../lib/notify";
import { authErrorThai, PASSWORD_HINT, passwordProblem } from "../lib/password";
import { W } from "../lib/theme";

export default function Signup() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    !passwordProblem(password) &&
    !isLoading;

  // Alert.alert ใช้ไม่ได้บนเว็บ → notify / กติการหัสผ่านตรงกับ Supabase (lib/password.ts)
  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      notify("กรอกข้อมูลให้ครบ", "กรุณากรอกชื่อ อีเมล และรหัสผ่านก่อนสมัคร");
      return;
    }
    const problem = passwordProblem(password);
    if (problem) {
      notify("รหัสผ่านยังไม่ผ่านเกณฑ์", problem);
      return;
    }

    setIsLoading(true);
    // โปรไฟล์ (บทบาทนักศึกษา) ฐานข้อมูลสร้างให้เอง (trigger handle_new_user) — ชื่อเก็บไว้ในข้อมูลบัญชี
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    setIsLoading(false);

    if (error) {
      notify("สมัครไม่สำเร็จ", authErrorThai(error.message));
      return;
    }
    if (!data?.user?.id) {
      notify("สมัครไม่สำเร็จ", "ลองใหม่อีกครั้ง");
      return;
    }
    // เปิด "ยืนยันอีเมล" ไว้ + อีเมลซ้ำ: Supabase ไม่ส่ง error (กันเดาอีเมล) แต่ identities ว่าง
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      notify("สมัครไม่สำเร็จ", "อีเมลนี้ถูกใช้สมัครไปแล้ว — เข้าสู่ระบบ หรือกด \"ลืมรหัสผ่าน\"");
      return;
    }

    if (data.session) {
      // ระบบยืนยันอีเมลอัตโนมัติ (ค่าปัจจุบัน) → ล็อกอินแล้ว เข้าแอปได้เลย (บัญชีใหม่ = นักศึกษา)
      notify("สมัครสำเร็จ", "ยินดีต้อนรับสู่ LabHub", () => router.replace("/home"));
    } else {
      notify("สมัครสำเร็จ", "กรุณายืนยันอีเมลจากลิงก์ที่ส่งไป แล้วเข้าสู่ระบบ", () => router.replace("/login"));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBack("/login")} disabled={isLoading}>
          <Ionicons name="chevron-back" size={23} color="#172033" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>สมัครสมาชิก</Text>
          <Text style={styles.headerSub}>เข้าร่วมชุมชน LabHub</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>สร้างบัญชีใหม่</Text>
          <Text style={styles.desc}>กรอกข้อมูลให้ครบเพื่อเริ่มใช้งาน</Text>

          <Text style={styles.label}>ชื่อ-นามสกุล</Text>
          <View style={styles.inputBox}>
            <Ionicons name="person-outline" size={20} color="#64748b" />
            <TextInput
              placeholder="ชื่อจริง นามสกุล"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              textContentType="name"
            />
          </View>

          <Text style={styles.label}>อีเมล</Text>
          <View style={styles.inputBox}>
            <Ionicons name="mail-outline" size={20} color="#64748b" />
            <TextInput
              placeholder="example@email.com"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          <Text style={styles.label}>รหัสผ่าน</Text>
          <View style={styles.inputBox}>
            <Ionicons name="lock-closed-outline" size={20} color="#64748b" />
            <TextInput
              placeholder={PASSWORD_HINT}
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              textContentType="newPassword"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#64748b"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.termsRow}>
            <Ionicons name="shield-checkmark-outline" size={17} color="#047857" />
            <Text style={styles.termsText}>
              เมื่อสมัครคุณยอมรับ <Text style={styles.termsLink}>เงื่อนไขการใช้งาน</Text> ของห้องแล็บ
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && styles.disabledBtn]}
            onPress={handleSignup}
            disabled={!canSubmit}
            activeOpacity={0.88}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>สมัครและเข้าใช้งาน</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>มีบัญชีอยู่แล้ว?</Text>
          <TouchableOpacity onPress={() => router.replace("/login")} disabled={isLoading}>
            <Text style={styles.footerLink}>เข้าสู่ระบบ</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...W.page,
    flex: 1,
  },
  header: {
    minHeight: 88,
    paddingTop: 10,
    paddingHorizontal: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    ...W.iconBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#172033",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
  },
  headerSub: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 5,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 28,
  },
  card: {
    ...W.card,
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
  },
  title: {
    color: "#1e293b",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  desc: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 14,
  },
  label: {
    color: "#1D4ED8",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  inputBox: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#DCE6F5",
    borderRadius: 12,
    paddingHorizontal: 13,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    color: "#172033",
    fontSize: 15,
    paddingVertical: 12,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  termsText: {
    flex: 1,
    color: "#475569",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  termsLink: {
    color: "#1D4ED8",
    fontWeight: "900",
  },
  primaryBtn: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#172554",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: {
    opacity: 0.55,
  },
  primaryText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  footerText: {
    color: "#475569",
    fontSize: 14,
  },
  footerLink: {
    color: "#1D4ED8",
    fontSize: 14,
    fontWeight: "900",
  },
});
