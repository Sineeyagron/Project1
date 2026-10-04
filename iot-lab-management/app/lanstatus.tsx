import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import supabase from "../lib/supabase";
import { goBack, useRefreshOnFocus } from "../lib/nav";
import { LAN_STATUS, roomStatus } from "../lib/roomStatus";
import LoadError from "../components/LoadError";
import { fetchRooms } from "../lib/rooms";
import { useRoomLive } from "../lib/roomRealtime";
import { W, NG } from "../lib/theme";
import ScreenHeader, { HeaderButton } from "../components/ScreenHeader";

type LanPort = {
  id: string;
  room_id: string;
  group_no: number;
  port_no: number;
  status: string;
  label?: string | null;
};

const C = {
  bg: "#EAF1FC",
  header: "#2563eb",
  headerDark: "#1d4ed8",
  purple: "#2563EB",
  purpleDark: "#1D4ED8",
  ink: "#172033",
  muted: "#475569",
  faint: "#64748B",
  green: "#047857",
  red: "#dc2626",
  orange: "#B45309",
  blue: "#2563eb",
};

export default function LanStatus() {
  // เปิดจากการ์ดห้องหน้าแรก → เลือกห้องนั้นให้เลย (เดิมเปิดห้องแรกเสมอ)
  const { room_id: roomParam } = useLocalSearchParams<{ room_id?: string }>();
  const [allPorts, setAllPorts] = useState<LanPort[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState(roomParam ? String(roomParam) : "");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);
  useRefreshOnFocus(() => fetchAll());
  useRoomLive(() => fetchAll()); // อัปเดตสดเมื่อสถานะ LAN เปลี่ยน (REVIEW M12)

  // รายชื่อห้องจากตาราง rooms + port ทั้งหมด
  const fetchAll = async () => {
    const [{ data, error: portError }, { rooms: roomList, error: roomError }] = await Promise.all([
      supabase.from("lan_ports").select("*").order("room_id").order("group_no").order("port_no"),
      fetchRooms(), // ห้องที่เปิดอยู่ เรียงตามที่ Admin ตั้ง
    ]);
    const error = portError || roomError;

    if (error) {
      // โหลดพัง ห้ามโชว์ "ไม่มีข้อมูล" — เก็บข้อมูลเดิมไว้ แล้วขึ้นแถบให้ลองใหม่
      setLoadError(error.message);
    } else {
      setLoadError("");
      const list = (data as LanPort[]) || [];
      const uniqueRooms = roomList.map((room) => room.id);
      setAllPorts(list);
      setRooms(uniqueRooms);
      setSelectedRoom((current) => (uniqueRooms.includes(current) ? current : uniqueRooms[0] || ""));
    }

    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const ports = useMemo(
    () =>
      allPorts
        .filter((port) => port.room_id === selectedRoom)
        .sort((a, b) => (a.group_no - b.group_no) || (a.port_no - b.port_no)),
    [allPorts, selectedRoom],
  );

  const grouped = useMemo(() => {
    const map = new Map<number, LanPort[]>();
    ports.forEach((port) => {
      const group = Number(port.group_no || 1);
      map.set(group, [...(map.get(group) || []), port]);
    });
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([group, rows]) => ({ group, rows }));
  }, [ports]);

  const available = ports.filter((port) => port.status === "available").length;
  const problem = ports.length - available;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <ScreenHeader
          title={"สถานะ LAN Port"}
          subtitle={`ห้อง ${selectedRoom || "-"} · ${ports.length} port`}
          onBack={() => goBack("/home")}
          right={<HeaderButton icon="refresh" label="รีเฟรช" onPress={onRefresh} />}
          bleed={16}
          style={{ marginBottom: 14 }}
        />

        <View style={s.roomTabs}>
          {rooms.map((room) => {
            const active = selectedRoom === room;
            return (
              <TouchableOpacity
                key={room}
                style={[s.roomTab, active && s.roomTabActive]}
                onPress={() => setSelectedRoom(room)}
                activeOpacity={0.84}
              >
                <Text style={[s.roomTabText, active && s.roomTabTextActive]}>{room}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.header} style={{ marginTop: 64 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.header} />}
        >
          {!!loadError && <LoadError message={loadError} onRetry={onRefresh} />}

          <View style={s.summaryRow}>
            <View style={[s.summaryCard, s.summaryGreen]}>
              <Ionicons name="checkmark-circle-outline" size={24} color={C.green} />
              <Text style={[s.summaryNumber, { color: C.green }]}>{available}</Text>
              <Text style={s.summaryLabel}>ใช้งานได้</Text>
            </View>
            <View style={[s.summaryCard, s.summaryRed]}>
              <Ionicons name="alert-circle-outline" size={24} color={C.red} />
              <Text style={[s.summaryNumber, { color: C.red }]}>{problem}</Text>
              <Text style={s.summaryLabel}>มีปัญหา</Text>
            </View>
            <View style={[s.summaryCard, s.summaryBlue]}>
              <Ionicons name="server-outline" size={24} color={C.blue} />
              <Text style={[s.summaryNumber, { color: C.blue }]}>{ports.length}</Text>
              <Text style={s.summaryLabel}>ทั้งหมด</Text>
            </View>
          </View>

          {grouped.map(({ group, rows }) => {
            const groupProblem = rows.filter((port) => port.status !== "available").length;
            return (
              <View key={group} style={s.groupCard}>
                <View style={s.groupHeader}>
                  <View style={s.groupTitleWrap}>
                    <View style={s.groupIcon}>
                      <Ionicons name="server-outline" size={20} color={C.orange} />
                    </View>
                    <Text style={s.groupTitle}>Server กลุ่ม {group}</Text>
                  </View>
                  <View style={[s.problemPill, groupProblem === 0 && s.okPill]}>
                    <Text style={[s.problemPillText, groupProblem === 0 && s.okPillText]}>
                      {groupProblem > 0 ? `⚠ ${groupProblem} port มีปัญหา` : "✓ ปกติทั้งหมด"}
                    </Text>
                  </View>
                </View>

                <View style={s.portGrid}>
                  {rows.map((port) => {
                    const cfg = roomStatus(LAN_STATUS, port.status);
                    return (
                      <View
                        key={port.id}
                        style={[
                          s.portCell,
                          {
                            backgroundColor: cfg.bg,
                            borderColor: cfg.border,
                          },
                        ]}
                      >
                        <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                        <Text style={[s.portNo, { color: cfg.color }]}>P{port.port_no}</Text>
                        <Text style={[s.portStatus, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {ports.length === 0 && !loadError ? (
            <View style={s.empty}>
              <Ionicons name="server-outline" size={48} color="#bfdbfe" />
              <Text style={s.emptyText}>ยังไม่มีข้อมูล LAN Port</Text>
            </View>
          ) : null}

          <View style={{ height: 28 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 15,
  },
  headerTop: {
    ...W.headerBar, marginHorizontal: -16, paddingTop: 52, paddingHorizontal: 16, paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerBtn: {
    ...W.iconBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { flex: 1, paddingHorizontal: 15 },
  title: { color: "#172033", fontSize: 21, fontWeight: "900" },
  subtitle: { color: "#475569", fontSize: 11, fontWeight: "800", marginTop: 2 },
  roomTabs: {
    height: 39,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.78)", boxShadow: "inset 0 1px 0 #FFFFFF, 0 2px 8px rgba(37,99,235,0.10)",
    borderWidth: 1,
    borderColor: "#D3E0F5",
    padding: 4,
    flexDirection: "row",
    gap: 4,
  },
  roomTab: {
    flex: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  roomTabActive: {
    ...NG,
    backgroundColor: "#fff",
    shadowColor: "#1D4ED8",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  roomTabText: { color: "#475569", fontSize: 13, fontWeight: "900" },
  roomTabTextActive: { color: C.headerDark },
  body: {
    paddingHorizontal: 35,
    paddingTop: 13,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 3,
  },
  summaryCard: {
    flex: 1,
    minHeight: 102,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderWidth: 1,
  },
  summaryGreen: { backgroundColor: "#ECFDF5", borderColor: "#bbf7d0" },
  summaryRed: { backgroundColor: "#fee2e2", borderColor: "#fecaca" },
  summaryBlue: { backgroundColor: "#eff6ff", borderColor: "#dbeafe" },
  summaryNumber: { fontSize: 28, fontWeight: "900", lineHeight: 32 },
  summaryLabel: { color: C.ink, fontSize: 11, fontWeight: "800" },
  groupCard: {
    ...W.card,
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: 15,
    marginTop: 5,
    marginBottom: 7,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 13,
  },
  groupTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  groupIcon: {
    width: 39,
    height: 39,
    borderRadius: 10,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  groupTitle: { color: C.ink, fontSize: 13, fontWeight: "900" },
  problemPill: {
    borderRadius: 999,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  problemPillText: { color: C.orange, fontSize: 10, fontWeight: "900" },
  okPill: { backgroundColor: "#ECFDF5" },
  okPillText: { color: C.green },
  portGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  portCell: {
    width: "23%",
    minHeight: 64,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
  },
  portNo: { fontSize: 13, fontWeight: "900", marginTop: 2 },
  portStatus: { fontSize: 9, fontWeight: "900", marginTop: 1 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { color: C.faint, fontSize: 14, fontWeight: "800" },
});
