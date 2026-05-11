import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ── อธิบาย ──────────────────────────────────────────────────────────
  // ขั้นตอนการสมัคร:
  // 1. เช็คว่ากรอกครบ + password ตรงกัน + ยาวพอ
  // 2. เรียก supabase.auth.signUp() → Supabase จัดการเองถ้า email ซ้ำ
  // 3. ถ้าสำเร็จ → insert row ใน profiles (เก็บ role = "user")
  // 4. ไปหน้า login
  //
  // ** ไม่ต้องลอง login ก่อนเพื่อเช็ค email ซ้ำ **
  // Supabase จะ return error เองถ้า email ถูกใช้ไปแล้ว
  // ────────────────────────────────────────────────────────────────────
  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("กรอกข้อมูลให้ครบ");
      return;
    }

    if (password.length < 6) {
      Alert.alert("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("รหัสผ่านไม่ตรงกัน");
      return;
    }

    setIsLoading(true);

    // สมัครผ่าน Supabase Auth — ถ้า email ซ้ำ จะ error เองอัตโนมัติ
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setIsLoading(false);
      // Supabase คืน error.message เป็น "User already registered" ถ้าซ้ำ
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

    // บันทึก role ลงในตาราง profiles
    // profiles เก็บข้อมูลเพิ่มเติมของ user เช่น ชื่อ, role
    const { error: profileError } = await supabase
      .from("profiles")
      .insert([{ id: userId, role: "user", email: email }]);

    setIsLoading(false);

    if (profileError) {
      console.log(profileError);
      Alert.alert("สร้าง profile ไม่สำเร็จ");
      return;
    }

    Alert.alert("สมัครสำเร็จ 🎉", "กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี");
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>สมัครสมาชิก</Text>
      <Text style={styles.subtitle}>Create your account</Text>

      {/* อีเมล */}
      <Text style={styles.label}>อีเมล</Text>
      <TextInput
        placeholder="example@email.com"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {/* รหัสผ่าน */}
      <Text style={styles.label}>รหัสผ่าน (อย่างน้อย 6 ตัว)</Text>
      <TextInput
        placeholder="••••••••"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      {/* ยืนยันรหัสผ่าน */}
      <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
      <TextInput
        placeholder="••••••••"
        secureTextEntry
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

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
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.replace("/login")}
      >
        <Text style={styles.backText}>มีบัญชีแล้ว? เข้าสู่ระบบ</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f1f5f9",
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 28,
  },

  label: {
    fontSize: 12,
    color: "#1e3a8a",
    marginBottom: 6,
    fontWeight: "600",
  },

  input: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    fontSize: 15,
  },

  btn: {
    backgroundColor: "#0f172a",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },

  btnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },

  backBtn: {
    marginTop: 20,
    alignItems: "center",
  },

  backText: {
    color: "#1e3a8a",
    fontSize: 14,
  },
});
