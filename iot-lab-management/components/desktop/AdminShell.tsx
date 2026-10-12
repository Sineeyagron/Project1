import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Text } from "../AppText";
import supabase from "../../lib/supabase";
import { useRealtime } from "../../lib/realtime";
import { useRoomLive } from "../../lib/roomRealtime";
import { canAccess, ROLE_LABEL, useRole } from "../../lib/roles";
import { confirmAction, notify } from "../../lib/notify";
import { ADMIN_COLUMN_WIDTH, isDesktopReady } from "../../lib/layout";
import { C } from "../../lib/theme";

// โครงหน้า admin แบบจอใหญ่ (คอม): เมนูซ้ายถาวร + พื้นที่เนื้อหา — ใช้เฉพาะเว็บจอกว้าง (lib/layout)
//   ฟีเจอร์/สิทธิ์เหมือนมือถือทุกอย่าง: เมนูกรองด้วย canAccess (TA เห็นเท่าที่มีสิทธิ์) · ด่านจริงยังอยู่ที่ RLS
//   หน้าที่ยังไม่มีแบบจอใหญ่ (ADMIN_DESKTOP_READY) → แสดงแบบมือถือกลางพื้นที่เนื้อหา

type NavItem = { icon: keyof typeof Ionicons.glyphMap; label: string; route: string; badge?: "requests" | "roomreports" };
const NAV: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { icon: "grid-outline", label: "แดชบอร์ด", route: "/admin/home" },
      { icon: "file-tray-full-outline", label: "กล่องคำขอ", route: "/admin/requests", badge: "requests" },
    ],
  },
  {
    title: "ยืม-คืน",
    items: [
      { icon: "cube-outline", label: "อุปกรณ์ IoT", route: "/admin/items" },
      { icon: "add-circle-outline", label: "เพิ่มอุปกรณ์", route: "/admin/scan" },
      { icon: "scan-outline", label: "สแกนดูสถานะ", route: "/admin/lookup" },
      { icon: "receipt-outline", label: "ประวัติยืม", route: "/admin/history" },
      { icon: "qr-code-outline", label: "สร้าง QR", route: "/admin/qrgen" },
      { icon: "pricetags-outline", label: "หมวดหมู่", route: "/admin/categories" },
      { icon: "document-text-outline", label: "นำเข้า CSV", route: "/admin/import" },
    ],
  },
  {
    title: "ห้องคอม",
    items: [
      { icon: "business-outline", label: "จัดการห้อง", route: "/admin/room" },
      { icon: "desktop-outline", label: "จัดการเครื่อง", route: "/admin/stations" },
      { icon: "git-network-outline", label: "จัดการแลน", route: "/admin/lanports" },
      { icon: "construct-outline", label: "ซ่อมบำรุง", route: "/admin/repairs" },
      { icon: "megaphone-outline", label: "แจ้งปัญหาห้อง", route: "/admin/roomreports", badge: "roomreports" },
    ],
  },
  {
    title: "ตรวจสภาพ & รายงาน",
    items: [
      { icon: "clipboard-outline", label: "ตรวจเครื่องคอม", route: "/admin/inspection" },
      { icon: "hardware-chip-outline", label: "ตรวจสภาพ IoT", route: "/admin/iotinspection" },
      { icon: "document-attach-outline", label: "รายงานยืม-คืน", route: "/admin/report" },
      { icon: "bar-chart-outline", label: "รายงานสต็อก", route: "/admin/stock" },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { icon: "people-outline", label: "จัดการผู้ใช้", route: "/admin/users" },
      { icon: "settings-outline", label: "ตั้งค่าระบบ", route: "/admin/settings" },
    ],
  },
];

// คำขอรออนุมัติ (ยืม/คืน/ยืมต่อ) + นัดรับรอนัดเวลา — นับเหมือนการ์ดกล่องคำขอในแดชบอร์ดมือถือ
async function countRequests() {
  const [req, pickup] = await Promise.all([
    supabase.from("borrow_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("pickup_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return (req.count || 0) + (pickup.count || 0);
}
async function countRoomReports() {
  const { count } = await supabase.from("room_reports").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count || 0;
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, userId } = useRole();
  const [name, setName] = useState("");
  const [badges, setBadges] = useState({ requests: 0, roomreports: 0 });

  const loadBadges = useCallback(async () => {
    const [requests, roomreports] = await Promise.all([countRequests(), countRoomReports()]);
    setBadges({ requests, roomreports });
  }, []);
  useEffect(() => { loadBadges(); }, [pathname]); // เปลี่ยนหน้า (เช่น ตัดสินคำขอแล้วกลับมา) = นับใหม่
  useRealtime("staff", "request", () => { loadBadges(); });
  useRoomLive(() => { loadBadges(); });

  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle()
      .then(({ data }) => setName(data?.full_name || data?.email?.split("@")[0] || ""));
  }, [userId]);

  const logout = () => {
    confirmAction("ออกจากระบบ", "ต้องการออกจากระบบใช่ไหม?", "ออกจากระบบ", async () => {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) notify("ออกจากระบบไม่สำเร็จ", error.message);
    }, true);
  };

  const current = pathname.replace(/\/+$/, "") === "/admin" ? "/admin/home" : pathname.replace(/\/+$/, "");
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => canAccess(role, i.route)) })).filter((g) => g.items.length);
  const ready = isDesktopReady(pathname);

  return (
    <View style={s.root}>
      <View style={s.sidebar}>
        <View style={s.brand}>
          <View style={s.brandIcon}><Ionicons name="flask" size={17} color="#fff" /></View>
          <Text style={s.brandText}>LabHub</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          {groups.map((g, gi) => (
            <View key={gi} style={{ marginTop: g.title ? 10 : 0 }}>
              {g.title ? <Text style={s.groupTitle}>{g.title}</Text> : null}
              {g.items.map((item) => {
                const active = current === item.route;
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <Pressable
                    key={item.route}
                    // สลับหน้า (replace) ไม่ซ้อน: navigate/push ทำให้หน้าเก่าค้างทุกครั้งที่กดเมนู — แต่ละหน้ายังฟัง realtime/รีเฟรชอยู่ = กินฐานข้อมูล
                    // (ไม่ใช่ปุ่มย้อนกลับ จึงไม่ขัดกติกา goBack) · หน้าที่มีของยังไม่บันทึกยังถามก่อนออก (usePreventRemove)
                    onPress={() => { if (!active) router.replace(item.route as any); }}
                    style={({ hovered }: any) => [s.item, hovered && !active && s.itemHover, active && s.itemOn]}
                    accessibilityRole="link"
                    accessibilityLabel={item.label}
                  >
                    <Ionicons name={item.icon} size={17} color={active ? C.primaryDark : "#64748B"} />
                    <Text style={[s.itemText, active && s.itemTextOn]} numberOfLines={1}>{item.label}</Text>
                    {count > 0 ? (
                      <View style={s.badge}><Text style={s.badgeText}>{count > 99 ? "99+" : count}</Text></View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
          {/* TA/Admin ยืมของเอง = หน้านักศึกษา (เหมือนการ์ด "ยืมของ" ในแดชบอร์ดมือถือ) */}
          <View style={{ marginTop: 10 }}>
            <Text style={s.groupTitle}>โหมดนักศึกษา</Text>
            <Pressable onPress={() => router.navigate("/home")} style={({ hovered }: any) => [s.item, hovered && s.itemHover]}>
              <Ionicons name="bag-handle-outline" size={17} color="#64748B" />
              <Text style={s.itemText}>ยืมของ</Text>
            </Pressable>
          </View>
        </ScrollView>
        <View style={s.me}>
          <View style={s.avatar}><Text style={s.avatarText}>{(name || "?").slice(0, 1).toUpperCase()}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.meName} numberOfLines={1}>{name || "-"}</Text>
            <Text style={s.meRole}>{role ? ROLE_LABEL[role] : ""}</Text>
          </View>
          <Pressable onPress={logout} style={({ hovered }: any) => [s.logout, hovered && s.itemHover]} accessibilityLabel="ออกจากระบบ">
            <Ionicons name="log-out-outline" size={18} color="#64748B" />
          </Pressable>
        </View>
      </View>

      {/* หน้าที่ยังไม่มีแบบจอใหญ่ = แท่งแบบมือถือกลางพื้นที่ (ใช้งานได้ครบ ไม่พัง) */}
      <View style={s.content}>
        <View style={[s.page, !ready && s.pagePhone]}>{children}</View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: "#E4ECF9" },
  sidebar: { width: 232, backgroundColor: "#FFFFFF", borderRightWidth: 1, borderRightColor: "#DCE6F5", paddingHorizontal: 12, paddingTop: 18, paddingBottom: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 8, paddingBottom: 14 },
  brandIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  brandText: { fontSize: 18, fontWeight: "900", color: C.ink },
  groupTitle: { fontSize: 11, fontWeight: "700", color: "#94A3B8", paddingHorizontal: 10, paddingBottom: 4 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  itemHover: { backgroundColor: "#F3F7FD" },
  itemOn: { backgroundColor: "#EAF1FF" },
  itemText: { flex: 1, fontSize: 13.5, fontWeight: "600", color: "#475569" },
  itemTextOn: { color: C.primaryDark, fontWeight: "800" },
  badge: { minWidth: 20, height: 18, borderRadius: 9, backgroundColor: "#EF4444", paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
  me: { flexDirection: "row", alignItems: "center", gap: 9, borderTopWidth: 1, borderTopColor: "#EEF2F8", paddingTop: 12, paddingHorizontal: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  avatarText: { color: C.primaryDark, fontWeight: "800" },
  meName: { fontSize: 13, fontWeight: "700", color: C.ink },
  meRole: { fontSize: 11, color: "#94A3B8" },
  logout: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, alignItems: "center" },
  page: { flex: 1, width: "100%" },
  pagePhone: { maxWidth: ADMIN_COLUMN_WIDTH, backgroundColor: C.bg, boxShadow: "0 0 32px rgba(23,32,51,0.10)" },
});
