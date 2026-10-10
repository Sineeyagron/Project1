import React, { useEffect, useState } from "react";
import { StyleProp, TextStyle } from "react-native";
import { Text } from "./AppText";

// นับถอยหลังถึงเวลาหมดอายุคำขอ (แสดง นาที:วินาที) แล้วเรียก onDone ตอนครบ
export default function Countdown({
  until,
  onDone,
  style,
}: {
  until: string;
  onDone?: () => void;
  style?: StyleProp<TextStyle>;
}) {
  const [left, setLeft] = useState(() => new Date(until).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const ms = new Date(until).getTime() - Date.now();
      setLeft(ms);
      if (ms <= 0) {
        clearInterval(id);
        onDone?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [until]);

  if (left <= 0) return <Text style={style}>หมดเวลาแล้ว</Text>;
  // เกิน 1 ชม. (เช่น คำขอนัดรับ 12 ชม.) → "ชม. นาที" อ่านง่ายกว่า "719:41"
  if (left >= 3600000) {
    const h = Math.floor(left / 3600000);
    const mm = Math.floor((left % 3600000) / 60000);
    return <Text style={style}>เหลือเวลา {h} ชม. {mm} นาที</Text>;
  }
  const m = Math.floor(left / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  return <Text style={style}>เหลือเวลา {m}:{String(sec).padStart(2, "0")} นาที</Text>;
}
