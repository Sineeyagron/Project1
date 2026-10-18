import { useEffect, useState } from "react";

// รายการยาว: วาดชุดแรกให้ขึ้นจอทันที แล้วทยอยวาดที่เหลือเฟรมละชุดจนครบ (ไม่กี่เฟรม)
//   → เปิดหน้าไว ไม่กระตุกตอนของเยอะ · ผลสุดท้ายเหมือนวาดทั้งรายการทุกอย่าง (ไม่ต้องเลื่อนถึงจะโผล่)
//   ใช้แทนเฉพาะตอน .map ในหน้าจอ — จำนวน/เลือกทั้งหมด/ค้นหา ยังใช้รายการเต็มเหมือนเดิม
//   ทยอยแค่ตอนเปิดหน้า: วาดครบแล้ว ค้นหา/กรองใหม่ก็แสดงครบทันที
export function useProgressiveList<T>(list: T[], first = 24, step = 24): T[] {
  const [count, setCount] = useState(first);
  const done = count >= list.length;

  useEffect(() => {
    if (done) return;
    // ชุดถัดไปในเฟรมหน้า (ได้วาดจอระหว่างชุด) — สำรองด้วยตัวจับเวลา เผื่อเฟรมถูกหน่วง (ประหยัดพลังงาน/แท็บพื้นหลัง)
    let fired = false;
    const next = () => {
      if (fired) return;
      fired = true;
      setCount((c) => c + step);
    };
    const raf = requestAnimationFrame(next);
    const timer = setTimeout(next, 50);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [done, count, step]);

  return done ? list : list.slice(0, count);
}
