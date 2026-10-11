import React from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import PickupRequestForm from "../components/PickupRequestForm";
import { useSheetFit } from "../lib/sheetFit";
import { C } from "../lib/theme";

// F2 แผ่นขอยืมแบบนัดรับ — แผ่นมาตรฐานของ iOS (presentation "formSheet" ใน app/_layout.tsx) ซ้อนบนแผ่นรายละเอียดรุ่น
//   ยกเลิก = กลับแผ่นรายละเอียด / ส่งสำเร็จ = ปิดทั้ง 2 แผ่น กลับหน้าอุปกรณ์
//   ความสูงพอดีเนื้อหา (lib/sheetFit) — กดอ่านกฎแล้วเนื้อหายาวขึ้น แผ่นยืดตาม
export default function PickupSheet() {
  const router = useRouter();
  const { key, name } = useLocalSearchParams<{ key: string; name: string }>();
  const fit = useSheetFit(560);
  if (!key) return null;
  return (
    <View style={s.fill}>
      <Stack.Screen options={{ sheetAllowedDetents: fit.detents }} />
      <View onLayout={fit.onLayout}>
        <PickupRequestForm model={{ key, name: name || key }} onClose={() => router.back()} onSent={() => router.dismiss(2)} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.surface },
});
