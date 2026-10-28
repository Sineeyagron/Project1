import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "./supabase";
import { currentUser } from "./session";

// Realtime Broadcast ที่ใช้ร่วมทั้งแอป (ไม่ใช่ของระบบใดระบบหนึ่ง): ฐานข้อมูลส่งสัญญาณมาเอง แทนการรีเฟรชถามเป็นระยะ
// สัญญาณบอกแค่ "มีของใหม่" — หน้าโหลดข้อมูลเองผ่าน RLS ตามปกติ
// supabase.channel(topic) คืนช่องเดิมถ้าชื่อซ้ำ → ทุกที่ที่ฟังช่องเดียวกันต้องผ่านทะเบียนนี้ที่เดียว
//   (นับผู้ฟัง ปิดเมื่อไม่เหลือใคร) ไม่งั้นหน้าหนึ่งปิดช่องแล้วอีกหน้าหลุดตาม
// ระบบยืม-คืน: lib/realtime.ts (ช่อง staff / lab) · ระบบห้องคอม: lib/room/roomRealtime.ts (ช่อง room — ช่องเฉพาะของตัวเอง)

type Listener = (event: string) => void;
const topics = new Map<string, { channel: RealtimeChannel; listeners: Set<Listener> }>();

function listen(topic: string, listener: Listener) {
  let entry = topics.get(topic);
  if (!entry) {
    const channel = supabase.channel(topic, { config: { private: true } });
    const created = { channel, listeners: new Set<Listener>() };
    channel.on("broadcast", { event: "*" }, (msg) => {
      created.listeners.forEach((l) => l(msg.event));
    });
    channel.subscribe();
    topics.set(topic, created);
    entry = created;
  }
  entry.listeners.add(listener);
  const current = entry;
  return () => {
    current.listeners.delete(listener);
    if (current.listeners.size === 0 && topics.get(topic) === current) {
      topics.delete(topic);
      supabase.removeChannel(current.channel);
    }
  };
}

// ฟังสัญญาณในหน้านั้น — scope "user" = ช่องส่วนตัว user:<id> ของคนที่ล็อกอิน / อื่น ๆ = ชื่อช่องตรงตัว
// onSignal ถูกเรียกเมื่อมีของใหม่ (ช่องหลุด/ฟังไม่ได้ → หน้ายังมีรีเฟรชสำรองของตัวเอง)
export function useBroadcast(scope: string, event: string, onSignal: () => void) {
  const latest = useRef(onSignal);
  useEffect(() => {
    latest.current = onSignal;
  });

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      const user = await currentUser();
      if (!user || cancelled) return;
      await supabase.realtime.setAuth(); // ช่อง private ต้องส่ง JWT ให้ Realtime เช็กสิทธิ์
      if (cancelled) return;
      const topic = scope === "user" ? `user:${user.id}` : scope;
      stop = listen(topic, (ev) => {
        if (ev === event) latest.current();
      });
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [scope, event]);
}

// แจ้งเตือนใหม่ของเรา (แถวใหม่ในตาราง notifications ที่ใช้ร่วมทั้งสองระบบ)
export function useMyNotifications(onSignal: () => void) {
  useBroadcast("user", "notification", onSignal);
}
