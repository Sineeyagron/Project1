import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import supabase from "../../lib/supabase";
import { isMissingColumn, who } from "../../lib/people";
import { useRealtime } from "../../lib/realtime";
import { goBack, useRefreshOnFocus } from "../../lib/nav";
import { notify } from "../../lib/notify";
import { photoStamp } from "../../lib/borrowPhotos";
import Countdown from "../../components/Countdown";
import { useRole } from "../../lib/roles";
import { W, NG } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";

// กล่องคำขอของผู้ดูแล: อนุมัติ / ปฏิเสธ คำขอยืม-คืน-ยืมต่อ (แผน 2.4, 2.6)
// การตัดสินทั้งหมดผ่าน RPC decide_request (ตรวจสิทธิ์ + ล็อกแถวในฐานข้อมูล)

const C = {
  bg: "#EAF1FC",
  purple: "#2563EB",
  ink: "#172033",
  muted: "#475569",
  faint: "#64748B",
  line: "#DCE6F5",
  green: "#047857",
  orange: "#c2410c",
  red: "#ef4444",
  blue: "#2563eb",
};

const KIND: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  borrow: { label: "ขอยืม", icon: "hand-left-outline", color: C.blue, bg: "#dbeafe" },
  return: { label: "ขอคืน", icon: "return-down-back-outline", color: C.green, bg: "#ECFDF5" },
  renew: { label: "ขอยืมต่อ", icon: "refresh-outline", color: C.orange, bg: "#ffedd5" },
};

const RESULT: Record<string, { label: string; color: string; bg: string }> = {
  approved: { label: "อนุมัติ", color: C.green, bg: "#ECFDF5" },
  declined: { label: "ปฏิเสธ", color: "#dc2626", bg: "#fee2e2" },
  expired: { label: "หมดอายุ", color: C.muted, bg: "#f1f5f9" },
  cancelled: { label: "ผู้ขอยกเลิก", color: C.muted, bg: "#f1f5f9" },
  auto_returned: { label: "คืนอัตโนมัติ", color: "#b45309", bg: "#fef3c7" },
};

const SELECT = `
  id, user_id, kind, status, days, condition, condition_note, photo_path, created_at, expires_at,
  decided_at, decision_note,
  items(item_code, name, image_url),
  borrow_locations(name),
  requester:profiles!borrow_requests_user_id_fkey(email, full_name, student_id),
  decider:profiles!borrow_requests_decided_by_fkey(email),
  record:borrow_records!borrow_requests_borrow_record_id_fkey(due_date, renew_count, borrow_photo_path)
`;
// ยังไม่ได้รัน migration profile_student_id → ไม่มี full_name/student_id: ใช้ชุดเดิม (อีเมล) ให้กล่องคำขอยังใช้ได้
const SELECT_LEGACY = SELECT.replace("(email, full_name, student_id)", "(email)");

const thaiDate = (value?: string | null) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-";
const thaiDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

type Decision = {
  req: any;
  approve: boolean;
  condition: "good" | "damaged" | null;
  cost: string;
  note: string;
};

export default function AdminRequests() {
  const router = useRouter();
  const { role, userId } = useRole();
  const { id: focusId } = useLocalSearchParams<{ id?: string }>();

  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [pending, setPending] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zoom, setZoom] = useState<{ url: string; stamp: string } | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [saving, setSaving] = useState(false);

  const signedRef = useRef<Record<string, string>>({});
  const signedAtRef = useRef(0);

  const load = useCallback(async () => {
    // ปล่อยคำขอที่หมดเวลาก่อน จะได้ไม่เห็นรายการที่ตัดสินไม่ได้แล้ว
    await supabase.rpc("expire_requests");
    const query = (sel: string) => Promise.all([
      supabase.from("borrow_requests").select(sel).eq("status", "pending").order("created_at", { ascending: true }),
      supabase.from("borrow_requests").select(sel).neq("status", "pending").order("decided_at", { ascending: false }).limit(40),
    ]);
    let [{ data: p, error }, { data: h }] = await query(SELECT);
    if (error && isMissingColumn(error)) [{ data: p, error }, { data: h }] = await query(SELECT_LEGACY);
    if (error) notify("โหลดคำขอไม่สำเร็จ", error.message);

    const all = [...(p || []), ...(h || [])];
    const paths = [
      ...new Set(
        all.flatMap((r: any) => [r.photo_path, r.record?.borrow_photo_path]).filter(Boolean) as string[]
      ),
    ];
    // ขอลิงก์รูปเฉพาะรูปใหม่ (ลิงก์อายุ 1 ชม. ใช้ซ้ำได้) — ลดงานฐานข้อมูลตอนรีเฟรชอัตโนมัติ
    // เปิดหน้าค้างไว้เกิน 50 นาที → ลิงก์เดิมใกล้หมดอายุ (รูปจะไม่ขึ้น) ล้างแล้วขอใหม่ทั้งหมด
    if (Date.now() - signedAtRef.current > 50 * 60 * 1000) {
      signedRef.current = {};
      signedAtRef.current = Date.now();
    }
    const fresh = paths.filter((path) => !signedRef.current[path]);
    if (fresh.length > 0) {
      const { data: signed } = await supabase.storage.from("borrow-photos").createSignedUrls(fresh, 60 * 60);
      (signed || []).forEach((s: any) => { if (s.path && s.signedUrl) signedRef.current[s.path] = s.signedUrl; });
      setPhotoUrls({ ...signedRef.current });
    }

    // คำขอที่เปิดมาจากแจ้งเตือนขึ้นก่อน
    const list = (p || []).slice().sort((a: any, b: any) => (a.id === focusId ? -1 : b.id === focusId ? 1 : 0));
    setPending(list);
    setHistory(h || []);
    setLoading(false);
    setRefreshing(false);
  }, [focusId]);

  useEffect(() => { load(); }, [load]);
  // กลับมาหน้านี้ (ปุ่ม ← / สลับแท็บ) → โหลดข้อมูลใหม่
  useRefreshOnFocus(() => { load(); });
  // Realtime: คำขอใหม่ / ถูกตัดสินโดยผู้ดูแลคนอื่น → โหลดทันที
  useRealtime("staff", "request", () => { load(); });

  // สำรองกรณีสัญญาณ Realtime หลุด: รีเฟรชทุก 5 นาที (ข้ามตอนแอป/แท็บอยู่เบื้องหลัง) และตอนกลับเข้าแอป
  useEffect(() => {
    const t = setInterval(() => { if (AppState.currentState === "active") load(); }, 300000);
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") load(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [load]);

  const openDecision = (req: any, approve: boolean) => {
    setDecision({ req, approve, condition: req.kind === "return" ? req.condition ?? null : null, cost: "", note: "" });
  };

  const decisionReady = useMemo(() => {
    if (!decision) return false;
    if (!decision.approve) return !!decision.note.trim();
    if (decision.req.kind === "return") {
      if (!decision.condition) return false;
      if (decision.cost.trim() && !(Number(decision.cost) >= 0)) return false;
    }
    return true;
  }, [decision]);

  const submitDecision = async () => {
    if (!decision || !decisionReady) return;
    setSaving(true);
    const isDamaged = decision.req.kind === "return" && decision.condition === "damaged";
    const { error } = await supabase.rpc("decide_request", {
      p_request_id: decision.req.id,
      p_approve: decision.approve,
      p_note: decision.note.trim() || null,
      p_condition: decision.req.kind === "return" && decision.approve ? decision.condition : null,
      p_damage_cost: isDamaged && decision.cost.trim() ? Number(decision.cost) : null,
    });
    setSaving(false);
    if (error) {
      notify("ดำเนินการไม่สำเร็จ", error.message);
      load();
      return;
    }
    setDecision(null);
    load();
  };

  const PhotoThumb = ({ path, code, at }: { path?: string; code?: string; at?: string }) => {
    const url = path ? photoUrls[path] : null;
    if (!url) {
      return (
        <View style={[s.photo, s.photoEmpty]}>
          <Ionicons name="image-outline" size={22} color={C.faint} />
        </View>
      );
    }
    const stamp = photoStamp(code, at);
    return (
      <TouchableOpacity onPress={() => setZoom({ url, stamp })} activeOpacity={0.9}>
        <Image source={{ uri: url }} style={s.photo} />
        <Text style={s.stamp} numberOfLines={1}>{stamp}</Text>
      </TouchableOpacity>
    );
  };

  const RequestCard = ({ r }: { r: any }) => {
    const k = KIND[r.kind] ?? KIND.borrow;
    const code = r.items?.item_code || r.items?.name || "อุปกรณ์";
    const isPending = r.status === "pending";
    const res = RESULT[r.status];
    return (
      <View style={[s.card, r.id === focusId && isPending && s.cardFocus]}>
        <View style={s.cardTop}>
          <View style={[s.kindPill, { backgroundColor: k.bg }]}>
            <Ionicons name={k.icon} size={13} color={k.color} />
            <Text style={[s.kindText, { color: k.color }]}>{k.label}</Text>
          </View>
          {isPending ? (
            <Countdown until={r.expires_at} onDone={load} style={s.countdown} />
          ) : (
            res && (
              <View style={[s.kindPill, { backgroundColor: res.bg }]}>
                <Text style={[s.kindText, { color: res.color }]}>{res.label}</Text>
              </View>
            )
          )}
        </View>

        <View style={s.cardBody}>
          {r.kind !== "renew" && <PhotoThumb path={r.photo_path} code={code} at={r.created_at} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.code}>{code}</Text>
            <Text style={s.meta} numberOfLines={1}>{r.items?.name} · ห้อง {r.borrow_locations?.name || "-"}</Text>
            <Text style={s.meta} numberOfLines={1}>{who(r.requester)}</Text>
            <Text style={s.metaFaint}>ส่งเมื่อ {thaiDateTime(r.created_at)}</Text>
            {r.kind === "borrow" && <Text style={s.detail}>ยืม {r.days} วัน</Text>}
            {r.kind === "renew" && (
              <Text style={s.detail}>ต่ออีก {r.days} วัน (เดิมครบ {thaiDate(r.record?.due_date)})</Text>
            )}
            {r.kind === "return" && r.record?.due_date && (
              <Text style={s.metaFaint}>กำหนดคืน {thaiDate(r.record.due_date)}</Text>
            )}
            {r.condition && (
              <Text style={[s.detail, { color: r.condition === "damaged" ? "#dc2626" : C.green }]}>
                ผู้ขอแจ้งสภาพ: {r.condition === "damaged" ? "ชำรุด" : "ปกติ"}
                {r.condition_note ? ` — ${r.condition_note}` : ""}
              </Text>
            )}
          </View>
        </View>

        {r.kind === "return" && r.record?.borrow_photo_path && (
          <View style={s.compare}>
            <Text style={s.compareLabel}>เทียบรูปตอนยืม</Text>
            <PhotoThumb path={r.record.borrow_photo_path} code={code} />
          </View>
        )}

        {isPending && role !== "admin" && r.user_id === userId ? (
          // คำขอของตัวเอง (TA ที่ยืมของด้วย) — ฐานข้อมูลก็กันไว้ (trigger borrow_requests_no_self_decide)
          <Text style={s.selfNote}>คำขอของคุณเอง — ให้ผู้ดูแลคนอื่นเป็นคนตัดสิน</Text>
        ) : isPending ? (
          <View style={s.actions}>
            <TouchableOpacity style={[s.btn, s.btnDecline]} onPress={() => openDecision(r, false)} activeOpacity={0.85}>
              <Text style={s.btnDeclineText}>ปฏิเสธ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnApprove]} onPress={() => openDecision(r, true)} activeOpacity={0.85}>
              <Text style={s.btnApproveText}>{r.kind === "return" ? "ตรวจสภาพ & ยืนยันคืน" : "อนุมัติ"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          (r.decision_note || r.decider?.email) && (
            <Text style={s.metaFaint}>
              {r.decider?.email ? `โดย ${r.decider.email} · ${thaiDateTime(r.decided_at)}` : thaiDateTime(r.decided_at)}
              {r.decision_note ? `\n${r.decision_note}` : ""}
            </Text>
          )
        )}
      </View>
    );
  };

  const list = tab === "pending" ? pending : history;

  return (
    <View style={s.container}>
      <ScreenHeader
        title={"กล่องคำขอ"}
        subtitle={"ยืม · คืน · ยืมต่อ ที่นักศึกษาส่งมา"}
        onBack={() => goBack("/admin/home")}
      />

      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === "pending" && s.tabActive]} onPress={() => setTab("pending")} activeOpacity={0.85}>
          <Text style={[s.tabText, tab === "pending" && s.tabTextActive]}>รอดำเนินการ ({pending.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === "history" && s.tabActive]} onPress={() => setTab("history")} activeOpacity={0.85}>
          <Text style={[s.tabText, tab === "history" && s.tabTextActive]}>ประวัติ</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.purple} />}
        >
          {list.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name={tab === "pending" ? "checkmark-done-circle-outline" : "file-tray-outline"} size={50} color="#cbd5e1" />
              <Text style={s.emptyText}>{tab === "pending" ? "ไม่มีคำขอที่รออยู่" : "ยังไม่มีประวัติ"}</Text>
            </View>
          ) : (
            list.map((r) => <RequestCard key={r.id} r={r} />)
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {/* ขยายรูป */}
      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <TouchableOpacity style={s.zoomBackdrop} activeOpacity={1} onPress={() => setZoom(null)}>
          {zoom && (
            <View style={s.zoomWrap}>
              <Image source={{ uri: zoom.url }} style={s.zoomImg} resizeMode="contain" />
              <Text style={s.zoomStamp}>{zoom.stamp}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Modal>

      {/* อนุมัติ / ปฏิเสธ */}
      <Modal visible={!!decision} transparent animationType="fade" onRequestClose={() => setDecision(null)}>
        <View style={s.backdrop}>
          {decision && (
            <View style={s.sheet}>
              <Text style={s.sheetTitle}>
                {decision.approve
                  ? decision.req.kind === "return" ? "ตรวจสภาพตอนคืน" : `อนุมัติ${KIND[decision.req.kind].label}`
                  : `ปฏิเสธ${KIND[decision.req.kind].label}`}
                {" "}{decision.req.items?.item_code}
              </Text>

              {decision.approve && decision.req.kind === "return" && (
                <>
                  <Text style={s.label}>ผลตรวจสภาพ (ผู้ดูแลตรวจเอง)</Text>
                  <View style={s.chipRow}>
                    <TouchableOpacity
                      style={[s.chip, decision.condition === "good" && { backgroundColor: C.green, borderColor: C.green }]}
                      onPress={() => setDecision({ ...decision, condition: "good" })}
                      activeOpacity={0.85}
                    >
                      <Text style={[s.chipText, decision.condition === "good" && { color: "#fff" }]}>ปกติ → ว่าง</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.chip, decision.condition === "damaged" && { backgroundColor: C.red, borderColor: C.red }]}
                      onPress={() => setDecision({ ...decision, condition: "damaged" })}
                      activeOpacity={0.85}
                    >
                      <Text style={[s.chipText, decision.condition === "damaged" && { color: "#fff" }]}>ชำรุด → ซ่อม</Text>
                    </TouchableOpacity>
                  </View>
                  {decision.condition === "damaged" && (
                    <TextInput
                      style={s.input}
                      value={decision.cost}
                      onChangeText={(cost) => setDecision({ ...decision, cost })}
                      placeholder="ค่าเสียหาย (บาท) ไม่บังคับ"
                      placeholderTextColor={C.faint}
                      keyboardType="numeric"
                    />
                  )}
                </>
              )}

              <TextInput
                style={[s.input, { minHeight: 70 }]}
                value={decision.note}
                onChangeText={(note) => setDecision({ ...decision, note })}
                placeholder={decision.approve ? "หมายเหตุ (ไม่บังคับ)" : "เหตุผลที่ปฏิเสธ (จำเป็น) — ผู้ขอจะเห็นข้อความนี้"}
                placeholderTextColor={C.faint}
                multiline
              />

              <TouchableOpacity
                style={[s.sheetPrimary, { backgroundColor: decision.approve ? C.green : C.red }, (!decisionReady || saving) && { opacity: 0.45 }]}
                disabled={!decisionReady || saving}
                onPress={submitDecision}
                activeOpacity={0.85}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={s.sheetPrimaryText}>{decision.approve ? "ยืนยัน" : "ยืนยันปฏิเสธ"}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.sheetCancel} onPress={() => setDecision(null)} activeOpacity={0.8}>
                <Text style={s.sheetCancelText}>ยกเลิก</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  header: { ...W.headerBar,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 10,
    marginBottom: 8,
  },
  iconBtn: {
    ...W.iconBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#172033", fontSize: 21, fontWeight: "900" },
  headerSub: { color: "#475569", fontSize: 12, fontWeight: "700", marginTop: 2 },

  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", borderWidth: 1, borderColor: C.line },
  tabActive: { ...NG, backgroundColor: C.purple, borderColor: C.purple },
  tabText: { color: C.muted, fontWeight: "800", fontSize: 13 },
  tabTextActive: { color: "#fff" },

  list: { padding: 16, gap: 12 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { color: C.faint, fontSize: 14, fontWeight: "800" },

  card: { ...W.card, padding: 14, gap: 10 },
  cardFocus: { borderColor: C.purple, borderWidth: 2 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kindPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  kindText: { fontSize: 12, fontWeight: "900" },
  countdown: { fontSize: 12, fontWeight: "900", color: C.orange },
  cardBody: { flexDirection: "row", gap: 12 },
  code: { fontSize: 18, fontWeight: "900", color: C.ink },
  meta: { fontSize: 12.5, fontWeight: "700", color: C.muted },
  metaFaint: { fontSize: 12, color: C.faint, fontWeight: "600" },
  detail: { fontSize: 12.5, fontWeight: "800", color: C.ink, marginTop: 2 },

  photo: { width: 96, height: 96, borderRadius: 12, backgroundColor: "#f1f5f9" },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  stamp: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    color: "#fff",
    fontSize: 8.5,
    fontWeight: "700",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  compare: { flexDirection: "row", alignItems: "center", gap: 10 },
  compareLabel: { fontSize: 12, fontWeight: "800", color: C.muted },

  actions: { flexDirection: "row", gap: 10 },
  selfNote: { fontSize: 13, fontWeight: "700", color: "#b45309", backgroundColor: "#fffbeb", padding: 10, borderRadius: 10, overflow: "hidden" },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  btnDecline: { borderWidth: 1.5, borderColor: C.red, backgroundColor: "#fff", flex: 0.6 },
  btnDeclineText: { color: C.red, fontWeight: "900" },
  btnApprove: { backgroundColor: C.green },
  btnApproveText: { color: "#fff", fontWeight: "900" },

  zoomBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center", padding: 16 },
  zoomWrap: { width: "100%", maxWidth: 520, alignItems: "center", gap: 10 },
  zoomImg: { width: "100%", height: 420 },
  zoomStamp: { color: "#fff", fontSize: 14, fontWeight: "800" },

  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28, gap: 10 },
  sheetTitle: { fontSize: 18, fontWeight: "900", color: C.ink },
  label: { fontSize: 12, fontWeight: "800", color: C.muted },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: { flex: 1, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingVertical: 11, alignItems: "center", backgroundColor: "#f8fafc" },
  chipText: { fontWeight: "900", color: C.muted },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, fontSize: 14, color: C.ink, textAlignVertical: "top" },
  sheetPrimary: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  sheetPrimaryText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  sheetCancel: { alignItems: "center", paddingVertical: 8 },
  sheetCancelText: { color: C.muted, fontWeight: "800" },
});
