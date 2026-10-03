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
// autoPrint = เปิดกล่องพิมพ์ทันที (เว็บ) / false = สำหรับแปลงเป็น PDF (มือถือ)
export function buildLabelSheetHtml(items: LabelItem[], startAt = 1, autoPrint = true) {
  const blanks = Array.from({ length: Math.max(0, Math.min(startAt, LABELS_PER_SHEET) - 1) }, () => `<div></div>`);
  const cells = [...blanks, ...items.map(labelHtml)].join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>ป้าย QR อุปกรณ์</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:8mm 10mm}
body{font-family:'Sarabun',sans-serif;margin:0;width:190mm;color:#000}
.g{display:grid;grid-template-columns:repeat(3,60mm);grid-auto-rows:28mm;gap:2mm 3mm}
.l{border:.25mm dashed #aaa;display:flex;align-items:center;box-sizing:border-box;padding:1.5mm;gap:2mm;overflow:hidden;break-inside:avoid}
.q{flex:none;width:24mm;height:24mm}.q svg{width:100%;height:100%;display:block}.t{min-width:0}
.c{font-size:12pt;font-weight:600;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.no{font-size:18pt;font-weight:600;line-height:1}
.n{font-size:7.5pt;margin-top:.8mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.s{font-size:7pt;color:#444;margin-top:.6mm}
.hint{font-size:9pt;color:#666;margin:0 0 3mm}
@media print{.hint{display:none}}
</style></head><body>
${autoPrint ? `<p class="hint">พิมพ์ที่ขนาด 100% (ห้ามย่อ/Fit to page) บนกระดาษ A4</p>` : ""}
<div class="g">${cells}</div>
${autoPrint ? `<script>
(document.fonts ? document.fonts.ready : Promise.resolve()).then(function(){ setTimeout(function(){ window.print(); }, 150); });
</script>` : ""}
</body></html>`;
}
