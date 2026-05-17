import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";

type ResultState = {
  visible: boolean;
  type: "success" | "error";
  title: string;
  message: string;
};

export default function ResetPassword() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ResultState>({
    visible: false,
    type: "success",
    title: "",
    message: "",
  });

  const showResult = (type: "success" | "error", title: string, message: string) => {
    setResult({ visible: true, type, title, message });
  };

  const handleReset = async () => {
    if (isLoading) return;

    if (!password || !confirmPassword) {
      showResult("error", "ข้อมูลไม่ครบ", "กรุณากรอกรหัสผ่านให้ครบทั้ง 2 ช่อง");
      return;
    }

    if (password.length < 6) {
      showResult("error", "รหัสผ่านสั้นเกินไป", "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
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
      showResult("error", "เปลี่ยนรหัสไม่สำเร็จ", error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      return;
    }

    showResult("success", "เปลี่ยนรหัสสำเร็จ", "คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว");
  };

  const handleCloseModal = () => {
    const wasSuccess = result.type === "success";
    setResult({ ...result, visible: false });
    if (wasSuccess) {
      router.replace("/login");
    }
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
        <Text style={styles.welcome}>ตั้งรหัสผ่านใหม่</Text>
        <Text style={styles.desc}>กรอกรหัสผ่านใหม่เพื่อเข้าใช้งานบัญชี</Text>

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
        <Text style={{ color: "#64748b" }}>จำรหัสผ่านได้แล้ว? </Text>
        <TouchableOpacity onPress={() => router.replace("/login")} disabled={isLoading}>
          <Text style={styles.signup}>เข้าสู่ระบบ</Text>
        </TouchableOpacity>
      </View>

      {/* RESULT MODAL */}
      <Modal
        visible={result.visible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View
              style={[
                styles.modalIconCircle,
                { backgroundColor: result.type === "success" ? "#dcfce7" : "#fee2e2" },
              ]}
            >
              <Ionicons
                name={result.type === "success" ? "checkmark-circle" : "alert-circle"}
                size={48}
                color={result.type === "success" ? "#16a34a" : "#dc2626"}
              />
            </View>
            <Text style={styles.modalTitle}>{result.title}</Text>
            <Text style={styles.modalMessage}>{result.message}</Text>
            <TouchableOpacity
              style={[
                styles.modalBtn,
                { backgroundColor: result.type === "success" ? "#16a34a" : "#0f172a" },
              ]}
              onPress={handleCloseModal}
              activeOpacity={0.85}
            >
              <Text style={styles.modalBtnTxt}>
                {result.type === "success" ? "ไปเข้าสู่ระบบ" : "ตกลง"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

  // ── MODAL ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  modalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 6,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 19,
  },
  modalBtn: {
    width: "100%",
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
