import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";

export default function Borrow() {
  const router = useRouter();

  const [borrows, setBorrows] = useState<any[]>([]);

  useEffect(() => {
    fetchBorrows();
  }, []);

  // ── อธิบาย ──────────────────────────────────────────────────────────
  // ก่อนหน้านี้: ดึง borrow_records ทั้งหมด → ทุกคนเห็นของทุกคน ❌
  // แก้แล้ว: ดึง user ที่ login อยู่ก่อน แล้ว filter เฉพาะของ user นั้น ✅
  // ────────────────────────────────────────────────────────────────────
  const fetchBorrows = async () => {
    // ดึง user ปัจจุบันที่ login อยู่
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("borrow_records")
      .select(`
        id,
        status,
        borrow_date,
        item_id,
        items (
          name
        )
      `)
      .eq("user_id", user.id);  // กรองเฉพาะของ user นี้เท่านั้น

    if (error) {
      console.log(error);
    } else {
      setBorrows(data);
    }
  };

  // 🔥 ฟังก์ชัน "ขอคืน"
  const requestReturn = (item: any) => {
    if (item.status !== "borrowed") return;

    Alert.alert(
      "ขอคืนอุปกรณ์",
      "คุณต้องการขอคืนอุปกรณ์นี้ใช่ไหม?",
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ยืนยัน",
          onPress: async () => {
            const { error } = await supabase
              .from("borrow_records")
              .update({
                status: "pending_return",
              })
              .eq("id", item.id);

            if (error) {
              console.log(error);
              alert("ขอคืนไม่สำเร็จ");
              return;
            }

            alert("ส่งคำขอคืนแล้ว ✅");

            fetchBorrows();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.headerText}>การยืมของฉัน</Text>

        <View style={{ width: 22 }} />
      </View>

      {/* TITLE */}
      <View style={styles.rowBetween}>
        <Text style={styles.section}>รายการที่ยืม</Text>
      </View>

      {/* LIST */}
      {borrows.map((b) => (
        <TouchableOpacity
          key={b.id}
          style={styles.itemCard}
          onPress={() => {
            console.log("CLICK", b.status);

            if (b.status === "borrowed") {
              requestReturn(b);
            } else {
              Alert.alert("รายการนี้คืนไม่ได้");
            }
          }}
        > 
          <View style={styles.itemRow}>
            
            <View style={styles.iconBox}>
              <Ionicons name="cube-outline" size={20} color="#1e3a8a" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {b.items?.name || b.items?.[0]?.name || "ไม่มีชื่อ"}
              </Text>

              <Text style={styles.sub}>
                STATUS: {b.status}
              </Text>

              <Text style={styles.date}>
                {b.borrow_date
                  ? new Date(b.borrow_date).toLocaleDateString()
                  : ""}
              </Text>
            </View>

          </View>
        </TouchableOpacity>
      ))}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },

  header: {
    backgroundColor: "#3b6ea5",
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  section: {
    fontSize: 20,
    fontWeight: "bold",
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
  },

  itemCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 15,
    padding: 15,
    borderRadius: 15,
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  iconBox: {
    width: 50,
    height: 50,
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontWeight: "bold",
    fontSize: 16,
  },

  sub: {
    color: "#64748b",
    marginTop: 5,
  },

  date: {
    marginTop: 5,
    fontSize: 12,
    color: "#94a3b8",
  },
});