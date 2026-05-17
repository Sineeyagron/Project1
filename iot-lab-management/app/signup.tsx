import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Image, Alert, ActivityIndicator,
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
      {/* LOGO */}
      <View style={styles.logoContainer}>
        <Image source={require("../assets/images/c02.png")} style={styles.logo} />
        <Text style={styles.title}>IoT Lab Management</Text>
        <Text style={styles.subtitle}>ระบบจัดการห้องปฏิบัติการ IoT</Text>
      </View>

      {/* CARD */}
      <View style={styles.card}>
        <Text style={styles.welcome}>สมัครสมาชิก</Text>
        <Text style={styles.desc}>กรอกข้อมูลเพื่อสร้างบัญชีใหม่</Text>

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
        <Text style={styles.label}>รหัสผ่าน</Text>
        <View style={styles.inputBox}>
          <Ionicons name="lock-closed-outline" size={18} color="#64748b" />
          <TextInput
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={18} color="#64748b"
            />
          </TouchableOpacity>
        </View>

        {/* CONFIRM PASSWORD */}
        <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
        <View style={styles.inputBox}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#64748b" />
          <TextInput
            placeholder="••••••••"
            secureTextEntry={!showConfirm}
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} hitSlop={10}>
            <Ionicons
              name={showConfirm ? "eye-off-outline" : "eye-outline"}
              size={18} color="#64748b"
            />
          </TouchableOpacity>
        </View>

        {/* Password match indicator */}
        {confirmPassword.length > 0 && (
          <View style={styles.matchRow}>
            <Ionicons
              name={password === confirmPassword ? "checkmark-circle" : "close-circle"}
              size={14}
              color={password === confirmPassword ? "#16a34a" : "#dc2626"}
            />
            <Text style={[
              styles.matchTxt,
              { color: password === confirmPassword ? "#16a34a" : "#dc2626" },
            ]}>
              {password === confirmPassword ? "รหัสผ่านตรงกัน" : "รหัสผ่านไม่ตรงกัน"}
            </Text>
          </View>
        )}

        {/* SIGNUP */}
        <TouchableOpacity
          style={[styles.loginBtn, isLoading && { opacity: 0.6 }]}
          onPress={handleSignup}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.loginText}>สมัครสมาชิก</Text>
          }
        </TouchableOpacity>
      </View>

      {/* BACK TO LOGIN */}
      <View style={styles.signupRow}>
        <Text style={{ color: "#64748b" }}>มีบัญชีอยู่แล้ว? </Text>
        <TouchableOpacity onPress={() => router.replace("/login")} disabled={isLoading}>
          <Text style={styles.signup}>เข้าสู่ระบบ</Text>
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
    marginTop: 60,
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

  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: -8,
    marginBottom: 10,
  },
  matchTxt: { fontSize: 11, fontWeight: "600" },

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
