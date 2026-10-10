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
import { fetchPeople, who } from "../../lib/people";
import { currentUser } from "../../lib/session";
import { useRefreshOnFocus } from "../../lib/nav";
import GreetingLine from "../../components/GreetingLine";
import StaffCheckInCard from "../../components/StaffCheckInCard";
import { usePresence } from "../../lib/presence";
import { FadeIn, PressScale, Pulse } from "../../components/Motion";
import { confirmAction, notify } from "../../lib/notify";
import { canAccess, ROLE_LABEL, useRole } from "../../lib/roles";
import { W, NG, gradient, iconDot, BADGE_TEXT } from "../../lib/theme";

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
// ทางลัด = งานยืม-คืนที่ทำแทบทุกวัน (ฟีเจอร์หลักของแอป) — ที่เหลือแยกตามหมวดใน TOOL_GROUPS ด้านล่าง
const PRIMARY = [
  { icon: "scan-outline", title: "สแกนดูสถานะ", sub: "ผู้ยืม · ประวัติ", route: "/admin/lookup", bg: "blue" },
  { icon: "add-circle-outline", title: "เพิ่มอุปกรณ์", sub: "ออกรหัสให้อัตโนมัติ", route: "/admin/scan", bg: "orange" },
  { icon: "cube-outline", title: "จัดการอุปกรณ์", sub: "ค้นหา · แก้ไข", route: "/admin/items", bg: "teal" },
  { icon: "receipt-outline", title: "ประวัติยืม", sub: "ยืม-คืนทั้งหมด", route: "/admin/history", bg: "green" },
] as const;

// โทนสีของการ์ดทางลัด (bg ของ PRIMARY = ชื่อโทน): พื้นไล่สีของโทนนั้นชัด ๆ + แถบสีซ้าย + ไอคอนไล่สี
const TONES: Record<string, { accent: string; icon: string; tint: string }> = {
  blue: { accent: "#2563EB", icon: "linear-gradient(145deg, #7AA7FF 0%, #3B6FF0 55%, #2D56E0 100%)", tint: "linear-gradient(150deg, #E6EFFF 0%, #CFE0FF 55%, #B4CEFF 100%)" },
  orange: { accent: "#EA6A1F", icon: "linear-gradient(145deg, #FFB648 0%, #F7862F 55%, #F06A2A 100%)", tint: "linear-gradient(150deg, #FFF0E3 0%, #FFDDC3 55%, #FFC59E 100%)" },
  teal: { accent: "#1F7F96", icon: "linear-gradient(145deg, #4FB8C2 0%, #2A8FA8 55%, #2C6FA5 100%)", tint: "linear-gradient(150deg, #E3F4F7 0%, #CAE9EF 55%, #ACDBE5 100%)" },
  green: { accent: "#2E8B57", icon: "linear-gradient(145deg, #5CC489 0%, #36A066 55%, #2A8253 100%)", tint: "linear-gradient(150deg, #E6F5EB 0%, #CDEBD7 55%, #B1DFC1 100%)" },
  indigo: { accent: "#4F46E5", icon: "linear-gradient(145deg, #8B85FF 0%, #5B54F0 55%, #4338CA 100%)", tint: "linear-gradient(150deg, #ECEBFF 0%, #DAD7FF 55%, #C4BFFF 100%)" },
};

// ลายน้ำไอคอนใหญ่จาง ๆ มุมขวาล่าง บอกว่าการ์ดนี้ทำอะไร (ตาม route) — ⊕ เส้นบางกว่าตัวอื่น จึงเข้มกว่าเล็กน้อย (0.1 แทน 0.06)
const MARKS: Record<string, string> = {
  "/admin/lookup": "qr-code-outline",
  "/admin/scan": "add-circle-outline",
  "/admin/items": "cube-outline",
  "/admin/history": "time-outline",
  "/admin/qrgen": "print-outline",
  "/home": "bag-handle-outline",
};

// เครื่องมือแยกหมวด (เรียงหมวดและปุ่มในหมวดจากใช้บ่อย → นาน ๆ ครั้ง)
const TOOL_GROUPS = [
  {
    icon: "cube-outline",
    title: "อุปกรณ์ IoT",
    items: [
      { icon: "cube-outline", label: "จัดการอุปกรณ์", route: "/admin/items", color: "#0ea5e9", bg: "#e0f2fe" },
      { icon: "receipt-outline", label: "ประวัติยืม", route: "/admin/history", color: C.muted, bg: "#f1f5f9" },
      { icon: "qr-code-outline", label: "สร้าง QR", route: "/admin/qrgen", color: "#6366f1", bg: "#DBEAFE" },
      { icon: "pricetags-outline", label: "หมวดหมู่", route: "/admin/categories", color: "#db2777", bg: "#fce7f3" },
      { icon: "document-text-outline", label: "นำเข้า CSV", route: "/admin/import", color: "#059669", bg: "#d1fae5" },
    ],
  },
  {
    icon: "desktop-outline",
    title: "ห้องคอม",
    items: [
      { icon: "business-outline", label: "จัดการห้อง", route: "/admin/room", color: "#3B82F6", bg: "#DBEAFE" },
      { icon: "desktop-outline", label: "จัดการเครื่อง", route: "/admin/stations", color: C.red, bg: "#fee2e2" },
      { icon: "git-network-outline", label: "จัดการแลน", route: "/admin/lanports", color: C.purple, bg: "#DBEAFE" },
      { icon: "construct-outline", label: "ซ่อมบำรุง", route: "/admin/repairs", color: C.orangeDark, bg: "#ffedd5" },
      { icon: "megaphone-outline", label: "แจ้งปัญหาห้อง", route: "/admin/roomreports", color: "#7c3aed", bg: "#ede9fe" },
    ],
  },
  {
    icon: "calendar-outline",
    title: "ตรวจสภาพ & รายงาน",
    items: [
      { icon: "clipboard-outline", label: "ตรวจเครื่องคอม", route: "/admin/inspection", color: "#0d9488", bg: "#ccfbf1" },
      { icon: "hardware-chip-outline", label: "ตรวจสภาพ IoT", route: "/admin/iotinspection", color: "#a855f7", bg: "#EEF5FF" },
      { icon: "document-attach-outline", label: "รายงานยืม-คืน", route: "/admin/report", color: "#0d9488", bg: "#ccfbf1" },
      { icon: "bar-chart-outline", label: "รายงานสต็อก", route: "/admin/stock", color: "#0891b2", bg: "#cffafe" },
    ],
  },
  {
    icon: "options-outline",
    title: "ระบบ",
    items: [
      { icon: "people-outline", label: "จัดการผู้ใช้", route: "/admin/users", color: "#2563EB", bg: "#DBEAFE" },
      { icon: "settings-outline", label: "ตั้งค่าระบบ", route: "/admin/settings", color: "#475569", bg: "#f1f5f9" },
    ],
  },
];

type ActivityItem = {
  id: string;
  icon: string;
  iconBg: string;
  color: string;
  title: string;
  sub: string;
  time: string;
};

type Tile = { icon: string; title?: string; sub?: string; label?: string; route: string; color?: string; bg: string };

// เที่ยงคืนวันนี้ (เวลาไทย) เป็น ISO — ใช้นับยืม/คืนของวันนี้
function startOfTodayBkk() {
  const d = new Date(Date.now() + 7 * 3600000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 7 * 3600000).toISOString();
}

// คำขอยืม-คืน-ยืมต่อที่รออนุมัติ + คำขอนัดรับที่รอนัดเวลา (F2)
async function countPending() {
  const [req, pickup] = await Promise.all([
    supabase.from("borrow_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("pickup_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return (req.count || 0) + (pickup.count || 0);
}

export default function AdminHome() {
  const router = useRouter();
  const { role, userId } = useRole();
  // F4 ผู้ดูแลที่อยู่ห้องตอนนี้ — การ์ดเช็กอิน + จุดสีบนบรรทัดทักทาย (เช็กอินแล้ว = เขียว / ยังไม่เช็กอิน = แดง)
  const presence = usePresence();
  const checkedIn = presence.list.some((p) => p.user_id === userId);
  // TA เห็นเฉพาะเมนูที่มีสิทธิ์ (lib/roles.ts) + ทางไปหน้านักศึกษาเพื่อยืมของเอง
  const primary: Tile[] = [
    ...PRIMARY.filter((t) => canAccess(role, t.route)),
    ...(role === "ta" ? [
      { icon: "qr-code-outline", title: "พิมพ์ป้าย QR", sub: "ป้ายติดอุปกรณ์", route: "/admin/qrgen", bg: "indigo" },
      { icon: "person-outline", title: "ยืมของ", sub: "หน้านักศึกษา", route: "/home", bg: "orange" },
    ] : []),
  ];
  // เครื่องมือแต่ละหมวด: เฉพาะที่มีสิทธิ์ + ไม่ซ้ำกับทางลัดด้านบน / หมวดที่ว่างไม่แสดง
  const groups = TOOL_GROUPS.map((g) => ({
    ...g,
    items: (g.items as Tile[]).filter((t) => canAccess(role, t.route) && !primary.some((p) => p.route === t.route)),
  })).filter((g) => g.items.length > 0);
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

  // ด่านสิทธิ์อยู่ที่ app/admin/_layout.tsx แล้ว (ไม่ต้องอ่าน role ซ้ำ) → โหลดแดชบอร์ดเลย
  useEffect(() => {
    fetchDashboard();
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
    setPendingRequests(await countPending());
  };

  // Realtime: แจ้งเตือนใหม่ → เลขกระดิ่ง / คำขอใหม่หรือถูกตัดสิน → เลขกล่องคำขอ (ขึ้นทันที ไม่ต้องรีเฟรช)
  useRealtime("user", "notification", refreshUnread);
  useRealtime("staff", "request", () => { refreshPending(); });


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

  const fetchDashboard = async () => {
    // เลขกล่องคำขอ: ปล่อยคำขอหมดเวลาก่อนแล้วค่อยนับ — วิ่งคู่กับคำสั่งอื่น ไม่ต้องรอกันเป็นทอด ๆ
    const pendingTask = supabase.rpc("expire_requests").then(() => countPending());

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
      // การ์ด "วันนี้": ยืม/คืน ที่เกิดขึ้นวันนี้จริง (เดิมเป็นยอดสะสมทั้งหมด อยู่ข้างวันที่แล้วชวนเข้าใจผิด)
      supabase.from("borrow_records").select("id", { count: "exact", head: true }).gte("borrow_date", startOfTodayBkk()),
      supabase.from("borrow_records").select("id", { count: "exact", head: true }).gte("return_date", startOfTodayBkk()),
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
    setPendingRequests(await pendingTask);

    const itemMap = new Map(safeItems.map((item: any) => [item.id, item.item_code || item.name || "อุปกรณ์"]));
    const userIds = [...new Set(safeBorrows.map((r: any) => r.user_id).filter(Boolean))];
    let emailMap: Record<string, string> = {};

    // ชื่อ · รหัส นศ. (ไม่มีชื่อ → อีเมล) เหมือนหน้าผู้ดูแลอื่น
    if (userIds.length > 0) {
      const profiles = await fetchPeople(userIds as string[]);
      profiles.forEach((p: any) => {
        emailMap[p.id] = who(p);
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
    // ออกเฉพาะเครื่องนี้ (ค่าเริ่มต้น Supabase = ออกทุกเครื่องของบัญชี)
    const { error } = await supabase.auth.signOut({ scope: "local" });
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
            <GreetingLine roleLabel={role ? ROLE_LABEL[role] : undefined} dot={checkedIn ? "green" : "red"} />
            <Text style={s.heroTitle}>
              {role === "ta" ? "TA" : "Admin"} <Text style={s.heroTitleAccent}>Dashboard</Text>
            </Text>
          </View>

          <View style={s.headerBtns}>
            {/* ป้ายตัวเลขวางเป็นชั้นแยกทับบนปุ่ม (ถ้าอยู่ในปุ่ม พื้นไล่สีของปุ่มบน iOS จะทับป้าย) */}
            <View style={s.bellWrap}>
              <TouchableOpacity
                style={s.logoutBtn}
                onPress={() => router.push("/notifications")}
                activeOpacity={0.85}
                accessibilityLabel={unread ? `แจ้งเตือน ยังไม่อ่าน ${unread}` : "แจ้งเตือน"}
              >
                <Ionicons name="notifications-outline" size={20} color="#1D4ED8" />
              </TouchableOpacity>
              {unread > 0 && (
                <View style={s.bellBadge} pointerEvents="none">
                  <Text style={s.bellBadgeText}>{unread > 99 ? "99+" : unread}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity style={s.logoutBtn} onPress={confirmLogout} activeOpacity={0.85} accessibilityLabel="ออกจากระบบ">
              <Ionicons name="log-out-outline" size={20} color="#1D4ED8" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.todayCard}>
          <TodayItem icon="arrow-up-outline" color="#10B981" num={statusBorrowed} label="ยืมวันนี้" />
          <View style={s.todayDivider} />
          <TodayItem icon="arrow-down-outline" color="#2563EB" num={statusReturned} label="คืนวันนี้" />
          <View style={s.todayDivider} />
          <TodayItem icon="construct-outline" color="#F59E0B" num={statusRepair} label="ซ่อมค้าง" />
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
            {/* ลูกเล่น: แต่ละส่วนค่อย ๆ ลอยขึ้นทีละส่วนตอนเปิดหน้า + ปุ่มกดแล้วยุบ/สั่นเบา ๆ (components/Motion) */}
            {/* F4 เช็กอิน/เช็กเอาท์ อยู่ที่ IoT Lab */}
            <FadeIn>
              <StaffCheckInCard list={presence.list} me={userId} reload={presence.reload} />
            </FadeIn>
            {/* กล่องคำขอจากนักศึกษา (เฟส 3) */}
            <FadeIn>
            <PressScale
              style={[s.inboxCard, pendingRequests > 0 && s.inboxCardHot]}
              onPress={() => router.push("/admin/requests" as any)}
              scaleTo={0.98}
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
                <View style={s.inboxBadgeWrap}>
                  {/* มีคำขอรอ → วงชีพจรรอบตัวเลข เรียกสายตาเบา ๆ */}
                  <Pulse color="#ef4444" size={26} />
                  <View style={s.inboxBadge}>
                    <Text style={s.inboxBadgeText}>{pendingRequests}</Text>
                  </View>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={pendingRequests > 0 ? "#fff" : C.muted} />
            </PressScale>
            </FadeIn>

            <FadeIn delay={70} style={s.primaryGrid}>
              {primary.map((item) => {
                const tone = TONES[item.bg] || TONES.blue;
                return (
                  <PressScale
                    key={item.route}
                    style={[s.primaryTile, gradient(tone.tint)]}
                    onPress={() => router.push(item.route as any)}
                    accessibilityLabel={item.title}
                  >
                    {/* ลายน้ำไอคอนตามหน้าที่ของการ์ด */}
                    <View style={[s.tileMark, item.route === "/admin/scan" && { opacity: 0.1 }]} pointerEvents="none">
                      <Ionicons name={(MARKS[item.route] || item.icon) as any} size={108} color={tone.accent} />
                    </View>
                    <View style={[s.tileStripe, { backgroundColor: tone.accent }]} />
                    <View style={[s.tilePill, { backgroundColor: tone.accent }]} />
                    <View style={[s.primaryIcon, gradient(tone.icon), { backgroundColor: tone.accent, boxShadow: `0 6px 14px ${tone.accent}55` }]}>
                      <Ionicons name={item.icon as any} size={22} color="#fff" />
                    </View>
                    <Text style={s.primaryTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={s.primarySub} numberOfLines={1}>{item.sub}</Text>
                    <View style={[s.tileArrow, { boxShadow: `0 4px 10px ${tone.accent}33` }]}>
                      <Ionicons name="arrow-forward" size={18} color={tone.accent} />
                    </View>
                  </PressScale>
                );
              })}
            </FadeIn>

            <FadeIn delay={140}>
            <SectionLabel icon="cube-outline" title="ภาพรวมอุปกรณ์" />
            {/* แถวเดียว 4 ตัวเลข (เดิมเป็นการ์ด 4 ใบ + กราฟ 7 วัน = StatCard ด้านล่าง เก็บไว้เผื่อกลับไปใช้) */}
            <View style={s.statRow}>
              {stats.map((item, i) => (
                <View key={item.label} style={[s.statCell, i > 0 && s.statCellDivider]}>
                  <View style={s.statCellTop}>
                    <View style={iconDot(item.color, 20)}>
                      <Ionicons name={item.icon as any} size={11} color="#FFFFFF" />
                    </View>
                    <Text style={[s.statCellNum, { color: item.color }]}>{item.num}</Text>
                  </View>
                  <Text style={s.statCellLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
            </FadeIn>

            {groups.map((g, gi) => (
              <FadeIn key={g.title} delay={200 + gi * 60}>
                <SectionLabel icon={g.icon} title={g.title} />
                <View style={s.toolGrid}>
                  {g.items.map((item, i) => (
                    <PressScale
                      key={item.route}
                      style={[s.toolBtn, i % 3 !== 2 && s.toolBtnGap]}
                      onPress={() => router.push(item.route as any)}
                      accessibilityLabel={item.label}
                    >
                      <View style={[s.toolIcon, { backgroundColor: item.bg }]}>
                        <Ionicons name={item.icon as any} size={22} color={item.color} />
                      </View>
                      <Text style={s.toolText} numberOfLines={2}>{item.label}</Text>
                    </PressScale>
                  ))}
                </View>
              </FadeIn>
            ))}

            <FadeIn delay={200 + groups.length * 60}>
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
            </FadeIn>
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
  inboxBadgeWrap: { alignItems: "center", justifyContent: "center" },
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
  inboxBadgeText: { ...BADGE_TEXT, color: "#fff", fontSize: 13, lineHeight: 16 },
  container: {
    ...W.page,
    flex: 1,
  },
  content: {
    paddingBottom: 30,
  },
  hero: {
    paddingTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  heroTop: {
    ...W.headerBar, marginHorizontal: -16, paddingTop: 52, paddingHorizontal: 16, paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
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
  bellWrap: { zIndex: 2 },
  bellBadge: {
    ...NG,
    position: "absolute",
    zIndex: 3,
    elevation: 3,
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
  bellBadgeText: { ...BADGE_TEXT, color: "#fff", fontSize: 11, lineHeight: 13 },
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
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    marginBottom: 20,
  },
  primaryTile: {
    width: "48.2%",
    height: 148,
    borderRadius: 22,
    paddingLeft: 18,
    paddingRight: 14,
    paddingTop: 16,
    paddingBottom: 14,
    overflow: "hidden",
    backgroundColor: "#F7FAFF",
    // ไม่มีเส้นขอบขาวรอบการ์ด (พื้นการ์ดเป็นสี เส้นขาวตัดชัดเกิน ดูเป็นกรอบสติกเกอร์) — เหลือไฮไลต์ขอบบนใน boxShadow
    boxShadow: "inset 0 1px 0 #FFFFFF, 0 2px 4px rgba(15,23,42,0.05), 0 12px 24px rgba(37,99,235,0.12)",
  },
  tileStripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  tilePill: { position: "absolute", top: 14, right: 14, width: 22, height: 5, borderRadius: 3, opacity: 0.4 },
  tileMark: { position: "absolute", right: -28, bottom: -30, opacity: 0.06, transform: [{ rotate: "-12deg" }] },
  primaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryTitle: {
    color: C.ink,
    fontSize: 17,
    fontWeight: "700",
  },
  primarySub: {
    color: C.muted,
    fontSize: 12,
    marginTop: 2,
    paddingRight: 40,
  },
  // ปุ่มลูกศร: วงขาวโปร่ง ลอยเด่นจากพื้นสีของการ์ด
  tileArrow: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
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
  statRow: {
    ...W.card,
    flexDirection: "row",
    paddingVertical: 12,
    marginBottom: 20,
  },
  statCell: { flex: 1, alignItems: "center", gap: 2 },
  statCellDivider: { borderLeftWidth: 1, borderLeftColor: "#E2EAF6" },
  statCellTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  statCellNum: { fontSize: 20, fontWeight: "700", lineHeight: 28 },
  statCellLabel: { color: C.muted, fontSize: 12 },
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
  // 3 คอลัมน์ ชิดซ้าย (แถวสุดท้ายที่ไม่เต็มจะไม่ถูกกระจายห่าง)
  toolGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
    marginBottom: 20,
  },
  toolBtn: {
    width: "31.33%",
    ...W.card,
    minHeight: 92,
    paddingHorizontal: 6,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  toolBtnGap: { marginRight: "3%" },
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
