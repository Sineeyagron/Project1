// Edge Function: send-push — ส่ง Web Push ของแจ้งเตือน LabHub (ดู supabase/migrations/20261012110000_web_push.sql)
//   GET  → { publicKey } ให้แอปเว็บใช้สมัครรับ push (public key เปิดเผยได้)
//   POST { id } ← trigger notifications_push (pg_net) → ส่งไปทุกเครื่องของผู้รับ
//   POST { request_id, source: "borrow" | "pickup" } ← trigger borrow_requests_push / pickup_requests_push
//   POST { request_id, source: "pickup_cancel" | "borrow_cancel" } ← cancel_pickup / cancel_request (นักศึกษายกเลิกเอง — migration 20261013120000, 20261013130000)
//        → ส่งถึงผู้ดูแล (admin + TA) ทุกคนยกเว้นคนขอเอง (คำขอไม่มีแถวใน notifications — ดู migration 20261013090000)
// secrets ที่ต้องตั้ง: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (เช่น mailto:you@example.com) — ดู docs/DEPLOY_PWA.md
// deploy แบบไม่เช็ก JWT (--no-verify-jwt): trigger ไม่มี token / กันคนนอกด้วย id แจ้งเตือน (uuid เห็นเฉพาะผู้รับ) + ต้องเพิ่งสร้างไม่เกิน 2 นาที

import { sendPush, type Vapid } from "./webpush.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  (() => { try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default; } catch { return ""; } })();

const VAPID: Vapid = {
  publicKey: Deno.env.get("VAPID_PUBLIC_KEY") || "",
  privateKey: Deno.env.get("VAPID_PRIVATE_KEY") || "",
  subject: Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// เรียก PostgREST ด้วย service role (ไม่ต้องพึ่ง supabase-js)
async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

// แตะแจ้งเตือนแล้วไปหน้าไหน: งานผู้ดูแล → กล่องแจ้งเตือนผู้ดูแล / เรื่องของตัวเอง → แจ้งเตือนโหมดนักศึกษา
const targetUrl = (n: { for_staff: boolean }) => (n.for_staff ? "/admin/notifications" : "/notifications?tab=1");

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };
type Payload = { title: string; body: string; url: string; tag: string };
const UUID = /^[0-9a-f-]{36}$/i;
const recent = () => encodeURIComponent(new Date(Date.now() - 2 * 60 * 1000).toISOString());

// ส่งไปทุกเครื่อง + ลบเครื่องที่เลิกรับแล้ว (404/410)
async function deliver(subs: Sub[], payload: Payload) {
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      const status = await sendPush(s, payload, VAPID);
      if (status === 404 || status === 410) gone.push(s.id);
      else if (status >= 200 && status < 300) sent++;
      else console.warn("push status", status, new URL(s.endpoint).host);
    } catch (e) {
      console.warn("push error", String(e));
    }
  }));
  if (gone.length) await rest(`push_subscriptions?id=in.(${gone.join(",")})`, { method: "DELETE" });
  return json({ sent, removed: gone.length });
}

// แถวใหม่ใน notifications → เครื่องของผู้รับ
async function pushNotification(id: string) {
  const nRes = await rest(`notifications?id=eq.${id}&created_at=gte.${recent()}&select=id,user_id,title,body,for_staff`);
  const [n] = nRes.ok ? await nRes.json() : [];
  if (!n) return json({ sent: 0 });
  const sRes = await rest(`push_subscriptions?user_id=eq.${n.user_id}&select=id,endpoint,p256dh,auth`);
  const subs: Sub[] = sRes.ok ? await sRes.json() : [];
  return deliver(subs, { title: n.title || "LabHub", body: n.body || "", url: targetUrl(n), tag: n.id });
}

const KIND_TEXT: Record<string, [string, string]> = {
  borrow: ["คำขอยืมใหม่", "ขอยืม"],
  return: ["คำขอคืนใหม่", "ส่งคืน"],
  renew: ["คำขอยืมต่อ", "ขอยืมต่อ"],
  pickup: ["คำขอนัดรับใหม่", "ขอนัดรับ"],
};

// "วันที่ 14/10/2569 เวลา 13:00 น." (เวลาไทย ปี พ.ศ. — แบบเดียวกับ _thai_when ในฐานข้อมูล)
function thaiWhen(iso: string) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `วันที่ ${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear() + 543} เวลา ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} น.`;
}

// ส่งถึงเครื่องของผู้ดูแลทุกคน (admin + TA) ยกเว้นเจ้าของคำขอ
async function deliverToStaff(ownerId: string, payload: Payload) {
  const staffRes = await rest(`profiles?role=in.(admin,ta)&id=neq.${ownerId}&select=id`);
  const staff: { id: string }[] = staffRes.ok ? await staffRes.json() : [];
  if (!staff.length) return json({ sent: 0 });
  const sRes = await rest(`push_subscriptions?user_id=in.(${staff.map((x) => x.id).join(",")})&select=id,endpoint,p256dh,auth`);
  const subs: Sub[] = sRes.ok ? await sRes.json() : [];
  return deliver(subs, payload);
}

async function ownerName(userId: string) {
  const pRes = await rest(`profiles?id=eq.${userId}&select=full_name,email`);
  const [p] = pRes.ok ? await pRes.json() : [];
  return p?.full_name || p?.email || "นักศึกษา";
}

// นักศึกษายกเลิกคำขอนัดรับเอง → ผู้ดูแล
async function pushPickupCancel(id: string) {
  const rRes = await rest(`pickup_requests?id=eq.${id}&status=eq.cancelled&decided_at=gte.${recent()}&select=id,user_id,item_prefix,pickup_at`);
  const [r] = rRes.ok ? await rRes.json() : [];
  if (!r) return json({ sent: 0 });
  const who = await ownerName(r.user_id);
  return deliverToStaff(r.user_id, {
    title: "นักศึกษายกเลิกนัดรับ",
    body: `${who} ยกเลิกคำขอนัดรับ รุ่น ${r.item_prefix}${r.pickup_at ? ` (นัด${thaiWhen(r.pickup_at)})` : ""}`,
    url: "/admin/requests",
    tag: r.id,
  });
}

const KIND_NAME: Record<string, string> = { borrow: "คำขอยืม", return: "คำขอคืน", renew: "คำขอยืมต่อ" };

// นักศึกษายกเลิกคำขอยืม/คืน/ยืมต่อเอง → ผู้ดูแล
async function pushBorrowCancel(id: string) {
  const rRes = await rest(`borrow_requests?id=eq.${id}&status=eq.cancelled&decided_at=gte.${recent()}&select=id,user_id,kind,item:items(name,item_code)`);
  const [r] = rRes.ok ? await rRes.json() : [];
  if (!r) return json({ sent: 0 });
  const who = await ownerName(r.user_id);
  const what = r.item ? ` "${r.item.name}" (${r.item.item_code})` : "";
  return deliverToStaff(r.user_id, {
    title: "นักศึกษายกเลิกคำขอ",
    body: `${who} ยกเลิก${KIND_NAME[r.kind] || "คำขอ"}${what}`,
    url: "/admin/requests",
    tag: r.id,
  });
}

// คำขอใหม่ (ยืม/คืน/ยืมต่อ/นัดรับ) → เครื่องของผู้ดูแลทุกคน ยกเว้นคนขอเอง
async function pushStaffRequest(id: string, source: string) {
  if (source === "pickup_cancel") return pushPickupCancel(id);
  if (source === "borrow_cancel") return pushBorrowCancel(id);
  const isPickup = source === "pickup";
  const rRes = await rest(
    isPickup
      ? `pickup_requests?id=eq.${id}&status=eq.pending&created_at=gte.${recent()}&select=id,user_id,item_prefix`
      : `borrow_requests?id=eq.${id}&status=eq.pending&created_at=gte.${recent()}&select=id,user_id,kind,item:items(name,item_code)`,
  );
  const [r] = rRes.ok ? await rRes.json() : [];
  if (!r) return json({ sent: 0 });

  const who = await ownerName(r.user_id);
  const what = isPickup ? `รุ่น ${r.item_prefix}` : r.item ? `"${r.item.name}" (${r.item.item_code})` : "อุปกรณ์";
  const [title, verb] = KIND_TEXT[isPickup ? "pickup" : r.kind] || KIND_TEXT.borrow;

  return deliverToStaff(r.user_id, {
    title,
    body: `${who} ${verb} ${what}`,
    url: isPickup ? "/admin/requests" : `/admin/requests?id=${r.id}`,
    tag: r.id,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") {
    if (!VAPID.publicKey) return json({ error: "not_configured" }, 503);
    return json({ publicKey: VAPID.publicKey });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!VAPID.publicKey || !VAPID.privateKey) return json({ error: "not_configured" }, 503);

  let data: any = {};
  try { data = await req.json(); } catch { /* ไม่ใช่ JSON */ }
  if (data.request_id) {
    const id = String(data.request_id);
    if (!UUID.test(id)) return json({ error: "bad_id" }, 400);
    return pushStaffRequest(id, String(data.source || "borrow"));
  }
  const id = String(data.id || "");
  if (!UUID.test(id)) return json({ error: "bad_id" }, 400);
  return pushNotification(id);
});
