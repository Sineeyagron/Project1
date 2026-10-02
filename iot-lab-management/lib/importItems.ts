// ตรรกะนำเข้าอุปกรณ์จาก CSV (ไม่มี UI — ทดสอบแยกได้)
// หลัก: ผิด (error) = บันทึกไม่ได้ / เตือน (warning) = บันทึกได้แต่ต้องติ๊กยืนยัน / หมายเหตุ (note) = แค่แจ้ง
// กันพลาดที่เจอบ่อย: หมวดสะกดผิด, ปี พ.ศ./ปีผิด, นำเข้าไฟล์ซ้ำ, ชื่อซ้ำในไฟล์, รหัสชนของเดิม, ไฟล์ Excel ไม่ใช่ CSV

import { parseCsv } from "./csv";
import { isValidDate } from "./itemInfo";

export const OTHER = "อื่นๆ";
export const MAX_TOTAL = 500;
export const MAX_PER_ROW = 100;
export const MAX_FILE_BYTES = 1024 * 1024;
const BIG_QTY = 20;

export type Category = { id: string; name: string; active: boolean };
export type ExistingItem = { name: string; item_prefix: string | null; status: string };

export type Row = {
  line: number;
  name: string;
  categoryRaw: string;
  category: string;
  categoryId: string | null;
  qty: number;
  warranty: string | null;
  short: string;
  prefix: string;
  errors: string[];
  warnings: string[];
  notes: string[];
};

export type CheckResult = {
  rows: Row[];
  fileError?: string;
  fileNotes: string[];
  // หมวดที่ไม่มีในระบบ → ให้ผู้ใช้เลือกหมวดแทน (แก้ได้ในแอป ไม่ต้องกลับไปแก้ไฟล์)
  unknownCategories: { raw: string; suggestion: string | null; lines: number[]; fixed: boolean }[];
};

// ── อ่านไฟล์ ─────────────────────────────────────────────

// ไบต์ → ข้อความ: UTF-8 (มี/ไม่มี BOM) ไม่ผ่านค่อยเป็น Windows-874/TIS-620 (Excel ภาษาไทยรุ่นเก่า)
// เขียนเองไม่พึ่ง TextDecoder เพราะบนมือถือ (Hermes) ไม่มีตัวถอด windows-874
export function decodeBytes(bytes: Uint8Array): { text?: string; error?: string } {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return { error: 'นี่คือไฟล์ Excel (.xlsx) ไม่ใช่ CSV — ใน Excel กด "บันทึกเป็น" แล้วเลือก "CSV UTF-8"' };
  }
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return { error: 'นี่คือไฟล์ Excel รุ่นเก่า (.xls) ไม่ใช่ CSV — ใน Excel กด "บันทึกเป็น" แล้วเลือก "CSV UTF-8"' };
  }
  if (bytes.length > MAX_FILE_BYTES) return { error: "ไฟล์ใหญ่เกิน 1 MB — แบ่งเป็นหลายไฟล์" };
  const utf8 = decodeUtf8(bytes);
  if (utf8 !== null) return { text: utf8 };
  return { text: decodeTis620(bytes) };
}

function decodeUtf8(b: Uint8Array): string | null {
  let out = "";
  let i = b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0;
  while (i < b.length) {
    const c = b[i];
    let cp: number;
    let extra: number;
    if (c < 0x80) { cp = c; extra = 0; }
    else if (c >= 0xc2 && c < 0xe0) { cp = c & 0x1f; extra = 1; }
    else if (c >= 0xe0 && c < 0xf0) { cp = c & 0x0f; extra = 2; }
    else if (c >= 0xf0 && c < 0xf5) { cp = c & 0x07; extra = 3; }
    else return null;
    if (i + extra >= b.length + (extra ? 0 : 1)) return null;
    for (let k = 1; k <= extra; k++) {
      const n = b[i + k];
      if (n === undefined || (n & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (n & 0x3f);
    }
    out += String.fromCodePoint(cp);
    i += extra + 1;
  }
  return out;
}

// TIS-620: 0xA1–0xFB = ก–๛ (U+0E01–U+0E5B)
function decodeTis620(b: Uint8Array): string {
  let out = "";
  for (const c of b) out += c >= 0xa1 && c <= 0xfb ? String.fromCharCode(c + 0x0d60) : String.fromCharCode(c);
  return out;
}

// เครื่องหมายคำพูดโค้ง (iPhone), เลขไทย, ช่องว่างพิเศษ → แบบปกติ
export function normalizeText(text: string): string {
  return text
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0e50))
    .replace(/[   ]/g, " ");
}

// ── ตรวจค่า ──────────────────────────────────────────────

const HEADERS: Record<string, string[]> = {
  name: ["ชื่อ", "ชื่ออุปกรณ์", "name"],
  category: ["หมวด", "หมวดหมู่", "category"],
  qty: ["จำนวน", "จำนวนชิ้น", "qty", "quantity"],
  warranty: ["วันหมดประกัน", "หมดประกัน", "ประกันถึง", "warranty", "warrantyexpiresat"],
  short: ["ชื่อย่อ", "ชื่อย่อสำหรับรหัส", "shortname"],
};
export const COLUMN_LABEL: Record<string, string> = {
  name: "ชื่อ", category: "หมวด", qty: "จำนวน", warranty: "วันหมดประกัน", short: "ชื่อย่อ",
};

export const keyOf = (v: string) => v.trim().toLowerCase().replace(/[\s_()\-.:]/g, "");
const tidy = (v: string) => v.replace(/\s+/g, " ").trim();

// เหมือน alloc_item_code ฝั่งฐานข้อมูล: ใช้ชื่อย่อ (หรือชื่อ) ตัดช่องว่าง/สัญลักษณ์
export const codePrefix = (name: string, short: string) =>
  (short.trim() || name.trim()).replace(/[\s!-/:-@[-`{-~]/g, "") || "Item";

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

function suggestCategory(raw: string, categories: Category[]) {
  const k = keyOf(raw);
  if (!k) return null;
  let best: { name: string; d: number } | null = null;
  for (const c of categories.filter((c) => c.active)) {
    const ck = keyOf(c.name);
    const d = ck.startsWith(k) || k.startsWith(ck) ? 1 : levenshtein(k, ck);
    if (d <= Math.max(2, Math.floor(ck.length / 3)) && (!best || d < best.d)) best = { name: c.name, d };
  }
  return best?.name || null;
}

// วันที่: ปปปป-ดด-วว / ปปปป/ดด/วว / วว/ดด/ปปปป (ไทยใช้ วัน/เดือน) / มีเวลาต่อท้าย / เลขวันที่ของ Excel / ปี พ.ศ.
export function parseDate(raw: string, today = new Date()): { value: string | null; error?: string; warning?: string; note?: string } {
  let v = raw.trim().replace(/[ T]\d{1,2}:\d{2}(:\d{2})?.*$/, "");
  if (!v || v === "-") return { value: null };
  let y: number, m: number, d: number;
  let note: string | undefined;
  let match: RegExpMatchArray | null;
  if ((match = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if (/^\d{5}$/.test(v) && Number(v) > 20000 && Number(v) < 80000) {
    // Excel เก็บวันที่เป็นจำนวนวันนับจาก 30 ธ.ค. 1899
    const dt = new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000);
    [y, m, d] = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
    note = `แปลงเลขวันที่ Excel ${v}`;
  } else {
    return { value: null, error: `วันหมดประกัน "${raw.trim()}" อ่านไม่ออก — ใช้ ปปปป-ดด-วว เช่น 2027-10-31` };
  }
  if (y > 2400) {
    note = `แปลงปี พ.ศ. ${y} → ค.ศ. ${y - 543}`;
    y -= 543;
  }
  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (!isValidDate(iso)) return { value: null, error: `ไม่มีวันที่ "${raw.trim()}" ในปฏิทิน` };
  const todayIso = today.toISOString().slice(0, 10);
  const yearsAhead = (Date.parse(iso) - today.getTime()) / (365.25 * 86400000);
  if (iso < todayIso) return { value: iso, note, warning: `วันหมดประกันผ่านไปแล้ว (${iso}) — พิมพ์ปีผิดหรือเปล่า?` };
  if (yearsAhead > 20) return { value: iso, note, warning: `ประกันอีก ${Math.floor(yearsAhead)} ปี ดูนานผิดปกติ — ปีถูกไหม?` };
  return { value: iso, note };
}

export function checkCsv(
  text: string,
  ctx: { categories: Category[]; existing: ExistingItem[]; categoryFixes?: Record<string, string> }
): CheckResult {
  const fileNotes: string[] = [];
  const empty = (fileError: string): CheckResult => ({ rows: [], fileError, fileNotes, unknownCategories: [] });

  const table = parseCsv(normalizeText(text));
  if (table.length === 0) return empty("ไม่มีข้อมูลในไฟล์");
  const head = table[0].map(keyOf);

  const col: Record<string, number> = {};
  for (const [field, names] of Object.entries(HEADERS)) {
    const hits = head.map((h, i) => (names.map(keyOf).includes(h) ? i : -1)).filter((i) => i >= 0);
    if (hits.length > 1) return empty(`มีคอลัมน์ "${COLUMN_LABEL[field]}" ซ้ำ ${hits.length} คอลัมน์ — ลบให้เหลืออันเดียว`);
    col[field] = hits.length ? hits[0] : -1;
  }
  if (col.name < 0) {
    return empty('แถวแรกต้องเป็นหัวคอลัมน์ และต้องมีคอลัมน์ "ชื่อ" — ดาวน์โหลดไฟล์แม่แบบไปใช้ได้');
  }
  if (table.length < 2) return empty("มีแต่หัวคอลัมน์ ยังไม่มีรายการอุปกรณ์");

  const missing = Object.keys(HEADERS).filter((f) => f !== "name" && col[f] < 0);
  if (missing.length) {
    const defaults: Record<string, string> = {
      category: `หมวด = "${OTHER}"`, qty: "จำนวน = 1", warranty: "ไม่มีประกัน", short: "รหัสสร้างจากชื่อ",
    };
    fileNotes.push(`ไม่มีคอลัมน์ ${missing.map((f) => `"${COLUMN_LABEL[f]}"`).join(", ")} — ใช้ค่าตั้งต้น: ${missing.map((f) => defaults[f]).join(", ")}`);
  }
  const used = new Set(Object.values(col).filter((i) => i >= 0));
  const unused = table[0].filter((h, i) => !used.has(i) && h.trim());
  if (unused.length) fileNotes.push(`ไม่ได้ใช้คอลัมน์: ${unused.map((h) => `"${h.trim()}"`).join(", ")}`);
  if (table.length - 1 > MAX_TOTAL) return empty(`มี ${table.length - 1} แถว เกินครั้งละ ${MAX_TOTAL} แถว — แบ่งไฟล์`);

  const fixes = ctx.categoryFixes || {};
  const activeCats = ctx.categories;
  const byKey = new Map(activeCats.map((c) => [keyOf(c.name), c]));
  const unknown = new Map<string, { raw: string; suggestion: string | null; lines: number[]; fixed: boolean }>();
  // หมวดที่ต้องให้ผู้ใช้เลือก (รวมที่เลือกแล้ว เพื่อให้เปลี่ยนใจได้)
  const needPick = (raw: string, line: number, suggestion: string | null, fixed: boolean) => {
    const u = unknown.get(keyOf(raw)) || { raw, suggestion, lines: [], fixed };
    u.lines.push(line);
    unknown.set(keyOf(raw), u);
    return u;
  };

  const cell = (r: string[], field: string) => (col[field] >= 0 ? (r[col[field]] ?? "") : "");

  const rows: Row[] = table.slice(1).map((r, i) => {
    const line = i + 2;
    const errors: string[] = [];
    const warnings: string[] = [];
    const notes: string[] = [];

    const name = tidy(cell(r, "name"));
    if (!name) errors.push("ไม่มีชื่อ");
    else if (name.length > 100) errors.push(`ชื่อยาว ${name.length} ตัวอักษร (เกิน 100)`);
    if (/^[=+@]/.test(name)) errors.push("ช่องชื่อเป็นสูตร Excel — ใส่เป็นข้อความ");
    if (r.length > table[0].length && r.slice(table[0].length).some((c) => c.trim())) {
      warnings.push("มีข้อมูลเกินจำนวนคอลัมน์ — อาจมีเครื่องหมาย , ในชื่อ (ครอบชื่อด้วย \"...\")");
    }

    // หมวด: ว่าง = อื่นๆ / ผู้ใช้เลือกหมวดแทนในแอปได้ (categoryFixes)
    const categoryRaw = tidy(cell(r, "category")) || OTHER;
    const fixedName = fixes[keyOf(categoryRaw)];
    const cat = byKey.get(keyOf(fixedName || categoryRaw));
    if (fixedName && cat) {
      notes.push(`หมวด "${categoryRaw}" → ใช้ "${cat.name}"`);
      needPick(categoryRaw, line, null, true);
    }
    if (!cat) {
      const u = needPick(categoryRaw, line, suggestCategory(categoryRaw, activeCats), false);
      errors.push(`ไม่มีหมวด "${categoryRaw}" ในระบบ${u.suggestion ? ` (หมายถึง "${u.suggestion}"?)` : ""}`);
    } else if (!cat.active) {
      errors.push(`หมวด "${cat.name}" ปิดอยู่ — เปิดหมวดก่อน หรือเลือกหมวดอื่น`);
      needPick(categoryRaw, line, null, false);
    }

    // จำนวน: ว่าง = 1 / รับ "5" "5.0" "5 ชิ้น"→ผิด
    const qtyRaw = tidy(cell(r, "qty")).replace(/,/g, "");
    let qty = 1;
    if (qtyRaw) {
      qty = /^\d+(\.0+)?$/.test(qtyRaw) ? Number(qtyRaw) : NaN;
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_PER_ROW) {
        errors.push(`จำนวน "${qtyRaw}" ต้องเป็นตัวเลข 1–${MAX_PER_ROW}`);
        qty = 0;
      } else if (qty > BIG_QTY) {
        warnings.push(`จำนวน ${qty} ชิ้น เยอะกว่าปกติ — ตรวจอีกครั้ง`);
      }
    }

    const date = parseDate(cell(r, "warranty"));
    if (date.error) errors.push(date.error);
    if (date.warning) warnings.push(date.warning);
    if (date.note) notes.push(date.note);

    const short = tidy(cell(r, "short"));
    if (short.length > 30) errors.push(`ชื่อย่อยาว ${short.length} ตัวอักษร (เกิน 30)`);
    if (short && !short.replace(/[\s!-/:-@[-`{-~]/g, "")) warnings.push("ชื่อย่อมีแต่สัญลักษณ์ — รหัสจะเป็น Item");

    return {
      line, name, categoryRaw,
      category: cat?.name || categoryRaw,
      categoryId: cat && cat.active ? cat.id : null,
      qty, warranty: date.value, short,
      prefix: codePrefix(name, short),
      errors, warnings, notes,
    };
  });

  // ── ตรวจข้ามแถว / เทียบของเดิม ──
  const byName = new Map<string, Row[]>();
  const byPrefix = new Map<string, Row[]>();
  rows.forEach((r) => {
    if (!r.name) return;
    byName.set(keyOf(r.name), [...(byName.get(keyOf(r.name)) || []), r]);
    byPrefix.set(r.prefix.toLowerCase(), [...(byPrefix.get(r.prefix.toLowerCase()) || []), r]);
  });
  byName.forEach((list) => {
    if (list.length < 2) return;
    list.forEach((r) => r.warnings.push(`ชื่อซ้ำกับแถว ${list.filter((o) => o !== r).map((o) => o.line).join(", ")} — ถ้าเป็นของเดียวกัน รวมเป็นแถวเดียวแล้วใส่จำนวน`));
  });
  byPrefix.forEach((list) => {
    const names = new Set(list.map((r) => keyOf(r.name)));
    if (names.size < 2) return;
    list.forEach((r) => r.warnings.push(`รหัส "${r.prefix}" ใช้ร่วมกับแถว ${list.filter((o) => o !== r).map((o) => o.line).join(", ")} ที่ชื่อต่างกัน — ตั้งชื่อย่อให้ต่างกันไหม?`));
  });

  const existingByName = new Map<string, number>();
  // รหัสเดียวอาจเป็นของหลายชื่อ (เช่น "NodeMCU" กับ "NodeMCU ESP8266") → เก็บทุกชื่อ
  const existingByPrefix = new Map<string, { names: Set<string>; label: string }>();
  ctx.existing.forEach((e) => {
    if (e.status === "retired") return;
    existingByName.set(keyOf(e.name), (existingByName.get(keyOf(e.name)) || 0) + 1);
    if (e.item_prefix) {
      const k = e.item_prefix.toLowerCase();
      const entry = existingByPrefix.get(k) || { names: new Set<string>(), label: e.name };
      entry.names.add(keyOf(e.name));
      existingByPrefix.set(k, entry);
    }
  });
  rows.forEach((r) => {
    if (!r.name) return;
    const sameName = existingByName.get(keyOf(r.name));
    if (sameName) r.warnings.push(`มี "${r.name}" ในระบบแล้ว ${sameName} ชิ้น — นำเข้าไฟล์นี้ซ้ำหรือเปล่า?`);
    const owner = existingByPrefix.get(r.prefix.toLowerCase());
    if (owner && !owner.names.has(keyOf(r.name))) {
      r.warnings.push(`รหัส "${r.prefix}" เป็นของ "${owner.label}" อยู่แล้ว — เลขจะต่อจากของเดิม ตั้งชื่อย่ออื่นไหม?`);
    }
  });

  return { rows, fileNotes, unknownCategories: [...unknown.values()] };
}

// เทียบผลตรวจสองรอบ (ก่อนบันทึกตรวจซ้ำกับข้อมูลล่าสุด) ว่ามีอะไรเปลี่ยน
export function summary(rows: Row[]) {
  return {
    ok: rows.filter((r) => !r.errors.length && !r.warnings.length).length,
    warn: rows.filter((r) => !r.errors.length && r.warnings.length).length,
    bad: rows.filter((r) => r.errors.length).length,
    total: rows.reduce((s, r) => s + (r.errors.length ? 0 : r.qty), 0),
  };
}
