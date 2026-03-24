
@@ -1,96 +1,285 @@
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from "react-native";
import React from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons"; // ใช้ไอคอนพื้นฐานของ Expo

export default function Login(){
export default function Login() {
  const router = useRouter();

const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.innerContainer}
      >
        {/* Admin Button Top Right */}
        <TouchableOpacity 
          style={styles.adminBtn}
          onPress={() => router.push("./admin/home")}
        >
          <Ionicons name="shield-checkmark-outline" size={16} color="#64748b" />
          <Text style={styles.adminText}>ADMIN</Text>
        </TouchableOpacity>

return(
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Image
              source={require("../assets/images/c02.png")} // ตรวจสอบว่าไฟล์ชื่อนี้อยู่ในโฟลเดอร์ assets จริง
              style={styles.logo}
              resizeMode="contain"
            />
          </View>