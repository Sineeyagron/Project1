import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function RoomMap() {
  const router = useRouter();
  const [selectedGroup, setSelectedGroup] = useState(1);

  return (
    <ScrollView style={styles.container}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1e3a8a" />
        </TouchableOpacity>
        <Text style={styles.headerText}>ผังห้อง</Text>
      </View>

      {/* TITLE */}
      <Text style={styles.subTitle}>INTERACTIVE ASSET MAP</Text>
      <Text style={styles.title}>ผังห้อง</Text>

      {/* MAP BOX */}
      <View style={styles.mapBox}>
        <Image
          source={require("../assets/images/c01.png")}
          style={styles.map}
        />

        {/* ปุ่มเครื่อง */}
        {[1, 2, 3, 4].map((num, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.pc,
              { left: 60 + i * 70, top: 200 },
              num === selectedGroup && styles.activePc,
            ]}
            onPress={() => alert(`Desk ${num}`)}
          >
            <Text style={styles.pcText}>{num}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* GROUP */}
      <Text style={styles.groupTitle}>NAVIGATION BY GROUP</Text>

      <View style={styles.groupContainer}>
        {Array.from({ length: 8 }).map((_, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.groupBtn,
              selectedGroup === i + 1 && styles.activeGroup,
            ]}
            onPress={() => setSelectedGroup(i + 1)}
          >
            <Text
              style={[
                styles.groupText,
                selectedGroup === i + 1 && { color: "#fff" },
              ]}
            >
              {i === 0 ? "Group 1" : `กลุ่มที่ ${i + 1}`}
            </Text>
          </TouchableOpacity>
        ))}
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
    alignItems: "center",
    gap: 10,
  },

  headerText: {
    fontSize: 18,
    fontWeight: "bold",
  },

  subTitle: {
    marginTop: 20,
    fontSize: 12,
    letterSpacing: 2,
    color: "#64748b",
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginBottom: 20,
  },

  mapBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 10,
    alignItems: "center",
    marginBottom: 30,
  },

  map: {
    width: 350,
    height: 250,
    resizeMode: "contain",
  },

  pc: {
    position: "absolute",
    width: 45,
    height: 45,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },

  activePc: {
    backgroundColor: "#1e3a8a",
  },

  pcText: {
    fontWeight: "bold",
    color: "#000",
  },

  groupTitle: {
    fontSize: 12,
    letterSpacing: 2,
    color: "#64748b",
    marginBottom: 10,
  },

  groupContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  groupBtn: {
    backgroundColor: "#e2e8f0",
    padding: 15,
    borderRadius: 12,
    width: "45%",
    alignItems: "center",
  },

  activeGroup: {
    backgroundColor: "#1e3a8a",
  },

  groupText: {
    color: "#1e3a8a",
    fontWeight: "bold",
  },
});