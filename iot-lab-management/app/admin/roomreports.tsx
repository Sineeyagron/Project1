import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../../lib/supabase";
import { fetchRoomPeople } from "../../lib/roomPeople";
import { notify } from "../../lib/notify";
import { goBack, useRefreshOnFocus } from "../../lib/nav";
import { useRealtime } from "../../lib/realtime";
import LoadError from "../../components/LoadError";
import { W, NG } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";

// คิวคำแจ้งปัญหาจากนักศึกษา (ระบบห้อง R3) — Admin/TA รับเป็นงานซ่อม หรือปิดพร้อมเหตุผล
// ตัดสินผ่าน RPC decide_room_report (รับเครื่อง = สร้างงานซ่อม + เครื่องเป็น "กำลังซ่อม" / รับ LAN = port เป็น "กำลังซ่อม")

type Report = {
  id: string;
  kind: "station" | "lan";
  room_id: string;
  label: string;
  description: string;
  status: "open" | "accepted" | "closed";
  reported_by: string;
  reported_at: string;
  handled_by: string | null;
  handled_at: string | null;
  handle_note: string | null;
};

const STATUS_CFG: Record<Report["status"], { label: string; color: string; bg: string }> = {
  open: { label: "รอตรวจ", color: "#c2410c", bg: "#ffedd5" },
  accepted: { label: "รับเป็นงานซ่อม", color: "#047857", bg: "#ECFDF5" },
  closed: { label: "ปิดแล้ว", color: "#475569", bg: "#f1f5f9" },
};

const FILTERS = [
  { key: "open", label: "รอตรวจ" },
  { key: "accepted", label: "รับแล้ว" },
  { key: "closed", label: "ปิดแล้ว" },
  { key: "all", label: "ทั้งหมด" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

function timeText(d: string) {
  const date = new Date(d);
  return date.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function RoomReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterKey>("open");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  // หน้าต่างตัดสิน: accept = รับเป็นงานซ่อม / ปิด (ต้องมีเหตุผล)
  const [decision, setDecision] = useState<{ report: Report; accept: boolean } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("room_reports")
      .select("*")
      .order("reported_at", { ascending: false })
      .limit(200);
    setLoading(false);
    setRefreshing(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setLoadError("");
    const list = (data as Report[]) || [];
    setReports(list);
    // ชื่อผู้แจ้ง/ผู้จัดการ ("ชื่อ · รหัส นศ." — lib/roomPeople ของระบบห้อง)
    const ids = [...new Set(list.flatMap((r) => [r.reported_by, r.handled_by]).filter(Boolean))] as string[];
    if (ids.length) {
      setNames(await fetchRoomPeople(ids));
    }
  };

  useEffect(() => { load(); }, []);
  useRefreshOnFocus(() => load());
  // มีคำแจ้งใหม่ = ผู้ดูแลทุกคนได้แจ้งเตือน room_report → สัญญาณ Realtime ช่องของตัวเอง → โหลดคิวใหม่ทันที
  useRealtime("user", "notification", () => load());

  const counts = useMemo(() => ({
    open: reports.filter((r) => r.status === "open").length,
    accepted: reports.filter((r) => r.status === "accepted").length,
    closed: reports.filter((r) => r.status === "closed").length,
    all: reports.length,
  }), [reports]);

  const shown = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  const openDecision = (report: Report, accept: boolean) => {
    setNote("");
    setDecision({ report, accept });
  };

  const submitDecision = async () => {
    if (!decision) return;
    if (!decision.accept && !note.trim()) {
      notify("ใส่เหตุผลก่อน", "ผู้แจ้งจะเห็นเหตุผลในหน้าแจ้งเตือน เช่น เครื่องปกติ ลองรีสตาร์ทแล้วใช้ได้");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("decide_room_report", {
      p_id: decision.report.id,
      p_accept: decision.accept,
      p_note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      notify("ไม่สำเร็จ", error.message);
      load();
      return;
    }
    setDecision(null);
    notify(
      decision.accept ? "รับเรื่องแล้ว" : "ปิดคำแจ้งแล้ว",
      decision.accept
        ? decision.report.kind === "station"
          ? `สร้างงานซ่อม ${decision.report.label} แล้ว เครื่องเปลี่ยนเป็น "กำลังซ่อม"`
          : `${decision.report.label} เปลี่ยนเป็น "กำลังซ่อม" แล้ว`
        : "แจ้งผลให้ผู้แจ้งแล้ว"
    );
    load();
  };

  return (
    <View style={s.container}>
      <ScreenHeader
        title={"คำแจ้งปัญหาห้องคอม"}
        subtitle={`${counts.open} รายการรอตรวจ`}
        onBack={() => goBack("/admin/room")}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity key={f.key} style={[s.filterBtn, active && s.filterBtnActive]} onPress={() => setFilter(f.key)}>
              <Text style={[s.filterText, active && s.filterTextActive]}>{f.label} ({counts[f.key]})</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2563EB" />}
        >
          {!!loadError && <LoadError message={loadError} onRetry={load} />}
          {!loadError && shown.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="checkmark-done-outline" size={44} color="#cbd5e1" />
              <Text style={s.emptyText}>{filter === "open" ? "ไม่มีคำแจ้งรอตรวจ" : "ไม่มีรายการ"}</Text>
            </View>
          ) : null}

          {shown.map((r) => {
            const cfg = STATUS_CFG[r.status];
            return (
              <View key={r.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={[s.kindIcon, { backgroundColor: r.kind === "lan" ? "#DBEAFE" : "#dbeafe" }]}>
                    <Ionicons name={r.kind === "lan" ? "git-network-outline" : "desktop-outline"} size={18} color={r.kind === "lan" ? "#2563EB" : "#1d4ed8"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>{r.room_id} · {r.label}</Text>
                    <Text style={s.cardSub}>แจ้งโดย {names[r.reported_by] || "-"} · {timeText(r.reported_at)}</Text>
                  </View>
                  <View style={[s.pill, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.pillText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>

                <Text style={s.desc}>{r.description}</Text>

                {r.status !== "open" ? (
                  <Text style={s.handled}>
                    {names[r.handled_by || ""] || "-"} · {r.handled_at ? timeText(r.handled_at) : ""}
                    {r.handle_note ? ` · ${r.handle_note}` : ""}
                  </Text>
                ) : (
                  <View style={s.actions}>
                    <TouchableOpacity style={s.closeBtn} onPress={() => openDecision(r, false)}>
                      <Text style={s.closeBtnText}>ปิดคำแจ้ง</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.acceptBtn} onPress={() => openDecision(r, true)}>
                      <Ionicons name="construct-outline" size={15} color="#fff" />
                      <Text style={s.acceptBtnText}>รับเป็นงานซ่อม</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Modal visible={!!decision} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>
              {decision?.accept ? "รับเป็นงานซ่อม" : "ปิดคำแจ้ง"} · {decision?.report.room_id} {decision?.report.label}
            </Text>
            <Text style={s.modalDesc}>"{decision?.report.description}"</Text>
            <Text style={s.fieldLabel}>{decision?.accept ? "หมายเหตุ (ไม่บังคับ)" : "เหตุผล * (ผู้แจ้งจะเห็น)"}</Text>
            <TextInput
              style={s.input}
              value={note}
              onChangeText={setNote}
              placeholder={decision?.accept ? "เช่น จะเข้าไปดูพรุ่งนี้" : "เช่น เครื่องปกติ ลองรีสตาร์ทแล้วใช้ได้"}
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={300}
            />
            <View style={s.actions}>
              <TouchableOpacity style={s.closeBtn} onPress={() => setDecision(null)} disabled={saving}>
                <Text style={s.closeBtnText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[decision?.accept ? s.acceptBtn : s.rejectBtn, saving && { opacity: 0.6 }]}
                onPress={submitDecision}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={s.acceptBtnText}>{decision?.accept ? "ยืนยันรับเรื่อง" : "ยืนยันปิด"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  header: { ...W.headerBar, flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 52, paddingHorizontal: 16, paddingBottom: 10, marginBottom: 8 },
  iconBtn: { ...W.iconBtn, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#172033", fontSize: 18, fontWeight: "900" },
  headerSub: { color: "#475569", fontSize: 12, fontWeight: "800", marginTop: 2 },
  filterScroll: { maxHeight: 54 },
  filterRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#DCE6F5" },
  filterBtnActive: { ...NG, backgroundColor: "#2563EB", borderColor: "#2563EB" },
  filterText: { fontSize: 12, fontWeight: "800", color: "#475569" },
  filterTextActive: { color: "#fff" },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyText: { color: "#475569", fontSize: 14, fontWeight: "800" },
  card: { ...W.card, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  kindIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14, fontWeight: "900", color: "#172033" },
  cardSub: { fontSize: 12, color: "#475569", marginTop: 2 },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 10.5, fontWeight: "900" },
  desc: { fontSize: 14, color: "#172033", marginTop: 10, lineHeight: 20 },
  handled: { fontSize: 12, color: "#475569", marginTop: 8 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  closeBtn: { flex: 1, minHeight: 42, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  closeBtnText: { color: "#334155", fontWeight: "800", fontSize: 13 },
  acceptBtn: { flex: 2, minHeight: 42, borderRadius: 10, backgroundColor: "#047857", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  rejectBtn: { flex: 2, minHeight: 42, borderRadius: 10, backgroundColor: "#64748b", alignItems: "center", justifyContent: "center" },
  acceptBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  overlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.38)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#172033" },
  modalDesc: { fontSize: 13, color: "#475569", marginTop: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "900", color: "#475569", marginTop: 14, marginBottom: 6 },
  input: { minHeight: 70, borderRadius: 12, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#DCE6F5", padding: 12, fontSize: 14, color: "#172033", textAlignVertical: "top" },
});
