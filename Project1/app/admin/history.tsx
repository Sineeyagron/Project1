import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import supabase from "../../lib/supabase";

export default function AdminHistory() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from("borrow_records")
      .select(`
        id,
        user_id,
        status,
        borrow_date,
        items (
          name
        )
      `)
      .order("borrow_date", { ascending: false });

    if (error) {
      console.log(error);
    } else {
      setData(data);
    }
  };

    const router = useRouter();

  return (
    <ScrollView style={styles.container}>

        <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.push("/admin/home")}>
        <Text style={styles.backBtn}>← กลับ</Text>
    </TouchableOpacity>

    <Text style={styles.header}>ประวัติการยืม</Text>

    <View style={{ width: 50 }} />
    </View>

      {data.map((item) => (
        <View key={item.id} style={styles.card}>

          <Text style={styles.title}>
            📦 {item.items?.name || item.items?.[0]?.name}
          </Text>

          <Text style={styles.text}>
            👤 User: {item.user_id}
          </Text>

          <Text style={styles.text}>
            📊 Status: {item.status}
          </Text>

          <Text style={styles.date}>
            🕒 {item.borrow_date
              ? new Date(item.borrow_date).toLocaleString()
              : ""}
          </Text>

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

  header: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },

  title: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 5,
  },

  text: {
    color: "#555",
  },

  date: {
    fontSize: 12,
    color: "#888",
    marginTop: 5,
  },

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
});