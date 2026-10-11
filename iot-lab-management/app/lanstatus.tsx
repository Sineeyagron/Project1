import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
import { W, gradient } from "../lib/theme";
import { FadeIn, PressScale } from "../components/Motion";
import ScreenHeader, { HeaderButton } from "../components/ScreenHeader";
import Svg, { Circle, Path } from "react-native-svg";

// สถานะ LAN Port (หน้านักศึกษา) — หน้าตาตระกูลเดียวกับผังห้อง (roommap) แต่การ์ดสรุปโทนม่วงคราม + ตู้แร็กชั้นละกลุ่ม
// (เจ้าของโปรเจกต์เลือก 12 ต.ค. 2569)

type LanPort = {
  id: string;
  room_id: string;
  group_no: number;
  port_no: number;
  status: string;
  label?: string | null;
};

// ไฟสถานะของทั้งกลุ่ม: ปกติทุก port = เขียว / เสียบางส่วน = ส้ม / ใช้ไม่ได้ทั้งกลุ่ม = แดง
type Health = "ok" | "partial" | "down";
const HEALTH: Record<Health, { led: string; text: string; label: string }> = {
  ok: { led: "#4ADE80", text: "#047857", label: "ปกติ" },
  partial: { led: "#FB923C", text: "#B45309", label: "เสียบางส่วน" },
  down: { led: "#F87171", text: "#B91C1C", label: "ใช้ไม่ได้ทั้งกลุ่ม" },
};
const healthOf = (ok: number, total: number): Health => (ok === total ? "ok" : ok === 0 ? "down" : "partial");

// ช่อง port: ใช้ได้ = ขาว + ไฟเขียว / ซ่อม = เหลือง / เสีย = แดง (เหมือนช่องคอมในผังห้อง)
const PORT_TONE: Record<string, { box: object; fg: string; name: string; light: string }> = {
  available: { box: { backgroundColor: "#FFFFFF", borderColor: "#E3EAF4" }, fg: "#64748B", name: "#172033", light: "#22C55E" },
  repair: { box: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }, fg: "#B45309", name: "#92400E", light: "#F59E0B" },
  broken: { box: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }, fg: "#DC2626", name: "#991B1B", light: "#EF4444" },
};

const RACK_MAX = 6; // ตู้ละไม่เกิน 6 ชั้น — เกินแยกตู้ใหม่ (สูงสุด 2 ตู้ ห้องใหญ่กว่านั้นตู้ยาวขึ้น)

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
      .map(([group, rows]) => {
        const ok = rows.filter((port) => port.status === "available").length;
        return { group, rows, ok, health: healthOf(ok, rows.length) };
      });
  }, [ports]);

  const available = ports.filter((port) => port.status === "available").length;
  const badGroups = grouped.filter((g) => g.health !== "ok").length;
  const downGroups = grouped.filter((g) => g.health === "down").length;

  // ตู้แร็ก: ตู้ละไม่เกิน 6 ชั้น · มากกว่า 12 กลุ่ม = 2 ตู้ แบ่งครึ่ง
  const racks = useMemo(() => {
    const per = grouped.length > RACK_MAX * 2 ? Math.ceil(grouped.length / 2) : RACK_MAX;
    const out: (typeof grouped)[] = [];
    for (let i = 0; i < grouped.length; i += per) out.push(grouped.slice(i, i + per));
    return out;
  }, [grouped]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <ScreenHeader
          title={"สถานะ LAN Port"}
          subtitle={`ห้อง ${selectedRoom || "-"} · ${ports.length} port`}
          onBack={() => goBack("/home")}
          right={<HeaderButton icon="refresh" label="รีเฟรช" onPress={onRefresh} />}
          bleed={16}
          style={{ marginBottom: 6 }}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4338CA" style={{ marginTop: 64 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4338CA" />}
        >
          {!!loadError && <LoadError message={loadError} onRetry={onRefresh} />}

          {/* ── ชิปสลับห้อง (มีมากกว่า 1 ห้อง) ── */}
          {rooms.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.roomChips}>
              {rooms.map((room) => {
                const active = room === selectedRoom;
                return (
                  <PressScale key={room} style={[s.roomChip, active && s.roomChipOn]} onPress={() => setSelectedRoom(room)} scaleTo={0.94}>
                    <Ionicons name="business" size={13} color={active ? "#FFFFFF" : "#64748B"} />
                    <Text style={[s.roomChipTxt, active && { color: "#FFFFFF" }]}>{room}</Text>
                  </PressScale>
                );
              })}
            </ScrollView>
          ) : null}

          {/* ── การ์ดสรุป: port พร้อมใช้ + ตู้แร็กชั้นละกลุ่ม ── */}
          {ports.length > 0 ? (
            <FadeIn style={s.hero}>
              <NetworkLines />
              <View style={{ flex: 1 }}>
                <Text style={s.heroKicker}>Port พร้อมใช้ตอนนี้</Text>
                <Text style={s.heroNum}>
                  {available}<Text style={s.heroOf}> / {ports.length}</Text>
                </Text>
                <View style={s.heroStats}>
                  {badGroups === 0 ? (
                    <HeroChip icon="checkmark-circle" text="ทุกกลุ่มปกติ" />
                  ) : (
                    <HeroChip icon="warning" text={`${badGroups} กลุ่มมีปัญหา`} />
                  )}
                  {downGroups > 0 ? <HeroChip icon="close-circle" text={`ใช้ไม่ได้ทั้งกลุ่ม ${downGroups}`} /> : null}
                </View>
              </View>
              <View style={s.rackRow} accessibilityLabel={`ตู้ Server ${grouped.length} กลุ่ม`}>
                {racks.map((rack, ri) => (
                  <View key={ri} style={s.rack}>
                    {rack.map((g) => (
                      <View key={g.group} style={s.rackUnit}>
                        <Text style={s.rackNo}>{g.group}</Text>
                        <View style={s.rackSlot} />
                        <View
                          style={[
                            s.rackLed,
                            { backgroundColor: HEALTH[g.health].led },
                            g.health !== "ok" && { boxShadow: `0 0 5px ${HEALTH[g.health].led}` },
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </FadeIn>
          ) : null}

          {/* ── คำอธิบายไฟ ── */}
          {ports.length > 0 ? (
            <View style={s.legend}>
              {(Object.keys(HEALTH) as Health[]).map((h) => (
                <View key={h} style={s.legItem}>
                  <View style={[s.legDot, { backgroundColor: HEALTH[h].led }]} />
                  <Text style={s.legTxt}>{HEALTH[h].label}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* ── การ์ดกลุ่ม ── */}
          {grouped.map(({ group, rows, ok, health }, gi) => (
            <FadeIn key={group} delay={80 + gi * 50} style={s.groupBox}>
              <View style={s.groupHead}>
                <View style={s.groupNo}><Text style={s.groupNoTxt}>{group}</Text></View>
                <Text style={s.groupLabel}>Server กลุ่ม {group}</Text>
                <View style={[s.groupLed, { backgroundColor: HEALTH[health].led }]} />
                <View style={{ flex: 1 }} />
                <Text style={[s.groupFree, { color: HEALTH[health].text }]}>ใช้ได้ {ok}/{rows.length}</Text>
              </View>
              <View style={s.portGrid}>
                {rows.map((port) => {
                  const cfg = roomStatus(LAN_STATUS, port.status);
                  const tone = PORT_TONE[port.status] || PORT_TONE.broken;
                  return (
                    <View key={port.id} style={[s.port, tone.box]} accessibilityLabel={`Port ${port.port_no} ${cfg.label}`}>
                      <Ionicons name={port.status === "available" ? "git-network-outline" : cfg.icon} size={15} color={tone.fg} />
                      <Text style={[s.portNo, { color: tone.name }]}>P{port.port_no}</Text>
                      <View style={[s.portLight, { backgroundColor: tone.light }]} />
                    </View>
                  );
                })}
              </View>
            </FadeIn>
          ))}

          {ports.length === 0 && !loadError ? (
            <View style={s.empty}>
              <Ionicons name="server-outline" size={48} color="#C7D2FE" />
              <Text style={s.emptyText}>ยังไม่มีข้อมูล LAN Port</Text>
            </View>
          ) : null}

          <View style={{ height: 28 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ลายพื้นการ์ดสรุป: เส้นเครือข่ายจางๆ (โหนดต่อสาย) แทนวงกลมเบลอ — ให้เข้าเรื่อง LAN
function NetworkLines() {
  const line = "rgba(255,255,255,0.08)";
  const node = "rgba(255,255,255,0.13)";
  return (
    <Svg pointerEvents="none" width={240} height={150} style={s.heroLines}>
      <Path d="M10 120 L70 88 L130 104 L190 62 L236 76 M70 88 L96 30 L160 18 M130 104 L150 146 M190 62 L176 12" stroke={line} strokeWidth={1.4} fill="none" />
      {[[10, 120], [70, 88], [130, 104], [190, 62], [236, 76], [96, 30], [160, 18], [150, 146], [176, 12]].map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 3.2 : 2.4} fill={node} />
      ))}
    </Svg>
  );
}

function HeroChip({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.heroChip}>
      <Ionicons name={icon} size={12} color="#FFFFFF" />
      <Text style={s.heroChipTxt}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 4 },
  body: { paddingHorizontal: 16, paddingTop: 6 },

  roomChips: { gap: 8, paddingBottom: 12 },
  roomChip: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: "#DCE6F5" },
  roomChipOn: { backgroundColor: "#4338CA", borderColor: "#4338CA", boxShadow: "0 4px 10px rgba(67,56,202,0.30)" },
  roomChipTxt: { fontSize: 13, fontWeight: "700", color: "#475569" },

  hero: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderRadius: 24, marginBottom: 10, overflow: "hidden",
    backgroundColor: "#3730A3", ...gradient("linear-gradient(135deg, #1E1B4B 0%, #3730A3 55%, #6366F1 100%)"),
    boxShadow: "0 12px 26px rgba(55,48,163,0.32)",
  },
  // กลางการ์ด (Svg กว้าง 240 สูง 150) — จางพอไม่แย่งตัวเลข/ตู้แร็ก
  heroLines: { position: "absolute", left: "50%", top: "50%", marginLeft: -120, marginTop: -82.5 },
  heroKicker: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" },
  heroNum: { color: "#FFFFFF", fontSize: 40, fontWeight: "700", lineHeight: 50 },
  heroOf: { color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: "600" },
  heroStats: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  heroChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)" },
  heroChipTxt: { color: "#FFFFFF", fontSize: 11.5, fontWeight: "600" },

  rackRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  rack: { width: 62, padding: 5, gap: 3, borderRadius: 11, backgroundColor: "rgba(15,12,60,0.35)", borderWidth: 1, borderColor: "rgba(255,255,255,0.45)" },
  rackUnit: { height: 12, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.24)", flexDirection: "row", alignItems: "center", paddingHorizontal: 4, gap: 3 },
  rackNo: { width: 10, color: "#FFFFFF", fontSize: 8, fontWeight: "700", lineHeight: 10 },
  rackSlot: { flex: 1, height: 2, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.7)" },
  rackLed: { width: 5, height: 5, borderRadius: 3 },

  legend: { flexDirection: "row", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 12, paddingHorizontal: 4 },
  legItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legDot: { width: 9, height: 9, borderRadius: 5 },
  legTxt: { fontSize: 12, color: "#475569" },

  groupBox: { ...W.card, padding: 10, marginBottom: 12 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  groupNo: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF2FF" },
  groupNoTxt: { fontSize: 12, fontWeight: "700", color: "#4338CA" },
  groupLabel: { fontSize: 14, fontWeight: "700", color: "#172033" },
  groupLed: { width: 8, height: 8, borderRadius: 4 },
  groupFree: { fontSize: 12.5, fontWeight: "700" },

  portGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6 },
  port: { width: "23.5%", height: 52, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 2, overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,0.05)" },
  portNo: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  portLight: { position: "absolute", bottom: 5, width: 16, height: 3, borderRadius: 2 },

  empty: { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyText: { color: "#64748B", fontSize: 14, fontWeight: "800" },
});
