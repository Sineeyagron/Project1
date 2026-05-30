import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import supabase from "../../lib/supabase";

const C = {
  bg: "#eef3f8",
  hero: "#7c3aed",
  ink: "#0f172a",
  text: "#1e293b",
  muted: "#64748b",
  faint: "#94a3b8",
  card: "#ffffff",
  blue: "#1d4ed8",
  blueDark: "#1f3f9e",
  green: "#16a34a",
  orange: "#fb5a0a",
  orangeDark: "#ea580c",
  red: "#dc2626",
  purple: "#7c3aed",
  cyan: "#0891b2",
};

const PRIMARY = [
  { icon: "barcode-outline", title: "สแกนยืม", route: "/admin/borrowscan", bg: "#2347ae" },
  { icon: "return-down-back-outline", title: "สแกนคืน", route: "/admin/returnscan", bg: C.orange },
] as const;

const TOOLS = [
  { icon: "business-outline", label: "จัดการห้อง", route: "/admin/room", color: "#8b5cf6", bg: "#ede9fe" },
  { icon: "cube-outline", label: "จัดการอุปกรณ์", route: "/admin/items", color: "#0ea5e9", bg: "#e0f2fe" },
  { icon: "qr-code-outline", label: "สร้าง QR", route: "/admin/qrgen", color: "#6366f1", bg: "#ede9fe" },
  { icon: "scan-outline", label: "สแกน & เพิ่ม", route: "/admin/scan", color: C.cyan, bg: "#cffafe" },
  { icon: "receipt-outline", label: "ประวัติยืม", route: "/admin/history", color: C.muted, bg: "#f1f5f9" },
  { icon: "desktop-outline", label: "จัดการเครื่อง", route: "/admin/stations", color: C.red, bg: "#fee2e2" },
  { icon: "git-network-outline", label: "จัดการแลน", route: "/admin/lanports", color: C.purple, bg: "#ede9fe" },
  { icon: "clipboard-outline", label: "ตรวจอุปกรณ์", route: "/admin/inspection", color: "#0d9488", bg: "#ccfbf1" },
  { icon: "hardware-chip-outline", label: "ตรวจสภาพ IoT", route: "/admin/iotinspection", color: "#a855f7", bg: "#f3e8ff" },
  { icon: "construct-outline", label: "ซ่อมบำรุง", route: "/admin/repairs", color: C.orangeDark, bg: "#ffedd5" },
] as const;

type ActivityItem = {
  id: string;
  icon: string;
  iconBg: string;
  color: string;
  title: string;
  sub: string;
  time: string;
};

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 8) return { text: "สวัสดีตอนเช้า", icon: "sunny-outline", color: "#fde68a" };
  if (hour >= 8 && hour < 12) return { text: "สวัสดีตอนสาย", icon: "partly-sunny-outline", color: "#fcd34d" };
  if (hour >= 12 && hour < 16) return { text: "สวัสดีตอนบ่าย", icon: "sunny-outline", color: "#fb923c" };
  if (hour >= 16 && hour < 19) return { text: "สวัสดีตอนเย็น", icon: "partly-sunny-outline", color: "#fdba74" };
  if (hour >= 19 && hour < 22) return { text: "สวัสดีตอนค่ำ", icon: "moon-outline", color: "#c4b5fd" };
  return { text: "สวัสดีตอนดึก", icon: "moon-outline", color: "#bfdbfe" };
}

export default function AdminHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [available, setAvailable] = useState(0);
  const [borrowed, setBorrowed] = useState(0);
  const [repair, setRepair] = useState(0);
  const [statusBorrowed, setStatusBorrowed] = useState(0);
  const [statusReturned, setStatusReturned] = useState(0);
  const [statusRepair, setStatusRepair] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    checkRoleAndFetch();
  }, []);

  const greeting = useMemo(() => getGreeting(), []);

  const today = useMemo(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear() + 543).slice(-2);
    return {
      compact: `${day}/${month}/${year}`,
      dayName: d.toLocaleDateString("th-TH", { weekday: "long" }),
    };
  }, []);

  const checkRoleAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      router.replace("/home");
      return;
    }

    await fetchDashboard();
  };

  const fetchDashboard = async () => {
    const [
      { data: items },
      { data: borrowRecords },
      { data: repairRecords },
      { data: stations },
      activeBorrowCount,
      returnedCount,
      activeRepairCount,
    ] = await Promise.all([
      supabase.from("items").select("id, name, status"),
      supabase.from("borrow_records").select("*").order("created_at", { ascending: false }).limit(12),
      supabase.from("repair_records").select("*").order("reported_at", { ascending: false }).limit(6),
      supabase.from("computer_stations").select("id, room_id, group_no, name"),
      supabase.from("borrow_records").select("id", { count: "exact", head: true }).in("status", ["borrowed", "pending_return"]),
      supabase.from("borrow_records").select("id", { count: "exact", head: true }).eq("status", "returned"),
      supabase.from("repair_records").select("id", { count: "exact", head: true }).in("status", ["pending", "in-repair"]),
    ]);

    const safeItems = items || [];
    const safeBorrows = borrowRecords || [];
    const safeRepairs = repairRecords || [];

    setTotal(safeItems.length);
    setAvailable(safeItems.filter((i: any) => i.status === "available").length);
    setBorrowed(safeItems.filter((i: any) => i.status === "borrowed").length);
    setRepair(safeItems.filter((i: any) => i.status === "repair").length);
    setStatusBorrowed(activeBorrowCount.count || 0);
    setStatusReturned(returnedCount.count || 0);
    setStatusRepair(activeRepairCount.count || 0);

    const itemMap = new Map(safeItems.map((item: any) => [item.id, item.name || "อุปกรณ์"]));
    const userIds = [...new Set(safeBorrows.map((r: any) => r.user_id).filter(Boolean))];
    let emailMap: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      (profiles || []).forEach((p: any) => {
        emailMap[p.id] = p.email || "";
      });
    }

    const stationMap = new Map((stations || []).map((st: any) => [
      st.id,
      `${st.room_id || "ห้อง"}${st.group_no ? ` · กลุ่ม ${st.group_no}` : ""}${st.name ? ` · ${st.name}` : ""}`,
    ]));

    const borrowActivities: ActivityItem[] = safeBorrows.map((record: any) => {
      const isReturned = record.status === "returned";
      return {
        id: `borrow-${record.id}`,
        icon: isReturned ? "arrow-down-outline" : "arrow-up-outline",
        iconBg: isReturned ? "#dbeafe" : "#dcfce7",
        color: isReturned ? C.blue : C.green,
        title: `${isReturned ? "คืน" : "ยืม"} ${itemMap.get(record.item_id) || "อุปกรณ์"}`,
        sub: emailMap[record.user_id] || "-",
        time: relativeTime(record.returned_at || record.borrow_date || record.created_at),
      };
    });

    const repairActivities: ActivityItem[] = safeRepairs.map((record: any) => ({
      id: `repair-${record.id}`,
      icon: "construct-outline",
      iconBg: "#fef3c7",
      color: C.orangeDark,
      title: record.status === "done" ? "ซ่อมเสร็จแล้ว" : "แจ้งซ่อม",
      sub: stationMap.get(record.station_id) || record.description || "-",
      time: relativeTime(record.repaired_at || record.reported_at),
    }));

    const merged = [...borrowActivities, ...repairActivities]
      .sort((a, b) => timeScore(b.time) - timeScore(a.time))
      .slice(0, 3);

    setActivities(merged);
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("ออกจากระบบไม่สำเร็จ", error.message);
      return;
    }
    router.replace("/login");
  };

  const confirmLogout = () => {
    if (Platform.OS === "web") {
      const ok = window.confirm("ต้องการออกจากระบบใช่ไหม?");
      if (ok) handleLogout();
      return;
    }

    Alert.alert("ออกจากระบบ", "ต้องการออกจากระบบใช่ไหม?", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ออกจากระบบ",
        style: "destructive",
        onPress: handleLogout,
      },
    ]);
  };

  const stats = [
    { icon: "cube-outline", iconBg: "#dbeafe", color: C.blue, num: total, label: "ทั้งหมด", trend: total > 0 ? `+${total}` : "0" },
    { icon: "checkmark-circle-outline", iconBg: "#dcfce7", color: C.green, num: available, label: "ว่าง", trend: available > 0 ? `+${available}` : "0" },
    { icon: "time-outline", iconBg: "#ffedd5", color: C.orangeDark, num: borrowed, label: "ถูกยืม", trend: borrowed > 0 ? `-${borrowed}` : "0" },
    { icon: "construct-outline", iconBg: "#fee2e2", color: C.red, num: repair, label: "ซ่อม", trend: repair > 0 ? `-${repair}` : "0" },
  ];

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.blueDark} />}
    >
      <View style={s.hero}>
        <View style={s.heroTop}>
          <View>
            <View style={s.greetRow}>
              <Ionicons name={greeting.icon as any} size={13} color={greeting.color} />
              <Text style={s.greet}>{greeting.text} · admin</Text>
            </View>
            <Text style={s.heroTitle}>
              Admin <Text style={s.heroTitleAccent}>Dashboard</Text>
            </Text>
          </View>

          <TouchableOpacity style={s.logoutBtn} onPress={confirmLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={s.todayCard}>
          <TodayItem icon="arrow-up-outline" color="#86efac" num={statusBorrowed} label="ยืม" />
          <View style={s.todayDivider} />
          <TodayItem icon="arrow-down-outline" color="#bfdbfe" num={statusReturned} label="คืน" />
          <View style={s.todayDivider} />
          <TodayItem icon="construct-outline" color="#fde68a" num={statusRepair} label="ซ่อม" />
          <View style={s.todayDivider} />
          <TodayItem icon="calendar-outline" color="#fca5a5" num={today.compact} label={today.dayName} date />
        </View>
      </View>

      <View style={s.body}>
        {loading ? (
          <View style={s.loadingCard}>
            <ActivityIndicator size="large" color={C.blueDark} />
            <Text style={s.loadingText}>กำลังโหลดข้อมูล...</Text>
          </View>
        ) : (
          <>
            <View style={s.primaryGrid}>
              {PRIMARY.map((item) => (
                <TouchableOpacity
                  key={item.route}
                  activeOpacity={0.86}
                  style={[s.primaryTile, { backgroundColor: item.bg }]}
                  onPress={() => router.push(item.route as any)}
                >
                  <View style={s.tileOrb} />
                  <View style={s.primaryIcon}>
                    <Ionicons name={item.icon as any} size={22} color="#fff" />
                  </View>
                  <View>
                    <Text style={s.primaryTitle}>{item.title}</Text>
                    <View style={s.primarySubRow}>
                      <Text style={s.primarySub}>Tap to scan</Text>
                      <Ionicons name="arrow-forward" size={12} color="#fff" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <SectionLabel icon="cube-outline" title="ภาพรวมอุปกรณ์" />
            <View style={s.statGrid}>
              {stats.map((item) => (
                <StatCard key={item.label} {...item} />
              ))}
            </View>

            <SectionLabel icon="settings-outline" title="เครื่องมือทั้งหมด" />
            <View style={s.toolGrid}>
              {TOOLS.map((item) => (
                <TouchableOpacity
                  key={item.route}
                  activeOpacity={0.85}
                  style={s.toolBtn}
                  onPress={() => router.push(item.route as any)}
                >
                  <View style={[s.toolIcon, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon as any} size={23} color={item.color} />
                  </View>
                  <Text style={s.toolText} numberOfLines={2}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.activityHeader}>
              <SectionLabel icon="time-outline" title="กิจกรรมล่าสุด" compact />
              <TouchableOpacity activeOpacity={0.75} onPress={() => router.push("/admin/history" as any)}>
                <Text style={s.viewAll}>ดูทั้งหมด</Text>
              </TouchableOpacity>
            </View>

            {activities.length === 0 ? (
              <View style={s.emptyActivity}>
                <Ionicons name="time-outline" size={26} color="#cbd5e1" />
                <Text style={s.emptyActivityText}>ยังไม่มีกิจกรรมล่าสุด</Text>
              </View>
            ) : (
              <View style={s.activityList}>
                {activities.map((item) => (
                  <TouchableOpacity key={item.id} style={s.activityCard} activeOpacity={0.85}>
                    <View style={[s.activityIcon, { backgroundColor: item.iconBg }]}>
                      <Ionicons name={item.icon as any} size={22} color={item.color} />
                    </View>
                    <View style={s.activityTextWrap}>
                      <Text style={s.activityTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={s.activitySub} numberOfLines={1}>{item.sub}</Text>
                    </View>
                    <Text style={s.activityTime}>{item.time}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function relativeTime(dateValue?: string) {
  if (!dateValue) return "-";
  const diffMs = Date.now() - new Date(dateValue).getTime();
  if (Number.isNaN(diffMs)) return "-";
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

function timeScore(label: string) {
  if (label === "เมื่อสักครู่") return Date.now();
  const match = label.match(/^(\d+)/);
  if (!match) return 0;
  const amount = Number(match[1]);
  if (label.includes("นาที")) return Date.now() - amount * 60000;
  if (label.includes("ชั่วโมง")) return Date.now() - amount * 3600000;
  if (label.includes("วัน")) return Date.now() - amount * 86400000;
  return 0;
}

function SectionLabel({ icon, title, compact }: { icon: any; title: string; compact?: boolean }) {
  return (
    <View style={[s.sectionRow, compact && s.sectionRowCompact]}>
      <Ionicons name={icon} size={13} color="#8b5cf6" />
      <Text style={s.sectionLabel}>{title}</Text>
    </View>
  );
}

function TodayItem({ icon, color, num, label, date }: { icon: any; color: string; num: number | string; label: string; date?: boolean }) {
  return (
    <View style={s.todayItem}>
      <Ionicons name={icon} size={17} color={color} />
      <View>
        <Text style={[s.todayNum, date && s.todayDateNum]}>{num}</Text>
        <Text style={s.todayLabel}>{label}</Text>
      </View>
    </View>
  );
}

function MiniLine({ color, value }: { color: string; value: number }) {
  const points = "0,15 18,13 36,14 54,11 72,12 90,9 108,10 126,7";

  return (
    <View style={s.lineChart}>
      <Svg width="100%" height="22" viewBox="0 0 126 22" preserveAspectRatio="none">
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={value > 0 ? "2.3" : "2"}
          strokeDasharray={value > 0 ? undefined : "5 5"}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={value > 0 ? 0.95 : 0.38}
        />
      </Svg>
    </View>
  );
}

function StatCard({
  icon,
  iconBg,
  color,
  num,
  label,
  trend,
}: {
  icon: any;
  iconBg: string;
  color: string;
  num: number;
  label: string;
  trend: string;
}) {
  return (
    <View style={s.statCard}>
      <View style={s.statTop}>
        <View style={[s.statIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={[s.trendPill, { backgroundColor: iconBg }]}>
          <Ionicons name={trend.startsWith("-") ? "trending-down" : trend === "0" ? "remove" : "trending-up"} size={10} color={color} />
          <Text style={[s.trendText, { color }]}>{trend}</Text>
        </View>
      </View>
      <Text style={[s.statNum, { color }]}>{num}</Text>
      <Text style={s.statLabel}>{label}</Text>
      <MiniLine color={color} value={num} />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    paddingBottom: 30,
  },
  hero: {
    backgroundColor: C.hero,
    paddingTop: 42,
    paddingHorizontal: 22,
    paddingBottom: 20,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  greetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greet: {
    color: "#dbeafe",
    fontSize: 12,
    fontWeight: "800",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 31,
    marginTop: 4,
  },
  heroTitleAccent: {
    color: "#bfdbfe",
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  todayCard: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  todayItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  todayNum: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  todayDateNum: {
    fontSize: 13,
    lineHeight: 16,
  },
  todayLabel: {
    color: "#dbeafe",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 1,
  },
  todayDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: 2,
    marginHorizontal: 10,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  loadingCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.05)",
  },
  loadingText: {
    color: C.muted,
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
  },
  primaryGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  primaryTile: {
    flex: 1,
    height: 124,
    borderRadius: 14,
    padding: 14,
    justifyContent: "space-between",
    overflow: "hidden",
    elevation: 10,
  },
  tileOrb: {
    position: "absolute",
    right: -16,
    top: -16,
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  primaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  primarySubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  primarySub: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 11,
    fontWeight: "800",
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 9,
  },
  sectionRowCompact: {
    marginBottom: 0,
  },
  sectionLabel: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "900",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: "48.2%",
    height: 138,
    backgroundColor: C.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.05)",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    minWidth: 38,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  trendText: {
    fontSize: 10.5,
    fontWeight: "900",
  },
  statNum: {
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 35,
    marginTop: 8,
  },
  statLabel: {
    color: C.faint,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  lineChart: {
    alignSelf: "stretch",
    height: 24,
    marginTop: 5,
    marginHorizontal: 0,
    overflow: "hidden",
  },
  toolGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 24,
  },
  toolBtn: {
    width: "48.2%",
    minHeight: 96,
    backgroundColor: C.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.05)",
    shadowColor: "#94a3b8",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  toolText: {
    color: C.text,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 16,
  },
  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  viewAll: {
    color: C.blueDark,
    fontSize: 14,
    fontWeight: "900",
  },
  emptyActivity: {
    minHeight: 78,
    backgroundColor: C.card,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.05)",
  },
  emptyActivityText: {
    color: C.faint,
    fontSize: 13,
    fontWeight: "800",
  },
  activityList: {
    gap: 10,
  },
  activityCard: {
    minHeight: 58,
    backgroundColor: C.card,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.05)",
    elevation: 1,
  },
  activityIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  activityTextWrap: {
    flex: 1,
  },
  activityTitle: {
    color: C.ink,
    fontSize: 13,
    fontWeight: "900",
  },
  activitySub: {
    color: C.faint,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  activityTime: {
    color: C.faint,
    fontSize: 10,
    fontWeight: "900",
  },
});
