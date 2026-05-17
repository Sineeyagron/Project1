import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";

export default function Home() {
  const router = useRouter();
  const [rooms, setRooms] = useState<string[]>([]);
  const [totalStations, setTotalStations] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchRooms(); }, []);

  const fetchRooms = async () => {
    const { data } = await supabase.from("computer_stations").select("room_id");
    const unique = [...new Set((data || []).map((r: any) => r.room_id))];
    setRooms(unique);
    setTotalStations(data?.length || 0);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); fetchRooms(); };
  const filtered = rooms.filter(r => r.toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={s.container}>

      {/* HEADER */}
      <View style={s.header}>
        <View>
          <Text style={s.headerGreet}>ระบบจัดการห้องแล็บ</Text>
          <Text style={s.headerTitle}>ห้องเรียน IoT</Text>
        </View>
        <View style={[s.statPill]}>
          <Ionicons name="desktop-outline" size={14} color="#93c5fd" />
          <Text style={s.statPillTxt}>{totalStations} เครื่อง</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}
      >
        {/* SEARCH */}
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={18} color="#94a3b8" />
          <TextInput
            placeholder="ค้นหาห้อง..."
            placeholderTextColor="#94a3b8"
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* SECTION LABEL */}
        <Text style={s.sectionLabel}>ห้องที่มีให้เลือก</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
        ) : (
          <>
            {filtered.map((room, i) => (
              <TouchableOpacity
                key={i}
                style={s.roomCard}
                onPress={() => router.push({ pathname: "/roommap", params: { room_id: room } })}
                activeOpacity={0.85}
              >
                <View style={s.roomIconBox}>
                  <Ionicons name="business-outline" size={24} color="#1e3a8a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.roomName}>{room}</Text>
                  <Text style={s.roomSub}>กดเพื่อดูผังห้องและสถานะเครื่อง</Text>
                </View>
                <View style={s.chevronBox}>
                  <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                </View>
              </TouchableOpacity>
            ))}

            {filtered.length === 0 && (
              <View style={s.empty}>
                <Ionicons name="search-outline" size={48} color="#cbd5e1" />
                <Text style={s.emptyTxt}>ไม่พบห้องที่ค้นหา</Text>
              </View>
            )}

            {/* LAN STATUS */}
            <Text style={s.sectionLabel}>ลิงก์ด่วน</Text>
            <TouchableOpacity style={s.lanCard} onPress={() => router.push("/lanstatus")}>
              <View style={s.lanIconBox}>
                <Ionicons name="git-network-outline" size={22} color="#7c3aed" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.lanTitle}>สถานะช่องเสียบสายแลน</Text>
                <Text style={s.lanSub}>ตู้ Server / Patch Panel</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#8b5cf6" />
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* TAB BAR */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tabItem, s.tabActive]}>
          <Ionicons name="home" size={22} color="#1e3a8a" />
          <Text style={[s.tabTxt, s.tabTxtActive]}>ชั้นเรียน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push("/equipment")}>
          <Ionicons name="cube-outline" size={22} color="#94a3b8" />
          <Text style={s.tabTxt}>อุปกรณ์</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push("/notifications")}>
          <Ionicons name="notifications-outline" size={22} color="#94a3b8" />
          <Text style={s.tabTxt}>แจ้งเตือน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push("/profile")}>
          <Ionicons name="person-outline" size={22} color="#94a3b8" />
          <Text style={s.tabTxt}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  header: {
    backgroundColor: "#1e3a8a",
    paddingTop: 58, paddingBottom: 20, paddingHorizontal: 20,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  headerGreet: { color: "#93c5fd", fontSize: 12 },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "bold", marginTop: 2 },
  statPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  statPillTxt: { color: "#fff", fontSize: 12, fontWeight: "600" },

  body: { padding: 16 },

  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    marginBottom: 20, borderWidth: 1, borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1e293b" },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 10, marginTop: 4,
  },

  roomCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 14,
    marginBottom: 10,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  roomIconBox: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: "#eff6ff", justifyContent: "center", alignItems: "center",
  },
  roomName: { fontSize: 18, fontWeight: "800", color: "#1e293b" },
  roomSub: { fontSize: 11, color: "#94a3b8", marginTop: 3 },
  chevronBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: "#f8fafc", justifyContent: "center", alignItems: "center",
  },

  lanCard: {
    backgroundColor: "#faf5ff", borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 14,
    borderWidth: 1, borderColor: "#ede9fe",
  },
  lanIconBox: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: "#ede9fe", justifyContent: "center", alignItems: "center",
  },
  lanTitle: { fontSize: 14, fontWeight: "700", color: "#5b21b6" },
  lanSub: { fontSize: 11, color: "#8b5cf6", marginTop: 3 },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTxt: { color: "#94a3b8", fontSize: 14 },

  tabBar: {
    flexDirection: "row", backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#e2e8f0",
    paddingBottom: 24, paddingTop: 10,
    position: "absolute", bottom: 0, left: 0, right: 0,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 3 },
  tabActive: {},
  tabTxt: { fontSize: 10, color: "#94a3b8" },
  tabTxtActive: { color: "#1e3a8a", fontWeight: "700" },
});
