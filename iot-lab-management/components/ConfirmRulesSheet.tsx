import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import BottomSheet from "./BottomSheet";
import { fetchBorrowRules } from "../lib/borrowRules";
import { C, W, NG } from "../lib/theme";

// F1 ป๊อปอัปยืนยันก่อนส่ง ขอยืม / ขอคืน / ขอยืมต่อ (ระบบยืม-คืน)
// กฎชุดเดียวกันทุกแบบ · ต้องติ๊กยอมรับก่อนกดยืนยัน (ไม่จำค่าติ๊กข้ามครั้ง) — ด่านจริงอยู่ใน RPC

export type SummaryRow = { label: string; value: string; old?: string; tone?: "ok" | "bad" };

export default function ConfirmRulesSheet({
  visible,
  title,
  confirmLabel,
  item,
  rows,
  submitting,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  confirmLabel: string;
  item: { code: string; name: string; image_url?: string } | null;
  rows: SummaryRow[];
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [rules, setRules] = useState<string[] | null>(null);
  const [accepted, setAccepted] = useState(false);

  // เปิดทุกครั้ง = เริ่มไม่ติ๊ก + โหลดกฎล่าสุด (Admin อาจเพิ่งแก้)
  useEffect(() => {
    if (!visible) return;
    setAccepted(false);
    fetchBorrowRules().then(setRules);
  }, [visible]);

  const canConfirm = accepted && !submitting;

  return (
    <BottomSheet visible={visible} onClose={submitting ? () => {} : onClose} style={s.sheet}>
      <View style={s.handle} />
      <Text style={s.title}>{title}</Text>

      {item ? (
        <View style={s.itemCard}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={s.itemImage} />
          ) : (
            <View style={[s.itemImage, s.itemImageEmpty]}>
              <Ionicons name="cube-outline" size={20} color={C.primary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.itemCode}>{item.code}</Text>
            <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
          </View>
        </View>
      ) : null}

      <View style={s.rows}>
        {rows.map((r) => (
          <View key={r.label} style={s.row}>
            <Text style={s.rowLabel}>{r.label}</Text>
            <Text style={[s.rowValue, r.tone === "ok" && { color: C.successInk }, r.tone === "bad" && { color: C.errorInk }]}>
              {r.old ? <Text style={s.rowOld}>{r.old}</Text> : null}
              {r.old ? "  →  " : ""}
              {r.value}
            </Text>
          </View>
        ))}
      </View>

      <Text style={s.rulesTitle}>กฎการยืม-คืน</Text>
      <View style={s.rulesBox}>
        {rules ? (
          <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 12, gap: 6 }}>
            {rules.map((t, i) => (
              <View key={i} style={s.rule}>
                <Text style={s.ruleNo}>{i + 1}.</Text>
                <Text style={s.ruleText}>{t}</Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <ActivityIndicator color={C.primary} style={{ margin: 16 }} />
        )}
      </View>

      <TouchableOpacity
        style={s.check}
        onPress={() => setAccepted((v) => !v)}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
      >
        <View style={[s.box, accepted && s.boxOn]}>
          {accepted ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
        </View>
        <Text style={s.checkText}>ฉันอ่านและยอมรับกฎการยืม-คืนแล้ว</Text>
      </TouchableOpacity>

      <View style={s.btnRow}>
        <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={submitting} activeOpacity={0.85}>
          <Text style={s.cancelText}>ยกเลิก</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.confirmBtn, !canConfirm && s.disabled]}
          onPress={onConfirm}
          disabled={!canConfirm}
          activeOpacity={0.85}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmText}>{confirmLabel}</Text>}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: { ...W.sheet, padding: 20, paddingTop: 0, paddingBottom: 36, gap: 10, maxHeight: "88%" },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#CBD5E1", marginTop: 10, marginBottom: 2 },
  title: { fontSize: 18, fontWeight: "700", color: C.ink },

  itemCard: { ...W.card, flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  itemImage: { width: 46, height: 46, borderRadius: 14 },
  itemImageEmpty: { backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  itemCode: { fontSize: 15, fontWeight: "700", color: C.ink },
  itemName: { fontSize: 12, color: C.muted, marginTop: 1 },

  rows: { gap: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  rowLabel: { fontSize: 13, color: C.muted },
  rowValue: { flexShrink: 1, textAlign: "right", fontSize: 13, fontWeight: "600", color: C.ink },
  rowOld: { color: C.faint, fontWeight: "400", textDecorationLine: "line-through" },

  rulesTitle: { fontSize: 14, fontWeight: "700", color: C.ink, marginTop: 2 },
  rulesBox: { maxHeight: 250, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: "#F8FAFF" },
  rule: { flexDirection: "row", gap: 6 },
  ruleNo: { width: 18, fontSize: 13, lineHeight: 20, color: C.primary, fontWeight: "700" },
  ruleText: { flex: 1, fontSize: 13, lineHeight: 20, color: C.text2 },

  check: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: "#93C5FD", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  boxOn: { ...NG, backgroundColor: C.primary, borderColor: C.primary },
  checkText: { flex: 1, fontSize: 14, fontWeight: "600", color: C.ink },

  btnRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  cancelBtn: { ...W.small, flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center" },
  cancelText: { color: C.muted, fontSize: 15, fontWeight: "600" },
  confirmBtn: { ...W.primary, flex: 2, minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  confirmText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.45 },
});
