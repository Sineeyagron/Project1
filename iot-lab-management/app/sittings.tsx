import React, { useEffect, useState } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text } from "../components/AppText";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";
import { goBack } from "../lib/nav";
import { confirmAction } from "../lib/notify";
import { W } from "../lib/theme";

export default function Settings() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("email").eq("id", user.id).single()
        .then(({ data }) => {
          const mail = data?.email || user.email || "";
          setEmail(mail);
          setUsername(mail.split("@")[0]);
        });
    });
  }, []);

  const handleLogout = () => {
    confirmAction("ออกจากระบบ", "ต้องการออกจากระบบใช่ไหม?", "ออกจากระบบ", async () => {
      await supabase.auth.signOut();
      router.replace("/login");
    }, true);
  };

  return (
    <View style={s.container}>

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => goBack("/profile")} activeOpacity={0.84}>
          <Ionicons name="chevron-back" size={21} color="#172033" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>ตั้งค่า</Text>
      </View>

      <View style={s.body}>

        {/* USER INFO */}
        <View style={s.userCard}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarInitial}>{username.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.userName}>{username}</Text>
            <Text style={s.userEmail}>{email}</Text>
          </View>
        </View>

        {/* MENU */}
        <Text style={s.sectionLabel}>บัญชี</Text>

        {/* เปิดมาจากหน้าโปรไฟล์ → ถอยกลับไป ไม่เปิดซ้อน (เดิม โปรไฟล์ ↔ ตั้งค่า วนซ้อนได้ไม่จบ) */}
        <TouchableOpacity style={s.menuItem} onPress={() => router.dismissTo("/profile")}>
          <View style={[s.menuIcon, { backgroundColor: "#eff6ff" }]}>
            <Ionicons name="person-outline" size={20} color="#1D4ED8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.menuTitle}>โปรไฟล์</Text>
            <Text style={s.menuSub}>ดูข้อมูลและประวัติการยืม</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity style={s.menuItem} onPress={() => router.push("/borrow")}>
          <View style={[s.menuIcon, { backgroundColor: "#fef3c7" }]}>
            <Ionicons name="time-outline" size={20} color="#b45309" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.menuTitle}>ประวัติการยืม</Text>
            <Text style={s.menuSub}>ดูรายการยืม-คืนทั้งหมด</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </TouchableOpacity>

        <Text style={s.sectionLabel}>ระบบ</Text>

        {/* LOGOUT */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <View style={[s.menuIcon, { backgroundColor: "#fee2e2" }]}>
            <Ionicons name="log-out-outline" size={20} color="#dc2626" />
          </View>
          <Text style={s.logoutTxt}>ออกจากระบบ</Text>
        </TouchableOpacity>

        {/* VERSION */}
        <Text style={s.version}>IoT Lab Management · v1.0.0</Text>

      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },

  header: {
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: { ...W.small, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#172033", fontSize: 20, fontWeight: "700" },

  body: { padding: 16 },

  userCard: {
    ...W.card,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#1D4ED8", justifyContent: "center", alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontSize: 22, fontWeight: "800" },
  userName: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  userEmail: { fontSize: 12, color: "#64748b", marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 10, marginTop: 4,
  },

  menuItem: {
    ...W.card,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 8,
  },
  menuIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  menuTitle: { fontSize: 14, fontWeight: "600", color: "#1e293b" },
  menuSub: { fontSize: 11, color: "#94a3b8", marginTop: 2 },

  logoutBtn: {
    ...W.card, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  logoutTxt: { fontSize: 14, fontWeight: "600", color: "#dc2626" },

  version: {
    textAlign: "center", fontSize: 11, color: "#cbd5e1",
    marginTop: 32,
  },
});
