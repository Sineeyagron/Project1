import { useRef } from "react";
import { Dimensions, LayoutChangeEvent } from "react-native";
import { useNavigation } from "expo-router";

// ความสูงแผ่นมาตรฐานของ iOS (presentation "formSheet") ให้พอดีเนื้อหา
//   ไม่ใช้ sheetAllowedDetents "fitToContents": มี ScrollView ในแผ่นแล้ววัดพลาด (ส่วนหัวหลุดขอบบน + ช่องว่างกลางแผ่น — เจอบน iPhone 11 ต.ค. 2569)
//   วิธีนี้: เปิดด้วยความสูงที่ประมาณจากข้อมูล → แผ่นวาดเสร็จแล้ววัดเนื้อหาจริง ถ้าต่างกันค่อยปรับ (iOS ยืด/หดแผ่นให้แบบมีแอนิเมชัน)
// ใช้: const fit = useSheetFit(ประมาณความสูงเป็นจุด) → <Stack.Screen options={{ sheetAllowedDetents: fit.detents }} /> + <View onLayout={fit.onLayout}>
const MAX = 0.92; // สูงสุดเกือบเต็มจอ (เหลือขอบบนให้เห็นหน้าด้านหลัง แบบแผ่นของ iOS)
const MIN = 0.25;
const GRABBER = 16; // พื้นที่ขีดจับด้านบนของแผ่น

const toFraction = (points: number) => Math.min(MAX, Math.max(MIN, (points + GRABBER) / Dimensions.get("window").height));

export function useSheetFit(estimatePoints: number) {
  const navigation = useNavigation();
  const initial = useRef([toFraction(estimatePoints)]).current;
  const current = useRef(initial[0]);

  const onLayout = (e: LayoutChangeEvent) => {
    const next = toFraction(e.nativeEvent.layout.height);
    // ต่างกันไม่ถึง ~1% ของจอ ไม่ต้องขยับ (กันแผ่นกระตุกเล็ก ๆ)
    if (Math.abs(next - current.current) < 0.01) return;
    current.current = next;
    navigation.setOptions({ sheetAllowedDetents: [next] } as any);
  };

  return { detents: initial, onLayout };
}
