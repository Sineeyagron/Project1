// วาด Use Case Diagram (UML) เป็น SVG → src/usecase-*.svg.html แล้ว render.js ทำเป็น .svg/.png
// แก้รายการ use case ที่ข้อมูลด้านล่าง แล้วรัน (ในโฟลเดอร์ docs/diagrams): npm run usecase — ดู README.md
// ที่มา: บทบาทใน lib/roles.ts (user / ta / admin — TA ทำได้ทุกอย่างของ user, admin ทำได้ทุกอย่างของ TA)
//        + RPC ที่แอปเรียก (request_borrow, decide_request, schedule_pickup, report_room_problem ฯลฯ) + pg_cron ใน migrations
// กติกาการตั้งชื่อ: 1 วงรี = 1 เป้าหมายของผู้ใช้งาน (กริยา + กรรม) · กฎภายในระบบ (เช่น จำกัดจำนวนครั้ง) ไม่ใช่ use case
const fs = require("fs");
const path = require("path");

const FONT = "'Leelawadee UI', 'Noto Sans Thai', Tahoma, sans-serif";
const C = { line: "#334155", oval: "#EFF5FF", ovalLine: "#2563EB", ink: "#172033", muted: "#64748B", band: "#CBD5E1", sys: "#F1F5F9" };

const FS = 20; // ขนาดตัวอักษรในวงรี
const ROW = 64; // ระยะห่างแถว
const RY = 26; // ความสูงครึ่งหนึ่งของวงรี
const GAP = 210; // ช่องระหว่างคอลัมน์ A กับ B (ให้ป้าย «include» มีที่)
const ACTOR_X = 120;
const BOX_L = 270;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ความกว้างข้อความโดยประมาณ (สระบน/ล่าง วรรณยุกต์ของไทยไม่กินที่) — ใช้กำหนดขนาดวงรีให้พอดีข้อความ
const MARKS = /[ัิ-ฺ็-๎]/;
function textWidth(s, size = FS) {
  let w = 0;
  for (const ch of s) {
    if (MARKS.test(ch)) continue;
    w += /[A-Z]/.test(ch) ? 0.66 : /[a-z0-9]/.test(ch) ? 0.53 : ch === " " ? 0.3 : /[()/+,.\-:]/.test(ch) ? 0.36 : 0.56;
  }
  return w * size;
}
const radiusFor = (texts) => Math.ceil(Math.max(...texts.map((t) => textWidth(t))) / 2 / 0.86) + 22;

function person(x, y, label, sub) {
  // ตัวคนแบบ UML — y = กึ่งกลางลำตัว
  return `<g stroke="${C.line}" stroke-width="2.2" fill="none">
  <circle cx="${x}" cy="${y - 38}" r="13" fill="#fff"/>
  <line x1="${x}" y1="${y - 25}" x2="${x}" y2="${y + 12}"/>
  <line x1="${x - 22}" y1="${y - 11}" x2="${x + 22}" y2="${y - 11}"/>
  <line x1="${x}" y1="${y + 12}" x2="${x - 18}" y2="${y + 40}"/>
  <line x1="${x}" y1="${y + 12}" x2="${x + 18}" y2="${y + 40}"/>
</g>
<text x="${x}" y="${y + 66}" text-anchor="middle" font-size="19" font-weight="700" fill="${C.ink}">${esc(label)}</text>
${(sub || "").split("\n").filter(Boolean).map((line, i) => `<text x="${x}" y="${y + 88 + i * 20}" text-anchor="middle" font-size="15.5" fill="${C.muted}">${esc(line)}</text>`).join("\n")}`;
}

// ผู้กระทำที่ไม่ใช่คน (ระบบ/เวลา) — กล่องมี «system» ตามธรรมเนียม UML
function systemActor(x, y, label, sub) {
  const w = Math.max(textWidth(label, 18), textWidth(sub || "", 15)) + 36;
  return `<rect x="${x - w / 2}" y="${y - 40}" width="${w}" height="80" rx="8" fill="${C.sys}" stroke="${C.line}" stroke-width="2"/>
<text x="${x}" y="${y - 14}" text-anchor="middle" font-size="14" font-style="italic" fill="${C.muted}">«system»</text>
<text x="${x}" y="${y + 10}" text-anchor="middle" font-size="18" font-weight="700" fill="${C.ink}">${esc(label)}</text>
${sub ? `<text x="${x}" y="${y + 30}" text-anchor="middle" font-size="14" fill="${C.muted}">${esc(sub)}</text>` : ""}`;
}

function oval(o) {
  return `<ellipse cx="${o.x}" cy="${o.y}" rx="${o.rx}" ry="${RY}" fill="${C.oval}" stroke="${C.ovalLine}" stroke-width="1.8"/>
<text x="${o.x}" y="${o.y + 7}" text-anchor="middle" font-size="${FS}" fill="${C.ink}">${esc(o.text)}</text>`;
}

// เส้นจากผู้กระทำไปจบที่ปลายวงรีฝั่งที่หันหา (ไม่ทะลุวงรีอื่นในคอลัมน์)
function assoc(ax, ay, o) {
  const x = ax < o.x ? o.x - o.rx : o.x + o.rx;
  return `<line x1="${ax}" y1="${ay}" x2="${x}" y2="${o.y}" stroke="${C.line}" stroke-width="1.5"/>`;
}

// ลูกศรเส้นประ «include» / «extend» จาก a → b (หัวลูกศรเปิด) ออก/เข้าที่ปลายวงรีฝั่งที่หันหากัน
// placed = กล่องป้ายที่วางแล้ว (ใช้หลบไม่ให้ป้ายทับกัน) · คืน { line, label } ให้วาดป้ายทีหลังเส้นทั้งหมด
function dep(a, b, kind, placed) {
  const dir = b.x > a.x ? 1 : -1;
  const [x1, y1] = [a.x + dir * a.rx, a.y];
  const [x2, y2] = [b.x - dir * b.rx, b.y];
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const h = 13, w = 0.42;
  const p1 = [x2 - h * Math.cos(ang - w), y2 - h * Math.sin(ang - w)];
  const p2 = [x2 - h * Math.cos(ang + w), y2 - h * Math.sin(ang + w)];
  const f = (n) => n.toFixed(1);
  // ป้ายวางบนเส้น (มีขอบขาว) — ลองหลายตำแหน่งตามเส้น เลือกจุดแรกที่ไม่ทับป้ายอื่น
  const LW = 82, LH = 22;
  let lx, ly;
  for (const t of [0.5, 0.35, 0.65, 0.25, 0.75, 0.2, 0.8]) {
    lx = x1 + (x2 - x1) * t;
    ly = y1 + (y2 - y1) * t;
    if (!placed.some((p) => Math.abs(p.x - lx) < LW && Math.abs(p.y - ly) < LH)) break;
  }
  placed.push({ x: lx, y: ly });
  return {
    line: `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${C.line}" stroke-width="1.5" stroke-dasharray="7 5"/>
<polyline points="${f(p1[0])},${f(p1[1])} ${f(x2)},${f(y2)} ${f(p2[0])},${f(p2[1])}" fill="none" stroke="${C.line}" stroke-width="1.5"/>`,
    label: `<text x="${f(lx)}" y="${f(ly + 5)}" text-anchor="middle" font-size="15" font-style="italic" fill="${C.muted}" paint-order="stroke" stroke="#fff" stroke-width="6">«${kind}»</text>`,
  };
}

// ลูกศรสืบทอด (หัวสามเหลี่ยมโปร่งชี้ไปที่ผู้กระทำแม่)
function generalize(x, yFrom, yTo) {
  const base = yTo + 18;
  return `<line x1="${x}" y1="${yFrom}" x2="${x}" y2="${base}" stroke="${C.line}" stroke-width="1.8"/>
<polygon points="${x - 11},${base} ${x},${yTo} ${x + 11},${base}" fill="#fff" stroke="${C.line}" stroke-width="1.8"/>`;
}

function build({ title, parent, bands, extras = [], deps = [], system }) {
  const TOP = 120;
  const rxA = radiusFor(bands.flatMap((b) => b.cases.map((c) => c[1])));
  const rxB = extras.length ? radiusFor(extras.map((e) => e[1])) : 0;
  const COL_A = BOX_L + 40 + rxA;
  const COL_B = COL_A + rxA + GAP + rxB;
  const BOX_R = Math.max(extras.length ? COL_B + rxB + 40 : COL_A + rxA + 60, BOX_L + textWidth(title, 24) + 80);

  let y = TOP + 70;
  const all = {};
  const bandInfo = [];
  bands.forEach((band, i) => {
    if (i > 0) y += 52; // ช่องระหว่างกลุ่ม (เส้นแบ่ง + ป้ายกลุ่ม)
    const first = y;
    for (const [id, text] of band.cases) {
      all[id] = { id, text, x: COL_A, y, rx: rxA };
      y += ROW;
    }
    bandInfo.push({ ...band, first, ids: band.cases.map((c) => c[0]) });
  });
  const bottom = y - ROW + RY + 40;
  for (const [id, text, at, dy = 0] of extras) {
    all[id] = { id, text, x: COL_B, y: (typeof at === "number" ? at : all[at].y) + dy, rx: rxB };
  }

  const parts = [];
  parts.push(`<rect x="${BOX_L}" y="${TOP - 50}" width="${BOX_R - BOX_L}" height="${bottom - TOP + 50}" rx="16" fill="#fff" stroke="${C.ink}" stroke-width="2"/>
<text x="${(BOX_L + BOX_R) / 2}" y="${TOP - 12}" text-anchor="middle" font-size="24" font-weight="700" fill="${C.ink}">${esc(title)}</text>`);

  // เส้นแบ่งกลุ่มตามบทบาท + ป้ายกลุ่ม (เหนือวงรีแรกของกลุ่ม)
  bandInfo.forEach((b, i) => {
    if (i > 0) parts.push(`<line x1="${BOX_L + 14}" y1="${b.first - RY - 30}" x2="${BOX_R - 14}" y2="${b.first - RY - 30}" stroke="${C.band}" stroke-width="1.5" stroke-dasharray="4 6"/>`);
    parts.push(`<text x="${BOX_L + 18}" y="${b.first - RY - 9}" font-size="15" font-weight="700" fill="${C.muted}">${esc(b.tag)}</text>`);
  });

  // ผู้กระทำ (ซ้าย) — อยู่กึ่งกลางกลุ่มของตัวเอง เชื่อมกับวงรีทุกอันในกลุ่ม
  const actorY = bandInfo.map((b) => (all[b.ids[0]].y + all[b.ids[b.ids.length - 1]].y) / 2);
  bandInfo.forEach((b, i) => {
    for (const id of b.ids) parts.push(assoc(ACTOR_X + 26, actorY[i] - 11, all[id]));
  });
  // ผู้กระทำแม่ที่ไม่มี use case ในรูปนี้ (เช่น "ผู้ใช้" ในรูปฝั่งผู้ดูแล) — โชว์เพื่อบอกการสืบทอด
  const chain = [...(parent ? [{ y: TOP + 20, sub: parent.sub }] : []), ...bandInfo.map((b, i) => ({ y: actorY[i], sub: b.sub }))];
  if (parent) parts.push(person(ACTOR_X, TOP + 20, parent.actor, parent.sub));
  bandInfo.forEach((b, i) => parts.push(person(ACTOR_X, actorY[i], b.actor, b.sub)));
  // หัวลูกศรอยู่ใต้ป้ายของผู้กระทำแม่ (ป้ายหลายบรรทัด = ลงมาอีก)
  const labelBottom = (a) => a.y + 96 + 20 * Math.max(0, (a.sub || "").split("\n").length - 1);
  for (let i = 1; i < chain.length; i++) parts.push(generalize(ACTOR_X, chain[i].y - 52, labelBottom(chain[i - 1])));

  // ผู้กระทำที่ไม่ใช่คน (ขวา)
  let W = BOX_R + 40;
  if (system) {
    const ids = system.cases;
    const sy = (all[ids[0]].y + all[ids[ids.length - 1]].y) / 2;
    const sx = BOX_R + 130;
    for (const id of ids) parts.push(assoc(sx - 80, sy, all[id]));
    parts.push(systemActor(sx, sy, system.actor, system.sub));
    W = sx + 110;
  }

  const placed = [];
  const drawn = deps.map(([a, b, kind]) => dep(all[a], all[b], kind, placed));
  for (const d of drawn) parts.push(d.line);
  for (const o of Object.values(all)) parts.push(oval(o));
  for (const d of drawn) parts.push(d.label); // ป้ายอยู่บนสุด ไม่โดนวงรีทับ

  const H = bottom + 40;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(W)} ${H}" width="${Math.ceil(W)}" height="${H}" font-family="${FONT}">
<rect width="100%" height="100%" fill="#fff"/>
${parts.join("\n")}
</svg>`;
}

const USER = { actor: "ผู้ใช้", sub: "นักศึกษา /\nบุคลากร มข." };
const TA = { actor: "TA", sub: "ผู้ช่วยผู้ดูแล" };
const ADMIN = { actor: "ผู้ดูแลระบบ", sub: "Admin" };

// ───────────── ระบบยืม-คืน (1/2): ผู้ใช้ ─────────────
const borrowUser = build({
  title: "ระบบยืม-คืนอุปกรณ์ IoT — ผู้ใช้",
  bands: [
    {
      ...USER, tag: "ผู้ใช้ทั่วไป",
      cases: [
        ["login", "เข้าสู่ระบบด้วยบัญชี Google มข."],
        ["browse", "ค้นหาและดูอุปกรณ์ที่ว่าง"],
        ["borrow", "ขอยืมอุปกรณ์ (สแกน QR)"],
        ["renew", "ขอยืมต่อ"],
        ["return", "ขอคืนอุปกรณ์"],
        ["pickup", "ขอนัดรับอุปกรณ์"],
        ["claim", "ยืนยันรับอุปกรณ์ตามนัด"],
        ["cancel", "ยกเลิกคำขอ"],
        ["myhist", "ดูประวัติการยืม-คืนของตนเอง"],
        ["presence", "ดูสถานะผู้ดูแลในห้อง"],
        ["notify", "รับการแจ้งเตือน"],
        ["profile", "จัดการข้อมูลส่วนตัว"],
      ],
    },
  ],
  extras: [
    ["photo", "ถ่ายภาพและระบุสภาพอุปกรณ์", "renew", ROW / 2],
    ["rules", "ยอมรับเงื่อนไขการยืม", "pickup", ROW / 2],
  ],
  deps: [
    ["borrow", "photo", "include"],
    ["return", "photo", "include"],
    ["borrow", "rules", "include"],
    ["return", "rules", "include"],
    ["renew", "rules", "include"],
    ["pickup", "rules", "include"],
    ["claim", "photo", "include"],
    ["claim", "rules", "include"],
  ],
});

// ───────────── ระบบยืม-คืน (2/2): TA + ผู้ดูแลระบบ + ระบบตั้งเวลา ─────────────
const borrowStaff = build({
  title: "ระบบยืม-คืนอุปกรณ์ IoT — ผู้ดูแล",
  parent: USER,
  bands: [
    {
      ...TA, tag: "TA (ทำได้ทุกอย่างของผู้ใช้)",
      cases: [
        ["decide", "พิจารณาคำขอยืม-คืน"],
        ["schedule", "จัดการคำขอนัดรับ"],
        ["checkin", "ลงเวลาเข้า-ออกห้อง"],
        ["lookup", "ตรวจสอบสถานะอุปกรณ์"],
        ["allhist", "ดูประวัติการยืม-คืนทั้งหมด"],
        ["report", "ออกรายงานการยืม-คืน"],
        ["stock", "ดูรายงานสต็อกอุปกรณ์"],
        ["qr", "พิมพ์ป้าย QR อุปกรณ์"],
        ["iotinsp", "ตรวจสภาพอุปกรณ์ประจำภาคเรียน"],
      ],
    },
    {
      ...ADMIN, tag: "ผู้ดูแลระบบ (ทำได้ทุกอย่างของ TA)",
      cases: [
        ["additem", "เพิ่มอุปกรณ์"],
        ["edititem", "แก้ไขข้อมูลอุปกรณ์"],
        ["retire", "จำหน่ายอุปกรณ์ออก"],
        ["delete", "ลบอุปกรณ์ถาวร"],
        ["import", "นำเข้าอุปกรณ์จากไฟล์ CSV"],
        ["category", "จัดการหมวดหมู่อุปกรณ์"],
        ["users", "จัดการผู้ใช้และสิทธิ์"],
        ["settings", "ตั้งค่าระบบ"],
      ],
    },
  ],
  extras: [
    ["inspect", "ตรวจสภาพอุปกรณ์ที่รับคืน", "decide"],
    ["expire", "ยกเลิกคำขอที่หมดอายุ", "checkin", ROW / 2],
    ["due", "เตือนกำหนดคืน", "lookup", ROW / 2],
    ["health", "เตือนประกันและอายุอุปกรณ์", "allhist", ROW / 2],
    ["autoout", "ลงเวลาออกผู้ดูแลอัตโนมัติ", "report", ROW / 2],
  ],
  deps: [["decide", "inspect", "include"]],
  system: { actor: "ระบบตั้งเวลา", sub: "pg_cron", cases: ["expire", "due", "health", "autoout"] },
});

// ───────────── ระบบห้องคอมพิวเตอร์ ─────────────
const room = build({
  title: "ระบบห้องคอมพิวเตอร์",
  bands: [
    {
      ...USER, tag: "ผู้ใช้ทั่วไป",
      cases: [
        ["login", "เข้าสู่ระบบด้วยบัญชี Google มข."],
        ["map", "ดูผังห้องและสถานะเครื่อง"],
        ["lan", "ดูสถานะ LAN port"],
        ["report", "แจ้งปัญหาเครื่องหรือ LAN"],
        ["notify", "รับผลการแจ้งปัญหา"],
      ],
    },
    {
      ...TA, tag: "TA (ทำได้ทุกอย่างของผู้ใช้)",
      cases: [
        ["status", "ปรับสถานะเครื่องและ LAN"],
        ["checklist", "ตรวจเช็กอุปกรณ์ประจำเครื่อง"],
        ["termins", "ตรวจเครื่องประจำภาคเรียน"],
        ["handle", "พิจารณาคำแจ้งปัญหา"],
        ["repair", "จัดการงานซ่อม"],
        ["log", "ดูประวัติสถานะเครื่อง"],
      ],
    },
    {
      ...ADMIN, tag: "ผู้ดูแลระบบ (ทำได้ทุกอย่างของ TA)",
      cases: [
        ["rooms", "จัดการข้อมูลห้อง"],
        ["stations", "จัดการเครื่องคอมพิวเตอร์"],
        ["ports", "จัดการ LAN port"],
      ],
    },
  ],
  extras: [["openrep", "เปิดงานซ่อมจากคำแจ้ง", "handle", ROW / 2]],
  deps: [["openrep", "handle", "extend"]],
});

const out = (name, svg) => fs.writeFileSync(path.join(__dirname, name + ".svg.html"), svg);
out("usecase-borrow-user", borrowUser);
out("usecase-borrow-staff", borrowStaff);
out("usecase-room", room);
for (const old of ["usecase-borrow.svg.html"]) fs.rmSync(path.join(__dirname, old), { force: true });
console.log("ok");
