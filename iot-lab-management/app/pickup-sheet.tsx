import React from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import PickupRequestForm from "../components/borrow/PickupRequestForm";
import { useSheetFit } from "../lib/sheetFit";
import { DialogHost } from "../lib/notify";

// F2 แผ่นขอยืมแบบนัดรับ — แผ่นมาตรฐานของ iOS (presentation "formSheet" ใน app/_layout.tsx) ซ้อนบนแผ่นรายละเอียดรุ่น
//   ยกเลิก = กลับแผ่นรายละเอียด / ส่งสำเร็จ = ปิดทั้ง 2 แผ่น กลับหน้าอุปกรณ์
//   ความสูงพอดีเนื้อหา (lib/sheetFit) — กดอ่านกฎแล้วเนื้อหายาวขึ้น แผ่นยืดตาม
//   โครงเหมือน app/equipment-sheet.tsx: ScrollView ของฟอร์มต้องอยู่ที่รากของแผ่นเลย (ห้ามห่อด้วย View)
//   — ห่อด้วย View แล้วบน iPhone แผ่นขาวโล่ง / ใส่ padding นอก ScrollView ตัวหนังสือตกขอบซ้าย (เจอทั้งคู่ 11 ต.ค. 2569)
export default function PickupSheet() {
  const router = useRouter();
  const { key, name } = useLocalSearchParams<{ key: string; name: string }>();
  const fit = useSheetFit(560);
  if (!key) return null;
  return (
    <>
      <Stack.Screen options={{ sheetAllowedDetents: fit.detents }} />
      <PickupRequestForm
        model={{ key, name: name || key }}
        onClose={() => router.back()}
        onSent={() => router.dismiss(2)}
        onLayout={fit.onLayout}
      />
      {/* ป๊อปอัปของฟอร์มขึ้นบนแผ่นนี้ (lib/notify) — ไม่มีป๊อปอัป = ไม่วาดอะไร */}
      <DialogHost />
    </>
  );
}
