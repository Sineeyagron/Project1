import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

const C = {
  bg: "#eef2f8",
  purple: "#7c3aed",
  purpleDeep: "#5b21b6",
  card: "#ffffff",
  ink: "#111827",
  text: "#1f2937",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#d8dde8",
  green: "#10b981",
  orange: "#f59e0b",
  red: "#ef4444",
};

type RoomStats = {
  room_id: string;
  total: number;
  available: number;
  repair: number;
  broken: number;
  lanIssues: number;
};

const FALLBACK_ROOMS = ["CP9524", "SC9604"];

export default function AdminRoom() {
  const router = useRouter();

  const [stats, setStats] = useState<RoomStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [{ data: stations }, { data: lanData }] = await Promise.all([
      supabase.from("computer_stations").select("room_id, status"),
      supabase.from("lan_ports").select("room_id, status").neq("status", "available"),
    ]);

    const roomsFromDb = [
      ...new Set([
        ...(stations || []).map((station: any) => station.room_id).filter(Boolean),
        ...(lanData || []).map((port: any) => port.room_id).filter(Boolean),
      ]),
    ] as string[];

    const rooms = roomsFromDb.length > 0 ? roomsFromDb.sort() : FALLBACK_ROOMS;

    const result: RoomStats[] = rooms.map((room) => {
      const roomStations = (stations || []).filter((station: any) => station.room_id === room);
      const roomLanIssues = (lanData || []).filter((port: any) => port.room_id === room).length;
      return {
        room_id: room,
        total: roomStations.length,
        available: roomStations.filter((station: any) => station.status === "available").length,
        repair: roomStations.filter((station: any) => station.status === "repair").length,
        broken: roomStations.filter((station: any) => station.status === "broken").length,
        lanIssues: roomLanIssues,
      };
    });

    setStats(result);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const totals = useMemo(() => ({
    rooms: stats.length,
    stations: stats.reduce((sum, room) => sum + room.total, 0),
    warnings: stats.reduce((sum, room) => sum + room.lanIssues + room.repair + room.broken, 0),
  }), [stats]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.replace("/admin/home")} activeOpacity={0.82}>
            <Ionicons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>จัดการห้อง</Text>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/admin/stations" as any)} activeOpacity={0.82}>
            <Ionicons name="add" size={21} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <View style={s.summaryRow}>
          <HeaderStat value={totals.rooms} label="ห้องทั้งหมด" />
          <HeaderStat value={totals.stations} label="เครื่องทั้งหมด" />
          <HeaderStat value={totals.warnings} label="แจ้งเตือน" />
        </View>
      </View>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={C.purple} />
          <Text style={s.loadingText}>กำลังโหลดข้อมูลห้อง...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />}
        >
          {stats.map((room) => (
            <View key={room.room_id} style={s.roomCard}>
              <View style={s.roomHeader}>
                <View style={s.roomIconBox}>
                  <Ionicons name="business-outline" size={21} color={C.purple} />
                </View>
                <View style={s.roomTitleBlock}>
                  <Text style={s.roomName}>{room.room_id}</Text>
                  <Text style={s.roomSub}>{room.total} เครื่องทั้งหมด</Text>
                </View>

                {room.lanIssues > 0 ? (
                  <View style={s.warnBadge}>
                    <Ionicons name="warning-outline" size={13} color="#c2410c" />
                    <Text style={s.warnText}>LAN {room.lanIssues} port</Text>
                  </View>
                ) : (
                  <View style={s.okBadge}>
                    <Ionicons name="checkmark-circle-outline" size={13} color={C.green} />
                    <Text style={s.okText}>ปกติ</Text>
                  </View>
                )}
              </View>

              <View style={s.statusGrid}>
                <RoomMetric value={room.available} label="ว่าง" color={C.green} />
                <RoomMetric value={room.repair} label="ซ่อม" color={room.repair > 0 ? C.orange : C.faint} />
                <RoomMetric value={room.broken} label="พัง" color={room.broken > 0 ? C.red : C.faint} />
              </View>

              <View style={s.actionRow}>
                <ActionButton icon="map-outline" label="ผังห้อง" onPress={() => router.push({ pathname: "/roommap", params: { room_id: room.room_id } } as any)} />
                <ActionButton icon="desktop-outline" label="จัดการเครื่อง" onPress={() => router.push("/admin/stations" as any)} />
                <ActionButton icon="git-network-outline" label="LAN Port" onPress={() => router.push("/admin/lanports" as any)} />
              </View>
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

function HeaderStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={s.headerStat}>
      <Text style={s.headerStatValue}>{value}</Text>
      <Text style={s.headerStatLabel}>{label}</Text>
    </View>
  );
}

function RoomMetric({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={s.metricCell}>
      <Text style={[s.metricValue, { color }]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
      <View style={[s.metricLine, { backgroundColor: color }]} />
    </View>
  );
}

function ActionButton({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.actionBtn} onPress={onPress} activeOpacity={0.84}>
      <Ionicons name={icon} size={19} color={C.ink} />
      <Text style={s.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.purple,
    paddingTop: 23,
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  iconBtn: {
    width: 31,
    height: 31,
    borderRadius: 8,
    backgroundColor: "rgba(39, 18, 98, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(18, 11, 54, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  summaryRow: { flexDirection: "row", gap: 8 },
  headerStat: {
    flex: 1,
    minHeight: 88,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerStatValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22,
  },
  headerStatLabel: {
    color: "#ede9fe",
    fontSize: 10.5,
    fontWeight: "800",
    marginTop: 9,
    textAlign: "center",
  },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: C.faint, fontSize: 13, fontWeight: "700" },
  scroll: { paddingHorizontal: 23, paddingTop: 14 },
  roomCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: 13,
    overflow: "hidden",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  roomHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  roomIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#ede9fe",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },
  roomTitleBlock: { flex: 1 },
  roomName: { fontSize: 14.5, fontWeight: "900", color: C.ink, lineHeight: 18 },
  roomSub: { fontSize: 11, color: "#374151", fontWeight: "600", marginTop: 2 },
  warnBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffedd5",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },
  warnText: { fontSize: 10.5, color: "#c2410c", fontWeight: "800" },
  okBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  okText: { fontSize: 10.5, color: C.green, fontWeight: "900" },
  statusGrid: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  metricCell: {
    flex: 1,
    minHeight: 78,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: C.line,
  },
  metricValue: { fontSize: 20, fontWeight: "900", lineHeight: 23 },
  metricLabel: { color: C.muted, fontSize: 11, fontWeight: "800", marginTop: 5 },
  metricLine: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 0,
    height: 2,
    borderRadius: 2,
  },
  actionRow: { flexDirection: "row" },
  actionBtn: {
    flex: 1,
    minHeight: 52,
    borderRightWidth: 1,
    borderRightColor: "#bfc5d1",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionText: { color: C.ink, fontSize: 12, fontWeight: "800" },
});
