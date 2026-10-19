import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text } from "../AppText";
import GreetingLine from "../GreetingLine";
import StaffCheckInCard from "../StaffCheckInCard";
import supabase from "../../lib/supabase";
import { fetchPeople, who } from "../../lib/people";
import { useRealtime } from "../../lib/realtime";
import { ROLE_LABEL, Role } from "../../lib/roles";
import { PresentStaff } from "../../lib/presence";
import { C } from "../../lib/theme";
import { DESKTOP_GUTTER, DESKTOP_MAX } from "../../lib/layout";

// แดชบอร์ด admin แบบจอใหญ่ (เว็บบนคอม) — ข้อมูลชุดเดียวกับแดชบอร์ดมือถือ (app/admin/home.tsx ส่งมาให้)
//   + ดึงเพิ่มเฉพาะที่จอใหญ่โชว์: รายการคำขอรออนุมัติ, เกินกำหนดคืน, สถานะห้องคอมรายกลุ่ม
//   ปุ่มในตาราง = เปิดคำขอนั้นในกล่องคำขอ (ตัดสินผ่านแผ่นยืนยันเดิม ไม่ข้ามขั้นตอน)
type Activity = { id: string; icon: string; iconBg: string; color: string; title: string; sub: string; time: string };
type Props = {
  role: Role | null;
  userId: string | null;
  presence: { list: PresentStaff[]; reload: () => Promise<void> | void };
  checkedIn: boolean;
  loading: boolean;
  stock: { total: number; available: number; borrowed: number; repair: number };
  today: { borrowed: number; returned: number; repairOpen: number };
  pending: number;
  unread: number;
  activities: Activity[];
  onRefresh: () => void;
};

type PendingRow = { id: string; source: "request" | "pickup"; kind: string; who: string; item: string; days?: number | null; expires_at?: string | null };
type RoomGroup = { room: string; group: number; ok: number; total: number };

const KIND: Record<string, { label: string; bg: string; fg: string }> = {
  borrow: { label: "ยืม", bg: "#EFF5FF", fg: "#1D4ED8" },
  return: { label: "คืน", bg: "#ECFDF5", fg: "#047857" },
  renew: { label: "ยืมต่อ", bg: "#FFF7ED", fg: "#C2410C" },
  pickup: { label: "นัดรับ", bg: "#F5F3FF", fg: "#6D28D9" },
};

const timeLeft = (iso?: string | null) => {
  if (!iso) return "-";
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins <= 0) return "หมดเวลา";
  if (mins < 60) return `${mins} นาที`;
  return `${Math.floor(mins / 60)} ชม. ${mins % 60} น.`;
};

export default function AdminDashboardDesktop(p: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<PendingRow[] | null>(null);
  const [overdue, setOverdue] = useState(0);
  const [roomGroups, setRoomGroups] = useState<RoomGroup[]>([]);
  const [roomReports, setRoomReports] = useState(0);

  const loadExtra = useCallback(async () => {
    const [reqs, picks, od, stations, reports] = await Promise.all([
      supabase.from("borrow_requests").select("id, kind, days, user_id, expires_at, items(item_code, name)")
        .eq("status", "pending").order("created_at", { ascending: true }).limit(8),
      supabase.from("pickup_requests").select("id, item_prefix, days, user_id, expires_at")
        .eq("status", "pending").order("created_at", { ascending: true }).limit(8),
      supabase.from("borrow_records").select("id", { count: "exact", head: true })
        .eq("status", "borrowed").lt("due_date", new Date().toISOString()),
      supabase.from("computer_stations").select("room_id, group_no, status").eq("active", true),
      supabase.from("room_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    const all = [...(reqs.data || []), ...(picks.data || [])];
    const people = await fetchPeople([...new Set(all.map((r: any) => r.user_id).filter(Boolean))] as string[]);
    const name = (id: string) => who(people.find((x: any) => x.id === id));
    setRows([
      ...(reqs.data || []).map((r: any) => ({
        id: r.id, source: "request" as const, kind: r.kind, who: name(r.user_id),
        item: r.items?.item_code || r.items?.name || "-", days: r.days, expires_at: r.expires_at,
      })),
      ...(picks.data || []).map((r: any) => ({
        id: r.id, source: "pickup" as const, kind: "pickup", who: name(r.user_id),
        item: r.item_prefix, days: r.days, expires_at: r.expires_at,
      })),
    ]);
    setOverdue(od.count || 0);
    setRoomReports(reports.count || 0);
    const map = new Map<string, RoomGroup>();
    (stations.data || []).forEach((st: any) => {
      const key = `${st.room_id}#${st.group_no}`;
      const g = map.get(key) || { room: st.room_id, group: st.group_no, ok: 0, total: 0 };
      g.total += 1;
      if (st.status === "available") g.ok += 1;
      map.set(key, g);
    });
    setRoomGroups([...map.values()].sort((a, b) => a.room.localeCompare(b.room) || a.group - b.group));
  }, []);

  useEffect(() => { loadExtra(); }, [p.pending]); // เลขคำขอเปลี่ยน (realtime/กลับมาหน้านี้) = โหลดตารางใหม่
  useRealtime("staff", "request", () => { loadExtra(); });

  const openRow = (r: PendingRow) =>
    router.push((r.source === "request" ? `/admin/requests?id=${r.id}` : "/admin/requests") as any);

  const rooms = [...new Set(roomGroups.map((g) => g.room))];
  const stockRows = [
    { label: "ว่าง", n: p.stock.available, color: "#10B981" },
    { label: "ถูกยืม", n: p.stock.borrowed, color: "#2563EB" },
    { label: "ซ่อม", n: p.stock.repair, color: "#F59E0B" },
  ];

  return (
    <ScrollView style={s.fill} contentContainerStyle={s.page}>
      {/* หัว */}
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <GreetingLine roleLabel={p.role ? ROLE_LABEL[p.role] : undefined} dot={p.checkedIn ? "green" : "red"} />
          <Text style={s.title}>แดชบอร์ด</Text>
        </View>
        <HeadButton icon="refresh" label="รีเฟรช" onPress={() => { p.onRefresh(); loadExtra(); }} />
        <HeadButton icon="notifications-outline" label="แจ้งเตือน" badge={p.unread} onPress={() => router.push("/admin/notifications" as any)} />
      </View>

      {/* ตัวเลขวันนี้ */}
      <View style={s.stats}>
        <Stat icon="arrow-up-outline" color="#2563EB" n={p.today.borrowed} label="ยืมวันนี้" />
        <Stat icon="arrow-down-outline" color="#047857" n={p.today.returned} label="คืนวันนี้" />
        <Stat icon="file-tray-full-outline" color="#B45309" n={p.pending} label="รออนุมัติ" onPress={() => router.push("/admin/requests")} />
        <Stat icon="alert-circle-outline" color="#B91C1C" n={overdue} label="เกินกำหนดคืน" onPress={() => router.push("/admin/history")} />
      </View>

      <View style={s.cols}>
        {/* ซ้าย: คำขอรออนุมัติ + กิจกรรมล่าสุด */}
        <View style={s.colMain}>
          <View style={s.card}>
            <CardHead icon="file-tray-full-outline" title="คำขอรออนุมัติ" action="ดูทั้งหมด" onAction={() => router.push("/admin/requests")} />
            {rows === null ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 24 }} />
            ) : rows.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name="checkmark-done-circle-outline" size={30} color="#86EFAC" />
                <Text style={s.emptyText}>ไม่มีคำขอค้าง</Text>
              </View>
            ) : (
              <View>
                <View style={[s.tr, s.th]}>
                  <Text style={[s.thText, { flex: 2.2 }]}>ผู้ขอ</Text>
                  <Text style={[s.thText, { flex: 1.4 }]}>อุปกรณ์</Text>
                  <Text style={[s.thText, { flex: 1.2 }]}>ประเภท</Text>
                  <Text style={[s.thText, { flex: 1.1 }]}>เหลือเวลา</Text>
                  <View style={{ width: 92 }} />
                </View>
                {rows.map((r) => {
                  const k = KIND[r.kind] || KIND.borrow;
                  return (
                    <Pressable key={r.source + r.id} onPress={() => openRow(r)} style={({ hovered }: any) => [s.tr, hovered && s.trHover]}>
                      <Text style={[s.td, { flex: 2.2 }]} numberOfLines={1}>{r.who}</Text>
                      <Text style={[s.td, s.mono, { flex: 1.4 }]} numberOfLines={1}>{r.item}</Text>
                      <View style={{ flex: 1.2, flexDirection: "row" }}>
                        <View style={[s.pill, { backgroundColor: k.bg }]}>
                          <Text style={[s.pillText, { color: k.fg }]}>{k.label}{r.days && r.kind !== "return" ? ` ${r.days} วัน` : ""}</Text>
                        </View>
                      </View>
                      <Text style={[s.td, { flex: 1.1, color: "#64748B" }]}>{timeLeft(r.expires_at)}</Text>
                      <View style={s.openBtn}><Text style={s.openBtnText}>{r.source === "pickup" ? "นัดเวลา" : "ตัดสิน"}</Text></View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={s.card}>
            <CardHead icon="pulse-outline" title="กิจกรรมล่าสุด" />
            {p.loading ? (
              <ActivityIndicator color={C.primary} style={{ marginVertical: 24 }} />
            ) : p.activities.length === 0 ? (
              <Text style={[s.emptyText, { paddingVertical: 16, textAlign: "center" }]}>ยังไม่มีกิจกรรม</Text>
            ) : (
              p.activities.slice(0, 8).map((a) => (
                <View key={a.id} style={s.act}>
                  <View style={[s.actIcon, { backgroundColor: a.iconBg }]}>
                    <Ionicons name={a.icon as any} size={15} color={a.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.actTitle} numberOfLines={1}>{a.title}</Text>
                    <Text style={s.actSub} numberOfLines={1}>{a.sub}</Text>
                  </View>
                  <Text style={s.actTime}>{a.time}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* ขวา: เช็กอินห้อง + สต็อก + ห้องคอม */}
        <View style={s.colSide}>
          <StaffCheckInCard list={p.presence.list} me={p.userId} reload={p.presence.reload} />

          <View style={s.card}>
            <CardHead icon="cube-outline" title={`ภาพรวมอุปกรณ์ · ${p.stock.total} ชิ้น`} action="รายงานสต็อก" onAction={() => router.push("/admin/stock")} />
            {stockRows.map((r) => (
              <View key={r.label} style={{ marginBottom: 10 }}>
                <View style={s.barHead}>
                  <Text style={s.barLabel}>{r.label}</Text>
                  <Text style={s.barNum}>{r.n}</Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { backgroundColor: r.color, width: `${p.stock.total ? Math.round((r.n / p.stock.total) * 100) : 0}%` }]} />
                </View>
              </View>
            ))}
          </View>

          {rooms.map((room) => {
            const groups = roomGroups.filter((g) => g.room === room);
            const ok = groups.reduce((n, g) => n + g.ok, 0);
            const total = groups.reduce((n, g) => n + g.total, 0);
            return (
              <View key={room} style={s.card}>
                <CardHead icon="desktop-outline" title={`ห้อง ${room}`} action={`ว่าง ${ok}/${total}`} onAction={() => router.push({ pathname: "/roommap", params: { room_id: room, from: "admin" } } as any)} />
                <View style={s.groupGrid}>
                  {groups.map((g) => {
                    const tone = g.ok === g.total ? s.gOk : g.ok === 0 ? s.gDown : s.gWarn;
                    return (
                      <View key={g.group} style={[s.gCell, tone]}>
                        <Text style={s.gNo}>G{g.group}</Text>
                        <Text style={s.gSub}>{g.ok}/{g.total}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
          <View style={s.card}>
            <CardHead icon="construct-outline" title="งานห้องคอม" />
            <Pressable onPress={() => router.push("/admin/repairs")} style={({ hovered }: any) => [s.line, hovered && s.trHover]}>
              <Text style={s.lineText}>ซ่อมค้าง</Text><Text style={s.lineNum}>{p.today.repairOpen}</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/admin/roomreports")} style={({ hovered }: any) => [s.line, hovered && s.trHover]}>
              <Text style={s.lineText}>คำแจ้งปัญหาใหม่</Text><Text style={s.lineNum}>{roomReports}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function HeadButton({ icon, label, badge = 0, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; badge?: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ hovered }: any) => [s.headBtn, hovered && { backgroundColor: "#F3F7FD" }]} accessibilityLabel={label}>
      <Ionicons name={icon} size={19} color={C.primaryDark} />
      {badge > 0 ? <View style={s.headBadge}><Text style={s.headBadgeText}>{badge > 99 ? "99+" : badge}</Text></View> : null}
    </Pressable>
  );
}

function Stat({ icon, color, n, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; color: string; n: number; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ hovered }: any) => [s.stat, hovered && onPress && { borderColor: "#BFD3F7" }]}>
      <View style={[s.statIcon, { backgroundColor: color + "18" }]}><Ionicons name={icon} size={18} color={color} /></View>
      <View>
        <Text style={[s.statNum, { color }]}>{n}</Text>
        <Text style={s.statLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

function CardHead({ icon, title, action, onAction }: { icon: keyof typeof Ionicons.glyphMap; title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.cardHead}>
      <Ionicons name={icon} size={16} color={C.primary} />
      <Text style={s.cardTitle} numberOfLines={1}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} disabled={!onAction} hitSlop={6}>
          <Text style={s.cardAction}>{action}{onAction ? " →" : ""}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  // พื้นหน้าเหมือนหน้า admin อื่นบนคอม (ตัวแปร CSS ใน app/+html)
  fill: { flex: 1, backgroundImage: "var(--lh-page-bg)" } as any,
  page: { paddingHorizontal: DESKTOP_GUTTER, paddingTop: 28, paddingBottom: 28, maxWidth: DESKTOP_MAX, width: "100%", alignSelf: "center", gap: 18 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 26, fontWeight: "900", color: C.ink, marginTop: 2 },
  headBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#DCE6F5", alignItems: "center", justifyContent: "center" },
  headBadge: { position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#EF4444", paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  headBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  stats: { flexDirection: "row", gap: 14 },
  stat: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#DCE6F5", padding: 16, boxShadow: "var(--lh-card-shadow)" } as any,
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statNum: { fontSize: 26, fontWeight: "900", lineHeight: 30 },
  statLabel: { fontSize: 12.5, color: "#64748B", fontWeight: "600" },
  cols: { flexDirection: "row", gap: 18, alignItems: "flex-start" },
  colMain: { flex: 1.65, gap: 18, minWidth: 0 },
  colSide: { flex: 1, gap: 18, minWidth: 0 },
  card: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#DCE6F5", padding: 18, boxShadow: "var(--lh-card-shadow)" } as any,
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: C.ink },
  cardAction: { fontSize: 12.5, fontWeight: "700", color: C.primary },
  tr: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", borderRadius: 8 },
  th: { paddingVertical: 6, borderBottomColor: "#EEF2F8" },
  thText: { fontSize: 11.5, fontWeight: "700", color: "#94A3B8" },
  trHover: { backgroundColor: "#F6F9FE" },
  td: { fontSize: 13, color: C.ink, fontWeight: "600" },
  mono: { fontWeight: "800" },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 11.5, fontWeight: "800" },
  openBtn: { width: 92, borderRadius: 9, borderWidth: 1, borderColor: "#BFD3F7", backgroundColor: "#EFF5FF", paddingVertical: 6, alignItems: "center" },
  openBtnText: { fontSize: 12, fontWeight: "800", color: C.primaryDark },
  empty: { alignItems: "center", paddingVertical: 22, gap: 6 },
  emptyText: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  act: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F5F7FB" },
  actIcon: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  actTitle: { fontSize: 13, fontWeight: "700", color: C.ink },
  actSub: { fontSize: 11.5, color: "#64748B" },
  actTime: { fontSize: 11.5, color: "#94A3B8" },
  barHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  barLabel: { fontSize: 12.5, color: "#475569", fontWeight: "600" },
  barNum: { fontSize: 12.5, color: C.ink, fontWeight: "800" },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: "#EEF2F8", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  groupGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gCell: { width: "30%", flexGrow: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 8, alignItems: "center" },
  gOk: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  gWarn: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  gDown: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  gNo: { fontSize: 13, fontWeight: "800", color: C.ink },
  gSub: { fontSize: 11, color: "#64748B" },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, paddingHorizontal: 6, borderRadius: 8 },
  lineText: { fontSize: 13, color: "#475569", fontWeight: "600" },
  lineNum: { fontSize: 13, color: C.ink, fontWeight: "800" },
});
