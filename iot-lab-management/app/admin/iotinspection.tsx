import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Alert, ActivityIndicator, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";

const CONDITION_CFG: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  good:    { color: "#16a34a", bg: "#dcfce7", label: "ปกติ",   icon: "checkmark-circle-outline" },
  damaged: { color: "#b45309", bg: "#fef3c7", label: "ชำรุด", icon: "construct-outline" },
  missing: { color: "#dc2626", bg: "#fee2e2", label: "หาย",   icon: "alert-circle-outline" },
};

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });

type ConditionKey = "good" | "damaged" | "missing";

export default function IotInspectionPage() {
  const router = useRouter();

  const [term, setTerm] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [borrowHistories, setBorrowHistories] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);

  // Modal form
  const [formModal, setFormModal] = useState(false);
  const [formItem, setFormItem] = useState<any>(null);
  const [formCondition, setFormCondition] = useState<ConditionKey>("good");
  const [formNotes, setFormNotes] = useState("");

  const fetchData = async () => {
    if (!term.trim()) { Alert.alert("กรุณาระบุเทอม"); return; }
    setLoading(true);
    setSearched(true);

    const [{ data: allItems }, { data: insp }] = await Promise.all([
      supabase.from("items").select("id, name, type, status").order("name"),
      supabase
        .from("item_inspections")
        .select("*")
        .eq("term", term.trim())
        .order("inspected_at", { ascending: false }),
    ]);

    setItems(allItems || []);
    setInspections(insp || []);

    // ดึงประวัติผู้ยืมสำหรับ item ที่มีปัญหา
    const problemItems = getProblems(insp || [], allItems || []);
    if (problemItems.length > 0) {
      await fetchBorrowHistories(problemItems.map((i: any) => i.item_id));
    }

    setLoading(false);
  };

  const fetchBorrowHistories = async (itemIds: string[]) => {
    const map: Record<string, any[]> = {};
    await Promise.all(
      itemIds.map(async (itemId) => {
        const { data } = await supabase
          .from("borrow_records")
          .select("id, created_at, due_date, status, profiles(full_name, email), items(name)")
          .eq("item_id", itemId)
          .order("created_at", { ascending: false })
          .limit(5);
        map[itemId] = data || [];
      })
    );
    setBorrowHistories(map);
  };

  const getLatestPerItem = (insp: any[]) => {
    const map: Record<string, any> = {};
    for (const r of insp) map[r.item_id] = r;
    return map;
  };

  const getProblems = (insp: any[], allItems: any[]) => {
    const latest = getLatestPerItem(insp);
    return Object.values(latest).filter((r) => r.condition !== "good");
  };

  const openForm = (item: any) => {
    setFormItem(item);
    const latest = getLatestPerItem(inspections);
    const existing = latest[item.id];
    setFormCondition(existing?.condition ?? "good");
    setFormNotes(existing?.notes ?? "");
    setFormModal(true);
  };

  const saveInspection = async () => {
    if (!term.trim()) { Alert.alert("กรุณาระบุเทอมก่อน"); return; }
    if (!formItem) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("item_inspections")
      .upsert(
        {
          term: term.trim(),
          item_id: formItem.id,
          condition: formCondition,
          notes: formNotes.trim() || null,
          inspector_id: user?.id || null,
          inspected_at: new Date().toISOString(),
        },
        { onConflict: "term,item_id" }
      );

    setSaving(false);

    if (error) { Alert.alert("เกิดข้อผิดพลาด", error.message); return; }

    Alert.alert("บันทึกสำเร็จ");
    setFormModal(false);

    // reload inspections
    const { data: insp } = await supabase
      .from("item_inspections")
      .select("*")
      .eq("term", term.trim())
      .order("inspected_at", { ascending: false });
    setInspections(insp || []);

    // refresh borrow histories if now a problem item
    if (formCondition !== "good") {
      const existingIds = Object.keys(borrowHistories);
      if (!existingIds.includes(formItem.id)) {
        await fetchBorrowHistories([...existingIds, formItem.id]);
      }
    }
  };

  const latestMap = getLatestPerItem(inspections);
  const problems = getProblems(inspections, items);

  return (
    <View style={st.container}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={st.headerTxt}>ตรวจสภาพ IoT ประจำเทอม</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">

        {/* ระบุเทอม */}
        <Text style={st.fieldLabel}>เทอมที่ตรวจ (เช่น 1/2568)</Text>
        <View style={st.inputRow}>
          <TextInput
            style={st.termInput}
            placeholder="1/2568"
            value={term}
            onChangeText={setTerm}
          />
          <TouchableOpacity style={st.searchBtn} onPress={fetchData}>
            <Ionicons name="search-outline" size={18} color="#fff" />
            <Text style={st.searchBtnTxt}>ค้นหา</Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator color="#7c3aed" style={{ marginVertical: 20 }} />}

        {/* รายการ items */}
        {searched && !loading && items.length > 0 && (
          <>
            <Text style={st.sectionLabel}>รายการอุปกรณ์ทั้งหมด ({items.length})</Text>
            {items.map((item) => {
              const insp = latestMap[item.id];
              const cfg = insp ? CONDITION_CFG[insp.condition] : null;
              return (
                <View key={item.id} style={st.itemRow}>
                  <View style={st.itemInfo}>
                    <Text style={st.itemName}>{item.name}</Text>
                    <Text style={st.itemType}>{item.type || "ไม่ระบุประเภท"}</Text>
                    {cfg ? (
                      <View style={[st.condBadge, { backgroundColor: cfg.bg }]}>
                        <Ionicons name={cfg.icon} size={12} color={cfg.color} />
                        <Text style={[st.condBadgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                    ) : (
                      <Text style={st.notInspected}>ยังไม่ได้ตรวจเทอมนี้</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[st.inspBtn, insp && { backgroundColor: "#0891b2" }]}
                    onPress={() => openForm(item)}
                  >
                    <Ionicons name={insp ? "create-outline" : "clipboard-outline"} size={16} color="#fff" />
                    <Text style={st.inspBtnTxt}>{insp ? "แก้ไข" : "ตรวจ"}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

        {searched && !loading && items.length === 0 && (
          <Text style={st.emptyTxt}>ไม่พบข้อมูลอุปกรณ์</Text>
        )}

        {/* สรุปปัญหา */}
        {problems.length > 0 && (
          <View style={st.summaryBox}>
            <Text style={st.summaryTitle}>สรุปปัญหาเทอม {term}</Text>
            {problems.map((insp) => {
              const item = items.find((i) => i.id === insp.item_id);
              const cfg = CONDITION_CFG[insp.condition];
              const borrows = borrowHistories[insp.item_id] || [];
              return (
                <View key={insp.id} style={st.problemBlock}>
                  {/* ── item header ── */}
                  <View style={[st.issueRow, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={[st.issueName, { color: cfg.color }]}>
                        {item?.name || "ไม่ทราบ"}
                      </Text>
                      <Text style={[st.issueStatus, { color: cfg.color }]}>{cfg.label}</Text>
                      {insp.notes ? <Text style={st.issueNote}>{insp.notes}</Text> : null}
                      <Text style={st.issueDate}>{formatDate(insp.inspected_at)}</Text>
                    </View>
                  </View>

                  {/* ── borrow history ── */}
                  {borrows.length > 0 && (
                    <View style={st.historyBox}>
                      <View style={st.historyHeader}>
                        <Ionicons name="time-outline" size={13} color="#7c3aed" />
                        <Text style={st.historyTitle}>ประวัติผู้ยืม 5 รายการล่าสุด</Text>
                      </View>
                      {borrows.map((b: any) => {
                        const profile = b.profiles;
                        const isOverdue =
                          b.due_date && b.status !== "returned" && new Date(b.due_date) < new Date();
                        return (
                          <View key={b.id} style={st.historyRow}>
                            <View style={st.historyAvatar}>
                              <Text style={st.historyAvatarTxt}>
                                {(profile?.full_name || profile?.email || "?")[0].toUpperCase()}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={st.historyName}>
                                {profile?.full_name || profile?.email || "ไม่ทราบ"}
                              </Text>
                              <Text style={st.historyDate}>ยืม {formatDate(b.created_at)}</Text>
                            </View>
                            <View style={[
                              st.historyStatus,
                              b.status === "returned" ? st.historyStatusReturned :
                              isOverdue ? st.historyStatusOverdue : st.historyStatusActive,
                            ]}>
                              <Text style={[
                                st.historyStatusTxt,
                                { color: b.status === "returned" ? "#16a34a" : isOverdue ? "#dc2626" : "#b45309" },
                              ]}>
                                {b.status === "returned" ? "คืนแล้ว" : isOverdue ? "เกินกำหนด" : "ยังยืมอยู่"}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                  {borrows.length === 0 && (
                    <Text style={st.noBorrowTxt}>ไม่มีประวัติการยืมในระบบ</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* MODAL */}
      <Modal visible={formModal} transparent animationType="slide">
        <View style={st.modalOverlay}>
          <View style={st.modalBox}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>
                {latestMap[formItem?.id] ? "แก้ไขผลตรวจ" : "ตรวจสภาพ"} — {formItem?.name}
              </Text>
              <TouchableOpacity onPress={() => setFormModal(false)}>
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={st.fieldLabel}>สภาพอุปกรณ์</Text>
            <View style={st.condRow}>
              {(["good", "damaged", "missing"] as const).map((c) => {
                const cfg = CONDITION_CFG[c];
                const active = formCondition === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[st.condBtn, { borderColor: cfg.color }, active && { backgroundColor: cfg.bg }]}
                    onPress={() => setFormCondition(c)}
                  >
                    <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                    <Text style={[st.condBtnTxt, { color: cfg.color }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {formCondition !== "good" && (
              <>
                <Text style={[st.fieldLabel, { marginTop: 12 }]}>หมายเหตุ</Text>
                <TextInput
                  style={st.notesInput}
                  placeholder="รายละเอียดความเสียหาย..."
                  value={formNotes}
                  onChangeText={setFormNotes}
                  multiline
                />
              </>
            )}

            <TouchableOpacity
              style={[st.saveBtn, saving && { backgroundColor: "#94a3b8" }]}
              onPress={saveInspection}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="save-outline" size={18} color="#fff" />
                  <Text style={st.saveBtnTxt}>บันทึก</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    backgroundColor: "#7c3aed", paddingTop: 50, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerTxt: { color: "#fff", fontSize: 17, fontWeight: "bold" },
  body: { padding: 16 },

  fieldLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
  },

  inputRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  termInput: {
    flex: 1, backgroundColor: "#fff", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "#e2e8f0", fontSize: 14,
  },
  searchBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#7c3aed", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchBtnTxt: { color: "#fff", fontWeight: "600", fontSize: 13 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
  },

  itemRow: {
    backgroundColor: "#fff", borderRadius: 12, padding: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 6, borderWidth: 1, borderColor: "#e2e8f0",
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  itemType: { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  notInspected: { fontSize: 11, color: "#94a3b8", marginTop: 4 },
  condBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, alignSelf: "flex-start", marginTop: 4 },
  condBadgeTxt: { fontSize: 11, fontWeight: "600" },

  inspBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#7c3aed", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
  },
  inspBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "600" },

  emptyTxt: { color: "#94a3b8", fontSize: 13, textAlign: "center", marginVertical: 20 },

  summaryBox: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    marginTop: 16, marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0",
  },
  summaryTitle: { fontSize: 13, fontWeight: "700", color: "#1e293b", marginBottom: 10 },

  problemBlock: { marginBottom: 12 },
  issueRow: {
    flexDirection: "row", gap: 10, borderRadius: 10,
    padding: 10, alignItems: "flex-start",
  },
  issueName: { fontSize: 13, fontWeight: "600" },
  issueStatus: { fontSize: 11, fontWeight: "600" },
  issueNote: { fontSize: 11, color: "#64748b", marginTop: 2 },
  issueDate: { fontSize: 10, color: "#94a3b8", marginTop: 2 },

  historyBox: {
    backgroundColor: "#faf5ff", borderRadius: 10, padding: 10,
    marginTop: 6, borderWidth: 1, borderColor: "#ede9fe",
  },
  historyHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  historyTitle: { fontSize: 11, fontWeight: "700", color: "#7c3aed" },
  historyRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#ede9fe",
  },
  historyAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#ede9fe", alignItems: "center", justifyContent: "center",
  },
  historyAvatarTxt: { fontSize: 13, fontWeight: "700", color: "#7c3aed" },
  historyName: { fontSize: 12, fontWeight: "600", color: "#1e293b" },
  historyDate: { fontSize: 10, color: "#94a3b8", marginTop: 1 },
  historyStatus: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7 },
  historyStatusReturned: { backgroundColor: "#dcfce7" },
  historyStatusOverdue: { backgroundColor: "#fee2e2" },
  historyStatusActive: { backgroundColor: "#fef3c7" },
  historyStatusTxt: { fontSize: 10, fontWeight: "600" },
  noBorrowTxt: { fontSize: 11, color: "#94a3b8", paddingVertical: 6, paddingHorizontal: 10 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b", flex: 1, marginRight: 8 },

  condRow: { flexDirection: "row", gap: 8 },
  condBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5,
    alignItems: "center", gap: 4,
  },
  condBtnTxt: { fontSize: 12, fontWeight: "600" },

  notesInput: {
    backgroundColor: "#f8fafc", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#e2e8f0", fontSize: 13,
    minHeight: 70, textAlignVertical: "top", marginBottom: 14,
  },
  saveBtn: {
    flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6,
    backgroundColor: "#7c3aed", padding: 14, borderRadius: 12, marginTop: 16,
  },
  saveBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
