import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";

const C = {
  bg: "#edf5ff",
  header: "#2563eb",
  purple: "#7c3aed",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  blue: "#2563eb",
  green: "#16a34a",
  orange: "#d97706",
  red: "#ef4444",
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: keyof typeof Ionicons.glyphMap }> = {
  borrowed: { label: "กำลังยืม", color: C.orange, bg: "#fef3c7", border: "#fbbf24", icon: "cube-outline" },
  pending_return: { label: "กำลังยืม", color: C.orange, bg: "#fef3c7", border: "#fbbf24", icon: "cube-outline" },
  returned: { label: "คืนแล้ว", color: C.green, bg: "#dcfce7", border: "#86efac", icon: "checkmark-circle-outline" },
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

  const fetchProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("email").eq("id", user.id).maybeSingle();
    setEmail(profile?.email || user.email || "");

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
      const { data: items } = await supabase.from("items").select("id, name, type").in("id", itemIds);
      (items || []).forEach((item: any) => {
        itemMap[item.id] = item.name;
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
    Alert.alert("ออกจากระบบ", "ต้องการออกจากระบบหรือไม่?", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ออกจากระบบ",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/login");
        },
      },
    ]);
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
              <Ionicons name="notifications-outline" size={20} color="#fff" />
              {unreadNotifications > 0 ? <View style={s.actionDot} /> : null}
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/sittings")} activeOpacity={0.84}>
              <Ionicons name="settings-outline" size={20} color="#fff" />
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
              <Ionicons name="mail-outline" size={12} color="#e0ecff" />
              <Text style={s.userEmail}>{email}</Text>
            </View>
            <View style={s.rolePill}>
              <Ionicons name="school-outline" size={11} color="#fff" />
              <Text style={s.roleText}>นักศึกษา · IoT Lab</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={s.statsCard}>
        <Stat icon="cube-outline" bg="#dbeafe" color={C.blue} value={totalBorrows} label="ยืมทั้งหมด" />
        <View style={s.statDivider} />
        <Stat icon="time-outline" bg="#fef3c7" color={C.orange} value={activeLoans} label="กำลังยืม" />
        <View style={s.statDivider} />
        <Stat icon="checkmark-circle-outline" bg="#dcfce7" color={C.green} value={returnedLoans} label="คืนแล้ว" />
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
                  <View style={[s.borrowIcon, overdue ? { backgroundColor: "#fee2e2" } : { backgroundColor: "#dcfce7" }]}>
                    <Ionicons name="hardware-chip-outline" size={22} color={overdue ? C.red : C.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.borrowTitleRow}>
                      <Text style={s.borrowName} numberOfLines={1}>{record.itemName}</Text>
                      <View style={[s.borrowBadge, overdue ? { backgroundColor: "#fee2e2" } : { backgroundColor: "#dcfce7" }]}>
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
          <MenuRow icon="person-circle-outline" iconBg="#ede9fe" iconColor={C.purple} title="แก้ไขข้อมูลส่วนตัว" sub="ชื่อ อีเมล รหัสนักศึกษา" onPress={() => router.push("/sittings")} />
          <MenuRow icon="shield-checkmark-outline" iconBg="#dcfce7" iconColor={C.green} title="ความปลอดภัย" sub="เปลี่ยนรหัสผ่าน" onPress={() => router.push("/sittings")} />
          <MenuRow icon="help-circle-outline" iconBg="#fce7f3" iconColor="#db2777" title="ช่วยเหลือ" sub="คำถามที่พบบ่อย" onPress={() => Alert.alert("ช่วยเหลือ", "ติดต่อผู้ดูแลห้องแล็บ IoT")} />
          <MenuRow icon="log-out-outline" iconBg="#fee2e2" iconColor={C.red} title="ออกจากระบบ" sub="" danger onPress={logout} />
        </View>

        <View style={{ height: 92 }} />
      </ScrollView>

      <View style={s.tabBar}>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push("/home")} activeOpacity={0.82}>
          <Ionicons name="home-outline" size={22} color={C.faint} />
          <Text style={s.tabText}>ชั้นเรียน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push("/equipment")} activeOpacity={0.82}>
          <Ionicons name="cube-outline" size={22} color={C.faint} />
          <Text style={s.tabText}>อุปกรณ์</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} onPress={() => router.push("/notifications")} activeOpacity={0.82}>
          <Ionicons name="notifications-outline" size={22} color={C.faint} />
          <Text style={s.tabText}>แจ้งเตือน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tabItem} activeOpacity={0.82}>
          <Ionicons name="person" size={22} color={C.purple} />
          <Text style={[s.tabText, s.tabTextActive]}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>
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
  container: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: C.bg },
  header: {
    backgroundColor: C.header,
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 82,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 25 },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "900" },
  headerActions: { flexDirection: "row", gap: 9 },
  iconBtn: {
    width: 37,
    height: 37,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.23)",
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
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "900" },
  onlineDot: {
    position: "absolute",
    right: 0,
    bottom: 8,
    width: 14,
    height: 14,
    borderRadius: 99,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: C.header,
  },
  userBlock: { flex: 1 },
  userName: { color: "#fff", fontSize: 22, fontWeight: "900" },
  emailRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  userEmail: { color: "#e0ecff", fontSize: 12, fontWeight: "700" },
  rolePill: {
    alignSelf: "flex-start",
    marginTop: 9,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.22)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  roleText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  body: { paddingHorizontal: 22, paddingTop: 18 },
  statsCard: {
    marginHorizontal: 20,
    marginTop: -55,
    backgroundColor: "#fff",
    borderRadius: 18,
    minHeight: 106,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 21,
    paddingTop: 13,
    paddingBottom: 12,
    marginBottom: 0,
    shadowColor: "#1e3a8a",
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 6,
    zIndex: 5,
  },
  statItem: { flex: 1, alignItems: "center" },
  statIcon: { width: 37, height: 37, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statValue: { color: C.ink, fontSize: 21, fontWeight: "900", lineHeight: 24 },
  statLabel: { color: C.muted, fontSize: 10, fontWeight: "900", marginTop: 5 },
  statDivider: { width: 1, height: 37, backgroundColor: "#dbe4f0", marginHorizontal: 1 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: C.ink, fontSize: 14, fontWeight: "900", marginBottom: 10 },
  viewAll: { color: C.purple, fontSize: 12, fontWeight: "900" },
  borrowCard: {
    backgroundColor: "#fff",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    marginBottom: 9,
  },
  borrowCardOverdue: { borderColor: "#fecaca", backgroundColor: "#fffafa" },
  borrowIcon: { width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  borrowTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  borrowName: { color: C.ink, fontSize: 14, fontWeight: "900", flex: 1 },
  borrowBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  borrowBadgeText: { fontSize: 9, fontWeight: "900" },
  smallRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  borrowSub: { color: C.muted, fontSize: 11, fontWeight: "700" },
  quickGrid: { flexDirection: "row", gap: 10, marginBottom: 18 },
  quickCard: { flex: 1, minHeight: 105, borderRadius: 14, padding: 13, position: "relative" },
  quickBlue: { backgroundColor: "#dbeafe" },
  quickYellow: { backgroundColor: "#fef3c7" },
  quickIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  quickTitle: { color: C.ink, fontSize: 13, fontWeight: "900" },
  quickSub: { color: C.muted, fontSize: 10, fontWeight: "700", marginTop: 3 },
  notificationBadge: {
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
  notificationBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  menuList: { gap: 8 },
  menuRow: {
    minHeight: 66,
    borderRadius: 13,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e5edf7",
  },
  menuIcon: { width: 42, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  menuTitle: { color: C.ink, fontSize: 14, fontWeight: "900" },
  menuSub: { color: C.muted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 65,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#dbe4f0",
    flexDirection: "row",
  },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  tabText: { color: C.faint, fontSize: 10, fontWeight: "800" },
  tabTextActive: { color: C.purple },
});
