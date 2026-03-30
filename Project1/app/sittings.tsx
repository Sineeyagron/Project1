import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Settings() {
  const router = useRouter();

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1e3a8a" />
        </TouchableOpacity>

        <Text style={styles.headerText}>Settings</Text>

        <View style={{ width: 22 }} />
      </View>

      {/* PROFILE */}
      <View style={styles.profileBox}>
        <View style={styles.avatarWrapper}>
          <Image
            source={{
              uri: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
            }}
            style={styles.avatar}
          />

          <TouchableOpacity style={styles.editBtn}>
            <Ionicons name="pencil" size={14} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.name}>Kittisak Azure</Text>
        <Text style={styles.role}>Inventory Manager</Text>
      </View>

      {/* ACCOUNT */}
      <Text style={styles.section}>ACCOUNT (บัญชี)</Text>

      <TouchableOpacity style={styles.menuItem}>
        <View style={styles.menuLeft}>
          <Ionicons name="person-outline" size={20} color="#1e3a8a" />
          <View>
            <Text style={styles.menuTitle}>Edit Profile</Text>
            <Text style={styles.menuSub}>แก้ไขโปรไฟล์</Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
      </TouchableOpacity>

      {/* LOGOUT */}
      <TouchableOpacity
        style={styles.logout}
        onPress={() => router.replace("/login")}
      >
        <Ionicons name="log-out-outline" size={20} color="red" />
        <Text style={styles.logoutText}>LOGOUT</Text>
      </TouchableOpacity>

      {/* FOOTER */}
      <View style={styles.footer}>
        <Text style={styles.version}>AZURE INVENTORY SYSTEM V2.4.0</Text>
        <Text style={styles.links}>Privacy Policy   Terms of Service</Text>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e3a8a",
  },

  profileBox: {
    alignItems: "center",
    marginTop: 20,
  },

  avatarWrapper: {
    position: "relative",
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  editBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#1e3a8a",
    padding: 6,
    borderRadius: 20,
  },

  name: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
  },

  role: {
    color: "#64748b",
  },

  section: {
    marginTop: 30,
    marginBottom: 10,
    fontSize: 12,
    color: "#94a3b8",
  },

  menuItem: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  menuTitle: {
    fontWeight: "bold",
  },

  menuSub: {
    fontSize: 12,
    color: "#64748b",
  },

  logout: {
    marginTop: 20,
    backgroundColor: "#fee2e2",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },

  logoutText: {
    color: "red",
    fontWeight: "bold",
  },

  footer: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    alignItems: "center",
  },

  version: {
    fontSize: 10,
    color: "#94a3b8",
  },

  links: {
    fontSize: 10,
    color: "#94a3b8",
  },
});