import QRCode from "qrcode";
import { STATION_STATUS, naturalNo } from "./roomStatus";

// QR ห้องคอม: ป้ายแปะคอมแต่ละเครื่อง → สแกนแล้วเปิดผังห้องพร้อมแผ่นของเครื่องนั้น (ดูสถานะ / แจ้งปัญหา)
// ของระบบห้องเอง — ห้ามใช้ lib/labels.ts (ป้ายอุปกรณ์ระบบยืม-คืน) และห้ามให้หน้าสแกนระบบยืมอ่าน QR นี้
//   ค่าใน QR = ลิงก์เว็บจริง: สแกนด้วยกล้องมือถือก็เปิดได้ / ปุ่มสแกนในแอป (app/roomscan) อ่านลิงก์เดียวกันแล้วพาไปหน้าในแอป

// โดเมนเว็บจริง (ป้ายพิมพ์จากเครื่องไหนก็ต้องชี้ที่เดียวกัน — ห้ามใช้ window.location ตอนสร้างป้าย)
export const SITE_ORIGIN = "https://labhub-kku.vercel.app";

export type StationLabel = { id: string; name: string; group_no: number; room_id: string };

export function stationLink(roomId: string, stationId: string) {
  return `${SITE_ORIGIN}/roommap?room_id=${encodeURIComponent(roomId)}&station=${encodeURIComponent(stationId)}`;
}

// อ่านค่าจาก QR → ห้อง + เครื่อง (รับลิงก์โดเมนไหนก็ได้ที่เป็น /roommap?...&station=) / ไม่ใช่ QR ห้องคอม = null
export function parseStationLink(text: string): { room_id: string; station: string } | null {
  const match = String(text || "").trim().match(/\/roommap\?([^#\s]+)/);
  if (!match) return null;
  const params: Record<string, string> = {};
  match[1].split("&").forEach((pair) => {
    const [key, value = ""] = pair.split("=");
    try {
      params[key] = decodeURIComponent(value);
    } catch {
      params[key] = value;
    }
  });
  return params.room_id && params.station ? { room_id: params.room_id, station: params.station } : null;
}

function qrPath(value: string) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  let path = "";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (qr.modules.get(y, x)) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, path };
}

const esc = (value: string) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export const sortStations = <T extends { group_no: number; name: string }>(list: T[]) =>
  [...list].sort((a, b) => a.group_no - b.group_no || naturalNo(a.name) - naturalNo(b.name));

// หน้าพิมพ์ร่วม: A4 · ฟอนต์ Sarabun · บนเว็บ (autoPrint) แสดงเป็นแผ่นตัวอย่างแล้วเด้งกล่องพิมพ์เอง (เปิดซ้อนในแอป = ไม่เด้ง)
function page(title: string, css: string, body: string, autoPrint: boolean) {
  return `<!doctype html><html${autoPrint ? ` class="pv"` : ""}><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:10mm}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{font-family:'Sarabun',sans-serif;margin:0;color:#000}
.p{width:190mm;break-after:page}.p:last-child{break-after:auto}
@media screen{.pv{background:#EEF2F7}.pv body{padding:14px 0}
.pv .p{box-sizing:border-box;width:210mm;min-height:297mm;padding:10mm;margin:0 auto 14px;background:#fff;box-shadow:0 2px 10px rgba(23,32,51,.14)}}
${css}
</style></head><body>
${body}
${autoPrint ? `<script>
function fit(){ document.body.style.zoom = String(Math.min(1, (document.documentElement.clientWidth - 24) / 794)); }
fit(); addEventListener("resize", fit);
if (window.self === window.top) (document.fonts ? document.fonts.ready : Promise.resolve()).then(function(){ setTimeout(function(){ window.print(); }, 150); });
</script><style>@media print{body{zoom:1!important}}</style>` : ""}
</body></html>`;
}

// ป้ายแปะคอม 3 ขนาด (เลือกตอนกด "ป้าย QR" ใน admin/room) — พื้นที่พิมพ์ A4 = 190 × 277 มม.
//   ตัวหนังสือเล็กสุด 7.5pt · ห้อง/กลุ่มแยก 2 บรรทัด · ชื่อเครื่องยาวย่อฟอนต์เอง · ห้ามล้นกรอบ (เช็กชื่อยาวแบบ "SERVER-01A")
export type LabelSize = "s" | "m" | "l";
type LabelSpec = {
  name: string; w: number; h: number; qr: number; cols: number; rows: number; gapX: number; gapY: number;
  room: number; title: number; hint: number; brand: number; short: boolean;
};
export const LABEL_SIZES: Record<LabelSize, LabelSpec> = {
  // 4×45 + 3×3 = 189 · 8×32 + 7×2.5 = 273.5 (มม.) — ป้ายเล็ก: คำอธิบายบรรทัดเดียว ไม่มี LabHub
  s: { name: "เล็ก", w: 45, h: 32, qr: 22, cols: 4, rows: 8, gapX: 3, gapY: 2.5, room: 7.5, title: 20, hint: 7.5, brand: 0, short: true },
  // 3×60 + 2×5 = 190 · 6×42 + 5×3 = 267
  m: { name: "ปกติ", w: 60, h: 42, qr: 32, cols: 3, rows: 6, gapX: 5, gapY: 3, room: 8.5, title: 23, hint: 8, brand: 8.5, short: false },
  // 2×92 + 5 = 189 · 4×62 + 3×3 = 257
  l: { name: "ใหญ่", w: 92, h: 62, qr: 50, cols: 2, rows: 4, gapX: 5, gapY: 3, room: 12.5, title: 38, hint: 11.5, brand: 12, short: false },
};
export const labelsPerSheet = (size: LabelSize) => LABEL_SIZES[size].cols * LABEL_SIZES[size].rows;

// ชื่อเครื่องยาว → ย่อฟอนต์ (> 4 ตัว ×0.78, > 6 ตัว ×0.6, > 10 ตัว ย่อตามความยาว ไม่ต่ำกว่า ×0.36) + ตัดขึ้นบรรทัดใหม่ (overflow-wrap)
const nameScale = (name: string) => {
  const n = name.length;
  if (n <= 4) return 1;
  if (n <= 6) return 0.78;
  if (n <= 10) return 0.6;
  return Math.max(0.36, 6 / n);
};

export function buildStationLabelsHtml(stations: StationLabel[], autoPrint = true, sizeKey: LabelSize = "m") {
  const z = LABEL_SIZES[sizeKey];
  const per = z.cols * z.rows;
  const cells = sortStations(stations).map((st) => {
    const { size, path } = qrPath(stationLink(st.room_id, st.id));
    const scale = nameScale(st.name);
    return `<div class="l">
  <svg class="q" viewBox="-1 -1 ${size + 2} ${size + 2}" shape-rendering="crispEdges"><path fill="#000" d="${path}"/></svg>
  <div class="t">
    <div class="r">ห้อง ${esc(st.room_id)}<br>กลุ่ม ${st.group_no}</div>
    <div class="n"${scale < 1 ? ` style="font-size:${(z.title * scale).toFixed(1)}pt"` : ""}>${esc(st.name)}</div>
    <div class="h">${z.short ? "สแกนแจ้งเครื่องเสีย" : "สแกนดูสถานะ<br>แจ้งเครื่องเสีย"}</div>
    ${z.brand ? `<div class="b">LabHub</div>` : ""}
  </div>
</div>`;
  });
  const pages: string[] = [];
  for (let i = 0; i < Math.max(1, cells.length); i += per) {
    pages.push(`<div class="p"><div class="g">${cells.slice(i, i + per).join("")}</div></div>`);
  }
  const css = `
.g{display:grid;grid-template-columns:repeat(${z.cols},${z.w}mm);grid-auto-rows:${z.h}mm;gap:${z.gapY}mm ${z.gapX}mm}
.l{border:.25mm dashed #999;border-radius:2mm;display:flex;align-items:center;gap:2mm;padding:2mm;box-sizing:border-box;overflow:hidden;break-inside:avoid}
.q{flex:none;width:${z.qr}mm;height:${z.qr}mm;display:block}
.t{min-width:0;flex:1}
.r,.n{overflow-wrap:anywhere}
.r{font-size:${z.room}pt;color:#333;line-height:1.2}
.n{font-size:${z.title}pt;font-weight:700;line-height:1.05}
.h{font-size:${z.hint}pt;color:#333;line-height:1.2;margin-top:.8mm}
.b{font-size:${z.brand}pt;font-weight:700;color:#1D4ED8;margin-top:.6mm}`;
  return page(`ป้าย QR คอม ${stations.length} เครื่อง (${z.name})`, css, pages.join(""), autoPrint);
}

// สรุปห้องคอม (PDF) — ภาพรวมห้อง + แยกตามกลุ่ม + รายการที่ต้องดูแล
export type RoomSummaryData = {
  roomId: string;
  place: string;
  stations: { id: string; name: string; group_no: number; status: string | null }[];
  lanPorts: { group_no: number; port_no: number; status: string | null }[];
  equipIssues: { station_id: string; equipment_type: string; status: string }[];
  openRepairs: number;
  openReports: number;
};

const EQUIP_NAME: Record<string, string> = { mouse: "เมาส์", keyboard: "คีย์บอร์ด", monitor: "จอภาพ" };
const EQUIP_STATE: Record<string, string> = { missing: "หาย", broken: "ชำรุด" };

export function buildRoomSummaryHtml(d: RoomSummaryData, autoPrint = true) {
  const stations = sortStations(d.stations);
  const count = (status: string) => stations.filter((st) => (st.status || "available") === status).length;
  const lanBad = d.lanPorts.filter((p) => (p.status || "available") !== "available");
  const groups = [...new Set(stations.map((st) => st.group_no))].sort((a, b) => a - b);
  const byId = new Map(stations.map((st) => [st.id, st]));
  const now = new Date().toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" });

  const groupRows = groups.map((g) => {
    const list = stations.filter((st) => st.group_no === g);
    const n = (status: string) => list.filter((st) => (st.status || "available") === status).length;
    const ports = d.lanPorts.filter((p) => p.group_no === g);
    const portsOk = ports.filter((p) => (p.status || "available") === "available").length;
    return `<tr><td>กลุ่ม ${g}</td><td>${list.length}</td><td>${n("available")}</td><td>${n("repair") || "-"}</td><td>${n("broken") || "-"}</td><td>${portsOk}/${ports.length}</td></tr>`;
  }).join("");

  const problemStations = stations.filter((st) => (st.status || "available") !== "available");
  const problemRows = [
    ...problemStations.map((st) =>
      `<tr><td>กลุ่ม ${st.group_no} · ${esc(st.name)}</td><td>เครื่อง: ${esc((STATION_STATUS[st.status || ""] || { label: st.status }).label)}</td></tr>`),
    ...d.equipIssues
      .filter((e) => byId.has(e.station_id))
      .sort((a, b) => {
        const sa = byId.get(a.station_id)!, sb = byId.get(b.station_id)!;
        return sa.group_no - sb.group_no || naturalNo(sa.name) - naturalNo(sb.name);
      })
      .map((e) => {
        const st = byId.get(e.station_id)!;
        return `<tr><td>กลุ่ม ${st.group_no} · ${esc(st.name)}</td><td>${EQUIP_NAME[e.equipment_type] || e.equipment_type}: ${EQUIP_STATE[e.status] || e.status}</td></tr>`;
      }),
    ...lanBad.map((p) =>
      `<tr><td>กลุ่ม ${p.group_no} · Port ${p.port_no}</td><td>LAN: ${esc((STATION_STATUS[p.status || ""] || { label: p.status }).label)}</td></tr>`),
  ].join("");

  const body = `<div class="p">
<h1>สรุปห้องคอม ${esc(d.roomId)}</h1>
<p class="sub">${esc(d.place)} · ข้อมูล ณ ${esc(now)}</p>
<div class="k">
  <div><b>${stations.length}</b><span>เครื่องทั้งหมด</span></div>
  <div><b class="ok">${count("available")}</b><span>ใช้งานได้</span></div>
  <div><b class="wr">${count("repair")}</b><span>กำลังซ่อม</span></div>
  <div><b class="er">${count("broken")}</b><span>เสีย</span></div>
</div>
<div class="k">
  <div><b>${d.lanPorts.length - lanBad.length}/${d.lanPorts.length}</b><span>LAN port ใช้งานได้</span></div>
  <div><b>${d.equipIssues.length}</b><span>อุปกรณ์หาย/ชำรุด</span></div>
  <div><b>${d.openRepairs}</b><span>งานซ่อมค้าง</span></div>
  <div><b>${d.openReports}</b><span>แจ้งปัญหารอตรวจ</span></div>
</div>
<h2>แยกตามกลุ่ม</h2>
<table><thead><tr><th>กลุ่ม</th><th>เครื่อง</th><th>ใช้งานได้</th><th>กำลังซ่อม</th><th>เสีย</th><th>LAN ใช้ได้</th></tr></thead><tbody>${groupRows || `<tr><td colspan="6">ยังไม่มีเครื่องในห้องนี้</td></tr>`}</tbody></table>
<h2>รายการที่ต้องดูแล</h2>
<table><thead><tr><th>ตำแหน่ง</th><th>ปัญหา</th></tr></thead><tbody>${problemRows || `<tr><td colspan="2">ไม่มี — ทุกเครื่องปกติ</td></tr>`}</tbody></table>
</div>`;
  const css = `
h1{font-size:18pt;margin:0}h2{font-size:12pt;margin:6mm 0 2mm}
.sub{font-size:9pt;color:#444;margin:1mm 0 4mm}
.k{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-bottom:3mm}
.k div{border:.3mm solid #D3E0F5;border-radius:2mm;padding:2.5mm}
.k b{display:block;font-size:16pt}.k span{font-size:8.5pt;color:#444}
.ok{color:#16a34a}.wr{color:#b45309}.er{color:#dc2626}
table{width:100%;border-collapse:collapse;font-size:9.5pt}
th,td{border:.25mm solid #CBD5E1;padding:1.6mm 2.4mm;text-align:left}
th{background:#EEF5FF}
tr{break-inside:avoid}`;
  return page(`สรุปห้องคอม ${d.roomId}`, css, body, autoPrint);
}
