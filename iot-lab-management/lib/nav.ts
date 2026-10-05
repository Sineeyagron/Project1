import { useCallback, useEffect, useRef } from "react";
import { Href, router, useFocusEffect } from "expo-router";

// การนำทางที่ใช้ร่วมกันทั้งแอป

// ปุ่ม ← : กลับหน้าที่มาจริง / ไม่มีหน้าก่อนหน้า (เปิดจากลิงก์ตรง, รีโหลดเว็บ) → ไปหน้าสำรอง
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

// แถบเมนูล่างของนักศึกษา: หน้าแรกเป็นฐาน กดแท็บอื่นแล้ว stack = [หน้าแรก, แท็บนั้น] เสมอ ไม่ซ้อนเพิ่ม
// (เดิม push ทุกครั้ง → หน้าแรก → อุปกรณ์ → โปรไฟล์ → หน้าแรก ซ้อนกัน 4 ชั้น ย้อนกลับแล้ววน)
export type StudentTab = "/home" | "/equipment" | "/notifications" | "/profile";
export function goTab(target: StudentTab, current: StudentTab) {
  if (target === current) return;
  router.dismissTo("/home"); // มีหน้าแรกอยู่ใน stack → ถอยกลับไป / ไม่มี → แทนที่หน้านี้ด้วยหน้าแรก
  // ?tab=1 = มาจากแถบเมนูล่าง (หน้าแจ้งเตือนใช้ตัดสินว่าจะโชว์แถบไหม — staff ที่มาจากกระดิ่งแดชบอร์ดไม่มีแถบ)
  if (target !== "/home") router.push({ pathname: target, params: { tab: "1" } } as any);
}

// โหลดข้อมูลใหม่ตอนกลับมาที่หน้านี้ (ข้ามครั้งแรก เพราะหน้าโหลดเองตอนเปิดอยู่แล้ว)
// จำเป็นเพราะปุ่ม ← พากลับหน้าเดิมที่ค้างอยู่ ไม่ได้สร้างหน้าใหม่เหมือนเมื่อก่อน
export function useRefreshOnFocus(refresh: () => void) {
  const first = useRef(true);
  // เก็บฟังก์ชันล่าสุดใน ref (อัปเดตหลัง render ไม่ใช่ระหว่าง render) — ถ้าส่งเข้า deps ตรงๆ จะโหลดซ้ำทุก render
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      latest.current();
    }, [])
  );
}
