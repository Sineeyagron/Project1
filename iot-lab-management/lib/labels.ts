import QRCode from "qrcode";

// ป้ายแปะอุปกรณ์ (แผน 2.1): 6×2.8 ซม. A4 แผ่นละ 27 ชิ้น (3×9) — แบบล็อกตาม ป้ายQR_แม่แบบ.html
export const LABELS_PER_SHEET = 27;

export type LabelItem = {
  item_prefix?: string | null;
  item_no?: number | null;
  item_code?: string | null;
  name?: string | null;
  barcode?: string | null;
  location_name?: string | null;
};

// ค่าใน QR = รหัสสแกน 4 ตัวเดิม (ห้ามเปลี่ยน ป้ายเก่าต้องใช้ต่อได้)
export function qrMatrix(value: string) {
  const qr = QRCode.create(value || "-", { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  let path = "";
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (qr.modules.get(y, x)) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { size, path };
}

export function formatItemNo(no?: number | null) {
  if (!no) return "";
  return no < 1000 ? String(no).padStart(3, "0") : String(no);
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

function labelHtml(item: LabelItem) {
  const { size, path } = qrMatrix(item.barcode || "");
  const prefix = item.item_prefix || item.item_code || item.name || "";
  const room = item.location_name ? `ห้อง ${item.location_name}` : "";
  return `<div class="l">
  <div class="q"><svg viewBox="-1 -1 ${size + 2} ${size + 2}" shape-rendering="crispEdges"><path fill="#000" d="${path}"/></svg></div>
  <div class="t">
    <div class="c">${escapeHtml(prefix)}</div>
    <div class="no">${formatItemNo(item.item_no)}</div>
    <div class="n">${escapeHtml(item.name || "")}</div>
    <div class="s">${escapeHtml([item.barcode, room].filter(Boolean).join(" · "))}</div>
  </div>
</div>`;
}

// startAt = ช่องแรกที่จะเริ่มพิมพ์ (1-27) ใช้กับแผ่นสติกเกอร์ที่ใช้ไปแล้วบางส่วน
// autoPrint = เว็บ: บนจอแสดงเป็นแผ่น A4 ย่อพอดีจอ (ช่องว่าง = เส้นประจาง) + เด้งกล่องพิมพ์เองเมื่อเปิดในแท็บของตัวเอง
//   (เปิดซ้อนในแอปบนมือถือ = ไม่เด้ง ให้กดปุ่มพิมพ์เอง) / false = สำหรับแปลงเป็น PDF (มือถือ)
export function buildLabelSheetHtml(items: LabelItem[], startAt = 1, autoPrint = true) {
  const blanks = Array.from({ length: Math.max(0, Math.min(startAt, LABELS_PER_SHEET) - 1) }, () => `<div class="e"></div>`);
  const cells = [...blanks, ...items.map(labelHtml)];
  const pageCount = Math.max(1, Math.ceil(cells.length / LABELS_PER_SHEET));
  while (cells.length < pageCount * LABELS_PER_SHEET) cells.push(`<div class="e"></div>`);
  const pages = Array.from({ length: pageCount }, (_, i) =>
    `<div class="p"><div class="g">${cells.slice(i * LABELS_PER_SHEET, (i + 1) * LABELS_PER_SHEET).join("")}</div></div>`
  ).join("");

  return `<!doctype html><html${autoPrint ? ` class="pv"` : ""}><head><meta charset="utf-8"><title>ป้าย QR อุปกรณ์</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:8mm 10mm}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{font-family:'Sarabun',sans-serif;margin:0;color:#000}
.p{width:190mm;break-after:page}.p:last-child{break-after:auto}
.g{display:grid;grid-template-columns:repeat(3,60mm);grid-auto-rows:28mm;gap:2mm 3mm}
.l{border:.25mm dashed #aaa;display:flex;align-items:center;box-sizing:border-box;padding:1.5mm;gap:2mm;overflow:hidden;break-inside:avoid}
.q{flex:none;width:24mm;height:24mm}.q svg{width:100%;height:100%;display:block}.t{min-width:0}
.c{font-size:12pt;font-weight:600;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.no{font-size:18pt;font-weight:600;line-height:1}
.n{font-size:7.5pt;margin-top:.8mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.s{font-size:7pt;color:#444;margin-top:.6mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media screen{
.pv{background:#EEF2F7}.pv body{padding:14px 0 10px}
.pv .p{box-sizing:border-box;width:210mm;height:297mm;padding:8mm 10mm;margin:0 auto 14px;background:#fff;box-shadow:0 2px 10px rgba(23,32,51,.14)}
.pv .e{border:.25mm dashed #E1E7F0}
.hint{width:210mm;margin:0 auto 12px;font-size:14px;color:#1D4ED8}
}
@media print{body{zoom:1!important}.hint{display:none}}
</style></head><body>
${autoPrint ? `<p class="hint" id="hint">พิมพ์ที่ขนาด 100% (ไม่ย่อให้พอดีหน้า) บนกระดาษ A4</p>` : ""}
${pages}
${autoPrint ? `<script>
function fit(){ document.body.style.zoom = String(Math.min(1, (document.documentElement.clientWidth - 24) / 794)); }
fit(); addEventListener("resize", fit);
if (window.self !== window.top) document.getElementById("hint").remove();
else (document.fonts ? document.fonts.ready : Promise.resolve()).then(function(){ setTimeout(function(){ window.print(); }, 150); });
</script>` : ""}
</body></html>`;
}
