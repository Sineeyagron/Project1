import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text, TextInput } from "./AppText";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";
import { notify } from "../lib/notify";

// ฟอร์มแจ้งปัญหาเครื่องคอม / LAN port (ระบบห้อง R3) — ใช้ในผังห้อง
// เรียก RPC report_room_problem: ฐานข้อมูลกันแจ้งซ้ำ (เรื่องเดิมยังค้าง) + จำกัด 5 ครั้งต่อวัน + แจ้ง Admin/TA
export default function RoomReportForm({
  kind,
  targetId,
  label,
  onDone,
}: {
  kind: "station" | "lan";
  targetId: string;
  label: string;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const description = text.trim();
    if (description.length < 3) {
      notify("อธิบายปัญหาก่อน", "อย่างน้อย 3 ตัวอักษร เช่น จอไม่ติด, เมาส์หาย");
      return;
    }
    setSending(true);
    const { error } = await supabase.rpc("report_room_problem", {
      p_kind: kind,
      p_target: targetId,
      p_description: description,
    });
    setSending(false);
    if (error) {
      notify("แจ้งไม่สำเร็จ", error.message);
      return;
    }
    setText("");
    notify("แจ้งปัญหาแล้ว", "ผู้ดูแลจะตรวจสอบ และแจ้งผลกลับในหน้าแจ้งเตือน");
    onDone();
  };

  return (
    <View style={s.box}>
      <Text style={s.title}>แจ้งปัญหา · {label}</Text>
      <TextInput
        style={s.input}
        value={text}
        onChangeText={setText}
        placeholder={kind === "lan" ? "เช่น เสียบสายแล้วไม่มีเน็ต, ไฟไม่ขึ้น" : "เช่น จอไม่ติด, เมาส์หาย, เปิดไม่ขึ้น"}
        placeholderTextColor="#94a3b8"
        multiline
        maxLength={500}
      />
      <View style={s.row}>
        <TouchableOpacity style={s.cancel} onPress={onDone} disabled={sending}>
          <Text style={s.cancelText}>ยกเลิก</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.send, sending && { opacity: 0.6 }]} onPress={submit} disabled={sending}>
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send-outline" size={16} color="#fff" />
              <Text style={s.sendText}>ส่งคำแจ้ง</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { marginTop: 12, backgroundColor: "#fff7ed", borderRadius: 12, borderWidth: 1, borderColor: "#fed7aa", padding: 12 },
  title: { fontSize: 13, fontWeight: "800", color: "#9a3412", marginBottom: 8 },
  input: { minHeight: 64, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: "#DCE6F5", padding: 10, fontSize: 14, color: "#172033", textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  cancel: { flex: 1, minHeight: 42, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#334155", fontWeight: "800" },
  send: { flex: 2, minHeight: 42, borderRadius: 10, backgroundColor: "#ea580c", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  sendText: { color: "#fff", fontWeight: "800" },
});
