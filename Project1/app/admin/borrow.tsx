import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../../lib/supabase";

export default function AdminBorrow() {
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("borrow_records")
      .select(`
        id,
        status,
        item_id,
        items (
          name
        )
      `)
      .eq("status", "pending_return");

    if (error) {
      console.log(error);
    } else {
      setRequests(data);
    }
  };

  // 🔥 ฟังก์ชันยืนยันคืน
  const confirmReturn = (item: any) => {
    Alert.alert(
      "ยืนยันคืน",
      "ตรวจสอบของแล้วใช่ไหม?",
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ยืนยัน",
          onPress: async () => {
            // 1. update borrow_records
            await supabase
              .from("borrow_records")
              .update({
                status: "returned",
                return_date: new Date().toISOString(),
              })
              .eq("id", item.id);

            // 2. update items
            await supabase
              .from("items")
              .update({
                status: "available",
              })
              .eq("id", item.item_id);

            Alert.alert("สำเร็จ", "คืนของเรียบร้อย 🎉");

            fetchRequests();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>

      <Text style={styles.header}>รายการรอคืน</Text>

      {requests.map((r) => (
        <Pressable
          key={r.id}
          style={styles.card}
          onPress={() => confirmReturn(r)}
        >
          <View style={styles.row}>
            <Ionicons name="cube-outline" size={20} color="#1e3a8a" />

            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {r.items?.name || r.items?.[0]?.name}
              </Text>

              <Text style={styles.status}>
                STATUS: {r.status}
              </Text>
            </View>

            <Ionicons name="checkmark-circle" size={22} color="green" />
          </View>
        </Pressable>
      ))}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    padding: 20,
  },

  header: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  title: {
    fontWeight: "bold",
  },

  status: {
    color: "#64748b",
    fontSize: 12,
  },
});