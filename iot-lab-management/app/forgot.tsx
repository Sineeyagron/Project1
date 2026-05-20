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
import * as Linking from "expo-linking";
import supabase from "../lib/supabase";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = email.trim().length > 0 && !isLoading;

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert("กรอกอีเมลก่อน", "กรุณากรอกอีเมลที่ใช้สมัครบัญชี");
      return;
    }

    setIsLoading(true);

    const redirectTo = Linking.createURL("reset-password");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });

    setIsLoading(false);

    if (error) {
      console.log(error);
      Alert.alert("ส่งไม่สำเร็จ", error.message);
      return;
    }

    Alert.alert(
      "ส่งลิงก์แล้ว",
      "กรุณาตรวจสอบอีเมล แล้วกดลิงก์เพื่อรีเซ็ตรหัสผ่าน"
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} disabled={isLoading}>
          <Ionicons name="arrow-back" size={23} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ลืมรหัสผ่าน</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconBadge}>
          <Ionicons name="lock-closed-outline" size={42} color="#1e3a8a" />
          <View style={styles.keyBadge}>
            <Ionicons name="key" size={15} color="#fff" />
          </View>
        </View>

        <Text style={styles.title}>รีเซ็ตรหัสผ่าน</Text>
        <Text style={styles.subtitle}>ใส่อีเมลของคุณ เราจะส่งลิงก์รีเซ็ตไปให้ใน 1 นาที</Text>

        <View style={styles.stepRow}>
          <View style={styles.stepActive}>
            <Text style={styles.stepActiveText}>1</Text>
          </View>
          <Text style={styles.stepActiveLabel}>กรอกอีเมล</Text>
          <View style={styles.stepLine} />
          <View style={styles.stepMuted}>
            <Text style={styles.stepMutedText}>2</Text>
          </View>
          <Text style={styles.stepMutedLabel}>ตั้งรหัสใหม่</Text>
        </View>

        <View style={styles.card}>
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

          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={15} color="#1e3a8a" />
            <Text style={styles.noteText}>
              ใช้อีเมลที่ลงทะเบียนไว้กับห้องแล็บ — โดยปกติคือ <Text style={styles.noteStrong}>@iotlab.ac.th</Text>
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && styles.disabledBtn]}
            onPress={handleReset}
            disabled={!canSubmit}
            activeOpacity={0.88}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={19} color="#fff" />
                <Text style={styles.primaryText}>ส่งลิงก์รีเซ็ต</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>นึกออกแล้ว?</Text>
          <TouchableOpacity onPress={() => router.replace("/login")} disabled={isLoading}>
            <Text style={styles.footerLink}>กลับไปเข้าสู่ระบบ</Text>
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
    minHeight: 72,
    backgroundColor: "#2563eb",
    paddingTop: 10,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerBack: {
    width: 28,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
  },
  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 36,
  },
  iconBadge: {
    width: 96,
    height: 96,
    borderRadius: 25,
    backgroundColor: "#eaf3ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  keyBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#1e3a8a",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  stepActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1e3a8a",
    alignItems: "center",
    justifyContent: "center",
  },
  stepActiveText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
  },
  stepActiveLabel: {
    color: "#1e3a8a",
    fontSize: 11,
    fontWeight: "900",
    marginLeft: 7,
  },
  stepLine: {
    width: 24,
    height: 1,
    backgroundColor: "#cbd5e1",
    marginHorizontal: 8,
  },
  stepMuted: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepMutedText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "900",
  },
  stepMutedLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "900",
    marginLeft: 7,
  },
  card: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
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
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginBottom: 18,
  },
  noteText: {
    flex: 1,
    color: "#64748b",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
  },
  noteStrong: {
    color: "#1e3a8a",
    fontWeight: "900",
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: "#172554",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  disabledBtn: {
    opacity: 0.55,
  },
  primaryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
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
