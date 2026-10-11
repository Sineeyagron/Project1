import React, { useEffect, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { dropSheet, getSheet, patchSheet, setSheet } from "../lib/sheetHost";

// แผ่นล่างจอ ใช้ซ้ำทั้งแอป = แผ่น iOS แท้ แบบเดียวกับแผ่นรายละเอียดอุปกรณ์ของ นศ. (เจ้าของโปรเจกต์เลือก 12 ต.ค. 2569)
//   iOS เลื่อนแผ่น 120Hz + ฉากมืดของระบบอยู่กับที่ (ไม่มีขอบเทาไถขึ้นมา) + ขีดจับ + ปัดลงปิด + สูงพอดีเนื้อหา
//   วิธี: เปิด route app/sheet-host.tsx (presentation "formSheet") แล้วส่งเนื้อหาไปทาง lib/sheetHost ทุกครั้งที่หน้านี้ render
//   → หน้าเดิมเขียนเหมือนเดิม: <BottomSheet visible onClose style>เนื้อหา</BottomSheet>
//   (เคยลอง: Modal slide = ฉากเทาไถขึ้นมาด้วย / เลื่อนเองด้วย Animated = 60Hz หน่วง / Modal fade = ไม่เลื่อน)
// กติกาเนื้อหา (แผ่น iOS): รากของแผ่นเป็น ScrollView อยู่แล้ว → ห้ามมี ScrollView แนวตั้งซ้อนข้างใน (ยืดทับ)
//   ป๊อปอัป: sheet-host มี <DialogHost /> ของตัวเอง · ปิดแผ่นแล้ว notify ต่อ = ป๊อปอัปส่งต่อลงหน้าเดิมเอง (lib/notify)
// ปิด: หน้าเดิมตั้ง visible=false / ผู้ใช้ปัดลงหรือแตะฉากมืด = เรียก onClose ให้หน้าเดิม
// แผ่นหนึ่งปิดแล้วเปิดอีกแผ่นทันที (เช่น เมนู ⋯ → แก้ข้อมูล) → รอแผ่นเดิมเลื่อนลงจบก่อน (iOS เปิดซ้อนระหว่างกำลังปิดแล้วสะดุด)
const DISMISS_MS = 420;
let lastClosedAt = 0;

export default function BottomSheet({
  visible,
  onClose,
  style,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onHidden?: () => void;
  style?: StyleProp<ViewStyle>;
  liftKeyboard?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const id = useRef(`sheet-${Math.random().toString(36).slice(2, 10)}`).current;
  const opened = useRef(false); // หน้าเดิมสั่งเปิดอยู่
  const pushed = useRef(false); // เปิด route แผ่นไปแล้วจริง (ยังไม่ปิด)

  // เนื้อหาชุดล่าสุด → แผ่น (ทุก render ระหว่างเปิด)
  useEffect(() => {
    if (opened.current && getSheet(id)) patchSheet(id, { content: children, style, onClose });
  });

  useEffect(() => {
    if (visible && !opened.current) {
      opened.current = true;
      setSheet(id, { content: children, style, onClose, open: true });
      const go = () => {
        if (!opened.current || pushed.current) return;
        pushed.current = true;
        router.push({ pathname: "/sheet-host", params: { id } } as any);
      };
      // setTimeout 0 ก่อนเสมอ: แผ่นอื่นที่สั่งปิดในรอบ render เดียวกันจะได้ปิดก่อน แล้วค่อยรอให้เลื่อนลงจบ
      setTimeout(() => {
        const wait = Math.max(0, DISMISS_MS - (Date.now() - lastClosedAt));
        if (wait > 0) setTimeout(go, wait); else go();
      }, 0);
    } else if (!visible && opened.current) {
      opened.current = false;
      lastClosedAt = Date.now();
      // ยังมีแผ่นอยู่ = หน้าเดิมสั่งปิดเอง → ปิดแผ่น (ถ้าผู้ใช้ปัดลงไปแล้ว sheet-host ลบรายการไปก่อน → ไม่ต้องย้อน)
      if (pushed.current && getSheet(id)) {
        patchSheet(id, { open: false });
        router.back();
      } else if (!pushed.current) {
        dropSheet(id); // ยังไม่ทันเปิด → ยกเลิกเฉยๆ (ห้าม back ไม่งั้นหน้าเดิมหาย)
      }
      pushed.current = false;
    }
  }, [visible]);

  // หน้าเดิมปิดไปทั้งที่แผ่นยังเปิด → ไม่ต้องแจ้ง onClose กลับ
  useEffect(() => () => { if (getSheet(id)) patchSheet(id, { open: false }); }, []);

  return null;
}
