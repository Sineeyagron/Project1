import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ── อธิบาย ──────────────────────────────────────────────────────────
  // handleLogin ทำงานแบบนี้:
  // 1. ส่ง email+password ไปให้ Supabase ตรวจสอบ
  // 2. ถ้าผ่าน → ดึง "role" ของ user จากตาราง profiles
  // 3. role="admin" → ไปหน้า admin, อื่นๆ → ไปหน้า home ปกติ
  // ────────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("กรอกข้อมูลให้ครบ");
      return;
    }

    setIsLoading(true); // ปิดปุ่มระหว่างรอ ป้องกันกดซ้ำ

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
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

    // ดึง role จากตาราง profiles (ที่เราสร้างตอน signup)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    setIsLoading(false);

    if (profileError || !profile) {
      console.log(profileError);
      Alert.alert("ไม่พบข้อมูล role");
      return;
    }

    // แยกทางตาม role
    if (profile.role === "admin") {
      router.replace("/admin/home");
    } else {
      router.replace("/home");
    }
  };

  return (
    <View style={styles.container}>
      {/* ลบปุ่ม ADMIN ที่ข้ามการยืนยันตัวตนออกแล้ว */}

      {/* LOGO */}
      <View style={styles.logoContainer}>
        <Image source={require("../assets/images/c02.png")} style={styles.logo} />
        <Text style={styles.title}>IoT Lab Management</Text>
        <Text style={styles.subtitle}>ระบบจัดการห้องปฏิบัติการ IoT</Text>
      </View>

      {/* CARD */}
      <View style={styles.card}>
        <Text style={styles.welcome}>เข้าสู่ระบบ</Text>
        <Text style={styles.desc}>กรอกอีเมลและรหัสผ่านของคุณ</Text>

        {/* EMAIL */}
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

        {/* PASSWORD */}
        <View style={styles.passwordHeader}>
          <Text style={styles.label}>รหัสผ่าน</Text>
          <TouchableOpacity onPress={() => router.push("/forgot")}>
            <Text style={styles.forgot}>ลืมรหัสผ่าน?</Text>
          </TouchableOpacity>
        </View>

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
            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* LOGIN */}
        <TouchableOpacity
          style={[styles.loginBtn, isLoading && { opacity: 0.6 }]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.loginText}>เข้าสู่ระบบ</Text>
          }
        </TouchableOpacity>
      </View>

      {/* SIGN UP */}
      <View style={styles.signupRow}>
        <Text style={{ color: "#64748b" }}>ยังไม่มีบัญชี? </Text>
        <TouchableOpacity onPress={() => router.push("/signup")}>
          <Text style={styles.signup}>สมัครสมาชิก</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    padding: 20,
  },

  logoContainer: {
    alignItems: "center",
    marginTop: 100,
    marginBottom: 20,
  },

  logo: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1e3a8a",
  },

  subtitle: {
    fontSize: 12,
    color: "#64748b",
    letterSpacing: 2,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    elevation: 3,
  },

  welcome: {
    fontSize: 20,
    fontWeight: "bold",
  },

  desc: {
    color: "#64748b",
    marginBottom: 20,
  },

  label: {
    fontSize: 12,
    marginBottom: 5,
    color: "#1e3a8a",
  },

  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 10,
    marginBottom: 15,
    height: 50,
    gap: 8,
  },

  input: {
    flex: 1,
  },

  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  forgot: {
    fontSize: 12,
    color: "#1e3a8a",
  },

  loginBtn: {
    backgroundColor: "#0f172a",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },

  loginText: {
    color: "#fff",
    fontWeight: "bold",
  },

  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },

  signup: {
    color: "#1e3a8a",
    fontWeight: "bold",
  },
});