import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "./supabase";
import { currentUser } from "./session";

// อัปเดตสดของ "ระบบห้องคอม" (migration room_realtime) — ช่อง "room" event "room_status" payload { room_id }
// แยกจาก lib/realtime.ts ของระบบยืม-คืนโดยตั้งใจ (สองระบบห้าม import ข้ามกัน)
// หลายหน้าอาจเปิดค้างพร้อมกัน (หน้าแรก + ผังห้อง) → ใช้ช่องเดียวร่วมกัน นับผู้ฟัง ปิดเมื่อไม่เหลือใคร

type Listener = (roomId: string | null) => void;
let shared: { channel: RealtimeChannel; listeners: Set<Listener> } | null = null;

function listen(listener: Listener) {
  if (!shared) {
    const channel = supabase.channel("room", { config: { private: true } });
    const created = { channel, listeners: new Set<Listener>() };
    channel.on("broadcast", { event: "room_status" }, (msg) => {
      const roomId = (msg.payload as any)?.room_id ?? null;
      created.listeners.forEach((l) => l(roomId));
    });
    channel.subscribe();
    shared = created;
  }
  const current = shared;
  current.listeners.add(listener);
  return () => {
    current.listeners.delete(listener);
    if (current.listeners.size === 0 && shared === current) {
      shared = null;
      supabase.removeChannel(current.channel);
    }
  };
}

// เรียก onChange เมื่อสถานะเครื่อง/LAN/เช็กลิสต์ในห้องเปลี่ยน
// room = ฟังเฉพาะห้องนั้น / ไม่ใส่ = ทุกห้อง — รวมสัญญาณที่มาติดกันเป็นครั้งเดียว (เช่น แก้รหัสห้อง = หลายสิบแถว)
export function useRoomLive(onChange: () => void, room?: string | null) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const user = await currentUser();
      if (!user || cancelled) return;
      await supabase.realtime.setAuth(); // ช่อง private ต้องส่ง JWT ให้ Realtime เช็กสิทธิ์
      if (cancelled) return;
      stop = listen((roomId) => {
        if (room && roomId && roomId !== room) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => latest.current(), 400);
      });
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stop?.();
    };
  }, [room]);
}
