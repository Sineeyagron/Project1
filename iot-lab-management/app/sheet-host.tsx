import React, { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DialogHost } from "../lib/notify";
import { useSheetFit } from "../lib/sheetFit";
import { dropSheet, getSheet, useSheetEntry } from "../lib/sheetHost";

// แผ่น iOS แท้ (presentation "formSheet" ใน app/_layout.tsx) สำหรับ <BottomSheet> ทุกตัวในแอป
//   แบบเดียวกับแผ่นรายละเอียดอุปกรณ์ของ นศ.: iOS เลื่อนแผ่น 120Hz + ฉากมืดระบบอยู่กับที่ + ปัดลงปิด (เจ้าของโปรเจกต์เลือก 12 ต.ค. 2569)
//   เนื้อหามาจากหน้าเดิมผ่าน lib/sheetHost · สูงพอดีเนื้อหา (lib/sheetFit)
//   ScrollView เป็นรากของแผ่น (กติกาแผ่น iOS: ห้ามห่อ View / ห้าม padding นอก ScrollView / ห้ามมี ScrollView แนวตั้งซ้อนข้างใน)
export default function SheetHost() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useSheetEntry(String(id));
  const fit = useSheetFit(420);

  useEffect(() => {
    if (!entry) router.back(); // เปิดตรงจากลิงก์/รีเฟรชหน้า → ไม่มีเนื้อหา
    // แผ่นหายไป (ปัดลง / หน้าเดิมสั่งปิด) → ถ้าหน้าเดิมยังคิดว่าเปิดอยู่ = ผู้ใช้ปิดเอง → แจ้งหน้าเดิม
    return () => {
      const e = getSheet(String(id));
      if (e?.open) e.onClose();
      dropSheet(String(id));
    };
  }, []);
  if (!entry) return null;

  return (
    <>
      <Stack.Screen options={{ sheetAllowedDetents: fit.detents }} />
      <ScrollView
        style={s.fill}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* วัดความสูงเนื้อหาจริงจาก View นี้ · พื้น/มุมโค้งเป็นของแผ่น iOS เอง */}
        <View style={[entry.style, s.reset, { paddingBottom: Math.max(insets.bottom, 16) }]} onLayout={fit.onLayout}>
          {entry.content}
        </View>
      </ScrollView>
      <DialogHost />
    </>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  // style เดิมของแผ่นทำมาให้ลอยล่างจอ (absolute, maxHeight, มุมโค้ง) → ล้างส่วนที่แผ่น iOS ทำให้แล้ว
  reset: { position: "relative", maxHeight: undefined, borderTopLeftRadius: 0, borderTopRightRadius: 0, backgroundColor: "transparent", overflow: "visible" },
});
