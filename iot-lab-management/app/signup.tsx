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
    password.length >= 6 &&
    !isLoading;

  const handleSignup = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      Alert.alert("กรอกข้อมูลให้ครบ", "กรุณากรอกชื่อ อีเมล และรหัสผ่านก่อนสมัคร");
      return;
    }

    if (password.length < 6) {
      Alert.alert("รหัสผ่านสั้นเกินไป", "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setIsLoading(false);
      if (error.message.includes("already")) {
        Alert.alert("อีเมลนี้ถูกใช้ไปแล้ว");
      } else {
        Alert.alert("สมัครไม่สำเร็จ", error.message);
      }
      return;
    }

    const userId = data?.user?.id;
    if (!userId) {
      setIsLoading(false);
      Alert.alert("สมัครไม่สำเร็จ");
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        [{
          id: userId,
          role: "user",
          email: email.trim(),
          full_name: fullName.trim(),
        }],
        { onConflict: "id" }
      );

    setIsLoading(false);

    if (profileError) {
      console.log("profile error:", profileError);
      Alert.alert("สมัครสำเร็จ", "กรุณาเข้าสู่ระบบ");
      router.replace("/login");
      return;
    }

    Alert.alert("สมัครสำเร็จ", "เข้าสู่ระบบได้เลย");
    router.replace("/login");
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} disabled={isLoading}>
          <Ionicons name="arrow-back" size={23} color="#fff" />
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
              placeholder="อย่างน้อย 6 ตัวอักษร"
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
            <Ionicons name="shield-checkmark-outline" size={17} color="#16a34a" />
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
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  header: {
    minHeight: 88,
    backgroundColor: "#2563eb",
    paddingTop: 10,
    paddingHorizontal: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 28,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
  },
  headerSub: {
    color: "#dbeafe",
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
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },
  title: {
    color: "#1e293b",
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  desc: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 14,
  },
  label: {
    color: "#1e3a8a",
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
    paddingHorizontal: 13,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    color: "#0f172a",
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
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 16,
  },
  termsLink: {
    color: "#1e3a8a",
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
    color: "#64748b",
    fontSize: 14,
  },
  footerLink: {
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: "900",
  },
});
