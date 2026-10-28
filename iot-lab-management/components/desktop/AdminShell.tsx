import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Text, TextScale } from "../AppText";
import supabase from "../../lib/supabase";
import { useRealtime } from "../../lib/realtime";
import { useRoomLive } from "../../lib/roomRealtime";
import { onUnreadRefresh } from "../../lib/unread";
import { canAccess, useRole, useRoleLabel } from "../../lib/roles";
import { confirmAction, notify } from "../../lib/notify";
import { ADMIN_COLUMN_WIDTH, isDesktopReady } from "../../lib/layout";
import { C } from "../../lib/theme";

// โครงหน้า admin แบบจอใหญ่ (คอม): เมนูซ้ายถาวร + พื้นที่เนื้อหา — ใช้เฉพาะเว็บจอกว้าง (lib/layout)
//   ฟีเจอร์/สิทธิ์เหมือนมือถือทุกอย่าง: เมนูกรองด้วย canAccess (TA เห็นเท่าที่มีสิทธิ์) · ด่านจริงยังอยู่ที่ RLS
//   หน้าที่ยังไม่มีแบบจอใหญ่ (ADMIN_DESKTOP_READY) → แสดงแบบมือถือกลางพื้นที่เนื้อหา

type NavItem = { icon: keyof typeof Ionicons.glyphMap; label: string; route: string; badge?: "requests" | "roomreports" | "unread" };
// เมนูซ้ายโทนฟ้า-ขาว (แบบ 1A ที่เจ้าของโปรเจกต์เลือก): พื้นฟ้าเข้ม · ไอคอนขาวในกล่องสีประจำกลุ่ม
//   หน้าที่เปิดอยู่ = แถบขาว + ตัวหนังสือฟ้า
const SIDE = { ink: "#FFFFFF", text: "rgba(255,255,255,0.88)", dim: "rgba(255,255,255,0.62)", hover: "rgba(255,255,255,0.10)", line: "rgba(255,255,255,0.16)", activeInk: "#1D4ED8" };
// สีประจำกลุ่ม (แบบ ก): tile = กล่องไอคอนสีสด (ไอคอนขาว) / label = หัวกลุ่มสีสว่างอ่านบนพื้นฟ้า
//   กลุ่มหลักใช้ฟ้าน้ำทะเล ไม่ใช่ฟ้าแบรนด์ — ไม่งั้นกล่องกลืนกับพื้นเมนู
type Tone = { tile: string; label: string };
const TONE = {
  main: { tile: "#38BDF8", label: "#BAE6FD" },
  borrow: { tile: "#14B8A6", label: "#5EEAD4" },
  room: { tile: "#8B5CF6", label: "#DDD6FE" },
  check: { tile: "#F97316", label: "#FED7AA" },
  system: { tile: "#64748B", label: "#E2E8F0" },
  student: { tile: "#10B981", label: "#A7F3D0" },
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
      <View style={[s.groupDot, { backgroundColor: tone.label }]} />
      <Text style={[s.groupTitle, { color: tone.label }]}>{title}</Text>
    </View>
  );
}

// แถวเมนู: ปกติ = ไอคอนขาวในกล่องสีกลุ่ม + ตัวหนังสือขาว · ชี้ = พื้นขาวโปร่ง + กล่องขยายนิด
//   หน้าที่เปิดอยู่ = แถบขาวมีเงา + ตัวหนังสือฟ้าตัวหนา · โฟกัสคีย์บอร์ด = วงฟ้าอ่อน
function NavRow({ icon, label, tone, active = false, count = 0, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; tone: Tone; active?: boolean; count?: number; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      {...({ "aria-current": active ? "page" : undefined } as any)}
      style={({ hovered, pressed, focused }: any) => [
        s.item,
        hovered && !active && s.itemHover,
        pressed && !active && s.itemPressed,
        active && s.itemOn,
        focused && s.itemFocus,
      ]}
    >
      {({ hovered }: any) => (
        <>
          <View style={[s.iconBox, { backgroundColor: tone.tile }, (hovered || active) && s.iconBoxLift]}>
            <Ionicons name={icon} size={16} color="#FFFFFF" />
          </View>
          <Text style={[s.itemText, hovered && { color: SIDE.ink }, active && s.itemTextOn]} numberOfLines={1}>{label}</Text>
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
  const roleLabel = useRoleLabel(role, true);
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
          <View style={s.brandIcon}><Ionicons name="flask" size={18} color={C.primary} /></View>
          <View>
            <Text style={s.brandText}>LabHub</Text>
            <Text style={s.brandSub}>ระบบจัดการห้องแล็บ</Text>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12, paddingHorizontal: 12 }} showsVerticalScrollIndicator={false}>
          {groups.map((g, gi) => (
            <View key={gi} style={{ marginTop: g.title ? 10 : 0 }}>
              {g.title ? <GroupHead title={g.title} tone={g.tone} /> : null}
              {g.items.map((item) => {
                const active = current === item.route;
                return (
                  <NavRow
                    tone={g.tone}
                    key={item.route}
                    icon={item.icon}
                    label={item.label}
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
            <Text style={s.meRole} numberOfLines={1}>{roleLabel || ""}</Text>
          </View>
          <Pressable onPress={logout} style={({ hovered, focused }: any) => [s.logout, hovered && s.itemHover, focused && s.itemFocus]} accessibilityLabel="ออกจากระบบ">
            <Ionicons name="log-out-outline" size={18} color={SIDE.text} />
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
  // ฟ้า #2563EB→#1D4ED8→#1E40AF ผสมกรมท่า 15% (ค่าที่เลือกจาก mockup) + แสงฟ้าอ่อนมุมซ้ายบน
  sidebar: { width: 232, backgroundColor: "#1A46C3", backgroundImage: "radial-gradient(260px 200px at 0% 0%, rgba(147,197,253,0.35), transparent 70%), linear-gradient(180deg, #2158D3 0%, #1A46C3 45%, #1B3AA0 100%)", paddingTop: 18, paddingBottom: 12 } as any,
  brand: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingBottom: 16 },
  brandIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(15,23,42,0.20)" } as any,
  brandText: { fontSize: 18, fontWeight: "900", color: SIDE.ink, lineHeight: 22 },
  brandSub: { fontSize: 10.5, fontWeight: "600", color: SIDE.dim },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingTop: 4, paddingBottom: 5 },
  groupDot: { width: 6, height: 6, borderRadius: 3 },
  groupTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingVertical: 4, marginVertical: 1, borderRadius: 10, transitionProperty: "background-color, box-shadow", transitionDuration: "150ms" } as any,
  itemHover: { backgroundColor: SIDE.hover },
  itemPressed: { backgroundColor: "rgba(255,255,255,0.16)" },
  itemOn: { backgroundColor: "#FFFFFF", boxShadow: "0 6px 16px rgba(15,23,42,0.22)" } as any,
  itemFocus: { boxShadow: "0 0 0 2px #93C5FD" } as any,
  iconBox: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(15,23,42,0.18)", transitionProperty: "transform", transitionDuration: "150ms" } as any,
  iconBoxLift: { transform: [{ scale: 1.08 }], boxShadow: "0 3px 8px rgba(15,23,42,0.25)" } as any,
  itemText: { flex: 1, fontSize: 13.5, fontWeight: "600", color: SIDE.text },
  itemTextOn: { color: SIDE.activeInk, fontWeight: "800" },
  badge: { minWidth: 20, height: 18, borderRadius: 9, backgroundColor: "#EF4444", paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
  me: { flexDirection: "row", alignItems: "center", gap: 9, borderTopWidth: 1, borderTopColor: SIDE.line, paddingTop: 12, paddingHorizontal: 16 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  avatarText: { color: C.primaryDark, fontWeight: "800" },
  meName: { fontSize: 13, fontWeight: "700", color: SIDE.ink },
  meRole: { fontSize: 11, color: SIDE.dim },
  logout: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, alignItems: "center" },
  page: { flex: 1, width: "100%" },
  pagePhone: { maxWidth: ADMIN_COLUMN_WIDTH, backgroundColor: C.bg, boxShadow: "0 0 32px rgba(23,32,51,0.10)" },
});
