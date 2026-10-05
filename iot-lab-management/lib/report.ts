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
    returnedLate: returned.filter((r) => lateDays(r, today) > 0).length,
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

// PDF (A4 แนวนอน) — ใช้กับ expo-print บนมือถือ / หน้าพิมพ์บนเว็บ
export function reportHtml(opts: {
  title: string;
  rangeLabel: string;
  generatedBy: string;
  summary: Summary;
  rows: string[][];
  autoPrint?: boolean;
}) {
  const s = opts.summary;
  const stat = (label: string, value: string | number) =>
    `<div class="stat"><div class="v">${esc(value)}</div><div class="l">${esc(label)}</div></div>`;
  const list = (title: string, items: [string, number][]) =>
    `<div class="box"><h3>${esc(title)}</h3>${
      items.length ? `<ol>${items.map(([k, n]) => `<li>${esc(k)} <b>${n}</b></li>`).join("")}</ol>` : "<p>-</p>"
    }</div>`;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
<style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: Sarabun, sans-serif; color: #0f172a; margin: 0; font-size: 10pt; }
h1 { font-size: 16pt; margin: 0; } h3 { font-size: 10.5pt; margin: 0 0 2mm; }
.sub { color: #475569; margin: 1mm 0 4mm; }
.stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 2mm; margin-bottom: 3mm; }
.stat { border: 1px solid #cbd5e1; border-radius: 2mm; padding: 2mm; text-align: center; }
.stat .v { font-size: 14pt; font-weight: 700; } .stat .l { color: #475569; font-size: 8.5pt; }
.boxes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm; margin-bottom: 4mm; }
.box { border: 1px solid #cbd5e1; border-radius: 2mm; padding: 2mm 3mm; }
.box ol { margin: 0; padding-left: 5mm; } .box p { margin: 0; }
table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
th, td { border: 1px solid #cbd5e1; padding: 1mm 1.5mm; text-align: left; vertical-align: top; }
th { background: #f1f5f9; } tr { break-inside: avoid; }
.foot { color: #94a3b8; font-size: 8pt; margin-top: 3mm; }
</style></head><body>
<h1>${esc(opts.title)}</h1>
<div class="sub">${esc(opts.rangeLabel)} · ออกรายงานโดย ${esc(opts.generatedBy)} · ${esc(new Date().toLocaleString("th-TH"))}</div>
<div class="stats">
${stat("ยืมทั้งหมด", s.borrows)}${stat("คืนแล้ว", s.returned)}${stat("ยังไม่คืน", s.stillOut)}
${stat("เกินกำหนดตอนนี้", s.overdueNow)}${stat("คืนช้า", s.returnedLate)}${stat("ชำรุด / ค่าเสียหาย", `${s.damaged} / ${s.damageCost.toLocaleString("th-TH")} ฿`)}
</div>
<div class="boxes">
<div class="box"><h3>คำขอยืม ${s.requests.total}</h3><p>อนุมัติ ${s.requests.approved} · ปฏิเสธ ${s.requests.declined}<br>หมดเวลา ${s.requests.expired} · ยกเลิก ${s.requests.cancelled}<br>ยืมต่อ ${s.renewed} · คืนอัตโนมัติ ${s.autoReturned}</p></div>
${list("อุปกรณ์ที่ยืมบ่อย", s.topItems)}${list("หมวดที่ยืมบ่อย", s.topCategories)}${list("ผู้ยืมบ่อย", s.topBorrowers)}
</div>
<table><thead><tr>${DETAIL_HEADER.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
<tbody>${opts.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${DETAIL_HEADER.length}">ไม่มีรายการในช่วงนี้</td></tr>`}</tbody></table>
<div class="foot">LabHub · IoT Lab — นับตามวันที่ยืม (เวลาไทย)</div>
${opts.autoPrint ? "<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>" : ""}
</body></html>`;
}
