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
import supabase from "../lib/supabase";

type LanPort = {
  id: string;
  room_id: string;
  group_no: number;
  port_no: number;
  status: string;
  label?: string | null;
};

const C = {
  bg: "#edf5ff",
  header: "#2563eb",
  headerDark: "#1d4ed8",
  purple: "#7c3aed",
  purpleDark: "#6d28d9",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  green: "#16a34a",
  red: "#dc2626",
  orange: "#d97706",
  blue: "#2563eb",
};

const STATUS_CFG: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  available: {
    label: "ใช้งานได้",
    color: C.green,
    bg: "#dcfce7",
    border: "#86efac",
    icon: "checkmark-circle-outline",
  },
  repair: {
    label: "กำลังซ่อม",
    color: C.orange,
    bg: "#fef3c7",
    border: "#fbbf24",
    icon: "construct-outline",
  },
  broken: {
    label: "เสีย",
    color: C.red,
    bg: "#fee2e2",
    border: "#fca5a5",
    icon: "close-circle-outline",
  },
};

function roomSort(room: string) {
  const match = String(room || "").match(/\d+/);
  return match ? Number(match[0]) : 99999;
}

export default function LanStatus() {
  const router = useRouter();
  const [allPorts, setAllPorts] = useState<LanPort[]>([]);
  const [rooms, setRooms] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const { data, error } = await supabase
      .from("lan_ports")
      .select("*")
      .order("room_id")
      .order("group_no")
      .order("port_no");

    if (error) {
      console.log(error);
      setAllPorts([]);
      setRooms([]);
    } else {
      const list = (data as LanPort[]) || [];
      const uniqueRooms = Array.from(new Set(list.map((port) => port.room_id).filter(Boolean))).sort(
        (a, b) => roomSort(a) - roomSort(b) || a.localeCompare(b),
      );
      setAllPorts(list);
      setRooms(uniqueRooms);
      setSelectedRoom((current) => current || uniqueRooms[0] || "");
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
        <View style={s.headerTop}>
          <TouchableOpacity style={s.headerBtn} onPress={() => router.replace("/home")} activeOpacity={0.84}>
            <Ionicons name="arrow-back" size={23} color="#ffffff" />
          </TouchableOpacity>
          <View style={s.titleBlock}>
            <Text style={s.title}>สถานะ LAN Port</Text>
            <Text style={s.subtitle}>
              ห้อง {selectedRoom || "-"} · {ports.length} port
            </Text>
          </View>
          <TouchableOpacity style={s.headerBtn} onPress={onRefresh} activeOpacity={0.84}>
            <Ionicons name="refresh" size={19} color="#ffffff" />
          </TouchableOpacity>
        </View>

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
                    const cfg = STATUS_CFG[port.status] || STATUS_CFG.available;
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

          {ports.length === 0 ? (
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
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.header,
    paddingHorizontal: 32,
    paddingTop: 56,
    paddingBottom: 15,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerBtn: {
    width: 39,
    height: 39,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.23)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { flex: 1, paddingHorizontal: 15 },
  title: { color: "#fff", fontSize: 21, fontWeight: "900" },
  subtitle: { color: "#dbeafe", fontSize: 11, fontWeight: "800", marginTop: 2 },
  roomTabs: {
    height: 39,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
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
    backgroundColor: "#fff",
    shadowColor: "#1e3a8a",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  roomTabText: { color: "#dbeafe", fontSize: 13, fontWeight: "900" },
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
  summaryGreen: { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" },
  summaryRed: { backgroundColor: "#fee2e2", borderColor: "#fecaca" },
  summaryBlue: { backgroundColor: "#eff6ff", borderColor: "#dbeafe" },
  summaryNumber: { fontSize: 28, fontWeight: "900", lineHeight: 32 },
  summaryLabel: { color: C.ink, fontSize: 11, fontWeight: "800" },
  groupCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingTop: 14,
    paddingBottom: 15,
    marginTop: 5,
    marginBottom: 7,
    shadowColor: "#1e3a8a",
    shadowOpacity: 0.08,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
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
  okPill: { backgroundColor: "#dcfce7" },
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
