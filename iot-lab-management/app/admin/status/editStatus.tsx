import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../../../lib/supabase";

export default function EditStatus() {
  const router = useRouter();
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState("CP9524");
  const [rooms, setRooms] = useState<string[]>([]);

  useEffect(() => { fetchRooms(); }, []);
  useEffect(() => { fetchStations(); }, [selectedRoom]);

  const fetchRooms = async () => {
    const { data } = await supabase.from("computer_stations").select("room_id");
    if (data) {
      const unique = [...new Set(data.map((r: any) => r.room_id))];
      setRooms(unique);
    }
  };

  const fetchStations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("computer_stations")
      .select("*")
      .eq("room_id", selectedRoom)
      .order("group_no").order("name");
    if (error) console.log(error);
    else setStations(data || []);
    setLoading(false);
  };

  const toggleStatus = async (station: any) => {
    const newStatus = station.status === "available" ? "repair" : "available";
    Alert.alert(
      "เปลี่ยนสถานะ",
      `${station.name} → ${newStatus === "available" ? "ปกติ ✅" : "ซ่อมบำรุง 🔧"} ?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ยืนยัน",
          onPress: async () => {
            setSaving(station.id);
            const { error } = await supabase
              .from("computer_stations")
              .update({ status: newStatus })
              .eq("id", station.id);
            if (error) {
              Alert.alert("เกิดข้อผิดพลาด", error.message);
            } else {
              setStations(prev =>
                prev.map(s => s.id === station.id ? { ...s, status: newStatus } : s)
              );
            }
            setSaving(null);
          },
        },
      ]
    );
  };

  const grouped: { [key: number]: any[] } = {};
  stations.forEach((s) => {
    if (!grouped[s.group_no]) grouped[s.group_no] = [];
    grouped[s.group_no].push(s);
  });

  return (
    <View style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace("/admin/home")} activeOpacity={0.82}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerText}>แก้ไขสถานะเครื่อง</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.roomRow}>
        {rooms.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.roomBtn, selectedRoom === r && styles.roomBtnActive]}
            onPress={() => setSelectedRoom(r)}
          >
            <Text style={[styles.roomBtnText, selectedRoom === r && styles.roomBtnTextActive]}>
              {r}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: "#86efac" }]} />
          <Text style={styles.legText}>ปกติ</Text>
        </View>
        <View style={styles.legItem}>
          <View style={[styles.legDot, { backgroundColor: "#fca5a5" }]} />
          <Text style={styles.legText}>ซ่อมบำรุง</Text>
        </View>
        <Text style={styles.legHint}>* กดที่เครื่องเพื่อเปลี่ยนสถานะ</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {Object.entries(grouped).map(([groupNo, stns]) => (
            <View key={groupNo} style={styles.groupBox}>
              <Text style={styles.groupLabel}>กลุ่มที่ {groupNo}</Text>
              <View style={styles.stationsRow}>
                {stns.map((station) => {
                  const isRepair = station.status === "repair";
                  const isSaving = saving === station.id;
                  return (
                    <TouchableOpacity
                      key={station.id}
                      style={[styles.station, { backgroundColor: isRepair ? "#fee2e2" : "#dcfce7" }]}
                      onPress={() => toggleStatus(station)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color="#64748b" />
                      ) : (
                        <>
                          <Ionicons
                            name={isRepair ? "construct-outline" : "desktop-outline"}
                            size={20}
                            color={isRepair ? "#dc2626" : "#16a34a"}
                          />
                          <Text style={[styles.stationName, { color: isRepair ? "#dc2626" : "#16a34a" }]}>
                            {station.name}
                          </Text>
                          <Text style={[styles.stationStatus, { color: isRepair ? "#dc2626" : "#16a34a" }]}>
                            {isRepair ? "ซ่อม" : "ปกติ"}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    backgroundColor: "#7c3aed",
    paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  roomRow: { flexDirection: "row", gap: 8, padding: 16, flexWrap: "wrap" },
  roomBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: "#e2e8f0" },
  roomBtnActive: { backgroundColor: "#1e3a8a" },
  roomBtnText: { fontSize: 13, fontWeight: "600", color: "#64748b" },
  roomBtnTextActive: { color: "#fff" },
  legend: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, marginBottom: 8 },
  legItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legDot: { width: 10, height: 10, borderRadius: 3 },
  legText: { fontSize: 11, color: "#64748b" },
  legHint: { fontSize: 10, color: "#94a3b8", marginLeft: "auto" },
  scroll: { paddingHorizontal: 16 },
  groupBox: { marginBottom: 16 },
  groupLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  stationsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  station: { width: 72, height: 72, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 2 },
  stationName: { fontSize: 11, fontWeight: "700" },
  stationStatus: { fontSize: 9 },
});
