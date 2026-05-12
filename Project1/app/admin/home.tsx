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

      {/* 🔥 MENU */}
      <View style={styles.menuGrid}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => router.push("/admin/borrow")}>
          <Text style={styles.menuIcon}>↩️</Text>
          <Text style={styles.menuText}>ยืนยันคืน</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuBtn} onPress={() => router.push("/admin/booking")}>
          <Text style={styles.menuIcon}>📅</Text>
          <Text style={styles.menuText}>การจองห้อง</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuBtn} onPress={() => router.push("/admin/items")}>
          <Text style={styles.menuIcon}>📦</Text>
          <Text style={styles.menuText}>จัดการอุปกรณ์</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuBtn} onPress={() => router.push("/admin/scan")}>
          <Text style={styles.menuIcon}>📷</Text>
          <Text style={styles.menuText}>สแกน & เพิ่ม</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuBtn} onPress={() => router.push("/admin/history")}>
          <Text style={styles.menuIcon}>📜</Text>
          <Text style={styles.menuText}>ประวัติยืม</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuBtn} onPress={() => router.push("/admin/status/editStatus")}>
          <Text style={styles.menuIcon}>🖥️</Text>
          <Text style={styles.menuText}>สถานะเครื่อง</Text>
        </TouchableOpacity>
      </View>

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

  menuGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  menuBtn: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  menuIcon: { fontSize: 24 },
  menuText: { fontSize: 12, fontWeight: "600", color: "#1e293b" },

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