// Service worker ของ LabHub (เว็บ/PWA เท่านั้น — แอปมือถือไม่ใช้ไฟล์นี้)
//   1) cache แบบเบา: หน้าเว็บ = เน็ตก่อน (ไม่มีเน็ตค่อยใช้ของเก่า) / ไฟล์ /_expo/static/ (ชื่อมี hash ไม่เปลี่ยน) + ไอคอน = ใช้ของใน cache
//      ไม่ยุ่งกับคำขอไป Supabase (คนละโดเมน) → ข้อมูลสดเสมอ
//   2) รับ Web Push จาก Edge Function send-push → แสดงแจ้งเตือน / แตะแล้วเปิดหรือโฟกัสแอปไปหน้าที่ระบุ
// แก้ไฟล์นี้แล้วเปลี่ยน VERSION → cache เก่าถูกล้างตอนเปิดครั้งถัดไป

const VERSION = "labhub-v3";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // เปิดหน้า: เน็ตก่อนเสมอ (ได้เวอร์ชันล่าสุดหลัง deploy) — ออฟไลน์ค่อยใช้หน้าที่เคยเก็บ / หน้าแรก
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/"))),
    );
    return;
  }

  // ไฟล์ที่ชื่อมี hash (JS/ฟอนต์/รูปจาก expo export) + ไอคอน: cache ก่อน
  //   (มี ?query = ไฟล์ของ dev server ซึ่งชื่อไม่มี hash → ไม่ cache)
  const hashed = url.pathname.startsWith("/_expo/static/") || url.pathname.startsWith("/assets/");
  if (!url.search && (hashed || url.pathname.startsWith("/icons/"))) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
      ),
    );
  }
});

// ---------- Web Push ----------
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || "LabHub";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag || undefined,
      lang: "th",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (list) => {
      // มีแอปเปิดอยู่แล้ว → ใช้หน้าต่างเดิม ให้แอปเปลี่ยนหน้าเอง (lib/webPush ฟัง "labhub-open" → router.push ไม่ต้องโหลดใหม่)
      for (const client of list) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        try {
          const focused = await client.focus();
          (focused || client).postMessage({ type: "labhub-open", url: target });
          return;
        } catch {}
      }
      return self.clients.openWindow(target);
    }),
  );
});
