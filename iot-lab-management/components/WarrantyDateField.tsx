import React from "react";
import { StyleProp, StyleSheet, TextStyle, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, TextInput } from "./AppText";
import { addYears, maskThaiDate, parseThaiDate, thaiDate, toThaiDateInput } from "../lib/itemInfo";
import { C } from "../lib/theme";

// ช่องวันหมดประกันแบบ วว/ดด/ปปปป (ปี พ.ศ.) — ใช้ที่หน้าเพิ่มอุปกรณ์ + แก้ประกัน ให้เหมือนกันทุกที่
//   value = ข้อความในช่อง (ไม่ใช่ค่าฐานข้อมูล) → แปลงเป็น ปปปป-ดด-วว ด้วย parseThaiDate ตอนบันทึก
//   ใต้ช่องบอกผลเสมอ: พิมพ์ไม่ครบ / ไม่มีวันนี้ในปฏิทิน / "= 31 ธ.ค. 2570" / วันที่ผ่านไปแล้ว
export default function WarrantyDateField({
  value,
  onChange,
  inputStyle,
  onFocus,
}: {
  value: string;
  onChange: (text: string) => void;
  inputStyle?: StyleProp<TextStyle>;
  onFocus?: () => void;
}) {
  const text = value.trim();
  const iso = parseThaiDate(text);
  const complete = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text); // พิมพ์ครบ วัน/เดือน/ปี 4 หลักแล้ว
  const past = !!iso && iso < localToday();

  let hint: { msg: string; color: string; icon: keyof typeof Ionicons.glyphMap } | null = null;
  if (iso) hint = past
    ? { msg: `${thaiDate(iso)} — เป็นวันที่ผ่านมาแล้ว (ประกันหมดแล้ว)`, color: C.warningInk, icon: "alert-circle-outline" }
    : { msg: `ประกันถึง ${thaiDate(iso)}`, color: C.successInk, icon: "checkmark-circle-outline" };
  else if (text && complete) hint = { msg: "ไม่มีวันที่นี้ในปฏิทิน ลองตรวจวัน/เดือนอีกครั้ง", color: C.errorInk, icon: "close-circle-outline" };
  else if (text) hint = { msg: "พิมพ์ให้ครบ วัน/เดือน/ปี พ.ศ. เช่น 31/12/2570", color: C.faint, icon: "create-outline" };

  return (
    <>
      <TextInput
        style={[inputStyle, !!text && complete && !iso && s.inputError]}
        value={value}
        onChangeText={(t) => onChange(maskThaiDate(t))}
        onFocus={onFocus}
        placeholder="วว/ดด/ปปปป (พ.ศ.) เช่น 31/12/2570"
        placeholderTextColor="#94A3B8"
        keyboardType="number-pad"
        maxLength={10}
      />
      {hint && (
        <View style={s.hint}>
          <Ionicons name={hint.icon} size={14} color={hint.color} />
          <Text style={[s.hintText, { color: hint.color }]}>{hint.msg}</Text>
        </View>
      )}
      <View style={s.chips}>
        {[1, 2, 3].map((years) => (
          <TouchableOpacity key={years} style={s.chip} activeOpacity={0.8} onPress={() => onChange(toThaiDateInput(addYears(years)))}>
            <Text style={s.chipText}>+{years} ปีจากวันนี้</Text>
          </TouchableOpacity>
        ))}
        {!!value && (
          <TouchableOpacity style={s.chip} activeOpacity={0.8} onPress={() => onChange("")}>
            <Text style={s.chipText}>ไม่มีประกัน</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}

// ช่องวันที่ไม่ครบ/ผิด = บันทึกไม่ได้ / ว่าง = ไม่มีประกัน
export const warrantyBlocked = (value: string) => !!value.trim() && !parseThaiDate(value);

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const s = StyleSheet.create({
  inputError: { borderColor: C.error },
  hint: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  hintText: { flex: 1, fontSize: 12.5 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#DCE6F5" },
  chipText: { fontSize: 13, color: C.text2, fontWeight: "600" },
});
