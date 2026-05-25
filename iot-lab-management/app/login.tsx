import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;

  const handleLogin = async () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      Alert.alert("กรอกข้อมูลให้ครบ", "กรุณากรอกอีเมลและรหัสผ่านก่อนเข้าสู่ระบบ");
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      console.log(error);
      Alert.alert(
        "เข้าสู่ระบบไม่สำเร็จ",
        error.message || "กรุณาตรวจสอบอีเมลและรหัสผ่านอีกครั้ง"
      );
      setIsLoading(false);
      return;
    }

    const user = data.user;

    if (!user) {
      Alert.alert("ไม่พบผู้ใช้");
      setIsLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.log(profileError);
      Alert.alert(
        "โหลดสิทธิ์ผู้ใช้ไม่สำเร็จ",
        profileError.message || "กรุณาลองเข้าสู่ระบบอีกครั้ง"
      );
      setIsLoading(false);
      return;
    }

    if (!profile) {
      const { error: createProfileError } = await supabase
        .from("profiles")
        .upsert(
          [{
            id: user.id,
            role: "user",
            email: user.email || normalizedEmail,
          }],
          { onConflict: "id" }
        );

      if (createProfileError) {
        console.log(createProfileError);
        Alert.alert(
          "ตั้งค่าบัญชีไม่สำเร็จ",
          createProfileError.message || "บัญชีนี้ยังไม่มีข้อมูลสิทธิ์ผู้ใช้"
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      router.replace("/home");
      return;
    }

    setIsLoading(false);

    if (profile.role === "admin") {
      router.replace("/admin/home");
    } else {
      router.replace("/home");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBand} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandBlock}>
          <View style={styles.logoWrap}>
            <View style={styles.logoInner}>
              <Ionicons name="flask-outline" size={42} color="#ffffff" />
            </View>
            <View style={styles.logoBadge}>
              <Ionicons name="sparkles" size={14} color="#ffffff" />
            </View>
          </View>
          <Text style={styles.appName}>
            LabHub
          </Text>
          <View style={styles.subtitleRow}>
            <Ionicons name="time-outline" size={11} color="#7c3aed" />
            <Text style={styles.appSubtitle}>ทุกอุปกรณ์ในห้องแล็บ รวมไว้ที่เดียว</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>เข้าสู่ระบบ</Text>
          <Text style={styles.description}>ยินดีต้อนรับกลับ! กรุณาเข้าสู่ระบบเพื่อใช้งาน</Text>

          <Text style={styles.label}>อีเมล</Text>
          <View style={[styles.inputBox, focusedField === "email" && styles.inputBoxFocused]}>
            <View style={styles.inputIconBox}>
              <Ionicons name="mail-outline" size={19} color={focusedField === "email" ? "#7c3aed" : "#64748b"} />
            </View>
            <TextInput
              placeholder="student@iotlab.ac.th"
              placeholderTextColor="#334155"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          <View style={styles.passwordHeader}>
            <Text style={styles.label}>รหัสผ่าน</Text>
            <TouchableOpacity onPress={() => router.push("/forgot")} disabled={isLoading}>
              <Text style={styles.forgot}>ลืมรหัสผ่าน?</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.inputBox, focusedField === "password" && styles.inputBoxFocused]}>
            <View style={styles.inputIconBox}>
              <Ionicons name="lock-closed-outline" size={19} color={focusedField === "password" ? "#7c3aed" : "#64748b"} />
            </View>
            <TextInput
              placeholder="กรอกรหัสผ่าน"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              textContentType="password"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRememberMe((value) => !value)}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Ionicons name="checkmark" size={14} color="#ffffff" />}
            </View>
            <Text style={styles.rememberText}>จดจำการเข้าสู่ระบบ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginBtn, !canSubmit && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.loginText}>เข้าสู่ระบบ</Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>หรือเข้าใช้ระบบ</Text>
            <View style={styles.dividerLine} />
          </View>
        </View>

        <View style={styles.signupRow}>
          <Text style={styles.signupHint}>ยังไม่มีบัญชี?</Text>
          <TouchableOpacity onPress={() => router.push("/signup")} disabled={isLoading}>
            <Text style={styles.signup}>สมัครสมาชิก</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sslPill}>
          <Ionicons name="shield-checkmark" size={14} color="#16a34a" />
          <Text style={styles.sslText}>ปลอดภัย เข้ารหัส SSL</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#dfeafb",
  },
  topBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#dfeafb",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 28,
  },
  brandBlock: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    alignItems: "center",
    marginBottom: 28,
  },
  logoWrap: {
    width: 98,
    height: 98,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.80)",
    shadowColor: "#7c3aed",
    shadowOpacity: 0.2,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  logoInner: {
    width: 66,
    height: 66,
    borderRadius: 15,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#60a5fa",
  },
  logoBadge: {
    position: "absolute",
    top: -5,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fb923c",
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    color: "#0f172a",
    fontSize: 31,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 4,
  },
  appSubtitle: {
    color: "#475569",
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
  },
  card: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 21,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  title: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "900",
  },
  description: {
    color: "#64748b",
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 7,
    marginBottom: 17,
    fontWeight: "600",
  },
  label: {
    color: "#1e3a8a",
    fontSize: 12.5,
    fontWeight: "800",
    marginBottom: 7,
  },
  inputBox: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  inputBoxFocused: {
    borderColor: "#7c3aed",
    backgroundColor: "#ffffff",
  },
  inputIconBox: {
    width: 29,
    height: 29,
    borderRadius: 8,
    backgroundColor: "#ede9fe",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    color: "#0f172a",
    fontSize: 14,
    paddingVertical: 11,
    fontWeight: "600",
  },
  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forgot: {
    color: "#1e3a8a",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 7,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    marginTop: -4,
    marginBottom: 16,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#7c3aed",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#7c3aed",
  },
  rememberText: {
    color: "#334155",
    fontSize: 12.5,
    fontWeight: "800",
  },
  loginBtn: {
    minHeight: 44,
    backgroundColor: "#7c3aed",
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 0,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.38,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  loginBtnDisabled: {
    opacity: 0.55,
  },
  loginText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  dividerText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "800",
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 28,
  },
  signupHint: {
    color: "#64748b",
    fontSize: 12.5,
    fontWeight: "700",
  },
  signup: {
    color: "#1e3a8a",
    fontSize: 12.5,
    fontWeight: "900",
  },
  sslPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  sslText: {
    color: "#16a34a",
    fontSize: 10.5,
    fontWeight: "900",
  },
});
