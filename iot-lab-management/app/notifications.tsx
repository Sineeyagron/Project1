import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  AppState,
  Animated,
  Pressable,
  LayoutAnimation,
  Platform,
} from "react-native";
import { Text } from "../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import supabase from "../lib/supabase";
import { useRealtime } from "../lib/realtime";
import { currentUser } from "../lib/session";
import { goBack, useRefreshOnFocus } from "../lib/nav";
import { W } from "../lib/theme";
import ScreenHeader, { HeaderButton } from "../components/ScreenHeader";
import { haptic } from "../components/Motion";
import TabBar from "../components/TabBar";
import { refreshUnreadCount } from "../lib/unread";

const TYPE_CFG: Record<string, { icon: any; iconColor: string; iconBg: string; dot: string }> = {
  borrow:         { icon: "cube-outline",             iconColor: "#b45309", iconBg: "#fef3c7", dot: "#f59e0b" },
  return:         { icon: "checkmark-circle-outline", iconColor: "#047857", iconBg: "#ECFDF5", dot: "#10B981" },
  // ถึงผู้ดูแล: มีคำขอใหม่
  request_borrow: { icon: "hand-left-outline",        iconColor: "#2563eb", iconBg: "#dbeafe", dot: "#3b82f6" },
  request_return: { icon: "return-down-back-outline", iconColor: "#047857", iconBg: "#ECFDF5", dot: "#10B981" },
  request_renew:  { icon: "refresh-outline",          iconColor: "#c2410c", iconBg: "#ffedd5", dot: "#fb923c" },
  // ถึงผู้ขอ: ผลคำขอ
  approved:       { icon: "checkmark-circle-outline", iconColor: "#047857", iconBg: "#ECFDF5", dot: "#10B981" },
  renewed:        { icon: "calendar-outline",         iconColor: "#047857", iconBg: "#ECFDF5", dot: "#10B981" },
  declined:       { icon: "close-circle-outline",     iconColor: "#dc2626", iconBg: "#fee2e2", dot: "#ef4444" },
  expired:        { icon: "time-outline",             iconColor: "#64748b", iconBg: "#f1f5f9", dot: "#94a3b8" },
  cancelled:      { icon: "ban-outline",              iconColor: "#64748b", iconBg: "#f1f5f9", dot: "#94a3b8" },
  auto_returned:  { icon: "alert-circle-outline",     iconColor: "#b45309", iconBg: "#fef3c7", dot: "#f59e0b" },
  // เตือนกำหนดคืน
  due_soon:       { icon: "alarm-outline",            iconColor: "#c2410c", iconBg: "#ffedd5", dot: "#fb923c" },
  overdue:        { icon: "warning-outline",          iconColor: "#dc2626", iconBg: "#fee2e2", dot: "#ef4444" },
  // ถึงผู้ดูแล: ประกัน / อายุอุปกรณ์ (เฟส 2.3)
  warranty_soon:    { icon: "shield-half-outline",    iconColor: "#c2410c", iconBg: "#ffedd5", dot: "#fb923c" },
  warranty_expired: { icon: "shield-outline",         iconColor: "#dc2626", iconBg: "#fee2e2", dot: "#ef4444" },
  age_warn:         { icon: "eye-outline",            iconColor: "#c2410c", iconBg: "#ffedd5", dot: "#fb923c" },
  age_replace:      { icon: "refresh-circle-outline", iconColor: "#dc2626", iconBg: "#fee2e2", dot: "#ef4444" },
  // สิทธิ์ TA เปลี่ยน (เฟส 4.1)
  role_changed:     { icon: "shield-checkmark-outline", iconColor: "#2563EB", iconBg: "#DBEAFE", dot: "#3B82F6" },
  // ระบบห้องคอม R3: คำแจ้งปัญหาเครื่อง/LAN (แยกจากระบบยืม-คืน)
  room_report:          { icon: "megaphone-outline",        iconColor: "#c2410c", iconBg: "#ffedd5", dot: "#fb923c" },
  room_report_accepted: { icon: "construct-outline",        iconColor: "#047857", iconBg: "#ECFDF5", dot: "#10B981" },
  room_report_closed:   { icon: "chatbox-ellipses-outline", iconColor: "#64748b", iconBg: "#f1f5f9", dot: "#94a3b8" },
  // F2 ขอยืมแบบนัดรับ (ถึงผู้ขอ) → เปิดหน้าการยืมของฉัน
  pickup_scheduled: { icon: "calendar-outline",       iconColor: "#047857", iconBg: "#ECFDF5", dot: "#10B981" },
  pickup_declined:  { icon: "close-circle-outline",   iconColor: "#dc2626", iconBg: "#fee2e2", dot: "#ef4444" },
  pickup_expired:   { icon: "time-outline",           iconColor: "#64748b", iconBg: "#f1f5f9", dot: "#94a3b8" },
  pickup_cancelled: { icon: "ban-outline",            iconColor: "#64748b", iconBg: "#f1f5f9", dot: "#94a3b8" },
  pickup_no_show:   { icon: "alert-circle-outline",   iconColor: "#dc2626", iconBg: "#fee2e2", dot: "#ef4444" },
};

// แจ้งเตือนประกัน/อายุ → เปิดรายงานสต็อก ตรงกลุ่ม "ต้องดูแล" นั้น
const STOCK_WATCH: Record<string, string> = {
  warranty_soon: "soon",
  warranty_expired: "expired",
  age_warn: "ageWarn",
  age_replace: "ageReplace",
};

// ประเภทที่ผู้ดูแลต้องไปจัดการในกล่องคำขอ
const STAFF_TYPES = new Set(["request_borrow", "request_return", "request_renew", "auto_returned", "overdue"]);

const formatDateTime = (d: string) => {
  if (!d) return "";
  const date = new Date(d);
  const datePart = date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  const timePart = date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
};

const timeAgo = (d: string) => {
  if (!d) return "";
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (diff < 60) return "เมื่อกี้";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} วันที่แล้ว`;
  return formatDateTime(d);
};

export default function Notifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newCount, setNewCount] = useState(0);
  // null = ยังไม่รู้ (กันแถบเมนูนักศึกษาโผล่แวบให้ staff เห็น)
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  // แถบเมนูล่าง: มาจากแถบเมนู (ทุกบทบาท รวม TA/Admin ที่อยู่โหมดนักศึกษา) หรือเป็นนักศึกษา
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const showTabBar = tab === "1" || isStaff === false;
  const prevNewestRef = useRef("");
  const isFirstLoad = useRef(true);

  const fetchNotifications = useCallback(async (silent = false) => {
    const user = await currentUser();
    if (!user) { setLoading(false); return; }
    // ครั้งแรกเช็กบทบาทพร้อมกับโหลดรายการ (ยิงคู่กัน ไม่ต้องรอกัน)
    const [{ data }, staffRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      isFirstLoad.current ? supabase.rpc("is_staff") : Promise.resolve(null),
    ]);
    if (staffRes) setIsStaff(!!staffRes.data);

    const list = data || [];

    // นับรายการที่ใหม่กว่ารายการบนสุดครั้งก่อน (เดิมเทียบจำนวนแถว → ครบ 50 รายการแล้วแถบ "มีแจ้งเตือนใหม่" ไม่ขึ้นอีกเลย)
    const newest = prevNewestRef.current;
    if (!isFirstLoad.current) {
      const added = newest ? list.filter((n: any) => n.created_at > newest).length : list.length;
      if (added > 0) setNewCount((c) => c + added);
    }
    if (list[0]?.created_at) prevNewestRef.current = list[0].created_at;
    isFirstLoad.current = false;

    setNotifications(list);
    if (!silent) { setLoading(false); setRefreshing(false); }
    else setLoading(false);
  }, []);

  // อัปเดตจอทันที (ไฮไลต์ยังไม่อ่านค่อย ๆ จางหาย + สั่นเบา ๆ) แล้วค่อยบันทึกลงฐานข้อมูลเบื้องหลัง — พลาดก็โหลดใหม่
  const markAllRead = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setNewCount(0);
    haptic("success");
    const user = await currentUser();
    if (!user) return;
    const { error } = await supabase.from("notifications").update({ read: true })
      .eq("user_id", user.id).eq("read", false);
    if (error) fetchNotifications(true);
    refreshUnreadCount(); // เลขบนกระดิ่งแถบล่าง
  };

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  // กลับมาหน้านี้ (ปุ่ม ← / สลับแท็บ) → โหลดข้อมูลใหม่
  useRefreshOnFocus(() => { fetchNotifications(true); });
  // Realtime: มีแจ้งเตือนใหม่ → โหลดทันที
  useRealtime("user", "notification", () => { fetchNotifications(true); });

  useEffect(() => {
    // สำรองกรณีสัญญาณ Realtime หลุด: ทุก 5 นาที (เดิม 30 วิ) ข้ามตอนแอป/แท็บอยู่เบื้องหลัง
    const interval = setInterval(() => { if (AppState.currentState === "active") fetchNotifications(true); }, 300000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", state => {
      if (state === "active") fetchNotifications(true);
    });
    return () => sub.remove();
  }, [fetchNotifications]);

  const onRefresh = () => { setRefreshing(true); setNewCount(0); fetchNotifications(); };

  // TA อาจยืมของเองด้วย: "เกินกำหนด" / "คืนอัตโนมัติ" ของผู้ยืมกับของผู้ดูแลเป็นประเภทเดียวกัน
  // → ถ้าเป็นของที่ตัวเองยืม พาไปหน้าการยืมของตัวเอง ไม่ใช่กล่องคำขอ
  const isMyLoan = async (n: any) => {
    if (!["overdue", "auto_returned"].includes(n.type) || !n.item_id) return false;
    const user = await currentUser();
    if (!user) return false;
    // คืนอัตโนมัติ: ดูว่าคำขอคืนนั้นเป็นของเราไหม / เกินกำหนด: ดูว่าเรายังยืมชิ้นนั้นอยู่ไหม
    // (เดิมนับประวัติทั้งหมด → TA ที่เคยยืมชิ้นนั้นเมื่อนานมาแล้ว กดแจ้งเตือนของนักศึกษาคนอื่นแล้วไปหน้าการยืมของตัวเอง)
    if (n.type === "auto_returned" && n.request_id) {
      const { count } = await supabase
        .from("borrow_requests")
        .select("id", { count: "exact", head: true })
        .eq("id", n.request_id)
        .eq("user_id", user.id);
      return (count || 0) > 0;
    }
    const { count } = await supabase
      .from("borrow_records")
      .select("id", { count: "exact", head: true })
      .eq("item_id", n.item_id)
      .eq("user_id", user.id)
      .in("status", n.type === "overdue" ? ["borrowed", "pending_return"] : ["borrowed", "pending_return", "returned"]);
    return (count || 0) > 0;
  };

  // กดแจ้งเตือน → อ่านแล้ว + ไปหน้าที่เกี่ยวข้อง
  const openNotification = async (n: any) => {
    if (!n.read) {
      // ไม่ต้องรอฐานข้อมูลก่อนเปิดหน้าถัดไป
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      supabase.from("notifications").update({ read: true }).eq("id", n.id).then(() => refreshUnreadCount());
    }
    // ระบบห้องคอม: ผู้ดูแล → คิวคำแจ้ง / ผู้แจ้ง → อ่านผลในข้อความพอ ไม่พาไปหน้าการยืม
    if (n.type === "room_report") {
      if (isStaff) router.push("/admin/roomreports" as any);
      return;
    }
    if (n.type === "room_report_accepted" || n.type === "room_report_closed") return;
    if (n.type === "role_changed") {
      // ด่านหน้า admin เช็กสิทธิ์ล่าสุดเอง: ได้ TA → เข้าได้ / ถูกถอด → พากลับหน้านักศึกษา
      router.replace("/admin/home");
    } else if (isStaff && STOCK_WATCH[n.type]) {
      router.push(`/admin/stock?watch=${STOCK_WATCH[n.type]}` as any);
    } else if (isStaff && STAFF_TYPES.has(n.type) && !(await isMyLoan(n))) {
      router.push((n.request_id ? `/admin/requests?id=${n.request_id}` : "/admin/requests") as any);
    } else if (n.type !== "borrow" && n.type !== "return") {
      router.push("/borrow");
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={s.container}>

      {/* HEADER */}
      <ScreenHeader
        title={"การแจ้งเตือน"}
        subtitle={unreadCount > 0 ? `${unreadCount} รายการยังไม่ได้อ่าน` : undefined}
        onBack={() => goBack(isStaff ? "/admin/home" : "/home")}
        right={unreadCount > 0 ? <HeaderButton icon="checkmark-done-outline" label="อ่านทั้งหมด" onPress={markAllRead} /> : null}
      />

      {/* new banner */}
      {newCount > 0 && (
        <TouchableOpacity style={s.newBanner} onPress={() => setNewCount(0)}>
          <Ionicons name="notifications" size={16} color="#fff" />
          <Text style={s.newBannerTxt}>มีการแจ้งเตือนใหม่ {newCount} รายการ</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator size="large" color="#1D4ED8" style={{ marginTop: 60 }} />
      ) : notifications.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="notifications-off-outline" size={52} color="#cbd5e1" />
          <Text style={s.emptyTitle}>ยังไม่มีการแจ้งเตือน</Text>
          <Text style={s.emptyText}>เมื่อคุณยืม/คืนอุปกรณ์{"\n"}จะปรากฏที่นี่</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1D4ED8" />}
        >
          <Text style={s.sectionLabel}>การแจ้งเตือนทั้งหมด ({notifications.length})</Text>

          {notifications.map((n, i) => {
            const cfg = TYPE_CFG[n.type] || TYPE_CFG.borrow;
            return (
              <NotifCard
                key={n.id}
                index={i}
                style={[s.card, !n.read && s.cardUnread]}
                onPress={() => { haptic("light"); openNotification(n); }}
              >
                {!n.read && <View style={[s.dot, { backgroundColor: cfg.dot }]} />}
                <View style={[s.iconBox, { backgroundColor: cfg.iconBg }]}>
                  <Ionicons name={cfg.icon} size={22} color={cfg.iconColor} />
                </View>
                <View style={s.cardContent}>
                  <View style={s.cardTopRow}>
                    <Text style={[s.cardTitle, !n.read && s.cardTitleUnread]}>{n.title}</Text>
                    <Text style={s.cardAgo}>{timeAgo(n.created_at)}</Text>
                  </View>
                  <Text style={s.cardBody}>{n.body}</Text>
                  <View style={s.cardMeta}>
                    <Ionicons name="time-outline" size={11} color="#94a3b8" />
                    <Text style={s.cardDateTime}>{formatDateTime(n.created_at)}</Text>
                  </View>
                </View>
              </NotifCard>
            );
          })}

          <View style={{ height: showTabBar ? 104 : 40 }} />
        </ScrollView>
      )}

      {/* หน้านี้เป็นแท็บหนึ่งของนักศึกษา → แถบเมนูล่างเหมือนหน้าอื่น / Admin-TA เข้าจากกระดิ่งแดชบอร์ด = ไม่มี */}
      {showTabBar ? <TabBar current="/notifications" /> : null}
    </View>
  );
}

// การ์ดแจ้งเตือน: ตอนเปิดหน้าค่อย ๆ ลอยขึ้นทีละใบ (เฉพาะ 8 ใบแรก ใบที่เหลือโผล่ทันที) + กดแล้วยุบนิดหนึ่ง
// ใช้ Animated แบบ native driver — ไม่กระทบการโหลดข้อมูล
function NotifCard({ index, style, onPress, children }: { index: number; style: any; onPress: () => void; children: React.ReactNode }) {
  const animate = index < 8;
  const appear = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const press = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animate) return;
    Animated.timing(appear, { toValue: 1, duration: 260, delay: index * 45, useNativeDriver: true }).start();
  }, []);
  const to = (v: number) => Animated.spring(press, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  return (
    <Animated.View
      style={{
        opacity: appear,
        transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }, { scale: press }],
      }}
    >
      <Pressable style={style} onPress={onPress} onPressIn={() => to(0.97)} onPressOut={() => to(1)}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },

  header: { ...W.headerBar,
    paddingTop: 52,
    paddingBottom: 10,
    marginBottom: 8,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: { ...W.iconBtn, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#172033", fontSize: 20, fontWeight: "700" },
  headerSub: { color: "#475569", fontSize: 12, marginTop: 1 },
  markAllBtn: { ...W.small, borderRadius: 13, height: 38, paddingHorizontal: 12, justifyContent: "center" },
  markAllTxt: { color: "#1D4ED8", fontSize: 13, fontWeight: "600" },

  newBanner: {
    ...W.primary, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 8, paddingVertical: 10, marginHorizontal: 16, marginBottom: 4,
  },
  newBannerTxt: { color: "#fff", fontSize: 13, fontWeight: "600" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingBottom: 60 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#475569", marginTop: 8 },
  emptyText: { fontSize: 13, color: "#475569", textAlign: "center", lineHeight: 20 },

  list: { padding: 16, paddingTop: 4, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 16, fontWeight: "600", color: "#172033", marginBottom: 12,
  },

  card: {
    ...W.card,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardUnread: { borderColor: "#BFDBFE" },
  dot: { width: 8, height: 8, borderRadius: 4, position: "absolute", top: 14, left: 6 },
  iconBox: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginLeft: 4, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" },
  cardContent: { flex: 1 },
  // หัวข้อเข้ม-ใหญ่ / รายละเอียดเทากลาง / เวลาเทาอ่อนเล็ก — แยกระดับกันชัด (ยังไม่อ่าน = หัวข้อหนาขึ้น + จุดสี)
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#1E293B", flex: 1, marginRight: 6 },
  cardTitleUnread: { fontWeight: "700", color: "#0F172A" },
  cardAgo: { fontSize: 12, color: "#64748B", flexShrink: 0 },
  cardBody: { fontSize: 13.5, color: "#475569", lineHeight: 20, marginBottom: 6 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardDateTime: { fontSize: 12, color: "#64748B" },
});
