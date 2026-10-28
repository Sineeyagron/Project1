import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, LayoutChangeEvent, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput } from "./AppText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import supabase from "../lib/supabase";
import { fetchBorrowRules } from "../lib/borrowRules";
import { notify } from "../lib/notify";
import { C, W, NG } from "../lib/theme";

// F2 ขอยืมแบบนัดรับ (ระบบยืม-คืน): เลือกรุ่นจากหน้าอุปกรณ์ ไม่ต้องสแกน → ผู้ดูแลนัดเวลาให้
// กติกาทั้งหมดอยู่ใน RPC request_pickup (โควตา / ของว่างหลังหักนัด / ซ้ำ)
// เนื้อหาฟอร์ม — แสดงในแผ่นมาตรฐานของ iOS (app/pickup-sheet.tsx, presentation "formSheet")
//   ScrollView ต้องเต็มแผ่นพอดี (flex 1, ไม่มี padding รอบนอก) — แผ่นของ iOS จับ ScrollView ตัวแรกไปยืดชิดขอบแผ่น
//   ถ้ามี padding ข้างนอก ScrollView ตัวหนังสือจะชิดซ้ายจนตกขอบ (เจอบน iPhone 11 ต.ค. 2569) → padding อยู่ใน View ข้างในแทน
export default function PickupRequestForm({
  model,
  onClose,
  onSent,
  onLayout,
}: {
  model: { key: string; name: string };
  onClose: () => void;
  onSent: () => void;
  onLayout?: (e: LayoutChangeEvent) => void; // วัดความสูงเนื้อหาจริง (lib/sheetFit)
}) {
  const [dayOptions, setDayOptions] = useState<number[]>([3, 5, 7]);
  const [days, setDays] = useState(3);
  const [note, setNote] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState<string[] | null>(null);
  const [sending, setSending] = useState(false);
  const [limits, setLimits] = useState({ hours: 12, grace: 10 });
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!model) return;
    setNote("");
    setAccepted(false);
    setShowRules(false);
    supabase.from("app_settings").select("key, value")
      .in("key", ["borrow_day_options", "pickup_expiry_hours", "pickup_grace_minutes"])
      .then(({ data }) => {
        const rows = data || [];
        const d = rows.find((r: any) => r.key === "borrow_day_options")?.value;
        const v = Array.isArray(d) ? (d as any[]).map(Number).filter((n) => n > 0) : [];
        const opts = v.length ? v : [3, 5, 7];
        setDayOptions(opts);
        setDays(opts[0]);
        // เวลาหมดอายุ/ผ่อนผัน ตั้งได้ที่ admin/settings (ฐานข้อมูลใช้ค่าเดียวกัน)
        const num = (key: string, fallback: number) => {
          const n = Number(rows.find((r: any) => r.key === key)?.value);
          return Number.isInteger(n) && n > 0 ? n : fallback;
        };
        setLimits({ hours: num("pickup_expiry_hours", 12), grace: num("pickup_grace_minutes", 10) });
      });
    fetchBorrowRules().then(setRules);
  }, [model?.key]);

  const lock = useRef(false); // กันกดรัว — ครั้งที่ 2 จะเด้ง "มีคำขอนัดรับรุ่นนี้อยู่แล้ว" ทับข้อความสำเร็จ
  const send = async () => {
    if (!model || !accepted || lock.current) return;
    lock.current = true;
    setSending(true);
    const { error } = await supabase.rpc("request_pickup", { p_prefix: model.key, p_days: days, p_note: note.trim() });
    lock.current = false;
    setSending(false);
    if (error) {
      notify("ส่งคำขอไม่สำเร็จ", error.message);
      return;
    }
    notify("ส่งคำขอนัดรับแล้ว", "ผู้ดูแลจะนัดเวลาให้ ดูสถานะได้ที่หน้าประวัติการยืม");
    onSent();
  };

  return (
    // ลากเนื้อหาลง = ซ่อนแป้นพิมพ์
    <ScrollView style={s.fill} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]} onLayout={onLayout}>
        <Text style={s.title}>ขอยืมแบบนัดรับ · {model?.name}</Text>
        <Text style={s.sub}>ไม่มีผู้ดูแลเปิดตู้ตอนนี้? ฝากคำขอไว้ ผู้ดูแลจะนัดเวลาให้</Text>

        <Text style={s.label}>ระยะเวลายืม</Text>
        <View style={s.chipRow}>
          {dayOptions.map((d) => (
            <TouchableOpacity key={d} style={[s.chip, days === d && s.chipActive]} onPress={() => setDays(d)} activeOpacity={0.85}>
              <Text style={[s.chipText, days === d && s.chipTextActive]}>{d} วัน</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>หมายเหตุ (ไม่บังคับ)</Text>
        <TextInput
          style={s.input}
          value={note}
          onChangeText={setNote}
          placeholder="เช่น สะดวกช่วงบ่าย"
          placeholderTextColor={C.faint}
          maxLength={200}
          multiline
        />

        <View style={s.info}>
          <InfoRow icon="calendar-outline" text="ผู้ดูแลเป็นคนกำหนดวัน-เวลานัดรับ แล้วแจ้งให้ทราบในแอป" />
          <InfoRow icon="timer-outline" text={`ถ้าไม่มีผู้ดูแลนัดภายใน ${limits.hours} ชั่วโมง คำขอจะหมดอายุ`} />
          <InfoRow icon="alert-circle-outline" text={`ถ้าเลยเวลานัด ${limits.grace} นาที นัดจะถูกยกเลิก · คำขอนัดรับนับรวมในจำนวนที่ยืมได้`} />
        </View>

        <TouchableOpacity style={s.check} onPress={() => setAccepted((v) => !v)} activeOpacity={0.8} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
          <View style={[s.box, accepted && s.boxOn]}>
            {accepted ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
          </View>
          <Text style={s.checkText}>ฉันอ่านและยอมรับกฎการยืม-คืนแล้ว</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowRules((v) => !v)} activeOpacity={0.8}>
          <Text style={s.link}>{showRules ? "ซ่อนกฎการยืม-คืน" : "อ่านกฎการยืม-คืน"}</Text>
        </TouchableOpacity>
        {showRules ? (
          <View style={s.rulesBox}>
            {(rules || []).map((t, i) => (
              <View key={i} style={s.rule}>
                <Text style={s.ruleNo}>{i + 1}.</Text>
                <Text style={s.ruleText}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.btnRow}>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose} disabled={sending} activeOpacity={0.85}>
            <Text style={s.cancelText}>ยกเลิก</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.confirmBtn, (!accepted || sending) && s.disabled]} onPress={send} disabled={!accepted || sending} activeOpacity={0.85}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmText}>ส่งคำขอนัดรับ</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={16} color={C.primary} style={{ marginTop: 2 }} />
      <Text style={s.infoText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.surface },
  sheet: { paddingHorizontal: 20, paddingTop: 24, gap: 10 },
  title: { fontSize: 18, fontWeight: "700", color: C.ink },
  sub: { fontSize: 13, color: C.text2, marginTop: -4 },
  label: { fontSize: 13, color: C.text2, marginTop: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: "#FFFFFF" },
  chipActive: { ...NG, backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 14, color: C.text2 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  input: { borderWidth: 1, borderColor: C.border, backgroundColor: "#F8FAFF", borderRadius: 14, padding: 12, minHeight: 46, fontSize: 14, color: C.ink, textAlignVertical: "top" },
  info: { gap: 6, padding: 12, borderRadius: 14, backgroundColor: C.primaryTint },
  infoRow: { flexDirection: "row", gap: 8 },
  infoText: { flex: 1, fontSize: 12.5, lineHeight: 19, color: C.primaryDark },
  check: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: "#93C5FD", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  boxOn: { ...NG, backgroundColor: C.primary, borderColor: C.primary },
  checkText: { flex: 1, fontSize: 14, fontWeight: "600", color: C.ink },
  link: { fontSize: 13, fontWeight: "600", color: C.primary, marginLeft: 34, marginTop: -6 },
  rulesBox: { borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: "#F8FAFF", padding: 12, gap: 6 },
  rule: { flexDirection: "row", gap: 6 },
  ruleNo: { width: 18, fontSize: 13, lineHeight: 20, color: C.primary, fontWeight: "700" },
  ruleText: { flex: 1, fontSize: 13, lineHeight: 20, color: C.text2 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { ...W.small, flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center" },
  cancelText: { color: C.muted, fontSize: 15, fontWeight: "600" },
  confirmBtn: { ...W.primary, flex: 2, minHeight: 52, alignItems: "center", justifyContent: "center" },
  confirmText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.45 },
});
