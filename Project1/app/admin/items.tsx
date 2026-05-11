import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

export default function AdminItems() {
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from("items")
      .select("*");

    if (error) {
      console.log(error);
    } else {
      setItems(data);
    }
  };

  // 🔥 เพิ่ม item
  const addItem = async () => {
    if (!name) return;

    const { error } = await supabase
      .from("items")
      .insert([
        {
          name: name,
          status: "available",
        },
      ]);

    if (error) {
      console.log(error);
      alert("เพิ่มไม่สำเร็จ");
      return;
    }

    setName("");
    fetchItems();
  };

  // ── อธิบาย ──────────────────────────────────────────────────────────
  // ก่อนหน้า: ลบ item ทันทีโดยไม่เช็ค → ถ้ายังมีคนยืมอยู่
  // DB จะ error เพราะ borrow_records ยังอ้างถึง item นั้น (foreign key)
  //
  // แก้แล้ว: เช็คก่อนว่ามี borrow_records ที่ status="borrowed" อยู่ไหม
  // ถ้ามี → แจ้งเตือน ลบไม่ได้
  // ถ้าไม่มี → ลบได้
  // ────────────────────────────────────────────────────────────────────
  const deleteItem = (id: any) => {
    Alert.alert(
      "ลบอุปกรณ์",
      "ต้องการลบใช่ไหม?",
      [
        { text: "ยกเลิก" },
        {
          text: "ลบ",
          onPress: async () => {
            // เช็คว่ามีคนยืมอุปกรณ์นี้อยู่ไหม
            const { data: activeBorrows } = await supabase
              .from("borrow_records")
              .select("id")
              .eq("item_id", id)
              .eq("status", "borrowed");

            if (activeBorrows && activeBorrows.length > 0) {
              Alert.alert(
                "ลบไม่ได้",
                "อุปกรณ์นี้ยังถูกยืมอยู่ กรุณารอให้คืนก่อน"
              );
              return;
            }

            // ปลอดภัยแล้ว ลบได้
            const { error } = await supabase
              .from("items")
              .delete()
              .eq("id", id);

            if (error) {
              Alert.alert("ลบไม่สำเร็จ", error.message);
              return;
            }

            fetchItems();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>

      {/* 🔙 HEADER */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.push("/admin/home")}>
          <Text style={styles.backBtn}>← กลับ</Text>
        </TouchableOpacity>

        <Text style={styles.header}>จัดการอุปกรณ์</Text>

        <View style={{ width: 50 }} />
      </View>

      {/* ➕ ADD */}
      <View style={styles.addRow}>
        <TextInput
          placeholder="ชื่ออุปกรณ์"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <TouchableOpacity style={styles.addBtn} onPress={addItem}>
          <Text style={{ color: "#fff" }}>เพิ่ม</Text>
        </TouchableOpacity>
      </View>

      {/* 📦 LIST */}
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.title}>📦 {item.name}</Text>

          <Text style={styles.status}>
            STATUS: {item.status}
          </Text>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => deleteItem(item.id)}
          >
            <Text style={{ color: "#fff" }}>ลบ</Text>
          </TouchableOpacity>
        </View>
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

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  backBtn: {
    fontSize: 16,
    color: "#1e3a8a",
    fontWeight: "bold",
  },

  header: {
    fontSize: 18,
    fontWeight: "bold",
  },

  addRow: {
    flexDirection: "row",
    marginBottom: 20,
  },

  input: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    marginRight: 10,
  },

  addBtn: {
    backgroundColor: "#1e3a8a",
    padding: 10,
    borderRadius: 10,
    justifyContent: "center",
  },

  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },

  title: {
    fontWeight: "bold",
  },

  status: {
    color: "#666",
    marginTop: 5,
  },

  deleteBtn: {
    marginTop: 10,
    backgroundColor: "red",
    padding: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
});