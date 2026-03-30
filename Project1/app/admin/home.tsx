import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

export default function AdminHome() {
  const router = useRouter();

  // 🔥 STATE
  const [total, setTotal] = useState(0);
  const [borrowed, setBorrowed] = useState(0);
  const [pending, setPending] = useState(0);
  const [returned, setReturned] = useState(0);

  // 🔥 LOAD DATA
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 📦 ITEMS
    const { data: items } = await supabase
      .from("items")
      .select("*");

    setTotal(items?.length || 0);

    // 📤 BORROWS
    const { data: borrows } = await supabase
      .from("borrow_records")
      .select("*");

    setBorrowed(
      borrows?.filter(b => b.status === "borrowed").length || 0
    );

    setPending(
      borrows?.filter(b => b.status === "pending_return").length || 0
    );

    setReturned(
      borrows?.filter(b => b.status === "returned").length || 0
    );
  };

  return (
    <ScrollView style={styles.container}>

            {/* 🔥 TITLE */}
            <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.push("/")}>
            <Text style={styles.backBtn}>← กลับ</Text>
        </TouchableOpacity>

        <Text style={styles.title}>จัดการห้องเรียน</Text>

        <View style={{ width: 50 }} />
        </View>

      {/* 🔥 DASHBOARD */}
      <View style={{ marginBottom: 20 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📦 Total Items</Text>
          <Text style={styles.cardNumber}>{total}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>📤 Borrowed</Text>
          <Text style={styles.cardNumber}>{borrowed}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>⏳ Pending</Text>
          <Text style={styles.cardNumber}>{pending}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>✅ Returned</Text>
          <Text style={styles.cardNumber}>{returned}</Text>
        </View>
      </View>

      {/* 🔍 SEARCH + ADD */}
      <View style={styles.searchRow}>
        <Text>ค้นหา</Text>

        <TouchableOpacity style={styles.addBtn}>
          <Text>เพิ่มห้อง</Text>
        </TouchableOpacity>
      </View>

      {/* 🏫 ROOM LIST */}
      <TouchableOpacity
        style={styles.room}
        onPress={() => router.push("/admin/room")}
      >
        <Text style={styles.roomText}>CP9524</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.room}
        onPress={() => router.push("/admin/room")}
      >
        <Text style={styles.roomText}>SC9604</Text>
      </TouchableOpacity>

      {/* 🔥 NAVBAR */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.push("/admin/home")}>
          <Text>ห้องเรียน</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/admin/scan")}>
          <Text>สแกน</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/admin/borrow")}>
          <Text>การยืม</Text>
        </TouchableOpacity>
      </View>
        {/* 🔥 ปุ่มกลับ HISTORY */}
            <TouchableOpacity
        onPress={() => router.push("/admin/history")}
        style={{
            backgroundColor: "#1e3a8a",
            padding: 12,
            borderRadius: 10,
            marginBottom: 10,
        }}
        >
        <Text style={{ color: "#fff", textAlign: "center" }}>
            ดูประวัติทั้งหมด
        </Text>
        </TouchableOpacity>
        {/* 🔥 ปุ่มเข้า Manage Items */}
        <TouchableOpacity
        onPress={() => router.push("/admin/items")}
        style={{
            backgroundColor: "#10b981",
            padding: 12,
            borderRadius: 10,
            marginBottom: 10,
        }}
        >
        <Text style={{ color: "#fff", textAlign: "center" }}>
            จัดการอุปกรณ์
        </Text>
        </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({

  headerRow:{
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
    marginBottom:20
    },

  backBtn:{
    fontSize:16,
    color:"#1e3a8a",
    fontWeight:"bold"
    },

  container: {
    flex: 1,
    backgroundColor: "#eee",
    padding: 20,
  },

  title: {
    fontSize: 28,
    textAlign: "center",
    marginBottom: 20,
  },

  searchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  addBtn: {
    backgroundColor: "#ff8c8c",
    padding: 10,
    borderRadius: 10,
  },

  room: {
    backgroundColor: "#bcd0df",
    padding: 40,
    borderRadius: 20,
    marginBottom: 20,
    alignItems: "center",
  },

  roomText: {
    fontSize: 28,
  },

  navbar: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#c7d8e6",
    padding: 15,
    borderRadius: 10,
  },

  // 🔥 DASHBOARD STYLE
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },

  cardTitle: {
    color: "#666",
    fontSize: 14,
  },

  cardNumber: {
    fontSize: 22,
    fontWeight: "bold",
  },
});