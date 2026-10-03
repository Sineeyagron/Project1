// อ่าน/เขียน CSV แบบง่าย (รองรับ "ค่าในเครื่องหมายคำพูด", "" = ", ขึ้นบรรทัดใหม่ในคำพูด, BOM)
// ตัวคั่นเดาจากบรรทัดแรก: , (CSV ปกติ) / ; (Excel บางภาษา) / แท็บ (ก๊อปเซลล์จาก Excel/Google Sheets มาวาง)

function detectDelimiter(src: string) {
  const firstLine = src.split(/\r?\n/, 1)[0].replace(/"[^"]*"/g, "");
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const candidates = [",", ";", "\t"].sort((a, b) => count(b) - count(a));
  return count(candidates[0]) > 0 ? candidates[0] : ",";
}

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delim = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // ตัดแถวว่างล้วน (Excel ชอบเติมท้ายไฟล์)
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const escape = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(escape).join(",")).join("\r\n");
}
