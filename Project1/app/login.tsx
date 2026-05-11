import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // 🔥 LOGIN FUNCTION (แก้แล้ว)
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("กรอกข้อมูลให้ครบ");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log(error);
      Alert.alert(error.message); // 🔥 แสดง error จริง
      return;
    }

    const user = data.user;

    if (!user) {
      Alert.alert("ไม่พบผู้ใช้");
      return;
    }

    // 🔥 ดึง role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.log(profileError);
      Alert.alert("ไม่พบข้อมูล role");
      return;
    }

    // 🔥 แยก role
    if (profile.role === "admin") {
      router.replace("/admin/home");
    } else {
      router.replace("/home");
    }
  };

  return (
    <View style={styles.container}>
      
      {/* ADMIN BUTTON */}
      <TouchableOpacity
        style={styles.adminBtn}
        onPress={() => router.push("/admin/home")}
      >
        <Ionicons name="shield-checkmark-outline" size={16} color="#64748b" />
        <Text style={styles.adminText}>ADMIN</Text>
      </TouchableOpacity>

      {/* LOGO */}
      <View style={styles.logoContainer}>
        <Image
          source={require("../assets/images/c02.png")}
          style={styles.logo}
        />
        <Text style={styles.title}>Intelligent Ledger</Text>
        <Text style={styles.subtitle}>IOT INVENTORY MANAGEMENT</Text>
      </View>

      {/* CARD */}
      <View style={styles.card}>
        <Text style={styles.welcome}>Welcome Back</Text>
        <Text style={styles.desc}>Access your secure dashboard</Text>

        {/* EMAIL */}
        <Text style={styles.label}>CORPORATE EMAIL</Text>
        <View style={styles.inputBox}>
          <Ionicons name="mail-outline" size={18} color="#64748b" />
          <TextInput
            placeholder="name@company.com"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* PASSWORD */}
        <View style={styles.passwordHeader}>
          <Text style={styles.label}>ACCESS KEY</Text>

          {/* 🔥 FIX: Forgot Password กดได้ */}
          <TouchableOpacity onPress={() => router.push("/forgot")}>
            <Text style={styles.forgot}>Forgot Password?</Text>
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
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={18}
              color="#64748b"
            />
          </TouchableOpacity>
        </View>

        {/* LOGIN */}
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={handleLogin}
        >
          <Text style={styles.loginText}>Log In →</Text>
        </TouchableOpacity>
      </View>

      {/* SIGN UP */}
      <View style={styles.signupRow}>
        <Text>Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push("/signup")}>
          <Text style={styles.signup}>Sign Up</Text>
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

  adminBtn: {
    position: "absolute",
    top: 40,
    right: 20,
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: "center",
    gap: 5,
  },

  adminText: {
    fontSize: 12,
    color: "#64748b",
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