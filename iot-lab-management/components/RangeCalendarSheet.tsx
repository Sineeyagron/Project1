import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import BottomSheet from "./BottomSheet";
import {
  DateRange,
  EditSide,
  TH_MONTHS,
  TH_WEEKDAYS,
  dayRole,
  daysInclusive,
  monthCells,
  monthState,
  parseIso,
  pickDay,
  shiftMonth,
  thaiShort,
} from "../lib/calendar";
import { C, W, NG } from "../lib/theme";

// ปฏิทินเลือกช่วงวันที่ (แผ่นเลื่อนจากล่าง) — ใช้ซ้ำได้ทุกหน้า (ไม่ผูกระบบยืมหรือระบบห้อง) · ตรรกะอยู่ใน lib/calendar.ts
//   ช่อง วันเริ่ม | วันสิ้นสุด ด้านบน = กำลังแก้ช่องไหน (แก้ค้างไว้ ไม่เด้งเอง แตะสลับได้) · แตะวันเดิมซ้ำ = 1 วัน
//   แตะชื่อเดือน → ตาราง 12 เดือน (เปลี่ยนปีด้วย ‹ ›) · วันหลัง maxDate กดไม่ได้

const TH_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const CELLS = 42; // 6 แถว x 7 วัน — ทุกเดือนสูงเท่ากัน แผ่นไม่กระตุกตอนเปลี่ยนเดือน
const DAY = 38;
const ROW = DAY + 4;
const GRID_HEIGHT = ROW * 7; // หัววัน + 6 แถว — ตาราง 12 เดือนใช้ความสูงเท่ากัน

type View_ = { year: number; month0: number };
const monthOf = (iso: string): View_ => {
  const { year, month0 } = parseIso(iso);
  return { year, month0 };
};

export default function RangeCalendarSheet({
  visible,
  from,
  to,
  initialEdit,
  maxDate,
  today,
  onClose,
  onApply,
}: {
  visible: boolean;
  from: string;
  to: string;
  initialEdit: EditSide;
  maxDate: string;
  today: string;
  onClose: () => void;
  onApply: (from: string, to: string) => void;
}) {
  // ช่วง + ช่องที่กำลังแก้ อยู่ในก้อนเดียว — อัปเดตพร้อมกันเสมอ (แตะเร็ว ๆ ติดกันไม่ใช้ค่าเก่า)
  const [pick, setPick] = useState<{ range: DateRange; editing: EditSide; lastTap: string | null }>({
    range: { start: from, end: to },
    editing: initialEdit,
    lastTap: null,
  });
  const [view, setView] = useState<View_>(() => monthOf(initialEdit === "start" ? from : to));
  const [mode, setMode] = useState<"days" | "months">("days");
  const [pickerYear, setPickerYear] = useState(view.year);

  // เปิดใหม่ทุกครั้ง = เริ่มจากช่วงที่ใช้อยู่ + ช่องที่แตะ + เดือนของช่องนั้น
  useEffect(() => {
    if (!visible) return;
    setPick({ range: { start: from, end: to }, editing: initialEdit, lastTap: null });
    setView(monthOf(initialEdit === "start" ? from : to));
    setMode("days");
  }, [visible]);

  const { range, editing } = pick;
  const max = parseIso(maxDate);
  const canNextMonth = view.year < max.year || (view.year === max.year && view.month0 < max.month0);

  const cells = useMemo(() => {
    const c = monthCells(view.year, view.month0);
    while (c.length < CELLS) c.push(null);
    return c;
  }, [view.year, view.month0]);

  const switchSide = (side: EditSide) => {
    setPick((p) => ({ ...p, editing: side, lastTap: null }));
    setView(monthOf(side === "start" ? range.start : range.end));
    setMode("days");
  };

  const openMonths = () => {
    setPickerYear(view.year);
    setMode("months");
  };

  const sideLabel = editing === "start" ? "วันเริ่ม" : "วันสิ้นสุด";

  return (
    <BottomSheet visible={visible} onClose={onClose} style={s.sheet}>
      <View style={s.handle} />

      {/* ช่องที่กำลังแก้ */}
      <View style={s.seg}>
        {(["start", "end"] as EditSide[]).map((side) => {
          const on = editing === side;
          return (
            <TouchableOpacity
              key={side}
              style={[s.segBox, on && s.segOn]}
              onPress={() => switchSide(side)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${side === "start" ? "แก้วันเริ่ม" : "แก้วันสิ้นสุด"} ${thaiShort(side === "start" ? range.start : range.end)}`}
            >
              <Text style={[s.segLabel, on && s.segLabelOn]}>{side === "start" ? "วันเริ่ม" : "วันสิ้นสุด"}</Text>
              <Text style={s.segValue}>{thaiShort(side === "start" ? range.start : range.end)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={s.hint}>
        {mode === "months" ? "เลือกเดือนที่จะไป" : `แตะวันที่เพื่อเปลี่ยน${sideLabel} · แตะวันเดิมซ้ำ = 1 วัน`}
      </Text>

      {/* หัว: เลื่อนเดือน (โหมดวัน) / เลื่อนปี (โหมดเดือน) */}
      <View style={s.headRow}>
        <TouchableOpacity
          style={s.nav}
          onPress={() => (mode === "days" ? setView(shiftMonth(view.year, view.month0, -1)) : setPickerYear((y) => y - 1))}
          activeOpacity={0.8}
          accessibilityLabel={mode === "days" ? "เดือนก่อนหน้า" : "ปีก่อนหน้า"}
        >
          <Ionicons name="chevron-back" size={18} color={C.ink} />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.titleBtn}
          onPress={() => (mode === "days" ? openMonths() : setMode("days"))}
          activeOpacity={0.8}
          accessibilityLabel={mode === "days" ? "เลือกเดือนและปี" : "กลับไปปฏิทินวัน"}
        >
          <Text style={s.titleText}>{mode === "days" ? `${TH_MONTHS[view.month0]} ${view.year + 543}` : `พ.ศ. ${pickerYear + 543}`}</Text>
          <Ionicons name={mode === "days" ? "chevron-down" : "chevron-up"} size={14} color={C.primaryDark} />
        </TouchableOpacity>
        {(() => {
          const canNext = mode === "days" ? canNextMonth : pickerYear < max.year;
          return (
            <TouchableOpacity
              style={[s.nav, !canNext && s.navOff]}
              onPress={() => {
                if (!canNext) return;
                if (mode === "days") setView(shiftMonth(view.year, view.month0, 1));
                else setPickerYear((y) => y + 1);
              }}
              disabled={!canNext}
              activeOpacity={0.8}
              accessibilityLabel={mode === "days" ? "เดือนถัดไป" : "ปีถัดไป"}
            >
              <Ionicons name="chevron-forward" size={18} color={canNext ? C.ink : "#CBD5E1"} />
            </TouchableOpacity>
          );
        })()}
      </View>

      {mode === "days" ? (
        <View style={s.grid}>
          {TH_WEEKDAYS.map((w) => (
            <View key={w} style={s.cell}>
              <Text style={s.weekday}>{w}</Text>
            </View>
          ))}
          {cells.map((day, i) => {
            if (!day) return <View key={`e${i}`} style={s.cell} />;
            const future = day > maxDate;
            const role = dayRole(day, range);
            const picked = role === "start" || role === "end" || role === "single";
            return (
              <View key={day} style={s.cell}>
                {/* แถบช่วง: ครึ่งขวาที่วันเริ่ม / ครึ่งซ้ายที่วันสิ้นสุด / เต็มช่องระหว่างกลาง */}
                {role === "inside" ? <View style={[s.band, s.bandFull]} /> : null}
                {role === "start" ? <View style={[s.band, s.bandRight]} /> : null}
                {role === "end" ? <View style={[s.band, s.bandLeft]} /> : null}
                <TouchableOpacity
                  style={[s.day, day === today && !picked && s.today, picked && s.picked]}
                  onPress={() => setPick((p) => ({ ...p, ...pickDay(p.range, p.editing, day, p.lastTap) }))}
                  disabled={future}
                  activeOpacity={0.75}
                  accessibilityLabel={thaiShort(day)}
                >
                  <Text style={[s.dayText, future && s.future, picked && s.pickedText]}>{parseIso(day).day}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={s.monthGrid}>
          {TH_MONTHS_SHORT.map((label, m) => {
            const st = monthState(pickerYear, m, range, maxDate);
            const current = pickerYear === view.year && m === view.month0;
            return (
              <View key={m} style={s.monthCell}>
                <TouchableOpacity
                  style={[s.monthBtn, st.inRange && s.monthInRange, current && s.monthCurrent, st.future && s.monthFuture]}
                  onPress={() => {
                    setView({ year: pickerYear, month0: m });
                    setMode("days");
                  }}
                  disabled={st.future}
                  activeOpacity={0.8}
                  accessibilityLabel={`${TH_MONTHS[m]} ${pickerYear + 543}`}
                >
                  <Text style={[s.monthText, st.inRange && s.monthTextInRange, current && s.monthTextCurrent, st.future && s.future]}>{label}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <View style={s.summary}>
        <Text style={s.summaryText}>
          {thaiShort(range.start)} – {thaiShort(range.end)} · {daysInclusive(range.start, range.end)} วัน
        </Text>
      </View>

      <View style={s.btnRow}>
        <TouchableOpacity style={s.cancel} onPress={onClose} activeOpacity={0.85}>
          <Text style={s.cancelText}>ยกเลิก</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.apply} onPress={() => onApply(range.start, range.end)} activeOpacity={0.85}>
          <Text style={s.applyText}>ใช้ช่วงนี้</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  sheet: { ...W.sheet, paddingHorizontal: 16, paddingBottom: 32 },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#CBD5E1", marginTop: 10, marginBottom: 10 },
  seg: { flexDirection: "row", gap: 10 },
  segBox: { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: "#F8FAFF", paddingVertical: 8, paddingHorizontal: 12 },
  segOn: { ...NG, borderColor: C.primary, backgroundColor: C.primaryTint, boxShadow: `0 0 0 3px ${C.primarySoft}` },
  segLabel: { fontSize: 12, fontWeight: "600", color: C.faint },
  segLabelOn: { color: C.primaryDark },
  segValue: { fontSize: 15, fontWeight: "700", color: C.ink, marginTop: 1 },
  hint: { fontSize: 12.5, color: C.text2, marginTop: 8 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, marginBottom: 6 },
  nav: { ...W.iconBtn, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  navOff: { opacity: 0.5 },
  titleBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: C.primaryTint },
  titleText: { fontSize: 16, fontWeight: "700", color: C.primaryDark },
  grid: { flexDirection: "row", flexWrap: "wrap", height: GRID_HEIGHT },
  cell: { width: "14.2857%", height: ROW, alignItems: "center", justifyContent: "center" },
  weekday: { fontSize: 12, fontWeight: "600", color: C.faint },
  band: { position: "absolute", top: 2, bottom: 2, backgroundColor: C.primarySoft },
  bandFull: { left: 0, right: 0 },
  bandRight: { left: "50%", right: 0 },
  bandLeft: { left: 0, right: "50%" },
  day: { width: DAY, height: DAY, borderRadius: DAY / 2, alignItems: "center", justifyContent: "center" },
  today: { borderWidth: 1.5, borderColor: C.primary },
  picked: { ...NG, backgroundColor: C.primary },
  dayText: { fontSize: 14, color: C.ink },
  pickedText: { color: "#fff", fontWeight: "700" },
  future: { color: "#CBD5E1" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", height: GRID_HEIGHT, alignContent: "center" },
  monthCell: { width: "33.333%", padding: 5 },
  monthBtn: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  monthInRange: { ...NG, backgroundColor: C.primarySoft, borderColor: C.primarySoft },
  monthCurrent: { ...NG, backgroundColor: C.primary, borderColor: C.primary },
  monthFuture: { ...NG, backgroundColor: "#F8FAFC", borderColor: "#EEF2F7" },
  monthText: { fontSize: 15, fontWeight: "600", color: C.ink },
  monthTextInRange: { color: C.primaryDark },
  monthTextCurrent: { color: "#fff", fontWeight: "700" },
  summary: { marginTop: 10, borderRadius: 14, backgroundColor: C.primaryTint, paddingVertical: 10, paddingHorizontal: 12 },
  summaryText: { textAlign: "center", fontSize: 14, fontWeight: "600", color: C.primaryDark },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancel: { ...W.small, flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center" },
  cancelText: { color: C.muted, fontSize: 15, fontWeight: "600" },
  apply: { ...W.primary, flex: 2, minHeight: 50, alignItems: "center", justifyContent: "center" },
  applyText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
