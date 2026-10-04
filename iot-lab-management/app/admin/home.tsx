import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import supabase from "../../lib/supabase";
import { useRealtime } from "../../lib/realtime";
import { currentUser } from "../../lib/session";
import { useRefreshOnFocus } from "../../lib/nav";
import { confirmAction, notify } from "../../lib/notify";
import { canAccess, isStaffRole, ROLE_LABEL, useRole } from "../../lib/roles";
import { W, NG, gradient, iconDot } from "../../lib/theme";

const C = {
  bg: "#EAF1FC",
  hero: "#2563EB",
  ink: "#172033",
  text: "#1e293b",
  muted: "#475569",
  faint: "#64748B",
  card: "#ffffff",
  blue: "#1d4ed8",
  blueDark: "#1f3f9e",
  green: "#047857",
  orange: "#fb5a0a",
  orangeDark: "#ea580c",
  red: "#dc2626",
  purple: "#2563EB",
  cyan: "#0891b2",
};

// แผน 2.6: Admin ยืม/คืนแทนนักศึกษาไม่ได้ สแกน = ดูสถานะ / อนุมัติผ่านกล่องคำขอ
const PRIMARY = [
  { icon: "scan-outline", title: "สแกนดูสถานะ", sub: "ผู้ยืม · ประวัติ", route: "/admin/lookup", bg: "#2347ae" },
  { icon: "add-circle-outline", title: "เพิ่มอุปกรณ์", sub: "ออกรหัสให้อัตโนมัติ", route: "/admin/scan", bg: C.orange },
] as const;

const TOOLS = [
  { icon: "business-outline", label: "จัดการห้อง", route: "/admin/room", color: "#3B82F6", bg: "#DBEAFE" },
  { icon: "cube-outline", label: "จัดการอุปกรณ์", route: "/admin/items", color: "#0ea5e9", bg: "#e0f2fe" },
  { icon: "qr-code-outline", label: "สร้าง QR", route: "/admin/qrgen", color: "#6366f1", bg: "#DBEAFE" },
  { icon: "pricetags-outline", label: "หมวดหมู่", route: "/admin/categories", color: "#db2777", bg: "#fce7f3" },
  { icon: "bar-chart-outline", label: "รายงานสต็อก", route: "/admin/stock", color: "#0891b2", bg: "#cffafe" },
  { icon: "document-attach-outline", label: "รายงานยืม-คืน", route: "/admin/report", color: "#0d9488", bg: "#ccfbf1" },
  { icon: "settings-outline", label: "ตั้งค่าระบบ", route: "/admin/settings", color: "#475569", bg: "#f1f5f9" },
  { icon: "people-outline", label: "จัดการ TA", route: "/admin/users", color: "#2563EB", bg: "#DBEAFE" },
  { icon: "document-text-outline", label: "นำเข้า CSV", route: "/admin/import", color: "#059669", bg: "#d1fae5" },
  { icon: "receipt-outline", label: "ประวัติยืม", route: "/admin/history", color: C.muted, bg: "#f1f5f9" },
  { icon: "desktop-outline", label: "จัดการเครื่อง", route: "/admin/stations", color: C.red, bg: "#fee2e2" },
  { icon: "git-network-outline", label: "จัดการแลน", route: "/admin/lanports", color: C.purple, bg: "#DBEAFE" },
  { icon: "clipboard-outline", label: "ตรวจอุปกรณ์", route: "/admin/inspection", color: "#0d9488", bg: "#ccfbf1" },
  { icon: "hardware-chip-outline", label: "ตรวจสภาพ IoT", route: "/admin/iotinspection", color: "#a855f7", bg: "#EEF5FF" },
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
  if (hour >= 5 && hour < 8) return { text: "สวัสดีตอนเช้า", icon: "sunny-outline", color: "#F59E0B" };
  if (hour >= 8 && hour < 12) return { text: "สวัสดีตอนสาย", icon: "partly-sunny-outline", color: "#F59E0B" };
  if (hour >= 12 && hour < 16) return { text: "สวัสดีตอนบ่าย", icon: "sunny-outline", color: "#EA580C" };
  if (hour >= 16 && hour < 19) return { text: "สวัสดีตอนเย็น", icon: "partly-sunny-outline", color: "#EA580C" };
  if (hour >= 19 && hour < 22) return { text: "สวัสดีตอนค่ำ", icon: "moon-outline", color: "#2563EB" };
  return { text: "สวัสดีตอนดึก", icon: "moon-outline", color: "#1D4ED8" };
}

type Tile = { icon: string; title?: string; sub?: string; label?: string; route: string; color?: string; bg: string };

export default function AdminHome() {
  const router = useRouter();
  const { role } = useRole();
  // TA เห็นเฉพาะเมนูที่มีสิทธิ์ (lib/roles.ts) + ทางไปหน้านักศึกษาเพื่อยืมของเอง
  const primary: Tile[] = [
    ...PRIMARY.filter((t) => canAccess(role, t.route)),
    ...(role === "ta" ? [{ icon: "qr-code-outline", title: "พิมพ์ป้าย QR", sub: "ป้ายติดอุปกรณ์", route: "/admin/qrgen", bg: "#4f46e5" }] : []),
  ];
  // เครื่องมือ: ไม่ซ้ำกับปุ่มใหญ่ด้านบน
  const tools: Tile[] = [
    ...TOOLS.filter((t) => canAccess(role, t.route) && !primary.some((p) => p.route === t.route)),
    ...(role === "ta" ? [{ icon: "person-outline", label: "ยืมของ (หน้านักศึกษา)", route: "/home", color: C.green, bg: "#ECFDF5" }] : []),
  ];
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [available, setAvailable] = useState(0);
  const [borrowed, setBorrowed] = useState(0);
  const [repair, setRepair] = useState(0);
  // ข้อมูลกราฟย้อนหลัง 7 วัน (จุดสุดท้าย = ตัวเลขปัจจุบัน)
  const [series, setSeries] = useState<{ total: number[]; available: number[]; borrowed: number[]; repair: number[] }>({ total: [], available: [], borrowed: [], repair: [] });
  const [statusBorrowed, setStatusBorrowed] = useState(0);
  const [statusReturned, setStatusReturned] = useState(0);
  const [statusRepair, setStatusRepair] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    checkRoleAndFetch();
  }, []);
  // กลับมาหน้านี้ (ปุ่ม ← / สลับแท็บ) → โหลดข้อมูลใหม่
  useRefreshOnFocus(() => { fetchDashboard(); });

  // แจ้งเตือนที่ยังไม่อ่าน (ประกัน/อายุ/คำขอ ฯลฯ) — นับใหม่ทุกครั้งที่กลับมาหน้านี้
  const refreshUnread = useCallback(async () => {
    const user = await currentUser();
    if (!user) return;
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setUnread(count || 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshUnread();
    }, [refreshUnread])
  );

  // เลขบนการ์ดกล่องคำขอ (นับอย่างเดียว เบากว่าโหลดหน้าแรกทั้งหน้า)
  const refreshPending = async () => {
    const { count } = await supabase
      .from("borrow_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setPendingRequests(count || 0);
  };

  // Realtime: แจ้งเตือนใหม่ → เลขกระดิ่ง / คำขอใหม่หรือถูกตัดสิน → เลขกล่องคำขอ (ขึ้นทันที ไม่ต้องรีเฟรช)
  useRealtime("user", "notification", refreshUnread);
  useRealtime("staff", "request", () => { refreshPending(); });

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
    const user = await currentUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!isStaffRole(profile?.role)) {
      router.replace("/home");
      return;
    }

    await fetchDashboard();
  };

  const fetchDashboard = async () => {
    await supabase.rpc("expire_requests");
    const { count: reqCount } = await supabase
      .from("borrow_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setPendingRequests(reqCount || 0);

    const [
      { data: items },
      { data: borrowRecords },
      { data: repairRecords },
      { data: stations },
      activeBorrowCount,
      returnedCount,
      activeRepairCount,
      { data: loanHistory },
    ] = await Promise.all([
      // ของที่จำหน่ายแล้วไม่นับในสต็อก แต่ยังต้องใช้ชื่อในกิจกรรมล่าสุด
      supabase.from("items").select("id, name, item_code, status, created_at, retired_at"),
      supabase.from("borrow_records").select("*").order("borrow_date", { ascending: false }).limit(12),
      supabase.from("repair_records").select("*").order("reported_at", { ascending: false }).limit(6),
      supabase.from("computer_stations").select("id, room_id, group_no, name"),
      supabase.from("borrow_records").select("id", { count: "exact", head: true }).in("status", ["borrowed", "pending_return"]),
      supabase.from("borrow_records").select("id", { count: "exact", head: true }).eq("status", "returned"),
      supabase.from("repair_records").select("id", { count: "exact", head: true }).in("status", ["pending", "in-repair"]),
      // การยืมที่ยังค้างอยู่ช่วง 7 วันที่ผ่านมา (ใช้คำนวณกราฟ "ถูกยืม" ย้อนหลัง)
      supabase
        .from("borrow_records")
        .select("item_id, borrow_date, return_date, status")
        .or(`return_date.is.null,return_date.gte.${new Date(Date.now() - 7 * 86400000).toISOString()}`),
    ]);

    const safeItems = items || [];
    const stockItems = safeItems.filter((i: any) => i.status !== "retired");
    const safeBorrows = borrowRecords || [];
    const safeRepairs = repairRecords || [];

    setTotal(stockItems.length);
    setAvailable(stockItems.filter((i: any) => i.status === "available").length);
    setBorrowed(stockItems.filter((i: any) => i.status === "borrowed").length);
    setRepair(stockItems.filter((i: any) => i.status === "repair").length);
    setSeries(buildSeries(safeItems, loanHistory || []));
    setStatusBorrowed(activeBorrowCount.count || 0);
    setStatusReturned(returnedCount.count || 0);
    setStatusRepair(activeRepairCount.count || 0);

    const itemMap = new Map(safeItems.map((item: any) => [item.id, item.item_code || item.name || "อุปกรณ์"]));
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
        iconBg: isReturned ? "#dbeafe" : "#ECFDF5",
        color: isReturned ? C.blue : C.green,
        title: `${isReturned ? "คืน" : "ยืม"} ${itemMap.get(record.item_id) || "อุปกรณ์"}`,
        sub: emailMap[record.user_id] || "-",
        time: relativeTime(record.return_date || record.borrow_date),
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
      notify("ออกจากระบบไม่สำเร็จ", error.message);
      return;
    }
    router.replace("/login");
  };

  const confirmLogout = () => {
    confirmAction("ออกจากระบบ", "ต้องการออกจากระบบใช่ไหม?", "ออกจากระบบ", handleLogout, true);
  };

  const stats = [
    { icon: "cube-outline", iconBg: "#dbeafe", color: C.blue, num: total, label: "ทั้งหมด", data: series.total },
    { icon: "checkmark-circle-outline", iconBg: "#ECFDF5", color: C.green, num: available, label: "ว่าง", data: series.available },
    { icon: "time-outline", iconBg: "#ffedd5", color: C.orangeDark, num: borrowed, label: "ถูกยืม", data: series.borrowed },
    { icon: "construct-outline", iconBg: "#fee2e2", color: C.red, num: repair, label: "ซ่อม", data: series.repair },
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
              <Text style={s.greet}>{greeting.text} · {role ? ROLE_LABEL[role] : ""}</Text>
              <OnlineDot />
            </View>
            <Text style={s.heroTitle}>
              {role === "ta" ? "TA" : "Admin"} <Text style={s.heroTitleAccent}>Dashboard</Text>
            </Text>
          </View>

          <View style={s.headerBtns}>
            <TouchableOpacity
              style={s.logoutBtn}
              onPress={() => router.push("/notifications")}
              activeOpacity={0.85}
              accessibilityLabel={unread ? `แจ้งเตือน ยังไม่อ่าน ${unread}` : "แจ้งเตือน"}
            >
              <Ionicons name="notifications-outline" size={20} color="#1D4ED8" />
              {unread > 0 && (
                <View style={s.bellBadge}>
                  <Text style={s.bellBadgeText}>{unread > 99 ? "99+" : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.logoutBtn} onPress={confirmLogout} activeOpacity={0.85} accessibilityLabel="ออกจากระบบ">
              <Ionicons name="log-out-outline" size={20} color="#1D4ED8" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.todayCard}>
          <TodayItem icon="arrow-up-outline" color="#10B981" num={statusBorrowed} label="ยืม" />
          <View style={s.todayDivider} />
          <TodayItem icon="arrow-down-outline" color="#2563EB" num={statusReturned} label="คืน" />
          <View style={s.todayDivider} />
          <TodayItem icon="construct-outline" color="#F59E0B" num={statusRepair} label="ซ่อม" />
          <View style={s.todayDivider} />
          <TodayItem icon="calendar-outline" color="#EF4444" num={today.compact} label={today.dayName} date />
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
            {/* กล่องคำขอจากนักศึกษา (เฟส 3) */}
            <TouchableOpacity
              style={[s.inboxCard, pendingRequests > 0 && s.inboxCardHot]}
              onPress={() => router.push("/admin/requests" as any)}
              activeOpacity={0.86}
            >
              <View style={s.inboxIcon}>
                <Ionicons name="file-tray-full-outline" size={24} color={pendingRequests > 0 ? "#fff" : C.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.inboxTitle, pendingRequests > 0 && { color: "#fff" }]}>กล่องคำขอ</Text>
                <Text style={[s.inboxSub, pendingRequests > 0 && { color: "#DBEAFE" }]}>
                  {pendingRequests > 0 ? `มี ${pendingRequests} คำขอรออนุมัติ` : "ไม่มีคำขอที่รออยู่"}
                </Text>
              </View>
              {pendingRequests > 0 && (
                <View style={s.inboxBadge}>
                  <Text style={s.inboxBadgeText}>{pendingRequests}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={pendingRequests > 0 ? "#fff" : C.muted} />
            </TouchableOpacity>

            <View style={s.primaryGrid}>
              {primary.map((item) => (
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
                      <Text style={s.primarySub}>{item.sub}</Text>
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
              {tools.map((item) => (
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
      <Ionicons name={icon} size={13} color="#3B82F6" />
      <Text style={s.sectionLabel}>{title}</Text>
    </View>
  );
}

// จุดเขียวกระพริบ = กำลังออนไลน์ (วงแสงขยายแล้วจางหาย วนไปเรื่อย ๆ)
function OnlineDot() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
      { resetBeforeIteration: true }
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={s.onlineWrap} accessibilityLabel="ออนไลน์">
      <Animated.View
        style={[
          s.onlineRing,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.5] }) }],
          },
        ]}
      />
      <Animated.View style={[s.onlineDot, { opacity: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.35, 1] }) }]} />
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

// กราฟเส้นเล็กจากข้อมูลจริง 7 วัน (สเกลตามค่าต่ำสุด–สูงสุดของช่วงนั้น / ค่าเท่ากันทั้งช่วง = เส้นตรงกลาง)
function MiniLine({ color, data }: { color: string; data: number[] }) {
  const values = data.length ? data : [0, 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = 126 / Math.max(values.length - 1, 1);
  const y = (v: number) => (max === min ? 11 : 19 - ((v - min) / (max - min)) * 16);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const empty = values.every((v) => v === 0);

  return (
    <View style={s.lineChart}>
      <Svg width="100%" height="22" viewBox="0 0 126 22" preserveAspectRatio="none">
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={empty ? "2" : "2.3"}
          strokeDasharray={empty ? "5 5" : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={empty ? 0.38 : 0.95}
        />
      </Svg>
    </View>
  );
}

// สร้างตัวเลขย้อนหลัง 7 วัน (สิ้นวันของแต่ละวัน วันนี้ = ตอนนี้)
// ทั้งหมด = ของที่เพิ่มแล้วและยังไม่จำหน่าย / ถูกยืม = ยืมไปแล้วยังไม่คืน ณ เวลานั้น (รายการเก่าที่คืนแล้วแต่ไม่มีวันคืน ไม่นับ)
// ซ่อม = ไม่มีประวัติย้อนหลังในระบบ ใช้ค่าปัจจุบัน / ว่าง = ทั้งหมด − ถูกยืม − ซ่อม
// จุดสุดท้ายยึดตามสถานะจริงของตอนนี้ ให้ตรงกับตัวเลขบนการ์ดเสมอ
function buildSeries(items: any[], loans: any[]) {
  const now = Date.now();
  const days = Array.from({ length: 7 }, (_, i) => {
    if (i === 6) return now;
    const d = new Date(now - (6 - i) * 86400000);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  });
  const stock = items.filter((i) => i.status !== "retired");
  const current = {
    total: stock.length,
    borrowed: stock.filter((i) => i.status === "borrowed").length,
    repair: stock.filter((i) => i.status === "repair").length,
    available: stock.filter((i) => i.status === "available").length,
  };
  const time = (v: string | null) => (v ? new Date(v).getTime() : null);
  const total = days.map((t) => items.filter((i) => (time(i.created_at) ?? 0) <= t && (!i.retired_at || (time(i.retired_at) as number) > t)).length);
  const borrowed = days.map((t) => loans.filter((l) => (time(l.borrow_date) ?? Infinity) <= t && (l.return_date ? (time(l.return_date) as number) > t : l.status !== "returned")).length);
  const repair = days.map(() => current.repair);
  const available = days.map((_, i) => Math.max(total[i] - borrowed[i] - repair[i], 0));
  total[6] = current.total;
  borrowed[6] = current.borrowed;
  available[6] = current.available;
  return { total, available, borrowed, repair };
}

function StatCard({
  icon,
  iconBg,
  color,
  num,
  label,
  data,
}: {
  icon: any;
  iconBg: string;
  color: string;
  num: number;
  label: string;
  data: number[];
}) {
  // เปลี่ยนไปเท่าไรเทียบกับ 7 วันก่อน
  const diff = data.length ? data[data.length - 1] - data[0] : 0;
  const trend = diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : "0";
  return (
    <View
      style={[
        s.statCard,
        gradient(`linear-gradient(160deg, #FFFFFF 0%, ${iconBg} 100%)`),
        { backgroundColor: iconBg },
      ]}
    >
      <View style={s.statTop}>
        <View style={iconDot(color, 36)}>
          <Ionicons name={icon} size={19} color="#FFFFFF" />
        </View>
        <View style={[s.trendPill, { backgroundColor: "rgba(255,255,255,0.75)" }]}>
          <Ionicons name={trend.startsWith("-") ? "trending-down" : trend === "0" ? "remove" : "trending-up"} size={10} color={color} />
          <Text style={[s.trendText, { color }]}>{trend}</Text>
        </View>
      </View>
      <Text style={[s.statNum, { color }]}>{num}</Text>
      <Text style={s.statLabel}>{label}</Text>
      <MiniLine color={color} data={data} />
    </View>
  );
}

const s = StyleSheet.create({
  inboxCard: {
    ...W.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 14,
  },
  inboxCardHot: { ...W.primary, borderRadius: 22 },
  inboxIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(37,99,235,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  inboxTitle: { fontSize: 16, fontWeight: "600", color: "#172033" },
  inboxSub: { fontSize: 12.5, color: "#475569", marginTop: 1 },
  inboxBadge: {
    ...NG,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  inboxBadgeText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  container: {
    ...W.page,
    flex: 1,
  },
  content: {
    paddingBottom: 30,
  },
  hero: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
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
    color: "#475569",
    fontSize: 13,
  },
  onlineWrap: { width: 10, height: 10, marginLeft: 3, alignItems: "center", justifyContent: "center" },
  onlineRing: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E" },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E", boxShadow: "0 0 6px rgba(34,197,94,0.7)" },
  heroTitle: {
    color: "#172033",
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 34,
    marginTop: 2,
  },
  heroTitleAccent: {
    color: "#2563EB",
  },
  headerBtns: { flexDirection: "row", gap: 8 },
  bellBadge: {
    ...NG,
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  bellBadgeText: { color: "#fff", fontSize: 10.5, fontWeight: "900" },
  logoutBtn: {
    ...W.iconBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  todayCard: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 16,
    ...W.card,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  todayItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  todayNum: {
    color: "#172033",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 22,
  },
  todayDateNum: {
    fontSize: 13,
    lineHeight: 16,
  },
  todayLabel: {
    color: "#475569",
    fontSize: 11,
    marginTop: 0,
  },
  todayDivider: {
    width: 1,
    backgroundColor: "#DCE7FA",
    marginVertical: 2,
    marginHorizontal: 6,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  loadingCard: {
    ...W.card,
    padding: 28,
    alignItems: "center",
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
    borderRadius: 22,
    padding: 14,
    justifyContent: "space-between",
    overflow: "hidden",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 2px 4px rgba(15,23,42,0.12), 0 12px 24px rgba(37,99,235,0.22)",
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
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  primarySubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  primarySub: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
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
    color: C.ink,
    fontSize: 16,
    fontWeight: "600",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 20,
  },
  statCard: {
    ...W.card,
    width: "48.2%",
    minHeight: 138,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  statTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
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
    fontSize: 11,
    fontWeight: "600",
  },
  statNum: {
    fontSize: 30,
    fontWeight: "700",
    lineHeight: 38,
    marginTop: 6,
  },
  statLabel: {
    color: C.muted,
    fontSize: 12,
    marginTop: 0,
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
    ...W.card,
    minHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  toolIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  },
  toolText: {
    color: C.ink,
    fontSize: 13,
    fontWeight: "600",
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
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyActivity: {
    ...W.card,
    minHeight: 78,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
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
    ...W.card,
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  activityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
  },
  activityTextWrap: {
    flex: 1,
  },
  activityTitle: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  activitySub: {
    color: C.muted,
    fontSize: 12,
    marginTop: 2,
  },
  activityTime: {
    color: C.faint,
    fontSize: 11,
  },
});
