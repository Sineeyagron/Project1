// Edge Function: send-push — ส่ง Web Push ของแจ้งเตือน LabHub (ดู supabase/migrations/20261012110000_web_push.sql)
//   GET  → { publicKey } ให้แอปเว็บใช้สมัครรับ push (public key เปิดเผยได้)
//   POST { id } ← trigger notifications_push (pg_net) → ส่งไปทุกเครื่องของผู้รับ
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") {
    if (!VAPID.publicKey) return json({ error: "not_configured" }, 503);
    return json({ publicKey: VAPID.publicKey });
  }
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!VAPID.publicKey || !VAPID.privateKey) return json({ error: "not_configured" }, 503);

  let id = "";
  try { id = String((await req.json()).id || ""); } catch { /* ไม่ใช่ JSON */ }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "bad_id" }, 400);

  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const nRes = await rest(`notifications?id=eq.${id}&created_at=gte.${encodeURIComponent(since)}&select=id,user_id,title,body,for_staff`);
  const [n] = nRes.ok ? await nRes.json() : [];
  if (!n) return json({ sent: 0 });

  const sRes = await rest(`push_subscriptions?user_id=eq.${n.user_id}&select=id,endpoint,p256dh,auth`);
  const subs: { id: string; endpoint: string; p256dh: string; auth: string }[] = sRes.ok ? await sRes.json() : [];

  const payload = { title: n.title || "LabHub", body: n.body || "", url: targetUrl(n), tag: n.id };
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

  // เครื่องที่เลิกรับ/ถอนแอปแล้ว → ลบทิ้ง (ไม่ต้องส่งซ้ำครั้งหน้า)
  if (gone.length) await rest(`push_subscriptions?id=in.(${gone.join(",")})`, { method: "DELETE" });

  return json({ sent, removed: gone.length });
});
