import { RECORD_STATUS } from "./status";

// รายงานการยืม-คืนตามช่วงเวลา (เฟส 5.1) — คำนวณล้วน ไม่มี UI (ทดสอบแยกได้)
// นับตาม "วันที่ยืม" อยู่ในช่วง / คำขอนับตามวันที่ส่ง / เวลาไทย (Asia/Bangkok)

export type ReportRecord = {
  id: string;
  status: string; // borrowed | pending_return | returned
  borrow_date: string | null;
  due_date: string | null;
  return_date: string | null;
  return_condition: string | null;
  damage_cost: number | string | null;
  damage_note: string | null;
  auto_returned: boolean | null;
  renew_count: number | null;
  item: { item_code: string | null; name: string | null; category: string } | null;
  borrower: string | null;
  checker: string | null;
};

export type ReportRequest = { kind: string; status: string };

const bkkDate = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(0, 10) : null;

export const todayBkk = () => bkkDate(new Date().toISOString())!;

const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

// คืนช้ากี่วัน (คืนแล้ว = วันคืน - กำหนด / ยังไม่คืน = วันนี้ - กำหนด) ไม่ช้า = 0
export function lateDays(r: ReportRecord, today = todayBkk()) {
  if (!r.due_date) return 0;
  // ข้อมูลรุ่นเก่า: คืนแล้วแต่ไม่ได้บันทึกวันคืน → ไม่รู้ว่าช้าไหม (ไม่นับ)
  if (r.status === "returned" && !r.return_date) return 0;
  const end = r.status === "returned" ? bkkDate(r.return_date) || today : today;
  return Math.max(0, dayDiff(end, r.due_date));
}

export const STATUS_TH: Record<string, string> = Object.fromEntries(
  Object.entries(RECORD_STATUS).map(([k, v]) => [k, v.label])
);

export function summarize(records: ReportRecord[], requests: ReportRequest[], today = todayBkk()) {
  const returned = records.filter((r) => r.status === "returned");
  const open = records.filter((r) => r.status !== "returned");
  const damaged = returned.filter((r) => r.return_condition === "damaged");
  const count = (list: ReportRecord[], key: (r: ReportRecord) => string) => {
    const m = new Map<string, number>();
    list.forEach((r) => m.set(key(r), (m.get(key(r)) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const reqBy = (status: string) => requests.filter((q) => q.kind === "borrow" && q.status === status).length;

  return {
    borrows: records.length,
    returned: returned.length,
    stillOut: open.length,
    overdueNow: open.filter((r) => lateDays(r, today) > 0).length,
    // คืนช้า = นศ. คืนเองแต่เลยกำหนด — คืนอัตโนมัติ (ไม่มีผู้ดูแลยืนยันทัน) ไม่นับ ให้ตรงกับแถบ "จบยังไงบ้าง" ใน PDF
    returnedLate: returned.filter((r) => !r.auto_returned && lateDays(r, today) > 0).length,
    autoReturned: returned.filter((r) => r.auto_returned).length,
    damaged: damaged.length,
    damageCost: damaged.reduce((s, r) => s + (Number(r.damage_cost) || 0), 0),
    renewed: records.filter((r) => (r.renew_count || 0) > 0).length,
    requests: {
      total: requests.filter((q) => q.kind === "borrow").length,
      approved: reqBy("approved"),
      declined: reqBy("declined"),
      expired: reqBy("expired"),
      cancelled: reqBy("cancelled"),
    },
    topItems: count(records, (r) => r.item?.name || "ไม่ทราบ").slice(0, 5),
    topCategories: count(records, (r) => r.item?.category || "อื่นๆ").slice(0, 5),
    topBorrowers: count(records, (r) => r.borrower || "-").slice(0, 5),
  };
}

export type Summary = ReturnType<typeof summarize>;

export const thDate = (d: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }) : "-";

// แถวรายละเอียดสำหรับ CSV / PDF
export const DETAIL_HEADER = [
  "รหัสอุปกรณ์", "ชื่ออุปกรณ์", "หมวด", "ผู้ยืม", "วันที่ยืม", "กำหนดคืน", "วันที่คืน",
  "สถานะ", "คืนช้า (วัน)", "สภาพตอนคืน", "ค่าเสียหาย (บาท)", "หมายเหตุ", "ผู้ตรวจรับ",
];

export function detailRows(records: ReportRecord[], today = todayBkk()) {
  return records.map((r) => [
    r.item?.item_code || "-",
    r.item?.name || "-",
    r.item?.category || "-",
    r.borrower || "-",
    bkkDate(r.borrow_date) || "",
    r.due_date || "",
    r.status === "returned" ? bkkDate(r.return_date) || "" : "",
    r.auto_returned ? "คืนอัตโนมัติ" : STATUS_TH[r.status] || r.status,
    String(lateDays(r, today) || ""),
    r.return_condition === "damaged" ? "ชำรุด" : r.return_condition === "good" ? "ปกติ" : "",
    r.damage_cost != null && Number(r.damage_cost) > 0 ? String(Number(r.damage_cost)) : "",
    r.damage_note || "",
    r.checker || "",
  ]);
}

const esc = (v: string | number) =>
  String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// ───────── PDF (A4 แนวนอน) — ใช้กับ expo-print บนมือถือ / หน้าพิมพ์บนเว็บ ─────────
// ดีไซน์ที่เจ้าของโปรเจกต์เลือก (11 ต.ค. 2569): ตัวใหญ่ เข้ม ห่าง · หน้า 1 สรุป / หน้า 2 อันดับ + ตารางแยกเดือน 7 ช่อง
// ข้อมูลครบทุกช่อง (รหัส นศ. ผู้ตรวจรับ ฯลฯ) อยู่ใน CSV (DETAIL_HEADER / detailRows ด้านบน ไม่เปลี่ยน)

// ของที่ยืมแต่ละครั้ง "จบยังไง" — ทุกรายการตกอยู่กลุ่มเดียว รวมกันเท่ากับจำนวนยืมทั้งหมด
export type Outcome = "onTime" | "late" | "auto" | "notDue" | "overdue";
export function outcomeOf(r: ReportRecord, today = todayBkk()): Outcome {
  if (r.status === "returned") {
    if (r.auto_returned) return "auto";
    return lateDays(r, today) > 0 ? "late" : "onTime";
  }
  return lateDays(r, today) > 0 ? "overdue" : "notDue";
}
export const OUTCOME_STYLE: { key: Outcome; label: string; color: string }[] = [
  { key: "onTime", label: "คืนตรงเวลา", color: "#10B981" },
  { key: "late", label: "คืนช้า", color: "#F59E0B" },
  { key: "auto", label: "คืนอัตโนมัติ", color: "#FDBA74" },
  { key: "notDue", label: "ยังไม่ถึงกำหนด", color: "#93C5FD" },
  { key: "overdue", label: "เกินกำหนด", color: "#EF4444" },
];

// "ชื่อ · รหัส นศ." → ชื่ออย่างเดียว (ตารางใช้ชื่อ / กล่องต้องติดตามใช้เต็ม)
// บัญชีที่ไม่มีชื่อ (who() คืนอีเมล) → ส่วนหน้า @ ไม่ให้อีเมลเต็มล้นช่อง
const nameOnly = (who: string | null) => (who || "-").split(" · ")[0].split("@")[0];

const TH_MONTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const TH_MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
// "2026-09-02" → "2 ก.ย." (ปีบอกไว้ที่หัวเดือนแล้ว)
const shortDay = (d: string | null) => {
  if (!d) return "";
  const [, m, day] = d.slice(0, 10).split("-").map(Number);
  return `${day} ${TH_MON[m - 1]}`;
};

function statusOf(r: ReportRecord, today: string): { label: string; cls: string } {
  if (r.status === "returned") return r.auto_returned ? { label: "คืนอัตโนมัติ", cls: "auto" } : { label: "คืนแล้ว", cls: "ok" };
  if (lateDays(r, today) > 0) return { label: "เกินกำหนด", cls: "late" };
  if (r.status === "pending_return") return { label: "รอยืนยันคืน", cls: "out" };
  return { label: "กำลังยืม", cls: "out" };
}

// หมายเหตุ 1 ช่อง: รวมเรื่องที่ต้องสังเกต (ช้า / ชำรุด+ค่าเสียหาย / คืนอัตโนมัติ / เกิน) — แถวปกติ = ว่าง
function noteOf(r: ReportRecord, today: string): { text: string; cls: string } {
  const late = lateDays(r, today);
  if (r.status !== "returned") return late > 0 ? { text: `เกิน ${late} วัน`, cls: "bad" } : { text: "", cls: "" };
  if (r.auto_returned) return { text: "ยังไม่ได้ตรวจสภาพ", cls: "warn" };
  const parts: string[] = [];
  if (late > 0) parts.push(`ช้า ${late} วัน`);
  if (r.return_condition === "damaged") {
    const cost = Number(r.damage_cost) || 0;
    parts.push(`ชำรุด${cost > 0 ? ` ${cost.toLocaleString("th-TH")} บาท` : ""}`);
    if (r.damage_note) parts.push(r.damage_note);
  }
  return { text: parts.join(" · "), cls: parts.length ? "bad" : "" };
}

// กล่อง "ต้องติดตาม" หน้า 1: เกินกำหนด (มากสุดก่อน) → ชำรุด → คืนอัตโนมัติที่ยังไม่มีผู้ตรวจ
function watchList(records: ReportRecord[], today: string) {
  const codeOf = (r: ReportRecord) => r.item?.item_code || r.item?.name || "-";
  const overdue = records
    .filter((r) => r.status !== "returned" && lateDays(r, today) > 0)
    .sort((a, b) => lateDays(b, today) - lateDays(a, today))
    .map((r) => ({ code: codeOf(r), sub: r.borrower || "-", tag: `เกินกำหนด ${lateDays(r, today)} วัน`, cls: "red" }));
  const damaged = records
    .filter((r) => r.status === "returned" && r.return_condition === "damaged")
    .map((r) => {
      const cost = Number(r.damage_cost) || 0;
      return {
        code: codeOf(r),
        sub: [nameOnly(r.borrower), r.damage_note].filter(Boolean).join(" · "),
        tag: cost > 0 ? `ชำรุด ${cost.toLocaleString("th-TH")} บาท` : "ชำรุด",
        cls: "amber",
      };
    });
  const auto = records
    .filter((r) => r.status === "returned" && r.auto_returned && !r.checker)
    .map((r) => ({ code: codeOf(r), sub: `${nameOnly(r.borrower)} · คืนอัตโนมัติ`, tag: "รอตรวจสภาพ", cls: "amber" }));
  return [...overdue, ...damaged, ...auto];
}

export function reportHtml(opts: {
  title: string;
  rangeLabel: string;
  generatedBy: string;
  summary: Summary;
  records: ReportRecord[];
  autoPrint?: boolean;
}) {
  const s = opts.summary;
  const today = todayBkk();
  const total = opts.records.length;

  // หน้า 1 · ของที่ยืมจบยังไงบ้าง
  const counts = Object.fromEntries(OUTCOME_STYLE.map((o) => [o.key, 0])) as Record<Outcome, number>;
  opts.records.forEach((r) => { counts[outcomeOf(r, today)] += 1; });
  const pct = (n: number) => (total ? `${Math.round((n * 100) / total)}%` : "0%");
  const stack = total
    ? OUTCOME_STYLE.filter((o) => counts[o.key] > 0)
        .map((o) => `<span style="width:${((counts[o.key] * 100) / total).toFixed(2)}%;background:${o.color}"></span>`).join("")
    : `<span style="width:100%;background:#E2E8F0"></span>`;
  const outRows = OUTCOME_STYLE.map(
    (o) => `<tr><td><span class="sq" style="background:${o.color}"></span>${o.label}</td><td class="cv">${counts[o.key]}</td><td class="cp">${pct(counts[o.key])}</td></tr>`
  ).join("");

  // หน้า 1 · ต้องติดตาม — หน้า 1 ใส่ได้ราว 5 แถว (ทดสอบ 70 รายการแล้ว 8 แถวล้นไปหน้า 2) ที่เหลือบอกจำนวน
  const watch = watchList(opts.records, today);
  const WATCH_MAX = 5;
  const watchHtml = watch.length
    ? `<table class="watch">${watch.slice(0, WATCH_MAX).map((w) =>
        `<tr><td class="wn"><b>${esc(w.code)}</b><div class="who">${esc(w.sub)}</div></td><td class="st ${w.cls}">${esc(w.tag)}</td></tr>`).join("")}</table>${
        watch.length > WATCH_MAX ? `<div class="more">และอีก ${watch.length - WATCH_MAX} รายการ (ดูในตารางรายละเอียด)</div>` : ""}`
    : `<div class="none">ไม่มีรายการที่ต้องติดตาม</div>`;

  // หน้า 2 · อันดับ
  const rank = (items: [string, number][]) =>
    items.length
      ? items.map(([k, n], i) => `<tr><td class="rn">${i + 1}</td><td>${esc(k)}</td><td class="rv">${n}</td></tr>`).join("")
      : `<tr><td class="rn"></td><td>-</td><td></td></tr>`;
  const borrowersByName = s.topBorrowers.map(([k, n]) => [nameOnly(k), n] as [string, number]);
  const req = s.requests;

  // ตารางแยกเดือน เรียงตามวันยืม (เก่า → ใหม่) — ชื่อเดือนอยู่เหนือหัวคอลัมน์ของแต่ละเดือน
  const sorted = [...opts.records].sort((a, b) => (a.borrow_date || "\uffff").localeCompare(b.borrow_date || "\uffff"));
  const months: { key: string; label: string; rows: ReportRecord[] }[] = [];
  sorted.forEach((r) => {
    const key = (bkkDate(r.borrow_date) || "").slice(0, 7);
    let m = months[months.length - 1];
    if (!m || m.key !== key) {
      const [y, mo] = key.split("-").map(Number);
      m = { key, label: key ? `${TH_MONTH[mo - 1]} ${y + 543}` : "ไม่ระบุวันยืม", rows: [] };
      months.push(m);
    }
    m.rows.push(r);
  });
  const cols = `<colgroup><col style="width:14%"><col style="width:17%"><col style="width:9%"><col style="width:10%"><col style="width:9%"><col style="width:12%"><col style="width:29%"></colgroup>`;
  const head = `<thead><tr>${["อุปกรณ์", "ผู้ยืม", "วันยืม", "กำหนดคืน", "วันคืน", "สถานะ", "หมายเหตุ"].map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
  const monthHtml = months.length
    ? months.map((m) => {
        const body = m.rows.map((r) => {
          const st = statusOf(r, today);
          const nt = noteOf(r, today);
          return `<tr><td class="b">${esc(r.item?.item_code || r.item?.name || "-")}</td><td>${esc(nameOnly(r.borrower))}</td><td>${shortDay(bkkDate(r.borrow_date))}</td><td>${shortDay(r.due_date)}</td><td>${r.status === "returned" ? shortDay(bkkDate(r.return_date)) : ""}</td><td class="st ${st.cls}">${st.label}</td><td class="nt ${nt.cls}">${esc(nt.text)}</td></tr>`;
        }).join("");
        return `<div class="month"><div class="mh"><span class="mn">${m.label}</span><span class="mc">${m.rows.length} รายการ</span></div><table class="detail">${cols}${head}<tbody>${body}</tbody></table></div>`;
      }).join("")
    : `<div class="none">ไม่มีรายการในช่วงนี้</div>`;

  const now = new Date(Date.now() + 7 * 3600000);
  const generatedAt = `${now.getUTCDate()} ${TH_MON[now.getUTCMonth()]} ${now.getUTCFullYear() + 543} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")} น.`;
  const amber = (n: number) => (n ? " amber" : "");

  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page { size: A4 landscape; margin: 12mm 14mm; }
* { box-sizing: border-box; }
body { font-family: Sarabun, "Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif; color: #172033; margin: 0; font-size: 11pt; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.top { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 4mm; border-bottom: 2px solid #2563EB; }
.brand { font-size: 8.5pt; color: #2563EB; font-weight: 700; letter-spacing: .5pt; }
h1 { font-size: 19pt; margin: 1mm 0 0; line-height: 1.3; }
.range { font-size: 12pt; color: #334155; margin-top: .5mm; }
.meta { text-align: right; font-size: 9.5pt; color: #475569; line-height: 1.6; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); margin: 7mm 0 9mm; }
.kpi { padding: 0 5mm; border-left: 1px solid #E2E8F0; } .kpi:first-child { border-left: 0; padding-left: 0; }
.kpi .l { font-size: 11pt; color: #334155; font-weight: 600; }
.kpi .v { font-size: 30pt; font-weight: 700; line-height: 1.2; margin-top: 1mm; }
.kpi .h { font-size: 10pt; color: #475569; margin-top: 1mm; }
.red { color: #B91C1C; } .amber { color: #B45309; }
h2 { font-size: 13pt; margin: 0 0 4mm; line-height: 1.3; }
.cols { display: grid; grid-template-columns: 1.35fr 1fr; gap: 14mm; }
.stack { display: flex; height: 11mm; border-radius: 2mm; overflow: hidden; margin: 1mm 0 5mm; }
.stack span { display: block; height: 100%; border-right: 1.5px solid #fff; } .stack span:last-child { border-right: 0; }
.out { width: 100%; border-collapse: collapse; font-size: 11.5pt; } .out td { padding: 2.6mm 0; border-bottom: 1px solid #EEF2F7; }
.out .sq { display: inline-block; width: 3mm; height: 3mm; border-radius: .7mm; margin-right: 2.5mm; vertical-align: -.3mm; }
.out .cv { text-align: right; font-weight: 700; width: 14mm; } .out .cp { text-align: right; color: #475569; width: 14mm; }
.watch { width: 100%; border-collapse: collapse; font-size: 11.5pt; } .watch td { padding: 3mm 0; border-bottom: 1px solid #EEF2F7; vertical-align: top; }
.watch .wn { padding-right: 5mm; } .watch .who { font-size: 10pt; color: #475569; margin-top: .5mm; }
.watch .st { text-align: right; font-weight: 700; white-space: nowrap; }
.more, .none { font-size: 10.5pt; color: #475569; margin-top: 3mm; }
.ranks { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14mm; break-before: page; break-inside: avoid; padding-top: 2mm; }
.rk { width: 100%; border-collapse: collapse; font-size: 11.5pt; } .rk td { padding: 2.4mm 0; border-bottom: 1px solid #EEF2F7; }
.rk .rn { width: 7mm; color: #64748B; font-weight: 700; } .rk .rv { text-align: right; font-weight: 700; }
.tablesec { margin-top: 12mm; }
.month { margin-top: 8mm; } .month:first-of-type { margin-top: 3mm; }
.mh { display: flex; align-items: baseline; gap: 3mm; padding: 0 0 2mm 3mm; border-left: 1.4mm solid #2563EB; margin-bottom: 1mm; break-after: avoid; }
.mh .mn { font-size: 14pt; font-weight: 700; } .mh .mc { font-size: 10.5pt; color: #475569; font-weight: 600; }
table.detail { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11pt; }
table.detail thead { display: table-header-group; break-after: avoid; }
table.detail th { text-align: left; color: #475569; font-weight: 700; font-size: 10pt; padding: 2.6mm 3mm; border-bottom: 1.5px solid #94A3B8; white-space: nowrap; }
table.detail td { padding: 3.6mm 3mm; border-bottom: 1px solid #E2E8F0; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
table.detail th:first-child, table.detail td:first-child { padding-left: 1mm; }
table.detail tr { break-inside: avoid; }
table.detail .b { font-weight: 700; }
table.detail .st { font-weight: 700; } .st.ok { color: #15803D; } .st.out { color: #B45309; } .st.late { color: #B91C1C; } .st.auto { color: #C2410C; }
table.detail .nt { white-space: normal; } .nt.bad { color: #B91C1C; font-weight: 700; } .nt.warn { color: #B45309; font-weight: 700; }
.foot { color: #475569; font-size: 9.5pt; margin: -2mm 0 2mm; }
</style></head><body>

<div class="top">
  <div><div class="brand">LABHUB · IOT LAB</div><h1>${esc(opts.title)}</h1><div class="range">${esc(opts.rangeLabel)}</div></div>
  <div class="meta">ออกโดย ${esc(opts.generatedBy)}<br>${generatedAt}</div>
</div>

<div class="kpis">
  <div class="kpi"><div class="l">ยืมทั้งหมด</div><div class="v">${s.borrows}</div><div class="h">คืนแล้ว ${s.returned} · ยังไม่คืน ${s.stillOut}</div></div>
  <div class="kpi"><div class="l">เกินกำหนดตอนนี้</div><div class="v${s.overdueNow ? " red" : ""}">${s.overdueNow}</div><div class="h">ต้องตามคืน</div></div>
  <div class="kpi"><div class="l">คืนช้า</div><div class="v${amber(s.returnedLate)}">${s.returnedLate}</div><div class="h">คืนแล้วแต่เลยกำหนด</div></div>
  <div class="kpi"><div class="l">ชำรุด</div><div class="v${amber(s.damaged)}">${s.damaged}</div><div class="h">ค่าเสียหายรวม ${s.damageCost.toLocaleString("th-TH")} บาท</div></div>
</div>

<div class="cols">
  <div><h2>ของที่ยืม ${total} ครั้ง จบยังไงบ้าง</h2><div class="stack">${stack}</div><table class="out">${outRows}</table></div>
  <div><h2 class="red">ต้องติดตาม</h2>${watchHtml}</div>
</div>

<div class="ranks">
  <div><h2>อุปกรณ์ที่ยืมบ่อย</h2><table class="rk">${rank(s.topItems)}</table></div>
  <div><h2>ผู้ยืมบ่อย</h2><table class="rk">${rank(borrowersByName)}</table></div>
  <div><h2>คำขอยืม ${req.total} คำขอ</h2><table class="rk">
    <tr><td>อนุมัติ</td><td class="rv">${req.approved}</td></tr><tr><td>ปฏิเสธ</td><td class="rv">${req.declined}</td></tr>
    <tr><td>หมดเวลา (ไม่มีคนตอบ)</td><td class="rv">${req.expired}</td></tr><tr><td>ผู้ขอยกเลิก</td><td class="rv">${req.cancelled}</td></tr>
    <tr><td>ยืมต่อ</td><td class="rv">${s.renewed}</td></tr></table></div>
</div>

<div class="tablesec"><h2>รายการยืม-คืนทั้งหมด (${total} รายการ)</h2><div class="foot">นับตามวันที่ยืม เวลาไทย · ข้อมูลครบทุกช่อง (รหัส นศ. ผู้ตรวจรับ ฯลฯ) ดูได้ในไฟล์ CSV</div>${monthHtml}</div>
${opts.autoPrint ? "<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>" : ""}
</body></html>`;
}
