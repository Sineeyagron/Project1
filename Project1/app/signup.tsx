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

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");



const handleSignup = async () => {
  if (!email || !password) {
    Alert.alert("กรอกข้อมูลให้ครบ");
    return;
  }

  // 🔥 logout ก่อน (กัน session ค้าง)
  await supabase.auth.signOut();

  // 🔥 ลอง login ก่อน (เช็คว่ามี user นี้ไหม)
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (!loginError) {
    Alert.alert("อีเมลนี้ถูกใช้แล้ว");
    return;
  }

  // 🔥 สมัคร
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    Alert.alert(error.message);
    return;
  }

  const userId = data?.user?.id;

  if (!userId) {
    Alert.alert("สมัครไม่สำเร็จ");
    return;
  }

  // 🔥 insert profiles
  const { error: profileError } = await supabase
    .from("profiles")
    .insert([
      {
        id: userId,
        role: "user",
      },
    ]);

  if (profileError) {
    console.log(profileError);
    Alert.alert("สร้าง profile ไม่สำเร็จ");
    return;
  }

  Alert.alert("สมัครสำเร็จ 🎉");
  router.replace("/login");
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signup</Text>

      {/* 📧 EMAIL */}
      <TextInput
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />

      {/* 🔒 PASSWORD */}
      <TextInput
        placeholder="Password"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      {/* 🔥 SIGN UP */}
      <TouchableOpacity style={styles.btn} onPress={handleSignup}>
        <Text style={{ color: "#fff" }}>Sign Up</Text>
      </TouchableOpacity>

      {/* 🔙 BACK LOGIN */}
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: "gray" }]}
        onPress={() => router.replace("/login")}
      >
        <Text style={{ color: "#fff" }}>Back Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: 24,
    marginBottom: 20,
  },

  input: {
    width: "80%",
    backgroundColor: "#eee",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },

  btn: {
    backgroundColor: "green",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    width: "80%",
    alignItems: "center",
  },
});