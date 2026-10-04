import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "./AppText";
import { Ionicons } from "@expo/vector-icons";

// แถบแจ้ง "โหลดไม่สำเร็จ" + ปุ่มลองใหม่
// ใช้แทนการเงียบ — เดิมโหลดพังแล้วหน้าโชว์ "ปกติทุกอย่าง" / "ไม่มีข้อมูล" ทำให้เข้าใจผิด
export default function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={s.box}>
      <Ionicons name="cloud-offline-outline" size={20} color="#b91c1c" />
      <View style={{ flex: 1 }}>
        <Text style={s.title}>โหลดข้อมูลไม่สำเร็จ</Text>
        <Text style={s.msg} numberOfLines={2}>{message}</Text>
      </View>
      <TouchableOpacity style={s.btn} onPress={onRetry} activeOpacity={0.85}>
        <Text style={s.btnText}>ลองใหม่</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  box: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 12, padding: 12, marginBottom: 12 },
  title: { color: "#b91c1c", fontSize: 13, fontWeight: "900" },
  msg: { color: "#7f1d1d", fontSize: 11, marginTop: 2 },
  btn: { backgroundColor: "#dc2626", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7 },
  btnText: { color: "#fff", fontSize: 12, fontWeight: "900" },
});
