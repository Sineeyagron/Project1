import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Text, TextScale } from "../AppText";
import supabase from "../../lib/supabase";
import { useRealtime } from "../../lib/realtime";
import { useRoomLive } from "../../lib/roomRealtime";
import { onUnreadRefresh } from "../../lib/unread";
import { canAccess, ROLE_LABEL, useRole } from "../../lib/roles";
import { confirmAction, notify } from "../../lib/notify";
import { ADMIN_COLUMN_WIDTH, isDesktopReady } from "../../lib/layout";
import { C } from "../../lib/theme";

// โครงหน้า admin แบบจอใหญ่ (คอม): เมนูซ้ายถาวร + พื้นที่เนื้อหา — ใช้เฉพาะเว็บจอกว้าง (lib/layout)
//   ฟีเจอร์/สิทธิ์เหมือนมือถือทุกอย่าง: เมนูกรองด้วย canAccess (TA เห็นเท่าที่มีสิทธิ์) · ด่านจริงยังอยู่ที่ RLS
//   หน้าที่ยังไม่มีแบบจอใหญ่ (ADMIN_DESKTOP_READY) → แสดงแบบมือถือกลางพื้นที่เนื้อหา

type NavItem = { icon: keyof typeof Ionicons.glyphMap; label: string; route: string; badge?: "requests" | "roomreports" | "unread" };
// สีประจำกลุ่มเมนู: ไอคอนอยู่ในกล่องสีอ่อน → ดูออกว่าเมนูไหนอยู่ระบบไหน · หน้าที่เปิดอยู่ = กล่องสีเข้ม + แถบซ้าย + พื้นสีอ่อน
type Tone = { ink: string; soft: string };
const TONE = {
  main: { ink: "#2563EB", soft: "#E8F0FF" },
  borrow: { ink: "#0F766E", soft: "#E3F5F2" },
  room: { ink: "#7C3AED", soft: "#F1EBFF" },
  check: { ink: "#C2410C", soft: "#FFEFE3" },
  system: { ink: "#475569", soft: "#EDF1F6" },
  student: { ink: "#047857", soft: "#E3F7EE" },
} satisfies Record<string, Tone>;
const NAV: { title?: string; tone: Tone; items: NavItem[] }[] = [
  {
    tone: TONE.main,
    items: [
      { icon: "grid-outline", label: "แดชบอร์ด", route: "/admin/home" },
      { icon: "file-tray-full-outline", label: "กล่องคำขอ", route: "/admin/requests", badge: "requests" },
      { icon: "notifications-outline", label: "แจ้งเตือน", route: "/admin/notifications", badge: "unread" },
    ],
  },
  {
    title: "ยืม-คืน",
    tone: TONE.borrow,
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
    tone: TONE.room,
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
    tone: TONE.check,
    items: [
      { icon: "clipboard-outline", label: "ตรวจเครื่องคอม", route: "/admin/inspection" },
      { icon: "hardware-chip-outline", label: "ตรวจสภาพ IoT", route: "/admin/iotinspection" },
      { icon: "document-attach-outline", label: "รายงานยืม-คืน", route: "/admin/report" },
      { icon: "bar-chart-outline", label: "รายงานสต็อก", route: "/admin/stock" },
    ],
  },
  {
    title: "ระบบ",
    tone: TONE.system,
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
// แจ้งเตือนงานผู้ดูแลที่ยังไม่อ่าน (เหมือนเลขกระดิ่งแดชบอร์ด: for_staff + สิทธิ์ TA)
async function countUnread(userId: string | null) {
  if (!userId) return 0;
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", userId).or("for_staff.eq.true,type.eq.role_changed").eq("read", false);
  return count || 0;
}
async function countRoomReports() {
  const { count } = await supabase.from("room_reports").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count || 0;
}

function GroupHead({ title, tone }: { title: string; tone: Tone }) {
  return (
    <View style={s.groupHead}>
      <View style={[s.groupDot, { backgroundColor: tone.ink }]} />
      <Text style={[s.groupTitle, { color: tone.ink }]}>{title}</Text>
    </View>
  );
}

// แถวเมนู: ปกติ = ไอคอนในกล่องสีอ่อนของกลุ่ม · ชี้ = พื้นสีอ่อน + ตัวหนังสือสีกลุ่ม
//   หน้าที่เปิดอยู่ = แถบสีซ้าย + กล่องไอคอนสีเข้ม (ไอคอนขาว) + ตัวหนา
function NavRow({ icon, label, tone, active = false, count = 0, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; tone: Tone; active?: boolean; count?: number; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      {...({ "aria-current": active ? "page" : undefined } as any)}
      style={({ hovered }: any) => [s.item, (hovered || active) && { backgroundColor: tone.soft }]}
    >
      {({ hovered }: any) => (
        <>
          {active ? <View style={[s.activeBar, { backgroundColor: tone.ink }]} /> : null}
          <View style={[s.iconBox, { backgroundColor: active ? tone.ink : hovered ? "#FFFFFF" : tone.soft }, active && s.iconBoxOn]}>
            <Ionicons name={icon} size={16} color={active ? "#FFFFFF" : tone.ink} />
          </View>
          <Text style={[s.itemText, (hovered || active) && { color: tone.ink }, active && s.itemTextOn]} numberOfLines={1}>{label}</Text>
          {count > 0 ? (
            <View style={s.badge}><Text style={s.badgeText}>{count > 99 ? "99+" : count}</Text></View>
          ) : null}
        </>
      )}
    </Pressable>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { role, userId } = useRole();
  const [name, setName] = useState("");
  const [badges, setBadges] = useState({ requests: 0, roomreports: 0, unread: 0 });

  const loadBadges = useCallback(async () => {
    const [requests, roomreports, unread] = await Promise.all([countRequests(), countRoomReports(), countUnread(userId)]);
    setBadges({ requests, roomreports, unread });
  }, [userId]);
  useEffect(() => { loadBadges(); }, [pathname, loadBadges]); // เปลี่ยนหน้า (เช่น ตัดสินคำขอแล้วกลับมา) = นับใหม่
  useRealtime("staff", "request", () => { loadBadges(); });
  useRealtime("user", "notification", () => { loadBadges(); });
  useEffect(() => onUnreadRefresh(() => { loadBadges(); }), [loadBadges]); // กดอ่านแล้วเลขลดทันที
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
  // จอกว้างมาก ตัวหนังสือแบบมือถือ (12–14) เล็กเกินอ่านสบาย → ขยายเฉพาะตัวหนังสือ (ไม่ขยายทั้งหน้า: เมนูลอยคำนวณตำแหน่งจากพิกัดจอ)
  const { width } = useWindowDimensions();
  const textScale = width >= 1800 ? 1.12 : width >= 1500 ? 1.07 : 1;

  return (
    <TextScale.Provider value={textScale}>
    <View style={s.root}>
      <View style={s.sidebar}>
        <View style={s.brand}>
          <View style={s.brandIcon}><Ionicons name="flask" size={17} color="#fff" /></View>
          <Text style={s.brandText}>LabHub</Text>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12, paddingHorizontal: 12 }} showsVerticalScrollIndicator={false}>
          {groups.map((g, gi) => (
            <View key={gi} style={{ marginTop: g.title ? 10 : 0 }}>
              {g.title ? <GroupHead title={g.title} tone={g.tone} /> : null}
              {g.items.map((item) => {
                const active = current === item.route;
                return (
                  <NavRow
                    key={item.route}
                    icon={item.icon}
                    label={item.label}
                    tone={g.tone}
                    active={active}
                    count={item.badge ? badges[item.badge] : 0}
                    // สลับหน้า (replace) ไม่ซ้อน: navigate/push ทำให้หน้าเก่าค้างทุกครั้งที่กดเมนู — แต่ละหน้ายังฟัง realtime/รีเฟรชอยู่ = กินฐานข้อมูล
                    // (ไม่ใช่ปุ่มย้อนกลับ จึงไม่ขัดกติกา goBack) · หน้าที่มีของยังไม่บันทึกยังถามก่อนออก (usePreventRemove)
                    onPress={() => { if (!active) router.replace(item.route as any); }}
                  />
                );
              })}
            </View>
          ))}
          {/* TA/Admin ยืมของเอง = หน้านักศึกษา (เหมือนการ์ด "ยืมของ" ในแดชบอร์ดมือถือ) */}
          <View style={{ marginTop: 10 }}>
            <GroupHead title="โหมดนักศึกษา" tone={TONE.student} />
            <NavRow icon="bag-handle-outline" label="ยืมของ" tone={TONE.student} onPress={() => router.navigate("/home")} />
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
        {/* data-admin-page: ให้ CSS ใน +html จองที่แถบเลื่อนสองข้าง เนื้อหาตรงกับหัวหน้าจอ */}
        <View style={[s.page, !ready && s.pagePhone]} {...(ready ? ({ dataSet: { adminPage: "1" } } as any) : null)}>{children}</View>
      </View>
    </View>
    </TextScale.Provider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: "#E4ECF9" },
  // ขอบซ้าย-ขวาอยู่ในแต่ละส่วน (ไม่ใช่ที่ sidebar) — แถบสีหน้าปัจจุบันชิดขอบจอได้ ไม่โดน ScrollView ตัด
  sidebar: { width: 232, backgroundColor: "#FFFFFF", borderRightWidth: 1, borderRightColor: "#DCE6F5", paddingTop: 18, paddingBottom: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 20, paddingBottom: 14 },
  brandIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  brandText: { fontSize: 18, fontWeight: "900", color: C.ink },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingBottom: 4 },
  groupDot: { width: 6, height: 6, borderRadius: 3 },
  groupTitle: { fontSize: 11, fontWeight: "800" },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingVertical: 4, marginVertical: 1, borderRadius: 10, transitionProperty: "background-color", transitionDuration: "120ms" } as any,
  itemHover: { backgroundColor: "#F3F7FD" },
  activeBar: { position: "absolute", left: -12, top: 7, bottom: 7, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  iconBox: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  iconBoxOn: { boxShadow: "0 3px 8px rgba(15,23,42,0.18)" } as any,
  itemText: { flex: 1, fontSize: 13.5, fontWeight: "600", color: "#334155" },
  itemTextOn: { fontWeight: "800" },
  badge: { minWidth: 20, height: 18, borderRadius: 9, backgroundColor: "#EF4444", paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
  me: { flexDirection: "row", alignItems: "center", gap: 9, borderTopWidth: 1, borderTopColor: "#EEF2F8", paddingTop: 12, paddingHorizontal: 16 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  avatarText: { color: C.primaryDark, fontWeight: "800" },
  meName: { fontSize: 13, fontWeight: "700", color: C.ink },
  meRole: { fontSize: 11, color: "#94A3B8" },
  logout: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, alignItems: "center" },
  page: { flex: 1, width: "100%" },
  pagePhone: { maxWidth: ADMIN_COLUMN_WIDTH, backgroundColor: C.bg, boxShadow: "0 0 32px rgba(23,32,51,0.10)" },
});
