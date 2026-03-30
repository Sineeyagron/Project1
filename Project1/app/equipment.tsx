import { useEffect, useState } from "react";
import supabase from "../lib/supabase";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Equipment() {
  const router = useRouter();

  const [items, setItems] = useState<any>([]);

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

  const borrowItem = async (item: { status: string; id: any; }) => {
    if (item.status !== "available") {
      alert("อุปกรณ์ถูกยืมแล้ว");
      return;
    }

    const { error } = await supabase
      .from("borrow_records")
      .insert([
        {
          user_id: "11111111-1111-1111-1111-111111111111",
          item_id: item.id,
          status: "borrowed",
        },
      ]);

    if (error) {
      alert("ยืมไม่สำเร็จ");
      return;
    }

    await supabase
      .from("items")
      .update({ status: "borrowed" })
      .eq("id", item.id);

    alert("ยืมสำเร็จ 🎉");

    fetchItems();
  };

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <Text style={styles.header}>Borrowing</Text>

      {/* SEARCH */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput placeholder="Search equipment..." style={styles.input} />
      </View>

      {/* MY BORROW */}
      <TouchableOpacity
        style={styles.borrowCard}
        onPress={() => router.push("./borrow")}
      >
        <View style={styles.borrowLeft}>
          <Ionicons name="cube-outline" size={24} color="#fff" />
          <View>
            <Text style={styles.borrowTitle}>My Borrowing</Text>
            <Text style={styles.borrowSub}>
              VIEW YOUR ACTIVE REQUESTS & ITEMS
            </Text>
          </View>
        </View>

        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>

      {/* TITLE */}
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>Equipment Gallery</Text>
        <Text style={styles.all}>ALL ITEMS</Text>
      </View>

      {/* LIST */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {items.map((item: any) => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.item}
            onPress={() => borrowItem(item)}
          >
            
            <View style={styles.iconBox}>
              <Ionicons name="laptop-outline" size={20} color="#1e3a8a" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.subText}>
                STATUS: {item.status}
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* TAB */}
      <View style={styles.tab}>
        <TouchableOpacity onPress={() => router.push("/home")}>
          <Text>ชั้นเรียน</Text>
        </TouchableOpacity>

        <TouchableOpacity>
          <Text style={styles.active}>อุปกรณ์</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("./notifications")}>
          <Text>แจ้งเตือน</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("./profile")}>
          <Text>โปรไฟล์</Text>
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

  header: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginBottom: 10,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    padding: 10,
    marginBottom: 20,
    gap: 8,
  },

  input: {
    flex: 1,
  },

  borrowCard: {
    backgroundColor: "#0f3a6d",
    borderRadius: 15,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  borrowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  borrowTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  borrowSub: {
    color: "#cbd5e1",
    fontSize: 10,
  },

  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },

  all: {
    color: "#94a3b8",
  },

  item: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  iconBox: {
    width: 40,
    height: 40,
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  itemTitle: {
    fontWeight: "bold",
  },

  subText: {
    fontSize: 12,
    color: "#64748b",
  },

  tab: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
    marginTop: 10,
  },

  active: {
    color: "#1e3a8a",
    fontWeight: "bold",
  },
});