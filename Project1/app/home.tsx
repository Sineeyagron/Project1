
@@ -1,98 +1,280 @@
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
  ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

export default function Home(){
const API = "http://10.107.181.76:5000"; // ตรวจสอบว่า IP นี้ยังใช้งานได้อยู่

const router = useRouter();
const [tab,setTab] = useState("room");
export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState("room");
  const [rooms, setRooms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

return(
  // ✅ โหลดห้องจาก DB
  useEffect(() => {
    fetchRooms();
  }, []);

<View style={styles.container}>
  async function fetchRooms() {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/room`);
      const data = await res.json();
      setRooms(data.map((r: any) => r.name));
    } catch (err) {
      console.log("Fetch Error:", err);
      // fallback กรณีต่อ API ไม่ได้ เพื่อให้เห็นดีไซน์ (เอาออกได้เมื่อ API พร้อม)
      setRooms(["CP9524", "SC9604", "MA3012", "EN2011", "LB5005"]);
    } finally {
      setLoading(false);
    }
  }