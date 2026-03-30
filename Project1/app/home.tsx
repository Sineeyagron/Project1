import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function Home() {
  const router = useRouter();

  const rooms = ["CP9524", "SC9604", "MA3012"];

  return (
    <View style={styles.container}>

      {/* 🔵 TOP TITLE */}
      <Text style={styles.topTitle}>ห้องเรียน</Text>

      {/* 🔵 BIG TITLE */}
      <Text style={styles.title}>ห้องเรียน</Text>

      {/* 🔍 SEARCH */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput placeholder="Search rooms..." style={styles.input} />
      </View>

      {/* 🔵 BLUE CARD */}
      <View style={styles.card}>
        <Text style={styles.bigNumber}>42</Text>
        <Text style={styles.sub}>TOTAL CLASSROOMS</Text>
      </View>

      {/* 📦 ROOMS */}
      <ScrollView>
        {rooms.map((room, i) => (
          <TouchableOpacity
            key={i}
            style={styles.room}
            onPress={() => router.push("/roommap")}
          >
            <Text style={styles.roomText}>{room}</Text>

            <View style={styles.circle}>
              <Ionicons name="chevron-forward" size={16} color="#1e3a8a" />
            </View>
          </TouchableOpacity>
        ))}

        {/* ➕ ADD */}
        <View style={styles.addBox}>
          <Ionicons name="add" size={20} color="#1e3a8a" />
          <Text style={styles.addText}>Register New Room</Text>
        </View>
      </ScrollView>

      {/* ➕ FLOAT */}
      <TouchableOpacity style={styles.fab}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      {/* 🔻 TAB BAR */}
      <View style={styles.tab}>

        <TouchableOpacity style={styles.activeTab}>
          <Ionicons name="home" size={20} color="#fff" />
          <Text style={styles.activeText}>ชั้นเรียน</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("./equipment")}>
          <Ionicons name="construct-outline" size={20} />
          <Text>อุปกรณ์</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("./notifications")}>
          <Ionicons name="notifications-outline" size={20} />
          <Text>แจ้งเตือน</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("./profile")}>
          <Ionicons name="person-outline" size={20} />
          <Text>โปรไฟล์</Text>
        </TouchableOpacity>

      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f1f5f9",
  },

  topTitle: {
    textAlign: "center",
    color: "#1e3a8a",
    marginBottom: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginBottom: 10,
  },

  searchBox: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
  },

  input: {
    marginLeft: 10,
    flex: 1,
  },

  card: {
    backgroundColor: "#0f3a6d",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },

  bigNumber: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
  },

  sub: {
    color: "#cbd5e1",
    letterSpacing: 2,
  },

  room: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    marginBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  roomText: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#1e3a8a",
  },

  circle: {
    width: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },

  addBox: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    padding: 25,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 10,
  },

  addText: {
    marginTop: 5,
    color: "#1e3a8a",
  },

  fab: {
    position: "absolute",
    right: 20,
    bottom: 100,
    backgroundColor: "#0f3a6d",
    padding: 15,
    borderRadius: 30,
  },

  tab: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    position: "absolute",
    bottom: 10,
    width: "100%",
  },

  activeTab: {
    backgroundColor: "#0f3a6d",
    padding: 10,
    borderRadius: 15,
    alignItems: "center",
  },

  activeText: {
    color: "#fff",
    fontSize: 12,
  },
});