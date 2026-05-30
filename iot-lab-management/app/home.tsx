import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";

type Station = {
  id: string;
  room_id: string;
  group_no: number;
  name: string;
  status: string;
};

const BLUE = {
  bg: "#edf5ff",
  header: "#2563eb",
  headerDark: "#1d4ed8",
  blue: "#3b82f6",
  blueSoft: "#dbeafe",
  purple: "#7c3aed",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  card: "#ffffff",
  green: "#16a34a",
  yellow: "#facc15",
  orange: "#f59e0b",
};

function naturalRoom(room: string) {
  const match = String(room || "").match(/\d+/);
  return match ? Number(match[0]) : 99999;
}

function getRoomFloor(room: string) {
  if (/9524/i.test(room)) return "อาคารคอมพิวเตอร์ ชั้น 5";
  if (/9604/i.test(room)) return "อาคารวิทยาศาสตร์ ชั้น 6";
  return "ห้องปฏิบัติการ IoT";
}

export default function Home() {
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    const { data, error } = await supabase
      .from("computer_stations")
      .select("*")
      .order("room_id")
      .order("group_no")
      .order("name");

    if (error) {
      console.log(error);
      setStations([]);
    } else {
      setStations((data as Station[]) || []);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRooms();
  };

  const roomSummaries = useMemo(() => {
    const map = new Map<string, Station[]>();
    stations.forEach((station) => {
      const room = station.room_id || "ไม่ระบุห้อง";
      map.set(room, [...(map.get(room) || []), station]);
    });

    return [...map.entries()]
      .sort(([a], [b]) => naturalRoom(a) - naturalRoom(b) || a.localeCompare(b))
      .map(([room, rows]) => {
        const online = rows.filter((row) => row.status === "available").length;
        const problem = rows.length - online;
        return {
          room,
          total: rows.length,
          online,
          problem,
          floor: getRoomFloor(room),
        };
      });
  }, [stations]);

  const runSearch = () => {
    setActiveSearch(search.trim());
  };

  const filteredRooms = roomSummaries.filter((room) => {
    const query = activeSearch.trim().toLowerCase();
    if (!query) return true;
    return `${room.room} ${room.floor}`.toLowerCase().includes(query);
  });

  const totalStations = stations.length;
  const onlineStations = stations.filter((station) => station.status === "available").length;
  const problemStations = Math.max(totalStations - onlineStations, 0);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.headerKicker}>ระบบจัดการห้องแล็บ</Text>
            <View style={s.titleRow}>
              <View style={s.titleIcon}>
                <Ionicons name="business-outline" size={20} color="#ffffff" />
              </View>
              <Text style={s.headerTitle}>ห้องเรียน IoT</Text>
            </View>
          </View>
          <TouchableOpacity style={s.bellBtn} onPress={() => router.push("/notifications")} activeOpacity={0.84}>
            <Ionicons name="notifications-outline" size={21} color="#ffffff" />
          </TouchableOpacity>
        </View>

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Ionicons name="desktop-outline" size={14} color="#dbeafe" />
            <Text style={s.statLabel}>ทั้งหมด</Text>
            <Text style={s.statNumber}>{totalStations}</Text>
          </View>
          <View style={s.statCard}>
            <View style={[s.statDot, { backgroundColor: "#22c55e" }]} />
            <Text style={s.statLabel}>ออนไลน์</Text>
            <Text style={s.statNumber}>{onlineStations}</Text>
          </View>
          <View style={s.statCard}>
            <View style={[s.statDot, { backgroundColor: "#facc15" }]} />
            <Text style={s.statLabel}>มีปัญหา</Text>
            <Text style={s.statNumber}>{problemStations}</Text>
          </View>
        </View>

        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={18} color="#94a3b8" />
          <TextInput
            placeholder="ค้นหาห้องเรียน..."
            placeholderTextColor="#94a3b8"
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={runSearch}
          />
          {activeSearch.length > 0 ? (
            <TouchableOpacity
              style={s.clearSearchBtn}
              onPress={() => {
                setSearch("");
                setActiveSearch("");
              }}
              activeOpacity={0.82}
            >
              <Ionicons name="close" size={15} color="#64748b" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={s.filterBtn}
            onPress={runSearch}
            activeOpacity={0.84}
          >
            <Ionicons name="search" size={18} color={BLUE.purple} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BLUE.header} />}
      >
        <View style={s.sectionHead}>
          <View>
            <Text style={s.sectionTitle}>ห้องที่มีให้เลือก</Text>
            <Text style={s.sectionSub}>{roomSummaries.length} ห้อง พร้อมใช้งาน</Text>
          </View>
          <View style={s.viewToggle}>
            <TouchableOpacity
              style={[s.viewToggleBtn, viewMode === "grid" && s.viewToggleBtnActive]}
              onPress={() => setViewMode("grid")}
              activeOpacity={0.84}
            >
              <Ionicons name="grid-outline" size={17} color={viewMode === "grid" ? BLUE.purple : BLUE.faint} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.viewToggleBtn, viewMode === "list" && s.viewToggleBtnActive]}
              onPress={() => setViewMode("list")}
              activeOpacity={0.84}
            >
              <Ionicons name="list-outline" size={19} color={viewMode === "list" ? BLUE.purple : BLUE.faint} />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={BLUE.header} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={viewMode === "grid" ? s.roomGrid : undefined}>
              {filteredRooms.map((room, index) => {
                const hasProblem = room.problem > 0;
                return (
                  <TouchableOpacity
                    key={room.room}
                    style={[s.roomCard, viewMode === "grid" && s.roomCardGrid]}
                    onPress={() => router.push({ pathname: "/roommap", params: { room_id: room.room } })}
                    activeOpacity={0.88}
                  >
                    <View style={[s.roomIcon, index % 2 === 0 ? s.roomIconBlue : s.roomIconGold]}>
                      <Ionicons name="business-outline" size={26} color={index % 2 === 0 ? BLUE.purple : "#d97706"} />
                    </View>
                    <View style={s.roomInfo}>
                      <View style={s.roomTitleRow}>
                        <Text style={s.roomName}>{room.room}</Text>
                        <View style={[s.statusPill, hasProblem ? s.statusWarn : s.statusOk]}>
                          <View style={[s.statusDot, { backgroundColor: hasProblem ? BLUE.yellow : "#22c55e" }]} />
                          <Text style={[s.statusText, hasProblem ? s.statusWarnText : s.statusOkText]}>
                            {hasProblem ? `มีปัญหา ${room.problem}` : "ใช้งานได้"}
                          </Text>
                        </View>
                      </View>
                      <Text style={s.roomSub}>{room.floor}</Text>
                      <View style={s.roomMetaRow}>
                        <View style={s.roomMeta}>
                          <Ionicons name="desktop-outline" size={13} color="#64748b" />
                          <Text style={s.roomMetaText}>{room.total} เครื่อง</Text>
                        </View>
                        <View style={s.roomMeta}>
                          <Ionicons name="wifi-outline" size={13} color="#16a34a" />
                          <Text style={[s.roomMetaText, { color: "#16a34a" }]}>{room.online} ออนไลน์</Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={21} color="#94a3b8" />
                  </TouchableOpacity>
                );
              })}
            </View>

            {filteredRooms.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="search-outline" size={42} color="#bfdbfe" />
                <Text style={s.emptyText}>ไม่พบห้องที่ค้นหา</Text>
              </View>
            ) : null}

            <Text style={s.quickTitle}>ลิงก์ด่วน</Text>
            <View style={s.quickGrid}>
              <TouchableOpacity style={[s.quickCard, s.quickPurple]} onPress={() => router.push("/lanstatus")} activeOpacity={0.88}>
                <View style={s.quickIcon}>
                  <Ionicons name="git-network-outline" size={24} color={BLUE.purple} />
                </View>
                <Text style={s.quickName}>สถานะสายแลน</Text>
                <Text style={s.quickSub}>Server / Patch Panel</Text>
                <View style={s.quickGlow} />
              </TouchableOpacity>
              <TouchableOpacity style={[s.quickCard, s.quickBlue]} onPress={() => router.push("/borrow")} activeOpacity={0.88}>
                <View style={[s.quickIcon, { backgroundColor: "#eff6ff" }]}>
                  <Ionicons name="time-outline" size={23} color={BLUE.header} />
                </View>
                <Text style={s.quickName}>ประวัติการยืม</Text>
                <Text style={s.quickSub}>รายการยืม-คืน</Text>
                <View style={[s.quickGlow, { backgroundColor: "rgba(147,197,253,0.42)" }]} />
              </TouchableOpacity>
            </View>

            {problemStations > 0 ? (
              <TouchableOpacity style={s.alertCard} onPress={() => router.push("/roommap")} activeOpacity={0.88}>
                <View style={s.alertIcon}>
                  <Ionicons name="information-circle-outline" size={23} color="#d97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.alertTitle}>มีอุปกรณ์ต้องตรวจสอบ</Text>
                  <Text style={s.alertSub}>{roomSummaries.filter((room) => room.problem > 0).length} ห้อง มี {problemStations} เครื่องที่ต้องดูแล</Text>
                </View>
                <Ionicons name="chevron-forward" size={21} color="#d97706" />
              </TouchableOpacity>
            ) : null}
          </>
        )}

        <View style={{ height: 92 }} />
      </ScrollView>

      <View style={s.tabBar}>
        <TouchableOpacity style={s.tabItem} activeOpacity={0.82}>
          <Ionicons name="home" size={22} color={BLUE.purple} />
          <Text style={[s.tabText, s.tabTextActive]}>ชั้นเรียน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push("/equipment")} activeOpacity={0.82}>
          <Ionicons name="cube-outline" size={22} color={BLUE.faint} />
          <Text style={s.tabText}>อุปกรณ์</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push("/notifications")} activeOpacity={0.82}>
          <Ionicons name="notifications-outline" size={22} color={BLUE.faint} />
          <Text style={s.tabText}>แจ้งเตือน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push("/profile")} activeOpacity={0.82}>
          <Ionicons name="person-outline" size={22} color={BLUE.faint} />
          <Text style={s.tabText}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BLUE.bg },
  header: {
    backgroundColor: BLUE.header,
    paddingHorizontal: 30,
    paddingTop: 46,
    paddingBottom: 18,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
  },
  headerKicker: { color: "#dbeafe", fontSize: 11, fontWeight: "800", marginBottom: 7 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  titleIcon: {
    width: 35,
    height: 35,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "900" },
  bellBtn: {
    width: 39,
    height: 39,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.17)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  statCard: {
    flex: 1,
    minHeight: 66,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  statDot: { width: 7, height: 7, borderRadius: 99, marginBottom: 5 },
  statLabel: { color: "#e0ecff", fontSize: 10, fontWeight: "800" },
  statNumber: { color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 3 },
  searchBox: {
    height: 46,
    borderRadius: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingLeft: 14,
    paddingRight: 7,
  },
  searchInput: { flex: 1, color: BLUE.ink, fontSize: 13, fontWeight: "700" },
  clearSearchBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#f3e8ff",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: 30, paddingTop: 15 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: { color: BLUE.ink, fontSize: 14, fontWeight: "900" },
  sectionSub: { color: BLUE.muted, fontSize: 11, fontWeight: "700", marginTop: 1 },
  viewToggle: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: "#dbe4f0",
  },
  viewToggleBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  viewToggleBtnActive: { backgroundColor: "#f3e8ff" },
  roomGrid: { gap: 10 },
  roomCard: {
    backgroundColor: BLUE.card,
    borderRadius: 16,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 10,
    shadowColor: "#1e3a8a",
    shadowOpacity: 0.09,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  roomCardGrid: { marginBottom: 0 },
  roomIcon: {
    width: 50,
    height: 50,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  roomIconBlue: { backgroundColor: "#ede9fe" },
  roomIconGold: { backgroundColor: "#fef3c7" },
  roomInfo: { flex: 1, minWidth: 0 },
  roomTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  roomName: { color: BLUE.ink, fontSize: 16, fontWeight: "900" },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusOk: { backgroundColor: "#dcfce7" },
  statusWarn: { backgroundColor: "#fef3c7" },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  statusText: { fontSize: 10, fontWeight: "900" },
  statusOkText: { color: BLUE.green },
  statusWarnText: { color: "#d97706" },
  roomSub: { color: BLUE.muted, fontSize: 11, fontWeight: "700", marginBottom: 6 },
  roomMetaRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  roomMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  roomMetaText: { color: BLUE.muted, fontSize: 11, fontWeight: "800" },
  empty: { alignItems: "center", paddingVertical: 42, gap: 8 },
  emptyText: { color: BLUE.faint, fontSize: 13, fontWeight: "800" },
  quickTitle: { color: BLUE.ink, fontSize: 14, fontWeight: "900", marginTop: 8, marginBottom: 10 },
  quickGrid: { flexDirection: "row", gap: 10, marginBottom: 14 },
  quickCard: {
    flex: 1,
    minHeight: 105,
    borderRadius: 15,
    padding: 14,
    overflow: "hidden",
  },
  quickPurple: { backgroundColor: "#e9d5ff" },
  quickBlue: { backgroundColor: "#bfdbfe" },
  quickIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: "#f5f3ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 11,
  },
  quickName: { color: BLUE.ink, fontSize: 13, fontWeight: "900" },
  quickSub: { color: BLUE.muted, fontSize: 10, fontWeight: "700", marginTop: 3 },
  quickGlow: {
    position: "absolute",
    top: 0,
    right: -2,
    width: 57,
    height: 57,
    borderBottomLeftRadius: 57,
    backgroundColor: "rgba(245,243,255,0.45)",
  },
  alertCard: {
    minHeight: 58,
    borderRadius: 13,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fbbf24",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  alertIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: { color: "#b45309", fontSize: 13, fontWeight: "900" },
  alertSub: { color: "#d97706", fontSize: 10, fontWeight: "700", marginTop: 2 },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 65,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#dbe4f0",
    flexDirection: "row",
  },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  tabText: { color: BLUE.faint, fontSize: 10, fontWeight: "800" },
  tabTextActive: { color: BLUE.purple },
});
