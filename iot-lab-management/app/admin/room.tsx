import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

const ROOMS = ["CP9524", "SC9604"];

type RoomStats = {
  room_id: string;
  total: number;
  available: number;
  repair: number;
  broken: number;
  lanIssues: number;
};

export default function AdminRoom() {
  const router = useRouter();

  const [stats, setStats]     = useState<RoomStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchStats(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchStats(); };

  const fetchStats = async () => {
    const [{ data: stations }, { data: lanData }] = await Promise.all([
      supabase.from("computer_stations").select("room_id, status"),
      supabase.from("lan_ports").select("room_id, status").neq("status", "available"),
    ]);

    const result: RoomStats[] = ROOMS.map(room => {
      const roomStations = (stations || []).filter((s: any) => s.room_id === room);
      const roomLanIssues = (lanData || []).filter((l: any) => l.room_id === room).length;
      return {
        room_id:   room,
        total:     roomStations.length,
        available: roomStations.filter((s: any) => s.status === "available").length,
        repair:    roomStations.filter((s: any) => s.status === "repair").length,
        broken:    roomStations.filter((s: any) => s.status === "broken").length,
        lanIssues: roomLanIssues,
      };
    });

    setStats(result);
    setLoading(false);
    setRefreshing(false);
  };

  return (
    <View style={s.container}>

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTxt}>จัดการห้อง</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#8b5cf6" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}>

          {stats.map(room => (
            <View key={room.room_id} style={s.roomCard}>

              {/* Room title */}
              <View style={s.roomHeader}>
                <View style={s.roomIconBox}>
                  <Ionicons name="business-outline" size={20} color="#8b5cf6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.roomName}>{room.room_id}</Text>
                  <Text style={s.roomSub}>{room.total} เครื่องทั้งหมด</Text>
                </View>
                {room.lanIssues > 0 && (
                  <View style={s.warnBadge}>
                    <Ionicons name="warning-outline" size={12} color="#b45309" />
                    <Text style={s.warnTxt}>LAN {room.lanIssues} port</Text>
                  </View>
                )}
              </View>

              {/* Station stats */}
              <View style={s.statRow}>
                <View style={[s.statBox, { backgroundColor: "#dcfce7" }]}>
                  <Text style={[s.statNum, { color: "#16a34a" }]}>{room.available}</Text>
                  <Text style={s.statLbl}>ว่าง</Text>
                </View>
                <View style={[s.statBox, { backgroundColor: room.repair > 0 ? "#fef3c7" : "#f1f5f9" }]}>
                  <Text style={[s.statNum, { color: room.repair > 0 ? "#b45309" : "#94a3b8" }]}>{room.repair}</Text>
                  <Text style={s.statLbl}>ซ่อม</Text>
                </View>
                <View style={[s.statBox, { backgroundColor: room.broken > 0 ? "#fee2e2" : "#f1f5f9" }]}>
                  <Text style={[s.statNum, { color: room.broken > 0 ? "#dc2626" : "#94a3b8" }]}>{room.broken}</Text>
                  <Text style={s.statLbl}>พัง</Text>
                </View>
              </View>

              {/* Quick actions */}
              <View style={s.actionRow}>
                <TouchableOpacity style={s.actionBtn}
                  onPress={() => router.push({ pathname: "/roommap", params: { room_id: room.room_id } })}>
                  <Ionicons name="map-outline" size={14} color="#1d4ed8" />
                  <Text style={[s.actionTxt, { color: "#1d4ed8" }]}>ผังห้อง</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn}
                  onPress={() => router.push("/admin/stations")}>
                  <Ionicons name="desktop-outline" size={14} color="#dc2626" />
                  <Text style={[s.actionTxt, { color: "#dc2626" }]}>จัดการเครื่อง</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionBtn}
                  onPress={() => router.push("/admin/lanports")}>
                  <Ionicons name="git-network-outline" size={14} color="#7c3aed" />
                  <Text style={[s.actionTxt, { color: "#7c3aed" }]}>LAN Port</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    backgroundColor: "#1e3a8a", paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerTxt: { color: "#fff", fontSize: 17, fontWeight: "bold" },

  scroll: { padding: 16 },

  roomCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: "#e2e8f0",
  },
  roomHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  roomIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#ede9fe", justifyContent: "center", alignItems: "center",
  },
  roomName: { fontSize: 16, fontWeight: "800", color: "#1e293b" },
  roomSub: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  warnBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20,
  },
  warnTxt: { fontSize: 10, color: "#b45309", fontWeight: "700" },

  statRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  statBox: { flex: 1, borderRadius: 10, padding: 10, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800" },
  statLbl: { fontSize: 10, color: "#64748b", marginTop: 2 },

  actionRow: { flexDirection: "row", gap: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 12 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, backgroundColor: "#f8fafc", borderRadius: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  actionTxt: { fontSize: 11, fontWeight: "700" },
});
