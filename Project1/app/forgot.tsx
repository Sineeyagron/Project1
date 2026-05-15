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
import * as Linking from "expo-linking";
import supabase from "../lib/supabase";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ── อธิบาย redirectTo ────────────────────────────────────────────────
  // Supabase จะส่งลิงก์ไปทางอีเมล เมื่อกดลิงก์นั้น
  // ระบบจะเปิดแอปกลับมาที่หน้า reset-password พร้อม token
  //
  // Linking.createURL('reset-password') จะสร้าง URL อัตโนมัติ
  // - ถ้ารันบน Expo Go: exp://192.168.x.x:8081/--/reset-password
  // - ถ้า build จริง: project1://reset-password
  // แทนที่จะ hardcode URL ที่ใช้ได้เฉพาะเครื่องตัวเอง
  // ────────────────────────────────────────────────────────────────────
  const handleReset = async () => {
    if (!email) {
      Alert.alert("กรอกอีเมลก่อน");
      return;
    }

    setIsLoading(true);

    // สร้าง URL ที่ถูกต้องสำหรับเครื่องนี้ โดยอัตโนมัติ
    const redirectTo = Linking.createURL("reset-password");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setIsLoading(false);

    if (error) {
      console.log(error);
      Alert.alert("ส่งไม่สำเร็จ", error.message);
      return;
    }

    Alert.alert(
      "ส่งลิงก์แล้ว 📩",
      "กรุณาตรวจสอบอีเมลแล้วกดลิงก์เพื่อรีเซ็ตรหัสผ่าน"
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ลืมรหัสผ่าน?</Text>
      <Text style={styles.subtitle}>
        กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้
      </Text>

      <TextInput
        placeholder="อีเมล"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TouchableOpacity
        style={[styles.btn, isLoading && { opacity: 0.6 }]}
        onPress={handleReset}
        disabled={isLoading}
      >
        {isLoading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>ส่งลิงก์รีเซ็ตรหัสผ่าน</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>← กลับ</Text>
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
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 28,
    lineHeight: 22,
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
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
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
