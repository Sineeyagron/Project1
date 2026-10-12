import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput } from "../AppText";
import Countdown from "../Countdown";
import PickupInbox from "../PickupInbox";
import { who } from "../../lib/people";
import { photoStamp } from "../../lib/borrowPhotos";
import { Role } from "../../lib/roles";
import { C } from "../../lib/theme";

// กล่องคำขอแบบจอใหญ่ (เว็บบนคอม): รายการซ้าย + รายละเอียด/ฟอร์มตัดสินขวา
//   ข้อมูล/การตัดสินมาจาก app/admin/requests.tsx ทั้งหมด (decide_request ตัวเดิม กติกาเดิม) — ไฟล์นี้แค่จัดหน้า
//   คีย์บอร์ด: ↑↓ เลือกคำขอ (ui-ux-pro-max: ทุกอย่างต้องทำได้ด้วยคีย์บอร์ด)

type Decision = { req: any; approve: boolean; condition: "good" | "damaged" | null; cost: string; note: string };
type Pill = { label: string; color: string; bg: string; icon?: any };

type Props = {
  tab: "pending" | "pickup" | "history";
  setTab: (t: "pending" | "pickup" | "history") => void;
  pending: any[];
  history: any[];
  pickupCount: number;
  setPickupCount: (n: number) => void;
  loading: boolean;
  focusId?: string;
  role: Role | null;
  userId: string | null;
  photoUrls: Record<string, string>;
  onZoom: (z: { url: string; stamp: string }) => void;
  decision: Decision | null;
  setDecision: (d: Decision | null) => void;
  decisionReady: boolean;
  saving: boolean;
  onSubmit: () => void;
  onReload: () => void;
  KIND: Record<string, Pill>;
  RESULT: Record<string, Pill>;
};

const thaiDate = (v?: string | null) =>
  v ? new Date(`${v}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-";
const thaiDateTime = (v?: string | null) =>
  v ? new Date(v).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

export default function RequestsDesktop(p: Props) {
  const list = p.tab === "pending" ? p.pending : p.history;
  const [selectedId, setSelectedId] = useState<string | null>(p.focusId || null);
  const sel = useMemo(() => list.find((r) => r.id === selectedId) || null, [list, selectedId]);

  // รายการเปลี่ยน (ตัดสินแล้ว/หมดเวลา/สลับแท็บ) และตัวที่เลือกหายไป → เลือกตัวแรก (ตัวที่เปิดจากแจ้งเตือนอยู่บนสุดอยู่แล้ว)
  useEffect(() => {
    if (p.tab === "pickup") return;
    if (!list.some((r) => r.id === selectedId)) setSelectedId(list[0]?.id ?? null);
  }, [list, p.tab]);

  // เลือกคำขอที่รอ → เตรียมฟอร์มอนุมัติไว้ (กด "ปฏิเสธ" เพื่อสลับ) · คำขอของตัวเอง (TA) / ประวัติ = ไม่มีฟอร์ม
  const isSelf = !!sel && p.role !== "admin" && sel.user_id === p.userId;
  useEffect(() => {
    if (!sel || sel.status !== "pending" || isSelf) {
      if (p.decision) p.setDecision(null);
      return;
    }
    if (p.decision?.req.id !== sel.id) {
      p.setDecision({ req: sel, approve: true, condition: sel.kind === "return" ? sel.condition ?? null : null, cost: "", note: "" });
    }
  }, [sel?.id, isSelf]);

  // ↑↓ เลือกรายการ (ไม่กินปุ่มตอนกำลังพิมพ์ในช่อง)
  useEffect(() => {
    if (Platform.OS !== "web" || p.tab === "pickup") return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const i = list.findIndex((r) => r.id === selectedId);
      const next = list[Math.min(list.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))];
      if (next) { e.preventDefault(); setSelectedId(next.id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list, selectedId, p.tab]);

  const d = p.decision && sel && p.decision.req.id === sel.id ? p.decision : null;
  const patch = (x: Partial<Decision>) => d && p.setDecision({ ...d, ...x });

  const Photo = ({ path, code, at, label }: { path?: string; code?: string; at?: string; label: string }) => {
    const url = path ? p.photoUrls[path] : null;
    const stamp = photoStamp(code, at);
    return (
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={s.photoLabel}>{label}</Text>
        {url ? (
          <Pressable onPress={() => p.onZoom({ url, stamp })} accessibilityLabel={`ขยายรูป${label}`}>
            <Image source={{ uri: url }} style={s.photo} />
            <Text style={s.stamp} numberOfLines={1}>{stamp}</Text>
          </Pressable>
        ) : (
          <View style={[s.photo, s.photoEmpty]}><Ionicons name="image-outline" size={26} color="#94A3B8" /></View>
        )}
      </View>
    );
  };

  const TabBtn = ({ k, label }: { k: Props["tab"]; label: string }) => (
    <Pressable onPress={() => p.setTab(k)} style={({ hovered }: any) => [s.tab, p.tab === k && s.tabOn, hovered && p.tab !== k && s.hover]}>
      <Text style={[s.tabText, p.tab === k && s.tabTextOn]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={s.page}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>กล่องคำขอ</Text>
          <Text style={s.sub}>ยืม · คืน · ยืมต่อ · นัดรับ ที่นักศึกษาส่งมา</Text>
        </View>
        <TabBtn k="pending" label={`รอดำเนินการ (${p.pending.length})`} />
        <TabBtn k="pickup" label={`นัดรับ (${p.pickupCount})`} />
        <TabBtn k="history" label="ประวัติ" />
        <Pressable onPress={p.onReload} style={({ hovered }: any) => [s.iconBtn, hovered && s.hover]} accessibilityLabel="รีเฟรช">
          <Ionicons name="refresh" size={18} color={C.primaryDark} />
        </Pressable>
      </View>

      {p.tab === "pickup" ? (
        // นัดรับ: ใช้กล่องเดิม (ยังไม่มีแบบจอใหญ่) วางกลางพื้นที่
        <ScrollView contentContainerStyle={s.pickupWrap}>
          <View style={s.pickupCol}>
            <PickupInbox role={p.role} userId={p.userId} onCount={p.setPickupCount} />
          </View>
        </ScrollView>
      ) : p.loading ? (
        <ActivityIndicator size="large" color={C.primary} style={{ marginTop: 60 }} />
      ) : (
        <View style={s.split}>
          {/* ซ้าย: รายการ */}
          <View style={[s.card, s.listCard]}>
            <View style={[s.row, s.rowHead]}>
              <Text style={[s.th, { width: 92 }]}>ประเภท</Text>
              <Text style={[s.th, { flex: 1 }]}>อุปกรณ์ · ผู้ขอ</Text>
              <Text style={[s.th, { width: 110, textAlign: "right" }]}>{p.tab === "pending" ? "เหลือเวลา" : "ผล"}</Text>
            </View>
            {list.length === 0 ? (
              <View style={s.empty}>
                <Ionicons name={p.tab === "pending" ? "checkmark-done-circle-outline" : "file-tray-outline"} size={40} color="#CBD5E1" />
                <Text style={s.emptyText}>{p.tab === "pending" ? "ไม่มีคำขอที่รออยู่" : "ยังไม่มีประวัติ"}</Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }}>
                {list.map((r) => {
                  const k = p.KIND[r.kind] ?? p.KIND.borrow;
                  const res = p.RESULT[r.status];
                  const on = r.id === selectedId;
                  return (
                    <Pressable
                      key={r.id}
                      onPress={() => setSelectedId(r.id)}
                      style={({ hovered }: any) => [s.row, hovered && !on && s.hover, on && s.rowOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <View style={{ width: 92 }}>
                        <View style={[s.pill, { backgroundColor: k.bg }]}>
                          <Text style={[s.pillText, { color: k.color }]}>{k.label.replace("ขอ", "")}{r.kind !== "return" && r.days ? ` ${r.days} วัน` : ""}</Text>
                        </View>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.code} numberOfLines={1}>{r.items?.item_code || r.items?.name || "อุปกรณ์"}</Text>
                        <Text style={s.who} numberOfLines={1}>{who(r.requester)}</Text>
                      </View>
                      <View style={{ width: 110, alignItems: "flex-end" }}>
                        {r.status === "pending" ? (
                          <Countdown until={r.expires_at} onDone={p.onReload} style={s.countdown} />
                        ) : res ? (
                          <View style={[s.pill, { backgroundColor: res.bg }]}><Text style={[s.pillText, { color: res.color }]}>{res.label}</Text></View>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {list.length > 1 ? <Text style={s.hint}>↑ ↓ เลือกรายการ</Text> : null}
          </View>

          {/* ขวา: รายละเอียด + ฟอร์มตัดสิน */}
          <View style={[s.card, s.detailCard]}>
            {!sel ? (
              <View style={s.empty}>
                <Ionicons name="hand-left-outline" size={36} color="#CBD5E1" />
                <Text style={s.emptyText}>เลือกคำขอทางซ้ายเพื่อดูรายละเอียด</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
                <View style={s.detailHead}>
                  <View style={[s.pill, { backgroundColor: (p.KIND[sel.kind] ?? p.KIND.borrow).bg }]}>
                    <Text style={[s.pillText, { color: (p.KIND[sel.kind] ?? p.KIND.borrow).color }]}>{(p.KIND[sel.kind] ?? p.KIND.borrow).label}</Text>
                  </View>
                  <Text style={s.detailCode} numberOfLines={1}>{sel.items?.item_code || sel.items?.name}</Text>
                  {sel.status === "pending" ? (
                    <Countdown until={sel.expires_at} onDone={p.onReload} style={s.countdown} />
                  ) : null}
                </View>
                <View style={{ gap: 3 }}>
                  <Text style={s.info}>{who(sel.requester)}</Text>
                  <Text style={s.infoFaint}>{sel.items?.name} · ห้อง {sel.borrow_locations?.name || "-"} · ส่งเมื่อ {thaiDateTime(sel.created_at)}</Text>
                  {sel.kind === "borrow" ? <Text style={s.info}>ยืม {sel.days} วัน</Text> : null}
                  {sel.kind === "renew" ? <Text style={s.info}>ต่ออีก {sel.days} วัน (เดิมครบ {thaiDate(sel.record?.due_date)})</Text> : null}
                  {sel.kind === "return" && sel.record?.due_date ? <Text style={s.infoFaint}>กำหนดคืน {thaiDate(sel.record.due_date)}</Text> : null}
                  {sel.condition ? (
                    <Text style={[s.info, { color: sel.condition === "damaged" ? "#DC2626" : "#047857" }]}>
                      ผู้ขอแจ้งสภาพ: {sel.condition === "damaged" ? "ชำรุด" : "ปกติ"}{sel.condition_note ? ` — ${sel.condition_note}` : ""}
                    </Text>
                  ) : null}
                </View>

                {sel.kind !== "renew" ? (
                  <View style={s.photos}>
                    <Photo path={sel.photo_path} code={sel.items?.item_code} at={sel.created_at} label={sel.kind === "return" ? "รูปตอนคืน" : "รูปตอนขอยืม"} />
                    {sel.kind === "return" && sel.record?.borrow_photo_path ? (
                      <Photo path={sel.record.borrow_photo_path} code={sel.items?.item_code} at={sel.record.borrow_date} label="เทียบรูปตอนยืม" />
                    ) : null}
                  </View>
                ) : null}

                {sel.status !== "pending" ? (
                  <View style={s.decided}>
                    <Text style={s.infoFaint}>
                      {sel.decider?.email ? `โดย ${sel.decider.email} · ` : ""}{thaiDateTime(sel.decided_at)}
                    </Text>
                    {sel.decision_note ? <Text style={s.info}>{sel.decision_note}</Text> : null}
                  </View>
                ) : isSelf ? (
                  <Text style={s.selfNote}>คำขอของคุณเอง — ให้ผู้ดูแลคนอื่นเป็นคนตัดสิน</Text>
                ) : d ? (
                  <View style={s.form}>
                    {/* อนุมัติ / ปฏิเสธ */}
                    <View style={s.seg}>
                      <Pressable onPress={() => patch({ approve: true })} style={[s.segBtn, d.approve && s.segApprove]}>
                        <Text style={[s.segText, d.approve && { color: "#fff" }]}>{sel.kind === "return" ? "รับคืน" : "อนุมัติ"}</Text>
                      </Pressable>
                      <Pressable onPress={() => patch({ approve: false })} style={[s.segBtn, !d.approve && s.segDecline]}>
                        <Text style={[s.segText, !d.approve && { color: "#fff" }]}>ปฏิเสธ</Text>
                      </Pressable>
                    </View>

                    {d.approve && sel.kind === "return" ? (
                      <>
                        <Text style={s.label}>ผลตรวจสภาพ (ผู้ดูแลตรวจเอง)</Text>
                        <View style={s.seg}>
                          <Pressable onPress={() => patch({ condition: "good" })} style={[s.segBtn, d.condition === "good" && s.segApprove]}>
                            <Text style={[s.segText, d.condition === "good" && { color: "#fff" }]}>ปกติ → ว่าง</Text>
                          </Pressable>
                          <Pressable onPress={() => patch({ condition: "damaged" })} style={[s.segBtn, d.condition === "damaged" && s.segDecline]}>
                            <Text style={[s.segText, d.condition === "damaged" && { color: "#fff" }]}>ชำรุด → ซ่อม</Text>
                          </Pressable>
                        </View>
                        {d.condition === "damaged" ? (
                          <TextInput style={s.input} value={d.cost} onChangeText={(cost) => patch({ cost })} placeholder="ค่าเสียหาย (บาท) ไม่บังคับ" placeholderTextColor="#94A3B8" keyboardType="numeric" />
                        ) : null}
                      </>
                    ) : null}

                    <TextInput
                      style={[s.input, { minHeight: 76 }]}
                      value={d.note}
                      onChangeText={(note) => patch({ note })}
                      placeholder={d.approve ? "หมายเหตุ (ไม่บังคับ)" : "เหตุผลที่ปฏิเสธ (จำเป็น) — ผู้ขอจะเห็นข้อความนี้"}
                      placeholderTextColor="#94A3B8"
                      multiline
                    />

                    <Pressable
                      onPress={p.onSubmit}
                      disabled={!p.decisionReady || p.saving}
                      style={[s.submit, { backgroundColor: d.approve ? "#047857" : "#DC2626" }, (!p.decisionReady || p.saving) && { opacity: 0.45 }]}
                    >
                      {p.saving ? <ActivityIndicator color="#fff" /> : (
                        <Text style={s.submitText}>
                          {d.approve ? (sel.kind === "return" ? "ยืนยันรับคืน" : "ยืนยันอนุมัติ") : "ยืนยันปฏิเสธ"}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, padding: 28, gap: 18, maxWidth: 1280, width: "100%", alignSelf: "center" },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 26, fontWeight: "900", color: C.ink },
  sub: { fontSize: 13, color: "#64748B", marginTop: 2 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#DCE6F5", backgroundColor: "#fff" },
  tabOn: { backgroundColor: C.primary, borderColor: C.primary },
  tabText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  tabTextOn: { color: "#fff" },
  iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#DCE6F5", alignItems: "center", justifyContent: "center", marginLeft: 4 },
  hover: { backgroundColor: "#F3F7FD" },
  split: { flex: 1, flexDirection: "row", gap: 18, minHeight: 0 },
  card: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#DCE6F5", overflow: "hidden" },
  listCard: { flex: 1.05 },
  detailCard: { flex: 1, padding: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  rowHead: { backgroundColor: "#FAFCFF", paddingVertical: 9 },
  rowOn: { backgroundColor: "#EFF5FF", boxShadow: `inset 3px 0 0 ${C.primary}` } as any,
  th: { fontSize: 11.5, fontWeight: "700", color: "#94A3B8" },
  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 11.5, fontWeight: "800" },
  code: { fontSize: 14, fontWeight: "800", color: C.ink },
  who: { fontSize: 12, color: "#64748B", marginTop: 1 },
  countdown: { fontSize: 12.5, fontWeight: "800", color: "#B45309" },
  hint: { fontSize: 11.5, color: "#94A3B8", paddingHorizontal: 16, paddingVertical: 10 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13.5, color: "#64748B", fontWeight: "600" },
  detailHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailCode: { flex: 1, fontSize: 20, fontWeight: "900", color: C.ink },
  info: { fontSize: 13.5, color: C.ink, fontWeight: "600" },
  infoFaint: { fontSize: 12.5, color: "#64748B" },
  photos: { flexDirection: "row", gap: 12 },
  photoLabel: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: "#F1F5F9" },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  stamp: { position: "absolute", left: 8, bottom: 8, right: 8, fontSize: 11, color: "#fff", backgroundColor: "rgba(15,23,42,0.45)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  decided: { gap: 4, borderTopWidth: 1, borderTopColor: "#EEF2F8", paddingTop: 12 },
  selfNote: { fontSize: 13, color: "#B45309", backgroundColor: "#FFFBEB", borderRadius: 10, padding: 12 },
  form: { gap: 10, borderTopWidth: 1, borderTopColor: "#EEF2F8", paddingTop: 14 },
  label: { fontSize: 12.5, fontWeight: "800", color: "#475569" },
  seg: { flexDirection: "row", gap: 8 },
  segBtn: { flex: 1, borderWidth: 1, borderColor: "#DCE6F5", borderRadius: 12, paddingVertical: 10, alignItems: "center", backgroundColor: "#F8FAFC" },
  segApprove: { backgroundColor: "#047857", borderColor: "#047857" },
  segDecline: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  segText: { fontSize: 13.5, fontWeight: "800", color: "#475569" },
  input: { borderWidth: 1, borderColor: "#DCE6F5", borderRadius: 12, padding: 12, fontSize: 14, color: C.ink, textAlignVertical: "top", backgroundColor: "#FBFDFF" },
  submit: { borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  pickupWrap: { alignItems: "center", paddingBottom: 30 },
  pickupCol: { width: "100%", maxWidth: 560 },
});
