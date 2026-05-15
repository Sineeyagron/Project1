import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("กรอกข้อมูลให้ครบ"); return;
    }
    if (password.length < 6) {
      Alert.alert("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); return;
    }
    if (password !== confirmPassword) {
      Alert.alert("รหัสผ่านไม่ตรงกัน"); return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });

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

    // ใช้ upsert แทน insert เพื่อป้องกันกรณี trigger สร้าง profile อัตโนมัติแล้ว
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert([{ id: userId, role: "user", email }], { onConflict: "id" });

    setIsLoading(false);

    if (profileError) {
      console.log("profile error:", profileError);
      // แม้ profile error แต่ auth user สร้างสำเร็จแล้ว ให้ไปหน้า login ได้เลย
      Alert.alert("สมัครสำเร็จ 🎉", "กรุณาเข้าสู่ระบบ");
      router.replace("/login");
      return;
    }

    Alert.alert("สมัครสำเร็จ 🎉", "เข้าสู่ระบบได้เลย");
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>สมัครสมาชิก</Text>
      <Text style={styles.subtitle}>Create your account</Text>

      {/* อีเมล */}
      <Text style={styles.label}>อีเมล</Text>
      <View style={styles.inputBox}>
        <Ionicons name="mail-outline" size={18} color="#64748b" />
        <TextInput
          placeholder="example@email.com"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      {/* รหัสผ่าน */}
      <Text style={styles.label}>รหัสผ่าน (อย่างน้อย 6 ตัว)</Text>
      <View style={styles.inputBox}>
        <Ionicons name="lock-closed-outline" size={18} color="#64748b" />
        <TextInput
          placeholder="••••••••"
          secureTextEntry={!showPassword}
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Ionicons
            name={showPassword ? "eye-off-outline" : "eye-outline"}
            size={18} color="#64748b"
          />
        </TouchableOpacity>
      </View>

      {/* ยืนยันรหัสผ่าน */}
      <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
      <View style={styles.inputBox}>
        <Ionicons name="lock-closed-outline" size={18} color="#64748b" />
        <TextInput
          placeholder="••••••••"
          secureTextEntry={!showConfirm}
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
          <Ionicons
            name={showConfirm ? "eye-off-outline" : "eye-outline"}
            size={18} color="#64748b"
          />
        </TouchableOpacity>
      </View>

      {/* ปุ่มสมัคร */}
      <TouchableOpacity
        style={[styles.btn, isLoading && { opacity: 0.6 }]}
        onPress={handleSignup}
        disabled={isLoading}
      >
        {isLoading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>สมัครสมาชิก</Text>
        }
      </TouchableOpacity>

      {/* กลับ login */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.replace("/login")}>
        <Text style={styles.backText}>มีบัญชีแล้ว? <Text style={{ fontWeight: "bold" }}>เข้าสู่ระบบ</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: "center",
    padding: 24, backgroundColor: "#f1f5f9",
  },
  title: { fontSize: 26, fontWeight: "bold", color: "#1e3a8a", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#64748b", marginBottom: 28 },
  label: {
    fontSize: 12, color: "#1e3a8a",
    marginBottom: 6, fontWeight: "600", marginTop: 4,
  },
  inputBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12,
    paddingHorizontal: 12, marginBottom: 14,
    height: 52, gap: 8,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  input: { flex: 1, fontSize: 15, color: "#1e293b" },
  btn: {
    backgroundColor: "#0f172a", padding: 16,
    borderRadius: 12, alignItems: "center", marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  backBtn: { marginTop: 20, alignItems: "center" },
  backText: { color: "#1e3a8a", fontSize: 14 },
});
