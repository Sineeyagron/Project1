import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";

const STATUS_CFG: { [k: string]: { label: string; color: string; bg: string; icon: any } } = {
  available: { label: "ใช้งานได้", color: "#16a34a", bg: "#dcfce7", icon: "checkmark-circle-outline" },
  repair:    { label: "กำลังซ่อม", color: "#b45309", bg: "#fef3c7", icon: "construct-outline" },
  broken:    { label: "เสีย",       color: "#dc2626", bg: "#fee2e2", icon: "close-circle-outline" },
};

export default function LanStatus() {
  const router = useRouter();

  const [ports, setPorts]           = useState<any[]>([]);
  const [rooms, setRooms]           = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { if (selectedRoom) fetchPorts(); }, [selectedRoom]);

  const fetchAll = async () => {
    const { data } = await supabase.from("lan_ports").select("room_id");
    if (data) {
      const unique = [...new Set(data.map((r: any) => r.room_id))] as string[];
      setRooms(unique);
      if (unique.length > 0) setSelectedRoom(unique[0]);
    }
    setLoading(false);
  };

  const fetchPorts = async () => {
    const { data } = await supabase
      .from("lan_ports").select("*")
      .eq("room_id", selectedRoom)
      .order("group_no").order("port_no");
    setPorts(data || []);
    setRefreshing(false);
  };

  const onRefresh = () => { setRefreshing(true); fetchPorts(); };

  // จัดกลุ่มตาม group_no
  const grouped: { [k: number]: any[] } = {};
  ports.forEach(p => {
    if (!grouped[p.group_no]) grouped[p.group_no] = [];
    grouped[p.group_no].push(p);
  });

  const totalBroken  = ports.filter(p => p.status !== "available").length;
  const totalAvail   = ports.filter(p => p.status === "available").length;

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>สถานะ LAN Port</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* ROOM SELECTOR */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.roomScroll} contentContainerStyle={styles.roomRow}>
        {rooms.map(r => (
          <TouchableOpacity key={r}
            style={[styles.roomBtn, selectedRoom === r && styles.roomBtnActive]}
            onPress={() => setSelectedRoom(r)}>
            <Text style={[styles.roomBtnTxt, selectedRoom === r && styles.roomBtnTxtActive]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}>

          {/* สรุปภาพรวม */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: "#dcfce7" }]}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#16a34a" />
              <Text style={[styles.summaryNum, { color: "#16a34a" }]}>{totalAvail}</Text>
              <Text style={styles.summaryLabel}>ใช้งานได้</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: totalBroken > 0 ? "#fee2e2" : "#f1f5f9" }]}>
              <Ionicons name="alert-circle-outline" size={22} color={totalBroken > 0 ? "#dc2626" : "#94a3b8"} />
              <Text style={[styles.summaryNum, { color: totalBroken > 0 ? "#dc2626" : "#94a3b8" }]}>{totalBroken}</Text>
              <Text style={styles.summaryLabel}>มีปัญหา</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: "#eff6ff" }]}>
              <Ionicons name="server-outline" size={22} color="#1d4ed8" />
              <Text style={[styles.summaryNum, { color: "#1d4ed8" }]}>{ports.length}</Text>
              <Text style={styles.summaryLabel}>ทั้งหมด</Text>
            </View>
          </View>

          {/* แยกตามกลุ่ม */}
          {Object.entries(grouped).map(([gNo, gPorts]) => {
            const groupBroken = gPorts.filter(p => p.status !== "available").length;
            return (
              <View key={gNo} style={styles.groupBox}>
                {/* Group Header */}
                <View style={styles.groupHeader}>
                  <View style={styles.groupLeft}>
                    <View style={[styles.groupIcon, { backgroundColor: groupBroken > 0 ? "#fef3c7" : "#eff6ff" }]}>
                      <Ionicons
                        name="server-outline" size={16}
                        color={groupBroken > 0 ? "#b45309" : "#1d4ed8"}
                      />
                    </View>
                    <Text style={styles.groupTitle}>Server กลุ่ม {gNo}</Text>
                  </View>
                  {groupBroken > 0 ? (
                    <View style={styles.warnBadge}>
                      <Text style={styles.warnBadgeTxt}>⚠️ {groupBroken} port มีปัญหา</Text>
                    </View>
                  ) : (
                    <View style={styles.okBadge}>
                      <Text style={styles.okBadgeTxt}>✅ ปกติทุก port</Text>
                    </View>
                  )}
                </View>

                {/* Port Grid */}
                <View style={styles.portGrid}>
                  {gPorts.map(port => {
                    const cfg = STATUS_CFG[port.status] || STATUS_CFG.available;
                    return (
                      <View
                        key={port.id}
                        style={[styles.portCell, { backgroundColor: cfg.bg, borderColor: cfg.color + "50" }]}
                      >
                        <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                        <Text style={[styles.portNo, { color: cfg.color }]}>P{port.port_no}</Text>
                        <Text style={[styles.portStatus, { color: cfg.color }]}>{cfg.label}</Text>
                        {port.label ? (
                          <Text style={styles.portLabel} numberOfLines={1}>{port.label}</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {ports.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="server-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTxt}>ยังไม่มีข้อมูล LAN Port</Text>
            </View>
          )}

          {/* Legend */}
          <View style={styles.legend}>
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <View key={k} style={styles.legItem}>
                <View style={[styles.legDot, { backgroundColor: v.color }]} />
                <Text style={styles.legTxt}>{v.label}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    backgroundColor: "#1e3a8a", paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerText: { color: "#fff", fontSize: 17, fontWeight: "bold" },

  roomScroll: { maxHeight: 52 },
  roomRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  roomBtn: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 10, backgroundColor: "#e2e8f0" },
  roomBtnActive: { backgroundColor: "#1e3a8a" },
  roomBtnTxt: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  roomBtnTxtActive: { color: "#fff" },

  scroll: { padding: 16 },

  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  summaryNum: { fontSize: 24, fontWeight: "800" },
  summaryLabel: { fontSize: 10, color: "#64748b" },

  groupBox: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 12 },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  groupLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  groupTitle: { fontSize: 13, fontWeight: "700", color: "#1e293b" },
  warnBadge: { backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  warnBadgeTxt: { fontSize: 10, color: "#b45309", fontWeight: "700" },
  okBadge: { backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  okBadgeTxt: { fontSize: 10, color: "#16a34a", fontWeight: "700" },

  portGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  portCell: {
    width: "22%", borderRadius: 10, padding: 7,
    alignItems: "center", gap: 2, borderWidth: 1,
  },
  portNo: { fontSize: 10, fontWeight: "700" },
  portStatus: { fontSize: 8, fontWeight: "600" },
  portLabel: { fontSize: 7, color: "#94a3b8", textAlign: "center" },

  legend: { flexDirection: "row", gap: 14, justifyContent: "center", marginTop: 8 },
  legItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legDot: { width: 8, height: 8, borderRadius: 4 },
  legTxt: { fontSize: 11, color: "#64748b" },

  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTxt: { color: "#94a3b8", fontSize: 14 },
});
