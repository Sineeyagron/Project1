// ฟอนต์ไอคอน Ionicons ฉบับย่อสำหรับเว็บ: เหลือเฉพาะไอคอนที่โค้ดใช้จริง (381 KB → ราว 30 KB)
//   node scripts/subset-ionicons.js   (Vercel รันให้เองก่อน build ทุกครั้ง — ดู vercel.json)
// ไล่หาชื่อไอคอนจากทุก string ใน app/ components/ lib/ ที่ตรงกับชื่อใน Ionicons → เก็บรูปทรงไว้ ตัวอื่นเหลือว่าง
//   (รหัสตัวอักษร/ลำดับ glyph เท่าเดิม → @expo/vector-icons ใช้ได้ทันที) · metro.config.js สลับให้เว็บใช้ไฟล์นี้
// แอปมือถือใช้ฟอนต์เต็มเหมือนเดิม (ฝังในแอป ไม่ต้องดาวน์โหลด)
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FONT = require.resolve("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf");
const GLYPHS = require("@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json");
const OUT = path.join(ROOT, "assets", "fonts", "Ionicons.web.ttf");

// ---------- ชื่อไอคอนที่ใช้ ----------
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}
const used = new Set();
for (const dir of ["app", "components", "lib"]) {
  for (const file of walk(path.join(ROOT, dir))) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/["'`]([a-z0-9]+(?:-[a-z0-9]+)*)["'`]/g)) if (GLYPHS[m[1]] != null) used.add(m[1]);
  }
}

// ---------- อ่าน/เขียน TTF ----------
const buf = fs.readFileSync(FONT);
const numTables = buf.readUInt16BE(4);
const tables = {};
for (let i = 0; i < numTables; i++) {
  const o = 12 + i * 16;
  tables[buf.toString("ascii", o, o + 4)] = { offset: buf.readUInt32BE(o + 8), length: buf.readUInt32BE(o + 12) };
}
const longLoca = buf.readInt16BE(tables.head.offset + 50) === 1;
const numGlyphs = buf.readUInt16BE(tables.maxp.offset + 4);

// cmap format 4 → glyph id ของรหัสตัวอักษร
function glyphIdOf(cp) {
  const cmap = tables.cmap.offset;
  for (let i = 0, n = buf.readUInt16BE(cmap + 2); i < n; i++) {
    const sub = cmap + buf.readUInt32BE(cmap + 4 + i * 8 + 4);
    if (buf.readUInt16BE(sub) !== 4) continue;
    const segX2 = buf.readUInt16BE(sub + 6);
    const ends = sub + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = buf.readUInt16BE(ends + s * 2), start = buf.readUInt16BE(starts + s * 2);
      if (cp < start || cp > end) continue;
      const delta = buf.readInt16BE(deltas + s * 2), ro = buf.readUInt16BE(ranges + s * 2);
      if (ro === 0) return (cp + delta) & 0xffff;
      const g = buf.readUInt16BE(ranges + s * 2 + ro + (cp - start) * 2);
      return g ? (g + delta) & 0xffff : 0;
    }
  }
  return 0;
}

const locaAt = (i) => (longLoca ? buf.readUInt32BE(tables.loca.offset + i * 4) : buf.readUInt16BE(tables.loca.offset + i * 2) * 2);
const keep = new Set([0]); // .notdef
const queue = [];
for (const name of used) {
  const gid = glyphIdOf(GLYPHS[name]);
  if (!gid) throw new Error(`ไม่เจอไอคอน ${name} ในฟอนต์`);
  queue.push(gid);
}
// glyph แบบประกอบ (composite) → เก็บชิ้นส่วนด้วย
while (queue.length) {
  const g = queue.pop();
  if (keep.has(g)) continue;
  keep.add(g);
  const start = tables.glyf.offset + locaAt(g), end = tables.glyf.offset + locaAt(g + 1);
  if (end - start < 10 || buf.readInt16BE(start) >= 0) continue;
  let p = start + 10;
  for (;;) {
    const flags = buf.readUInt16BE(p);
    queue.push(buf.readUInt16BE(p + 2));
    p += 4 + (flags & 1 ? 4 : 2) + (flags & 8 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);
    if (!(flags & 0x20)) break;
  }
}

// glyf ใหม่: ตัวที่เก็บ = ข้อมูลเดิม / ตัวอื่น = ว่าง (ยาว 0)
const parts = [];
const loca = [];
let pos = 0;
for (let g = 0; g < numGlyphs; g++) {
  loca.push(pos);
  if (!keep.has(g)) continue;
  const data = buf.subarray(tables.glyf.offset + locaAt(g), tables.glyf.offset + locaAt(g + 1));
  parts.push(data);
  pos += data.length;
  if (pos % 4) { const pad = 4 - (pos % 4); parts.push(Buffer.alloc(pad)); pos += pad; }
}
loca.push(pos);
const glyf = Buffer.concat(parts);
// loca แบบสั้น (ตำแหน่ง/2 เก็บ 2 ไบต์) ได้เมื่อ glyf < 128 KB — ทุกตำแหน่งหาร 2 ลงตัวเพราะเติมให้ครบ 4 ไบต์แล้ว
const shortLoca = pos < 0x20000;
const locaBuf = Buffer.alloc((numGlyphs + 1) * (shortLoca ? 2 : 4));
loca.forEach((v, i) => (shortLoca ? locaBuf.writeUInt16BE(v / 2, i * 2) : locaBuf.writeUInt32BE(v, i * 4)));

// ประกอบไฟล์ใหม่
const newTables = {};
for (const [tag, t] of Object.entries(tables)) newTables[tag] = Buffer.from(buf.subarray(t.offset, t.offset + t.length));
newTables.glyf = glyf;
newTables.loca = locaBuf;
newTables.head.writeInt16BE(shortLoca ? 0 : 1, 50);
// post เวอร์ชัน 3 = ไม่เก็บชื่อ glyph (เบราว์เซอร์ไม่ใช้) — ตัดไป ~22 KB
newTables.post = Buffer.from(newTables.post.subarray(0, 32));
newTables.post.writeUInt32BE(0x00030000, 0);
newTables.head.writeUInt32BE(0, 8); // checkSumAdjustment คำนวณใหม่ด้านล่าง

const checksum = (b) => {
  const padded = b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b;
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0;
  return sum;
};
const tags = Object.keys(newTables).sort();
const header = Buffer.alloc(12 + tags.length * 16);
buf.copy(header, 0, 0, 12);
let offset = header.length;
const body = [];
tags.forEach((tag, i) => {
  const data = newTables[tag];
  const o = 12 + i * 16;
  header.write(tag, o, "ascii");
  header.writeUInt32BE(checksum(data), o + 4);
  header.writeUInt32BE(offset, o + 8);
  header.writeUInt32BE(data.length, o + 12);
  body.push(data);
  const pad = (4 - (data.length % 4)) % 4;
  if (pad) body.push(Buffer.alloc(pad));
  offset += data.length + pad;
});
const font = Buffer.concat([header, ...body]);
const headOffset = font.readUInt32BE(12 + tags.indexOf("head") * 16 + 8);
font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headOffset + 8);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, font);
console.log(`Ionicons (เว็บ): ${used.size} ไอคอน · ${(buf.length / 1024).toFixed(0)} KB → ${(font.length / 1024).toFixed(0)} KB`);
