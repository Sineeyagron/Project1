import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "../components/AppText";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";
import { currentUser } from "../lib/session";
import { RECORD_STATUS } from "../lib/status";
import { useRefreshOnFocus } from "../lib/nav";
import { Role, ROLE_LABEL } from "../lib/roles";
import { confirmAction, notify } from "../lib/notify";
import { W, NG } from "../lib/theme";
import TabBar from "../components/TabBar";

const C = {
  bg: "#EAF1FC",
  header: "#2563eb",
  purple: "#2563EB",
  ink: "#172033",
  muted: "#64748b",
  faint: "#94a3b8",
  blue: "#2563eb",
  green: "#047857",
  orange: "#B45309",
  red: "#ef4444",
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: keyof typeof Ionicons.glyphMap }> = {
  borrowed: { ...RECORD_STATUS.borrowed, icon: "cube-outline" },
  pending_return: { ...RECORD_STATUS.pending_return, icon: "hourglass-outline" },
  returned: { ...RECORD_STATUS.returned, icon: "checkmark-circle-outline" },
};

const formatDate = (dateValue: string) => {
  if (!dateValue) return "-";
  return new Date(dateValue).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
};

const dueText = (dateValue: string) => {
  if (!dateValue) return "ไม่ระบุกำหนดคืน";
  const due = new Date(dateValue);
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `เกินกำหนด ${Math.abs(diff)} วัน`;
  if (diff === 0) return "ครบกำหนดวันนี้";
  return `เหลืออีก ${diff} วัน`;
};

export default function Profile() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [totalBorrows, setTotalBorrows] = useState(0);
  const [activeLoans, setActiveLoans] = useState(0);
  const [returnedLoans, setReturnedLoans] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [recentBorrows, setRecentBorrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);
  // กลับมาหน้านี้ (ปุ่ม ← / สลับแท็บ) → โหลดข้อมูลใหม่
  useRefreshOnFocus(() => { fetchProfile(); });

  const fetchProfile = async () => {
    const user = await currentUser();
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("email, role").eq("id", user.id).maybeSingle();
    setEmail(profile?.email || user.email || "");
    setRole(profile?.role || "user");

    const [{ data: borrows }, totalRes, activeRes, returnedRes, unreadRes] = await Promise.all([
      supabase
        .from("borrow_records")
        .select("id, status, borrow_date, due_date, item_id")
        .eq("user_id", user.id)
        .order("borrow_date", { ascending: false })
        .limit(6),
      supabase.from("borrow_records").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase
        .from("borrow_records")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("status", ["borrowed", "pending_return"]),
      supabase
        .from("borrow_records")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "returned"),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false),
    ]);

    const itemIds = Array.from(new Set((borrows || []).map((record: any) => record.item_id).filter(Boolean)));
    const itemMap: Record<string, string> = {};
    if (itemIds.length > 0) {
      const { data: items } = await supabase.from("items").select("id, name, item_code, type").in("id", itemIds);
      (items || []).forEach((item: any) => {
        itemMap[item.id] = item.item_code || item.name;
      });
    }

    setTotalBorrows(totalRes.count || 0);
    setActiveLoans(activeRes.count || 0);
    setReturnedLoans(returnedRes.count || 0);
    setUnreadNotifications(unreadRes.count || 0);
    setRecentBorrows((borrows || []).map((record: any) => ({ ...record, itemName: itemMap[record.item_id] || "อุปกรณ์" })));
    setLoading(false);
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const logout = () => {
    confirmAction("ออกจากระบบ", "ต้องการออกจากระบบหรือไม่?", "ออกจากระบบ", async () => {
      await supabase.auth.signOut();
      router.replace("/login");
    }, true);
  };

  const username = email.split("@")[0] || "student";
  const initial = username.charAt(0).toUpperCase() || "S";
  const activePreview = recentBorrows.filter((record) => record.status === "borrowed" || record.status === "pending_return").slice(0, 2);

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={C.header} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.headerTitle}>โปรไฟล์</Text>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/notifications")} activeOpacity={0.84}>
              <Ionicons name="notifications-outline" size={20} color="#1D4ED8" />
              {unreadNotifications > 0 ? <View style={s.actionDot} /> : null}
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/sittings")} activeOpacity={0.84}>
              <Ionicons name="settings-outline" size={20} color="#1D4ED8" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.profileRow}>
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
            <View style={s.onlineDot} />
          </View>
          <View style={s.userBlock}>
            <Text style={s.userName}>{username}</Text>
            <View style={s.emailRow}>
              <Ionicons name="mail-outline" size={12} color="#64748B" />
              <Text style={s.userEmail}>{email}</Text>
            </View>
            <View style={s.rolePill}>
              <Ionicons name="school-outline" size={11} color="#1D4ED8" />
              <Text style={s.roleText}>{ROLE_LABEL[role as Role] || ROLE_LABEL.user} · IoT Lab</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={s.statsCard}>
        <Stat icon="cube-outline" bg="#dbeafe" color={C.blue} value={totalBorrows} label="ยืมทั้งหมด" />
        <View style={s.statDivider} />
        <Stat icon="time-outline" bg="#fef3c7" color={C.orange} value={activeLoans} label="กำลังยืม" />
        <View style={s.statDivider} />
        <Stat icon="checkmark-circle-outline" bg="#ECFDF5" color={C.green} value={returnedLoans} label="คืนแล้ว" />
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.header} />}
      >
        {activePreview.length > 0 ? (
          <>
            <View style={s.sectionHead}>
              <Text style={s.sectionTitle}>กำลังยืมอยู่</Text>
              <TouchableOpacity onPress={() => router.push("/borrow")} activeOpacity={0.82}>
                <Text style={s.viewAll}>ดูทั้งหมด ›</Text>
              </TouchableOpacity>
            </View>
            {activePreview.map((record) => {
              const overdue = record.due_date && new Date(record.due_date) < new Date();
              return (
                <TouchableOpacity
                  key={record.id}
                  style={[s.borrowCard, overdue && s.borrowCardOverdue]}
                  onPress={() => router.push("/borrow")}
                  activeOpacity={0.86}
                >
                  <View style={[s.borrowIcon, overdue ? { backgroundColor: "#fee2e2" } : { backgroundColor: "#ECFDF5" }]}>
                    <Ionicons name="hardware-chip-outline" size={22} color={overdue ? C.red : C.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.borrowTitleRow}>
                      <Text style={s.borrowName} numberOfLines={1}>{record.itemName}</Text>
                      <View style={[s.borrowBadge, overdue ? { backgroundColor: "#fee2e2" } : { backgroundColor: "#ECFDF5" }]}>
                        <Text style={[s.borrowBadgeText, overdue ? { color: C.red } : { color: C.green }]}>
                          {overdue ? "เกินกำหนด" : "ในเวลา"}
                        </Text>
                      </View>
                    </View>
                    <View style={s.smallRow}>
                      <Ionicons name="time-outline" size={12} color={C.faint} />
                      <Text style={s.borrowSub}>{dueText(record.due_date)}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={21} color="#94a3b8" />
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}

        <Text style={s.sectionTitle}>เมนูด่วน</Text>
        <View style={s.quickGrid}>
          <TouchableOpacity style={[s.quickCard, s.quickBlue]} onPress={() => router.push("/borrow")} activeOpacity={0.86}>
            <View style={s.quickIcon}>
              <Ionicons name="time-outline" size={23} color={C.blue} />
            </View>
            <Text style={s.quickTitle}>ประวัติการยืม</Text>
            <Text style={s.quickSub}>{totalBorrows} รายการ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.quickCard, s.quickYellow]} onPress={() => router.push("/notifications")} activeOpacity={0.86}>
            <View style={[s.quickIcon, { backgroundColor: "#fff" }]}>
              <Ionicons name="notifications-outline" size={22} color={C.orange} />
            </View>
            {unreadNotifications > 0 ? (
              <View style={s.notificationBadge}>
                <Text style={s.notificationBadgeText}>{unreadNotifications}</Text>
              </View>
            ) : null}
            <Text style={s.quickTitle}>การแจ้งเตือน</Text>
            <Text style={s.quickSub}>มี {unreadNotifications} รายการใหม่</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sectionTitle}>การตั้งค่า</Text>
        <View style={s.menuList}>
          <MenuRow icon="person-circle-outline" iconBg="#DBEAFE" iconColor={C.purple} title="แก้ไขข้อมูลส่วนตัว" sub="ชื่อ อีเมล รหัสนักศึกษา" onPress={() => notify("แก้ไขข้อมูลส่วนตัว", "ตอนนี้ยังแก้ในแอปไม่ได้ — อีเมลมาจากบัญชีที่ใช้สมัคร/ล็อกอิน Google ถ้าข้อมูลผิด ติดต่อผู้ดูแล")} />
          <MenuRow icon="shield-checkmark-outline" iconBg="#ECFDF5" iconColor={C.green} title="ความปลอดภัย" sub="เปลี่ยนรหัสผ่าน" onPress={() => router.push("/reset-password?mode=change" as any)} />
          <MenuRow icon="help-circle-outline" iconBg="#fce7f3" iconColor="#db2777" title="ช่วยเหลือ" sub="คำถามที่พบบ่อย" onPress={() => notify("ช่วยเหลือ", "ติดต่อผู้ดูแลห้องแล็บ IoT")} />
          <MenuRow icon="log-out-outline" iconBg="#fee2e2" iconColor={C.red} title="ออกจากระบบ" sub="" danger onPress={logout} />
        </View>

        <View style={{ height: 92 }} />
      </ScrollView>

      <TabBar current="/profile" />
    </View>
  );
}

function Stat({ icon, bg, color, value, label }: { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string; value: number; label: string }) {
  return (
    <View style={s.statItem}>
      <View style={[s.statIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({
  icon,
  iconBg,
  iconColor,
  title,
  sub,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  sub: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.menuRow} onPress={onPress} activeOpacity={0.86}>
      <View style={[s.menuIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.menuTitle, danger && { color: C.red }]}>{title}</Text>
        {sub ? <Text style={s.menuSub}>{sub}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={danger ? "#fda4af" : C.faint} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg },
  header: {
    paddingHorizontal: 18,
    paddingTop: 52,
    paddingBottom: 16,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  headerTitle: { color: "#172033", fontSize: 26, fontWeight: "700" },
  headerActions: { flexDirection: "row", gap: 9 },
  iconBtn: {
    ...W.small, width: 44, height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  actionDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: "#ef4444",
    borderWidth: 1,
    borderColor: "#fff",
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 17 },
  avatarWrap: { position: "relative" },
  avatar: {
    ...W.primary,
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 8,
    width: 14,
    height: 14,
    borderRadius: 99,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  userBlock: { flex: 1 },
  userName: { color: "#172033", fontSize: 20, fontWeight: "700" },
  emailRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  userEmail: { color: "#64748B", fontSize: 12 },
  rolePill: {
    alignSelf: "flex-start",
    marginTop: 9,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#DBEAFE",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  roleText: { color: "#1D4ED8", fontSize: 11, fontWeight: "600" },
  body: { paddingHorizontal: 18, paddingTop: 18 },
  statsCard: {
    ...W.card,
    marginHorizontal: 18,
    marginTop: 0,
    minHeight: 106,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 21,
    paddingTop: 13,
    paddingBottom: 12,
    marginBottom: 0,
    zIndex: 5,
  },
  statItem: { flex: 1, alignItems: "center" },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 8, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" },
  statValue: { color: C.ink, fontSize: 24, fontWeight: "700", lineHeight: 30 },
  statLabel: { color: C.muted, fontSize: 12, marginTop: 1 },
  statDivider: { width: 1, height: 37, backgroundColor: "#D3E0F5", marginHorizontal: 1 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: C.ink, fontSize: 17, fontWeight: "600", marginBottom: 10 },
  viewAll: { color: C.purple, fontSize: 13, fontWeight: "600" },
  borrowCard: {
    ...W.card,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    marginBottom: 9,
  },
  borrowCardOverdue: { ...NG, borderColor: "#fecaca", backgroundColor: "#fffafa" },
  borrowIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" },
  borrowTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  borrowName: { color: C.ink, fontSize: 15, fontWeight: "600", flex: 1 },
  borrowBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  borrowBadgeText: { fontSize: 11, fontWeight: "600" },
  smallRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  borrowSub: { color: C.muted, fontSize: 12 },
  quickGrid: { flexDirection: "row", gap: 12, marginBottom: 18 },
  quickCard: { flex: 1, minHeight: 105, padding: 14, position: "relative" },
  quickBlue: { ...W.statBlue },
  quickYellow: { ...W.statAmber },
  quickIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 12, boxShadow: "0 4px 10px rgba(37,99,235,0.14)" },
  quickTitle: { color: C.ink, fontSize: 14, fontWeight: "600" },
  quickSub: { color: C.muted, fontSize: 12, marginTop: 1 },
  notificationBadge: {
    ...NG,
    position: "absolute",
    top: 13,
    right: 14,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  notificationBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  menuList: { gap: 10 },
  menuRow: {
    ...W.card,
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
  },
  menuIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)" },
  menuTitle: { color: C.ink, fontSize: 15, fontWeight: "600" },
  menuSub: { color: C.muted, fontSize: 12, marginTop: 1 },
});
