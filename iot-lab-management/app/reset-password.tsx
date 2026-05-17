import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";

export default function ResetPassword() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleReset = async () => {
    // ❗ เช็คก่อน
    if (!password || !confirmPassword) {
      Alert.alert("กรอกข้อมูลให้ครบ");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("รหัสผ่านไม่ตรงกัน");
      return;
    }

    // 🔥 เปลี่ยนรหัส
    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      console.log(error);
      Alert.alert("เปลี่ยนรหัสไม่สำเร็จ");
      return;
    }

    Alert.alert("เปลี่ยนรหัสสำเร็จ 🎉");

    // 🔁 กลับหน้า login
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>

      {/* 🔒 PASSWORD */}
      <TextInput
        placeholder="New Password"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      {/* 🔒 CONFIRM PASSWORD */}
      <TextInput
        placeholder="Confirm Password"
        secureTextEntry
        style={styles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      {/* 🔥 BUTTON */}
      <TouchableOpacity style={styles.btn} onPress={handleReset}>
        <Text style={{ color: "#fff" }}>Confirm</Text>
      </TouchableOpacity>

      {/* 🔙 BACK */}
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: "gray" }]}
        onPress={() => router.replace("/login")}
      >
        <Text style={{ color: "#fff" }}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
  },

  input: {
    width: "80%",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  btn: {
    width: "80%",
    backgroundColor: "#2563eb",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
});