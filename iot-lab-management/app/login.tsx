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
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("กรอกข้อมูลให้ครบ", "กรุณากรอกอีเมลและรหัสผ่านก่อนเข้าสู่ระบบ");
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      console.log(error);
      Alert.alert("เข้าสู่ระบบไม่สำเร็จ", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
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
      .single();

    setIsLoading(false);

    if (profileError || !profile) {
      console.log(profileError);
      Alert.alert("ไม่พบข้อมูลสิทธิ์ผู้ใช้");
      return;
    }

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
              <Ionicons name="git-network-outline" size={34} color="#ffffff" />
              <View style={styles.logoDot}>
                <Text style={styles.logoDotText}>H</Text>
              </View>
            </View>
          </View>
          <Text style={styles.appName}>
            Lab<Text style={styles.appNameAccent}>Hub</Text>
          </Text>
          <Text style={styles.appSubtitle}>ทุกอุปกรณ์ในห้องแล็บ · รวมไว้ที่เดียว</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>เข้าสู่ระบบ</Text>
          <Text style={styles.description}>กรอกอีเมลและรหัสผ่านของคุณ</Text>

          <Text style={styles.label}>อีเมล</Text>
          <View style={[styles.inputBox, focusedField === "email" && styles.inputBoxFocused]}>
            <Ionicons name="mail-outline" size={20} color={focusedField === "email" ? "#1e3a8a" : "#64748b"} />
            <TextInput
              placeholder="example@email.com"
              placeholderTextColor="#94a3b8"
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
            <Ionicons name="lock-closed-outline" size={20} color={focusedField === "password" ? "#1e3a8a" : "#64748b"} />
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
            style={[styles.loginBtn, !canSubmit && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginText}>เข้าสู่ระบบ</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.signupRow}>
          <Text style={styles.signupHint}>ยังไม่มีบัญชี?</Text>
          <TouchableOpacity onPress={() => router.push("/signup")} disabled={isLoading}>
            <Text style={styles.signup}>สมัครสมาชิก</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#dbeafe",
  },
  topBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#dbeafe",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 26,
    paddingVertical: 34,
  },
  brandBlock: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  logoWrap: {
    width: 92,
    height: 92,
    borderRadius: 26,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.80)",
    elevation: 6,
  },
  logoInner: {
    width: 66,
    height: 66,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#60a5fa",
  },
  logoDot: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#3b82f6",
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  logoDotText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  appName: {
    color: "#0f172a",
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0,
  },
  appNameAccent: {
    color: "#1d4ed8",
  },
  appSubtitle: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
  },
  card: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },
  title: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "900",
  },
  description: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 20,
  },
  label: {
    color: "#334155",
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
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  inputBoxFocused: {
    borderColor: "#93c5fd",
    backgroundColor: "#ffffff",
  },
  input: {
    flex: 1,
    color: "#0f172a",
    fontSize: 15,
    paddingVertical: 13,
  },
  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forgot: {
    color: "#1e3a8a",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  loginBtn: {
    minHeight: 52,
    backgroundColor: "#172554",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
  },
  loginBtnDisabled: {
    opacity: 0.55,
  },
  loginText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
  },
  signupHint: {
    color: "#64748b",
    fontSize: 14,
  },
  signup: {
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: "900",
  },
});
