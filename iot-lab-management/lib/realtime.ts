import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import supabase from "./supabase";
import { currentUser } from "./session";

// Realtime Broadcast: ฐานข้อมูลส่งสัญญาณมาเอง (migration realtime_broadcast) แทนการรีเฟรชถามทุก 30 วิ
// ช่อง user:<id> = แจ้งเตือนใหม่ของเรา (event "notification") / ช่อง staff = คำขอใหม่/เปลี่ยนสถานะ (event "request")
// ช่อง lab = ผู้ดูแลเช็กอิน/เช็กเอาท์ (event "presence", F4) — ทุกคนที่ล็อกอินฟังได้
// สัญญาณบอกแค่ "มีของใหม่" — หน้าโหลดข้อมูลเองผ่าน RLS ตามปกติ
// หลายหน้าอาจฟังช่องเดียวกันพร้อมกัน (เช่น หน้าแรก admin + หน้าแจ้งเตือน) → ใช้ช่องร่วมกัน นับจำนวนผู้ฟัง ปิดเมื่อไม่เหลือใคร

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

// ฟังสัญญาณในหน้านั้น — onSignal ถูกเรียกเมื่อมีของใหม่ (ช่องหลุด/ฟังไม่ได้ → หน้ายังมีรีเฟรชสำรองของตัวเอง)
export function useRealtime(scope: "user" | "staff" | "lab", event: "notification" | "request" | "presence", onSignal: () => void) {
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
