import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Profile() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Profile</Text>

        <TouchableOpacity onPress={() => router.push("./sittings")}>
          <Ionicons name="settings" size={24} color="#1e3a8a" />
        </TouchableOpacity>
      </View>

      {/* AVATAR */}
      <View style={styles.avatarWrapper}>
        <View style={styles.avatarCircle}>
          <Image
            source={{
              uri: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
            }}
            style={styles.avatar}
          />
        </View>

        <TouchableOpacity style={styles.editBtn}>
          <Ionicons name="pencil" size={16} color="#1e3a8a" />
        </TouchableOpacity>
      </View>

      {/* NAME */}
      <Text style={styles.name}>Alex Thompson</Text>
      <Text style={styles.email}>
        a.thompson@azure-inventory.com
      </Text>

      {/* STATS */}
      <View style={styles.stats}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>24</Text>
          <Text style={styles.statLabel}>TOTAL BORROWS</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>02</Text>
          <Text style={styles.statLabel}>ACTIVE LOANS</Text>
        </View>
      </View>

      {/* HISTORY HEADER */}
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Borrowing History</Text>
        <Text style={styles.viewAll}>View All</Text>
      </View>

      {/* HISTORY LIST */}
      <View style={styles.item}>
        <Text style={styles.itemTitle}>Temperature Sensor (AA)</Text>
        <Text style={styles.blue}>คืนแล้ว</Text>
      </View>

      <View style={[styles.item, styles.redBorder]}>
        <Text style={styles.itemTitle}>IoT Gateway Hub v2</Text>
        <Text style={styles.red}>ล่าช้า</Text>
      </View>

      <View style={styles.item}>
        <Text style={styles.itemTitle}>Microcontroller Unit #4</Text>
        <Text style={styles.blue}>คืนแล้ว</Text>
      </View>

      {/* TAB */}
      <View style={styles.tab}>

        <TouchableOpacity onPress={() => router.push("./home")}>
          <Text>ชั้นเรียน</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("./equipment")}>
          <Text>อุปกรณ์</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("./notifications")}>
          <Text>แจ้งเตือน</Text>
        </TouchableOpacity>

        <TouchableOpacity>
          <Text style={styles.activeTab}>โปรไฟล์</Text>
        </TouchableOpacity>

      </View>

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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e3a8a",
  },

  avatarWrapper: {
    alignItems: "center",
    marginTop: 20,
  },

  avatarCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: "#1e3a8a",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fcd5b5",
  },

  avatar: {
    width: 80,
    height: 80,
  },

  editBtn: {
    position: "absolute",
    bottom: 0,
    right: 110,
    backgroundColor: "#fff",
    padding: 8,
    borderRadius: 20,
    elevation: 3,
  },

  name: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
  },

  email: {
    textAlign: "center",
    color: "#64748b",
    marginBottom: 20,
  },

  stats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  statCard: {
    backgroundColor: "#e2e8f0",
    width: "48%",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
  },

  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e3a8a",
  },

  statLabel: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 5,
  },

  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },

  historyTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },

  viewAll: {
    color: "#1e3a8a",
  },

  item: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  redBorder: {
    borderLeftWidth: 4,
    borderLeftColor: "red",
  },

  itemTitle: {
    fontWeight: "bold",
  },

  blue: {
    color: "#1e3a8a",
  },

  red: {
    color: "red",
  },

  tab: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 30,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
  },

  activeTab: {
    color: "#1e3a8a",
    fontWeight: "bold",
  },
});