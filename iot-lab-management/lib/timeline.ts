// F3 ประวัติแบบแอปธนาคาร (ระบบยืม-คืน) — ตรรกะล้วน ไม่แตะ UI/DB ใช้ร่วม app/borrow.tsx + app/admin/history.tsx
// แปลง borrow_records + borrow_requests → เหตุการณ์ (ยืมออก / คืนเข้า / ยืมต่อ / ถูกปฏิเสธ / หมดอายุ) แล้วจัดกลุ่มตามวัน (เวลาไทย)

// โชว์ "ถูกปฏิเสธ / หมดอายุ" ในประวัติไหม (ยังรออาจารย์ตัดสิน — ปิด = false ที่เดียว; ชิป "อื่น ๆ" จะเหลือแค่ยืมต่อ)
export const SHOW_OTHER_EVENTS = true;

export type EventKind = "borrow" | "return" | "renew" | "declined" | "expired" | "pickup" | "no_show";
export type DetailTone = "normal" | "warn" | "bad";

export type TimelineEvent = {
  key: string;
  kind: EventKind;
  at: string; // ISO timestamptz
  itemName: string;
  userId: string;
  detail: string;
  detailTone: DetailTone;
  overdue: boolean; // ยืมออกที่ยังไม่คืนและเกินกำหนดแล้ว
};

export const EVENT_STYLE: Record<EventKind, { label: string; icon: string; color: string; bg: string }> = {
  borrow:   { label: "ยืมออก",     icon: "arrow-up-outline",       color: "#1D4ED8", bg: "#DBEAFE" },
  return:   { label: "คืนเข้า",     icon: "arrow-down-outline",     color: "#047857", bg: "#ECFDF5" },
  renew:    { label: "ยืมต่อ",      icon: "refresh-outline",        color: "#6D28D9", bg: "#EDE9FE" },
  declined: { label: "ถูกปฏิเสธ",   icon: "close-outline",          color: "#B91C1C", bg: "#FEF2F2" },
  expired:  { label: "หมดอายุ",     icon: "timer-outline",          color: "#475569", bg: "#F1F5F9" },
  pickup:   { label: "นัดรับ",      icon: "calendar-outline",       color: "#047857", bg: "#ECFDF5" },
  no_show:  { label: "ไม่มาตามนัด", icon: "alert-circle-outline",   color: "#B91C1C", bg: "#FEF2F2" },
};

const DAY_MS = 86400000;
const BKK_OFFSET = 7 * 3600000;
const WEEKDAYS = ["วันอาทิตย์", "วันจันทร์", "วันอังคาร", "วันพุธ", "วันพฤหัสบดี", "วันศุกร์", "วันเสาร์"];
const pad = (n: number) => String(n).padStart(2, "0");

// เวลาไทยเสมอ ไม่ขึ้นกับเขตเวลาเครื่อง (เลื่อน +7 ชม. แล้วอ่านแบบ UTC)
const bkk = (iso: string) => new Date(new Date(iso).getTime() + BKK_OFFSET);
export const bkkDayKey = (iso: string) => {
  const d = bkk(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
export const bkkTime = (iso: string) => {
  const d = bkk(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};
// "2026-10-09" → "09/10/2569"
export const thaiDay = (dayKey: string) => {
  const [y, m, d] = dayKey.slice(0, 10).split("-").map(Number);
  return `${pad(d)}/${pad(m)}/${y + 543}`;
};
const todayKey = () => bkkDayKey(new Date().toISOString());
// ส่วนต่างวันของวันที่ล้วน (YYYY-MM-DD)
const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(`${a.slice(0, 10)}T00:00:00Z`) - Date.parse(`${b.slice(0, 10)}T00:00:00Z`)) / DAY_MS);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day.slice(0, 10)}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

type BuildOpts = {
  itemName: (itemId: string | null) => string;
  // Admin: ชื่อผู้อนุมัติ (ไม่ส่ง = ไม่โชว์)
  approver?: (requestId: string | null) => string | null;
};

// "11/10/2569 09:30 น." (เวลาไทย)
const dayTime = (iso: string) => `${thaiDay(bkkDayKey(iso))} ${bkkTime(iso)} น.`;

// pickups = แถว pickup_requests (F2) — นัดรับ (นัดแล้ว/รับแล้ว) + ไม่มาตามนัด
export function buildEvents(records: any[], requests: any[], opts: BuildOpts, pickups: any[] = []): TimelineEvent[] {
  const today = todayKey();
  const out: TimelineEvent[] = [];
  const recById: Record<string, any> = {};
  records.forEach((r) => { recById[r.id] = r; });

  for (const r of records) {
    const item = opts.itemName(r.item_id);
    if (r.borrow_date) {
      const parts: string[] = [];
      let overdue = false;
      if (r.due_date) {
        const days = dayDiff(r.due_date, bkkDayKey(r.borrow_date));
        parts.push(`ครบกำหนด ${thaiDay(r.due_date)}`);
        if (days > 0 && !r.renew_count) parts.push(`ยืม ${days} วัน`);
        const late = dayDiff(today, r.due_date);
        overdue = (r.status === "borrowed" || r.status === "pending_return") && late > 0;
        if (overdue) parts.push(`เกินกำหนด ${late} วัน`);
      }
      const by = opts.approver?.(r.borrow_request_id ?? null);
      if (by) parts.push(`อนุมัติโดย ${by}`);
      out.push({
        key: `b:${r.id}`, kind: "borrow", at: r.borrow_date, itemName: item, userId: r.user_id,
        detail: parts.join(" · ") || "ยืมออก", detailTone: overdue ? "bad" : "normal", overdue,
      });
    }
    if (r.status === "returned" && r.return_date) {
      let detail = "สภาพปกติ";
      let tone: DetailTone = "normal";
      if (r.auto_returned) {
        detail = "คืนอัตโนมัติ (รอตรวจย้อนหลัง)";
        tone = "warn";
      } else if (r.return_condition === "damaged") {
        detail = `ชำรุด${r.damage_cost != null ? ` · ค่าเสียหาย ${Number(r.damage_cost).toLocaleString()} บาท` : ""}`;
        tone = "warn";
      }
      out.push({ key: `r:${r.id}`, kind: "return", at: r.return_date, itemName: item, userId: r.user_id, detail, detailTone: tone, overdue: false });
    }
  }

  for (const q of requests) {
    const at = q.decided_at || q.expires_at || q.created_at;
    if (!at) continue;
    const item = opts.itemName(q.item_id);
    if (q.kind === "renew" && q.status === "approved") {
      const rec = q.borrow_record_id ? recById[q.borrow_record_id] : null;
      // ยืมต่อได้ครั้งเดียว → due_date ปัจจุบัน = ครบกำหนดใหม่, เดิม = ใหม่ − จำนวนวันที่ขอ
      const detail = rec?.due_date
        ? `ครบกำหนดใหม่ ${thaiDay(rec.due_date)} (เดิม ${thaiDay(addDays(rec.due_date, -(q.days || 0)))})`
        : `ยืมต่ออีก ${q.days} วัน`;
      out.push({ key: `q:${q.id}`, kind: "renew", at, itemName: item, userId: q.user_id, detail, detailTone: "normal", overdue: false });
    } else if (SHOW_OTHER_EVENTS && q.status === "declined") {
      out.push({
        key: `q:${q.id}`, kind: "declined", at, itemName: item, userId: q.user_id,
        detail: `${KIND_TH[q.kind] || "คำขอ"} · เหตุผล: ${q.decision_note || "-"}`, detailTone: "bad", overdue: false,
      });
    } else if (SHOW_OTHER_EVENTS && q.status === "expired" && q.kind !== "return") {
      // คำขอคืนที่หมดเวลา = คืนอัตโนมัติ (เห็นเป็น "คืนเข้า" อยู่แล้ว)
      out.push({
        key: `q:${q.id}`, kind: "expired", at, itemName: item, userId: q.user_id,
        detail: `${KIND_TH[q.kind] || "คำขอ"} · ไม่มีผู้ดูแลตอบภายในเวลา`, detailTone: "normal", overdue: false,
      });
    }
  }

  for (const p of pickups) {
    if (!p.decided_at || !p.pickup_at) continue;
    if (p.status === "scheduled" || p.status === "picked_up") {
      out.push({
        key: `p:${p.id}`, kind: "pickup", at: p.decided_at, itemName: p.item_prefix, userId: p.user_id,
        detail: `นัดรับ ${dayTime(p.pickup_at)} · ยืม ${p.days} วัน${p.status === "picked_up" ? " · รับของแล้ว" : ""}`,
        detailTone: "normal", overdue: false,
      });
    } else if (p.status === "no_show") {
      out.push({
        key: `p:${p.id}`, kind: "no_show", at: p.decided_at, itemName: p.item_prefix, userId: p.user_id,
        detail: `นัดไว้ ${dayTime(p.pickup_at)}`, detailTone: "bad", overdue: false,
      });
    }
  }

  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

const KIND_TH: Record<string, string> = { borrow: "ขอยืม", return: "ขอคืน", renew: "ขอยืมต่อ" };

export type DayGroup = { dayKey: string; title: string; weekday: string; events: TimelineEvent[] };

// จัดกลุ่มตามวัน (ใหม่สุดบน) — events ต้องเรียงใหม่→เก่ามาแล้ว
export function groupByDay(events: TimelineEvent[]): DayGroup[] {
  const today = todayKey();
  const groups: DayGroup[] = [];
  for (const e of events) {
    const key = bkkDayKey(e.at);
    let g = groups[groups.length - 1];
    if (!g || g.dayKey !== key) {
      const weekday = WEEKDAYS[new Date(`${key}T00:00:00Z`).getUTCDay()];
      g = { dayKey: key, title: key === today ? `วันนี้ · ${thaiDay(key)}` : thaiDay(key), weekday, events: [] };
      groups.push(g);
    }
    g.events.push(e);
  }
  return groups;
}

// ตัวกรองชิป
export type TimelineFilter = "all" | "borrow" | "return" | "overdue" | "other";
export function filterEvents(events: TimelineEvent[], f: TimelineFilter) {
  if (f === "all") return events;
  if (f === "borrow") return events.filter((e) => e.kind === "borrow");
  if (f === "return") return events.filter((e) => e.kind === "return");
  if (f === "overdue") return events.filter((e) => e.overdue);
  return events.filter((e) => e.kind !== "borrow" && e.kind !== "return");
}

// ช่วงเวลาที่ดึง (วันล่าสุด) + ปุ่มโหลดเพิ่ม — ไม่ดึงทั้งตาราง
export const PAGE_DAYS = 60;
export const sinceIso = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();
