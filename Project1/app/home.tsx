import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
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

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    // ดึง room_id ที่ไม่ซ้ำกันจาก computer_stations
    const { data, error } = await supabase
      .from("computer_stations")
      .select("room_id");

    if (error) {
      console.log(error);
      setLoading(false);
      return;
    }

    // distinct room_id
    const uniqueRooms = [...new Set(data.map((r: any) => r.room_id))];
    setRooms(uniqueRooms);
    setTotalStations(data.length);
    setLoading(false);
  };

  // กรองตาม search
  const filteredRooms = rooms.filter(r =>
    r.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>

      {/* TITLE */}
      <Text style={styles.title}>ห้องเรียน</Text>

      {/* SEARCH */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          placeholder="ค้นหาห้อง..."
          style={styles.input}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* STAT CARD */}
      <View style={styles.card}>
        <Text style={styles.bigNumber}>{loading ? "..." : totalStations}</Text>
        <Text style={styles.sub}>TOTAL COMPUTER STATIONS</Text>
        <Text style={styles.subSmall}>{rooms.length} ห้อง</Text>
      </View>

      {/* ROOMS */}
      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {filteredRooms.map((room, i) => (
            <TouchableOpacity
              key={i}
              style={styles.room}
              onPress={() => router.push({
                pathname: "/roommap",
                params: { room_id: room },
              })}
            >
              <View>
                <Text style={styles.roomText}>{room}</Text>
                <Text style={styles.roomSub}>กดเพื่อดูผังห้องและสถานะเครื่อง</Text>
              </View>
              <View style={styles.circle}>
                <Ionicons name="chevron-forward" size={16} color="#1e3a8a" />
              </View>
            </TouchableOpacity>
          ))}

          {filteredRooms.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>ไม่พบห้องที่ค้นหา</Text>
            </View>
          )}

          {/* LAN STATUS shortcut */}
          <TouchableOpacity
            style={styles.lanBtn}
            onPress={() => router.push("/lanstatus")}
          >
            <Ionicons name="git-network-outline" size={22} color="#7c3aed" />
            <View style={{ flex: 1 }}>
              <Text style={styles.lanBtnText}>สถานะช่องเสียบสายแลน</Text>
              <Text style={styles.lanBtnSub}>ตู้ Server / Patch Panel</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#7c3aed" />
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* TAB BAR */}
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
    paddingTop: 50,
    backgroundColor: "#f1f5f9",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: "row",
    backgroundColor: "#e2e8f0",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  input: {
    marginLeft: 10,
    flex: 1,
    fontSize: 14,
  },
  card: {
    backgroundColor: "#0f3a6d",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  bigNumber: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "bold",
  },
  sub: {
    color: "#cbd5e1",
    letterSpacing: 2,
    fontSize: 11,
  },
  subSmall: {
    color: "#93c5fd",
    fontSize: 12,
    marginTop: 4,
  },
  room: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 20,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roomText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e3a8a",
  },
  roomSub: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  circle: {
    width: 35,
    height: 35,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  empty: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  lanBtn: {
    backgroundColor: "#f5f3ff",
    borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 12,
    marginBottom: 12, borderWidth: 1, borderColor: "#ede9fe",
  },
  lanBtnText: { fontSize: 14, fontWeight: "700", color: "#5b21b6" },
  lanBtnSub: { fontSize: 11, color: "#8b5cf6", marginTop: 2 },
  tab: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 10,
    position: "absolute",
    bottom: 10,
    left: 20,
    right: 20,
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
