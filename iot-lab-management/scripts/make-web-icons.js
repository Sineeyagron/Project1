// สร้างไอคอน PWA (public/icons/*) จากโลโก้หน้า login: พื้นฟ้าไล่สี + ขวดทดลอง (Ionicons "flask-outline") สีขาว
//   node scripts/make-web-icons.js
// อ่านรูปทรงตัวอักษรจากฟอนต์ Ionicons ตรง ๆ (TTF glyf) แล้ววาดเอง — ไม่ต้องลงไลบรารีเพิ่ม (ใช้ pngjs ที่มากับ Expo)
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const FONT = require.resolve("@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf");
const GLYPHS = require("@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json");
const OUT = path.join(__dirname, "..", "public", "icons");

// ---------- อ่านฟอนต์ ----------
function readGlyph(buf, codepoint) {
  const numTables = buf.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    tables[buf.toString("ascii", o, o + 4)] = buf.readUInt32BE(o + 8);
  }
  const unitsPerEm = buf.readUInt16BE(tables.head + 18);
  const longLoca = buf.readInt16BE(tables.head + 50) === 1;

  // cmap format 4 (BMP)
  const cmap = tables.cmap;
  let sub = -1;
  for (let i = 0, n = buf.readUInt16BE(cmap + 2); i < n; i++) {
    const off = cmap + buf.readUInt32BE(cmap + 4 + i * 8 + 4);
    if (buf.readUInt16BE(off) === 4) { sub = off; break; }
  }
  if (sub < 0) throw new Error("no cmap format 4");
  const segX2 = buf.readUInt16BE(sub + 6);
  const ends = sub + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
  let gid = 0;
  for (let s = 0; s < segX2 / 2; s++) {
    const end = buf.readUInt16BE(ends + s * 2), start = buf.readUInt16BE(starts + s * 2);
    if (codepoint < start || codepoint > end) continue;
    const delta = buf.readInt16BE(deltas + s * 2), ro = buf.readUInt16BE(ranges + s * 2);
    if (ro === 0) gid = (codepoint + delta) & 0xffff;
    else {
      const g = buf.readUInt16BE(ranges + s * 2 + ro + (codepoint - start) * 2);
      gid = g ? (g + delta) & 0xffff : 0;
    }
    break;
  }
  if (!gid) throw new Error("glyph not found");

  const locaAt = (i) => (longLoca ? buf.readUInt32BE(tables.loca + i * 4) : buf.readUInt16BE(tables.loca + i * 2) * 2);
  const g = tables.glyf + locaAt(gid);
  const nContours = buf.readInt16BE(g);
  if (nContours < 0) throw new Error("composite glyph not supported");
  const endPts = [];
  for (let i = 0; i < nContours; i++) endPts.push(buf.readUInt16BE(g + 10 + i * 2));
  const nPts = endPts[nContours - 1] + 1;
  let p = g + 10 + nContours * 2;
  p += 2 + buf.readUInt16BE(p); // instructions
  const flags = [];
  while (flags.length < nPts) {
    const f = buf[p++];
    flags.push(f);
    if (f & 8) { let r = buf[p++]; while (r--) flags.push(f); }
  }
  const read = (short, same) => {
    const vals = [];
    let v = 0;
    for (const f of flags) {
      if (f & short) { const d = buf[p++]; v += f & same ? d : -d; }
      else if (!(f & same)) { v += buf.readInt16BE(p); p += 2; }
      vals.push(v);
    }
    return vals;
  };
  const xs = read(2, 16), ys = read(4, 32);
  const contours = [];
  let s0 = 0;
  for (const e of endPts) {
    const pts = [];
    for (let i = s0; i <= e; i++) pts.push({ x: xs[i], y: ys[i], on: !!(flags[i] & 1) });
    contours.push(pts);
    s0 = e + 1;
  }
  return { contours, unitsPerEm };
}

// เส้นโค้ง quadratic → เส้นตรงสั้น ๆ
function flatten(contour) {
  const pts = [...contour];
  // ใส่จุด on-curve ระหว่างจุด off-curve ติดกัน
  const full = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    full.push(a);
    if (!a.on && !b.on) full.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true });
  }
  let start = full.findIndex((q) => q.on);
  const seq = [...full.slice(start), ...full.slice(0, start)];
  const out = [{ x: seq[0].x, y: seq[0].y }];
  for (let i = 1; i <= seq.length; i++) {
    const q = seq[i % seq.length];
    if (q.on) { out.push({ x: q.x, y: q.y }); continue; }
    const p0 = out[out.length - 1], p2 = seq[(i + 1) % seq.length];
    for (let t = 1; t <= 12; t++) {
      const u = t / 12;
      out.push({ x: (1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * q.x + u * u * p2.x, y: (1 - u) * (1 - u) * p0.y + 2 * (1 - u) * u * q.y + u * u * p2.y });
    }
    i++;
  }
  return out;
}

// ---------- วาด (nonzero winding + supersample 4x4) ----------
function coverage(polys, size) {
  const S = 4;
  const cov = new Float32Array(size * size);
  const edges = [];
  for (const poly of polys) {
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1];
      if (a.y !== b.y) edges.push(a.y < b.y ? { x0: a.x, y0: a.y, x1: b.x, y1: b.y, w: 1 } : { x0: b.x, y0: b.y, x1: a.x, y1: a.y, w: -1 });
    }
  }
  for (let sy = 0; sy < size * S; sy++) {
    const y = (sy + 0.5) / S;
    const hits = [];
    for (const e of edges) {
      if (y < e.y0 || y >= e.y1) continue;
      hits.push({ x: e.x0 + ((y - e.y0) / (e.y1 - e.y0)) * (e.x1 - e.x0), w: e.w });
    }
    hits.sort((a, b) => a.x - b.x);
    let wind = 0;
    for (let i = 0; i < hits.length - 1; i++) {
      wind += hits[i].w;
      if (!wind) continue;
      const xa = hits[i].x, xb = hits[i + 1].x;
      for (let sx = Math.max(0, Math.ceil(xa * S - 0.5)); sx < Math.min(size * S, xb * S - 0.5); sx++) {
        cov[Math.floor(sy / S) * size + Math.floor(sx / S)] += 1 / (S * S);
      }
    }
  }
  return cov;
}

function blur(src, size, r) {
  let a = src;
  for (let pass = 0; pass < 3; pass++) {
    const b = new Float32Array(size * size), c = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < size) { s += a[y * size + xx]; n++; } }
      b[y * size + x] = s / n;
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let s = 0, n = 0;
      for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < size) { s += b[yy * size + x]; n++; } }
      c[y * size + x] = s / n;
    }
    a = c;
  }
  return a;
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function render(glyph, size, glyphScale) {
  // ขนาดตัวอักษรเท่ากับ size*glyphScale (เหมือน fontSize) จัดกึ่งกลางตามกรอบจริงของรูปทรง
  const k = (size * glyphScale) / glyph.unitsPerEm;
  const flat = glyph.contours.map(flatten);
  const all = flat.flat();
  const minX = Math.min(...all.map((q) => q.x)), maxX = Math.max(...all.map((q) => q.x));
  const minY = Math.min(...all.map((q) => q.y)), maxY = Math.max(...all.map((q) => q.y));
  const ox = size / 2 - ((minX + maxX) / 2) * k, oy = size / 2 + ((minY + maxY) / 2) * k;
  const polys = flat.map((poly) => poly.map((q) => ({ x: ox + q.x * k, y: oy - q.y * k })));
  const cov = coverage(polys, size);
  const shadowOff = Math.round(size * 0.014);
  const shadow = blur(cov, size, Math.max(1, Math.round(size * 0.012)));

  const c0 = hex("#3B82F6"), c1 = hex("#2563EB"), c2 = hex("#1D4ED8");
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const t = (x + y) / (2 * size);
    let col = t < 0.55 ? lerp(c0, c1, t / 0.55) : lerp(c1, c2, (t - 0.55) / 0.45);
    // ไฮไลต์อ่อนครึ่งบน
    const hl = Math.max(0, 0.14 * (1 - y / (size * 0.5)));
    col = lerp(col, [255, 255, 255], hl);
    // เงาใต้รูปขวด
    const sy = y - shadowOff;
    const sh = sy >= 0 ? shadow[sy * size + x] * 0.22 : 0;
    col = lerp(col, [15, 23, 42], sh);
    // รูปขวดสีขาว
    col = lerp(col, [255, 255, 255], Math.min(1, cov[y * size + x]));
    const i = (y * size + x) * 4;
    png.data[i] = Math.round(col[0]); png.data[i + 1] = Math.round(col[1]); png.data[i + 2] = Math.round(col[2]); png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

const glyph = readGlyph(fs.readFileSync(FONT), GLYPHS["flask-outline"]);
const files = [
  ["icon-192.png", 192, 0.56],
  ["icon-512.png", 512, 0.56],
  ["maskable-512.png", 512, 0.46], // Android ตัดเป็นวงกลม/ทรงอื่น → รูปเล็กลงให้อยู่ในพื้นที่ปลอดภัย
  ["apple-touch-icon.png", 180, 0.56],
  ["../../assets/images/favicon.png", 48, 0.62], // favicon แท็บเบราว์เซอร์ (app.json web.favicon)
];
for (const [name, size, scale] of files) {
  fs.writeFileSync(path.join(OUT, name), render(glyph, size, scale));
  console.log("wrote", name);
}
