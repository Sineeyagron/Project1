import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Text, TextInput } from "../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";
import { authErrorThai, PASSWORD_HINT, passwordProblem } from "../lib/password";
import { goBack } from "../lib/nav";
import { W } from "../lib/theme";
import { notify } from "../lib/notify";

export default function ResetPassword() {
  // เปลี่ยนรหัสผ่านจากหน้าโปรไฟล์ (ต้องล็อกอิน) — ระบบลืมรหัสผ่านทางอีเมลถอดออกแล้ว (12 ต.ค. 2569)

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ผลลัพธ์ = ป๊อปอัปของแอป (lib/notify) เหมือนทั้งแอป · สำเร็จ → กดโอเคแล้วกลับหน้าโปรไฟล์
  const showResult = (type: "success" | "error", title: string, message: string) => {
    notify(title, message, type === "success" ? () => goBack("/profile") : undefined);
  };

  const handleReset = async () => {
    if (isLoading) return;

    if (!password || !confirmPassword) {
      showResult("error", "ข้อมูลไม่ครบ", "กรุณากรอกรหัสผ่านให้ครบทั้ง 2 ช่อง");
      return;
    }

    const problem = passwordProblem(password);
    if (problem) {
      showResult("error", "รหัสผ่านยังไม่ผ่านเกณฑ์", problem);
      return;
    }

    if (password !== confirmPassword) {
      showResult("error", "รหัสผ่านไม่ตรงกัน", "กรุณาตรวจสอบรหัสผ่านทั้ง 2 ช่องให้ตรงกัน");
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setIsLoading(false);

    if (error) {
      console.log(error);
      showResult("error", "เปลี่ยนรหัสไม่สำเร็จ", authErrorThai(error.message || "") || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      return;
    }

    showResult("success", "เปลี่ยนรหัสสำเร็จ", "ครั้งหน้าใช้รหัสผ่านใหม่เข้าสู่ระบบ");
  };


  return (
    <View style={styles.container}>
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      {/* LOGO */}
      <View style={styles.logoContainer}>
        <Image source={require("../assets/images/brand-mark.png")} style={styles.logo} />
        <Text style={styles.title}>IoT Lab Management</Text>
        <Text style={styles.subtitle}>ระบบจัดการห้องปฏิบัติการ IoT</Text>
      </View>

      {/* CARD */}
      <View style={styles.card}>
        <Text style={styles.welcome}>เปลี่ยนรหัสผ่าน</Text>
        <Text style={styles.desc}>{PASSWORD_HINT}</Text>

        {/* NEW PASSWORD */}
        <Text style={styles.label}>รหัสผ่านใหม่</Text>
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
              size={18}
              color="#64748b"
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
              size={18}
              color="#64748b"
            />
          </TouchableOpacity>
        </View>

        {/* Password match indicator */}
        {confirmPassword.length > 0 && (
          <View style={styles.matchRow}>
            <Ionicons
              name={password === confirmPassword ? "checkmark-circle" : "close-circle"}
              size={14}
              color={password === confirmPassword ? "#047857" : "#dc2626"}
            />
            <Text style={[
              styles.matchTxt,
              { color: password === confirmPassword ? "#047857" : "#dc2626" },
            ]}>
              {password === confirmPassword ? "รหัสผ่านตรงกัน" : "รหัสผ่านไม่ตรงกัน"}
            </Text>
          </View>
        )}

        {/* SUBMIT */}
        <TouchableOpacity
          style={[styles.loginBtn, isLoading && { opacity: 0.6 }]}
          onPress={handleReset}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.loginText}>ยืนยันเปลี่ยนรหัส</Text>
          }
        </TouchableOpacity>
      </View>

      {/* BACK TO LOGIN */}
      <View style={styles.signupRow}>
        <Text style={{ color: "#475569" }}>ไม่เปลี่ยนแล้ว? </Text>
        <TouchableOpacity onPress={() => goBack("/profile")} disabled={isLoading}>
          <Text style={styles.signup}>กลับ</Text>
        </TouchableOpacity>
      </View>

      </KeyboardAwareScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...W.page,
    flex: 1,
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
    color: "#1D4ED8",
  },

  subtitle: {
    fontSize: 12,
    color: "#475569",
    letterSpacing: 2,
  },

  card: {
    ...W.card,
    padding: 20,
    marginTop: 20,
  },

  welcome: {
    fontSize: 20,
    fontWeight: "bold",
  },

  desc: {
    color: "#475569",
    marginBottom: 20,
  },

  label: {
    fontSize: 12,
    marginBottom: 5,
    color: "#1D4ED8",
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
    ...W.primarySolid,
    padding: 15,
    borderRadius: 15,
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
    color: "#1D4ED8",
    fontWeight: "bold",
  },

  // ── MODAL ──
});
