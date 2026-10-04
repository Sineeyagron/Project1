import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import SearchBar from "../components/SearchBar";
import { Text, TextInput } from "../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";
import { useRefreshOnFocus } from "../lib/nav";
import LoadError from "../components/LoadError";
import { Room, fetchRooms as fetchRoomList, roomPlace } from "../lib/rooms";
import { useRoomLive } from "../lib/roomRealtime";
import Svg, { Circle } from "react-native-svg";
import TabBar from "../components/TabBar";
import StatWidget from "../components/StatWidget";
import { HeaderButton } from "../components/ScreenHeader";
import { FadeIn, PressScale } from "../components/Motion";
import GreetingLine from "../components/GreetingLine";
import { useUnreadCount } from "../lib/unread";
import { currentUser } from "../lib/session";
import { C, W, gradient, iconDot } from "../lib/theme";

type Station = {
  id: string;
  room_id: string;
  group_no: number;
  name: string;
  status: string;
};



export default function Home() {
  const router = useRouter();
  const unread = useUnreadCount();
  // TA/admin ที่มาหน้านักศึกษา (เช่น มายืมของเอง) → มีปุ่มกลับแดชบอร์ด
  const [isStaff, setIsStaff] = useState(false);
  useEffect(() => {
    supabase.rpc("is_staff").then(({ data }) => setIsStaff(!!data));
    // นักศึกษาที่ยังไม่มีรหัส นศ. → ไปกรอกก่อน (staff ข้าม) / อ่านไม่ได้ (เช่น ยังไม่ได้รัน migration) = ปล่อยผ่าน
    currentUser().then((user) => {
      if (!user) return;
      supabase.from("profiles").select("role, student_id").eq("id", user.id).maybeSingle().then(({ data, error }) => {
        if (!error && data && data.role === "user" && !data.student_id) router.replace("/student-id" as any);
      });
    });
  }, []);
  const [stations, setStations] = useState<Station[]>([]);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loadError, setLoadError] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    fetchRooms();
  }, []);
  // กลับมาหน้านี้ (ปุ่ม ← / สลับแท็บ) → โหลดข้อมูลใหม่
  useRefreshOnFocus(() => { fetchRooms(); });
  // อัปเดตสด: สถานะเครื่องในห้องไหนเปลี่ยน → ตัวเลขการ์ดห้องเปลี่ยนทันที (REVIEW M12)
  useRoomLive(() => { fetchRooms(); });

  const fetchRooms = async () => {
    // ห้องจากตาราง rooms (ห้องที่เปิดอยู่) + เครื่องที่เปิดใช้งาน
    const [{ data, error: stationError }, { rooms: roomList, error: roomError }] = await Promise.all([
      supabase.from("computer_stations").select("*").eq("active", true).order("room_id").order("group_no").order("name"),
      fetchRoomList(),
    ]);
    const error = stationError || roomError;

    if (error) {
      // โหลดพัง ห้ามโชว์ว่า "ใช้งานได้ทั้งหมด" — เก็บข้อมูลเดิมไว้ แล้วขึ้นแถบให้ลองใหม่
      setLoadError(error.message);
    } else {
      setLoadError("");
      setRooms(roomList);
      // เฉพาะเครื่องในห้องที่เปิดอยู่
      const openIds = new Set(roomList.map((room) => room.id));
      setStations(((data as Station[]) || []).filter((station) => openIds.has(station.room_id)));
    }
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRooms();
  };

  // ทุกห้องที่เปิดอยู่ เรียงตามที่ Admin ตั้ง (ห้องใหม่ที่ยังไม่มีเครื่องก็ขึ้น)
  const roomSummaries = useMemo(() => {
    return rooms.map((info) => {
      const rows = stations.filter((station) => station.room_id === info.id);
      const online = rows.filter((row) => row.status === "available").length;
      const problem = rows.length - online;
      return {
        room: info.id,
        total: rows.length,
        online,
        problem,
        floor: roomPlace(info),
      };
    });
  }, [rooms, stations]);

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
      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
      >
        <View style={s.headerTop}>
          <View>
            {/* เหมือนหัวแดชบอร์ด Admin: ทักทาย + อากาศ + บทบาท / staff ที่มายืมของ = โหมดนักศึกษา */}
            <GreetingLine roleLabel={isStaff ? "โหมดนักศึกษา" : "นักศึกษา"} />
            <Text style={s.headerTitle}>
              ห้องเรียน <Text style={s.headerTitleAccent}>IoT</Text>
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {isStaff && (
              <HeaderButton
                icon="speedometer-outline"
                label="กลับแดชบอร์ดผู้ดูแล"
                // TA/admin ที่มายืมของ: กลับแดชบอร์ดเดิมใน stack (ไม่เปิดซ้อนใหม่) / ไม่มี → เปิดใหม่
                onPress={() => router.dismissTo("/admin/home")}
              />
            )}
            <HeaderButton icon="notifications-outline" label="แจ้งเตือน" count={unread} onPress={() => router.push("/notifications")} />
          </View>
        </View>

        <FadeIn style={s.statsRow}>
          <StatWidget tone="blue" icon="desktop-outline" label="ทั้งหมด" value={totalStations} />
          <StatWidget tone="green" icon="checkmark" label="ใช้งานได้" value={onlineStations} />
          <StatWidget tone="amber" icon="alert" label="มีปัญหา" value={problemStations} />
        </FadeIn>

        <SearchBar
          style={{ marginBottom: 18 }}
          value={search}
          onChangeText={(text) => { setSearch(text); setActiveSearch(text.trim()); }}
          placeholder="ค้นหาห้องเรียน"
        />

        <View style={s.sectionHead}>
          <View>
            <Text style={s.sectionTitle}>ห้องที่มีให้เลือก</Text>
            <Text style={s.sectionSub}>{activeSearch ? `พบ ${filteredRooms.length} จาก ${roomSummaries.length} ห้อง` : `${roomSummaries.length} ห้อง`}</Text>
          </View>
          <View style={s.viewToggle}>
            <TouchableOpacity
              style={[s.viewToggleBtn, viewMode === "grid" && s.viewToggleBtnActive]}
              onPress={() => setViewMode("grid")}
              activeOpacity={0.84}
            >
              <Ionicons name="grid-outline" size={16} color={viewMode === "grid" ? C.primaryDark : C.faint} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.viewToggleBtn, viewMode === "list" && s.viewToggleBtnActive]}
              onPress={() => setViewMode("list")}
              activeOpacity={0.84}
            >
              <Ionicons name="list-outline" size={18} color={viewMode === "list" ? C.primaryDark : C.faint} />
            </TouchableOpacity>
          </View>
        </View>

        {!!loadError && <LoadError message={loadError} onRetry={onRefresh} />}
        {loading ? (
          <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <FadeIn delay={80} style={viewMode === "grid" ? s.roomGrid : s.roomList}>
              {filteredRooms.map((room) => {
                const hasProblem = room.problem > 0;
                const open = () => router.push({ pathname: "/roommap", params: { room_id: room.room } });
                const pill = (
                  <View style={[s.statusPill, hasProblem ? s.statusWarn : s.statusOk]}>
                    <View style={[s.statusDot, { backgroundColor: hasProblem ? C.warning : C.success }]} />
                    <Text style={[s.statusText, { color: hasProblem ? C.warningInk : C.successInk }]}>
                      {hasProblem ? `มีปัญหา ${room.problem}` : "ใช้งานได้"}
                    </Text>
                  </View>
                );
                if (viewMode === "grid") {
                  return (
                    <PressScale key={room.room} style={[s.roomCard, s.roomCardGrid]} onPress={open} accessibilityLabel={`ห้อง ${room.room}`}>
                      <Text style={s.roomName} numberOfLines={1}>{room.room}</Text>
                      <Text style={s.roomSub} numberOfLines={1}>{room.floor}</Text>
                      <View style={s.ringRow}>
                        <Ring value={room.online} total={room.total} />
                        <View>
                          <Text style={s.ringNum}>{room.online} / {room.total}</Text>
                          <Text style={s.ringLabel}>ใช้งานได้</Text>
                        </View>
                      </View>
                      {pill}
                    </PressScale>
                  );
                }
                return (
                  <PressScale key={room.room} style={[s.roomCard, s.roomCardRow]} onPress={open} scaleTo={0.98} accessibilityLabel={`ห้อง ${room.room}`}>
                    <Ring value={room.online} total={room.total} />
                    <View style={s.roomInfo}>
                      <View style={s.roomTitleRow}>
                        <Text style={s.roomName}>{room.room}</Text>
                        {pill}
                      </View>
                      <Text style={s.roomSub}>{room.floor}</Text>
                      <View style={s.roomMetaRow}>
                        <View style={s.roomMeta}>
                          <Ionicons name="desktop-outline" size={13} color={C.muted} />
                          <Text style={s.roomMetaText}>{room.total} เครื่อง</Text>
                        </View>
                        <View style={s.roomMeta}>
                          <Ionicons name="wifi-outline" size={13} color={C.successInk} />
                          <Text style={[s.roomMetaText, { color: C.successInk }]}>{room.online} ใช้งานได้</Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={C.faint} />
                  </PressScale>
                );
              })}
            </FadeIn>

            {filteredRooms.length === 0 && !loadError ? (
              <View style={s.empty}>
                <Ionicons name="search-outline" size={42} color={C.primarySoft} />
                <Text style={s.emptyText}>ไม่พบห้องที่ค้นหา</Text>
              </View>
            ) : null}

            <Text style={s.quickTitle}>ลิงก์ด่วน</Text>
            {/* ทางเข้าหลักของการยืม-คืน (แผน 2.6: ยืม/คืนได้ทางเดียวคือสแกน QR ที่ตัวของ) */}
            <PressScale style={s.scanCard} onPress={() => router.push("/scan")} scaleTo={0.98}>
              <View style={s.scanCardIcon}>
                <Ionicons name="scan" size={23} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.scanCardTitle}>สแกนยืม / คืนอุปกรณ์</Text>
                <Text style={s.scanCardSub}>สแกน QR ที่ติดบนอุปกรณ์ในห้อง</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </PressScale>
            <View style={s.quickGrid}>
              <PressScale style={s.quickCard} onPress={() => router.push("/lanstatus")}>
                <View style={iconDot("#6366F1", 38)}>
                  <Ionicons name="git-network-outline" size={19} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.quickName}>สถานะสายแลน</Text>
                  <Text style={s.quickSub}>Server / Patch Panel</Text>
                </View>
              </PressScale>
              <PressScale style={s.quickCard} onPress={() => router.push("/borrow")}>
                <View style={iconDot("#0EA5E9", 38)}>
                  <Ionicons name="time-outline" size={19} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.quickName}>ประวัติการยืม</Text>
                  <Text style={s.quickSub}>รายการยืม-คืน</Text>
                </View>
              </PressScale>
            </View>

            {problemStations > 0 ? (
              <TouchableOpacity
                style={s.alertCard}
                // เปิดผังของห้องที่มีปัญหาจริง (เดิมไม่ส่ง room_id → เปิด CP9524 เสมอ แม้ปัญหาอยู่ SC9604)
                onPress={() => {
                  const problemRoom = roomSummaries.find((room) => room.problem > 0)?.room;
                  router.push({ pathname: "/roommap", params: problemRoom ? { room_id: problemRoom } : {} });
                }}
                activeOpacity={0.88}
              >
                <View style={iconDot(C.warning, 38)}>
                  <Ionicons name="information" size={20} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.alertTitle}>มีอุปกรณ์ต้องตรวจสอบ</Text>
                  <Text style={s.alertSub}>{roomSummaries.filter((room) => room.problem > 0).length} ห้อง มี {problemStations} เครื่องที่ต้องดูแล</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={C.warningInk} />
              </TouchableOpacity>
            ) : null}
          </>
        )}

        <View style={{ height: 96 }} />
      </ScrollView>

      <TabBar current="/home" />
    </View>
  );
}

// วงแหวนสัดส่วนเครื่องที่ใช้งานได้
function Ring({ value, total }: { value: number; total: number }) {
  const r = 19;
  const len = 2 * Math.PI * r;
  const ratio = total > 0 ? value / total : 0;
  return (
    <View style={s.ring}>
      <Svg width={48} height={48} viewBox="0 0 48 48">
        <Circle cx={24} cy={24} r={r} fill="none" stroke="#DCE7FA" strokeWidth={6} />
        {ratio > 0 ? (
          <Circle
            cx={24}
            cy={24}
            r={r}
            fill="none"
            stroke={C.success}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${(len * ratio).toFixed(1)} ${len.toFixed(1)}`}
            transform="rotate(-90 24 24)"
          />
        ) : null}
      </Svg>
      <View style={s.ringCenter}>
        <Text style={s.ringPct}>{Math.round(ratio * 100)}%</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { ...W.page },
  body: { paddingHorizontal: 18, paddingTop: 0 },
  headerTop: {
    ...W.headerBar, marginHorizontal: -18, paddingTop: 52, paddingHorizontal: 18, paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerKicker: { color: C.text2, fontSize: 13, marginBottom: 2 },
  headerTitle: { color: C.ink, fontSize: 26, fontWeight: "700", lineHeight: 34, marginTop: 2 },
  headerTitleAccent: { color: C.primary },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  searchBox: {
    ...W.input,
    borderWidth: 0,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 6,
    marginBottom: 18,
  },
  searchInput: { flex: 1, color: C.ink, fontSize: 15 },
  clearSearchBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 10px rgba(37,99,235,0.3)",
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { color: C.ink, fontSize: 17, fontWeight: "600" },
  sectionSub: { color: C.muted, fontSize: 12, marginTop: 1 },
  viewToggle: {
    flexDirection: "row",
    gap: 4,
    padding: 3,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.7)",
    boxShadow: "inset 0 1px 0 #FFFFFF, 0 2px 6px rgba(37,99,235,0.08)",
  },
  viewToggleBtn: {
    width: 32,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  viewToggleBtnActive: { backgroundColor: "#FFFFFF", boxShadow: "0 2px 6px rgba(37,99,235,0.16)" },
  roomGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  roomList: { gap: 12 },
  roomCard: { ...W.card, padding: 14 },
  roomCardGrid: { flexBasis: "47%", flexGrow: 1, gap: 8 },
  roomCardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ringRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ring: { width: 48, height: 48 },
  ringCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  ringPct: { color: C.successInk, fontSize: 11, fontWeight: "700" },
  ringNum: { color: C.ink, fontSize: 13, fontWeight: "600" },
  ringLabel: { color: C.muted, fontSize: 11 },
  roomInfo: { flex: 1, minWidth: 0 },
  roomTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  roomName: { color: C.ink, fontSize: 18, fontWeight: "700" },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusOk: { backgroundColor: C.successBg },
  statusWarn: { backgroundColor: "#FFF4DC" },
  statusDot: { width: 6, height: 6, borderRadius: 99 },
  statusText: { fontSize: 11, fontWeight: "600" },
  roomSub: { color: C.muted, fontSize: 11 },
  roomMetaRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 6 },
  roomMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  roomMetaText: { color: C.muted, fontSize: 11, fontWeight: "500" },
  empty: { alignItems: "center", paddingVertical: 42, gap: 8 },
  emptyText: { color: C.faint, fontSize: 13, fontWeight: "600" },
  quickTitle: { color: C.ink, fontSize: 17, fontWeight: "600", marginTop: 20, marginBottom: 12 },
  scanCard: {
    ...W.primary,
    borderRadius: 22,
    ...gradient("linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #60A5FA 100%)"),
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    marginBottom: 12,
  },
  scanCardIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanCardTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  scanCardSub: { color: "rgba(255,255,255,0.9)", fontSize: 12, marginTop: 1 },
  quickGrid: { flexDirection: "row", gap: 12, marginBottom: 14 },
  quickCard: {
    ...W.card,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  quickName: { color: C.ink, fontSize: 13, fontWeight: "600" },
  quickSub: { color: C.muted, fontSize: 11 },
  alertCard: {
    ...W.statAmber,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  alertTitle: { color: C.warningInk, fontSize: 14, fontWeight: "600" },
  alertSub: { color: "#92400E", fontSize: 12, marginTop: 1 },
});
