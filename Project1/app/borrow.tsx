import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Borrow() {
  const router = useRouter();

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

      {/* ล่าสุด */}
      <View style={styles.rowBetween}>
        <Text style={styles.section}>ล่าสุด</Text>
        <Text style={styles.link}>ดูทั้งหมด</Text>
      </View>

      {/* ACTIVE CARD */}
      <View style={styles.card}>

        <View style={styles.itemRow}>
          <View style={styles.iconBox}>
            <Ionicons name="cube-outline" size={20} color="#1e3a8a" />
          </View>

          <View>
            <Text style={styles.title}>Temperature Sensor (AA)</Text>
            <Text style={styles.status}>● IN POSSESSION</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.label}>BORROWED</Text>
            <Text style={styles.date}>15/03/69</Text>
          </View>

          <View>
            <Text style={styles.label}>RETURN</Text>
            <Text style={styles.date}>20/03/69</Text>
          </View>
        </View>

        <View style={styles.timeBox}>
          <Text style={styles.timeText}>Time remaining</Text>
          <Text style={styles.timeText}>0 days left</Text>
        </View>

      </View>

      {/* ITEM */}
      <View style={styles.itemCard}>
        <View style={styles.itemRow}>
          <View style={styles.iconBox}>
            <Ionicons name="wifi-outline" size={20} color="#1e3a8a" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Temperature Sensor (AA)</Text>
            <Text style={styles.sub}>ID: TS-0092-B</Text>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        </View>
      </View>

      {/* DATE */}
      <View style={styles.dateLine}>
        <Text style={styles.dateLineText}>15 / 04 / 69</Text>
      </View>

      {/* RETURNED */}
      <View style={styles.itemCard}>
        <View style={styles.itemRow}>
          <View style={styles.iconBoxGray}>
            <Ionicons name="cube-outline" size={20} color="#888" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Temperature Sensor (AA)</Text>
            <Text style={styles.returned}>RETURNED</Text>
          </View>

          <Text style={styles.qty}>QTY 1</Text>
        </View>
      </View>

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

  link: {
    color: "#1e3a8a",
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
  },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 20,
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

  iconBoxGray: {
    width: 50,
    height: 50,
    backgroundColor: "#eee",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontWeight: "bold",
    fontSize: 16,
  },

  status: {
    color: "#1e3a8a",
    marginTop: 5,
  },

  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 15,
  },

  label: {
    fontSize: 12,
    color: "#94a3b8",
  },

  date: {
    fontWeight: "bold",
    marginTop: 5,
  },

  timeBox: {
    backgroundColor: "#e2e8f0",
    padding: 15,
    borderRadius: 12,
    marginTop: 15,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  timeText: {
    color: "#1e3a8a",
  },

  itemCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 15,
    padding: 15,
    borderRadius: 15,
  },

  sub: {
    color: "#64748b",
  },

  dateLine: {
    alignItems: "center",
    marginVertical: 20,
  },

  dateLineText: {
    color: "#94a3b8",
  },

  returned: {
    color: "#94a3b8",
    marginTop: 5,
  },

  qty: {
    color: "#64748b",
  },
});