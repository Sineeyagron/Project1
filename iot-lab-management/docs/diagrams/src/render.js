// สร้างรูปแผนภาพสำหรับรายงาน: docs/diagrams/src/*.mmd (Mermaid) + *.svg.html (วาดเอง) → docs/diagrams/*.svg + *.png
// ใช้ Chrome แบบ headless (ไม่ต้องลงอะไรเพิ่ม) — Mermaid โหลดจาก CDN ตอน render จึงต้องต่อเน็ต
// รัน (ในโฟลเดอร์ docs/diagrams): npm run er / npm run usecase / npm run build — ดู README.md (ตั้ง CHROME=path ถ้าหา Chrome ไม่เจอ)
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const SRC = __dirname;
const OUT = path.join(__dirname, "..");
const CHROME =
  process.env.CHROME ||
  // หา Chrome/Edge ตามที่ติดตั้งปกติ (Windows ไดรฟ์ C/E, ติดตั้งเฉพาะผู้ใช้, macOS) — ไม่เจอให้ตั้ง CHROME เอง
  [
    ...["C", "E", "D"].flatMap((d) => [
      `${d}:/Program Files/Google/Chrome/Application/chrome.exe`,
      `${d}:/Program Files (x86)/Google/Chrome/Application/chrome.exe`,
      `${d}:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`,
    ]),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].find((p) => p && fs.existsSync(p));
if (!CHROME) throw new Error("ไม่เจอ Chrome/Edge — ตั้ง CHROME=path/to/chrome.exe");

const FONT = "'Leelawadee UI', 'Noto Sans Thai', Tahoma, sans-serif";
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "labhub-diagram-"));

function chrome(args) {
  return execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${TMP}/profile`, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

const fileUrl = (p) => "file:///" + p.replace(/\\/g, "/");

// หน้า HTML ที่มีแต่ <svg> ของแผนภาพ (พื้นขาว ขอบ 24px)
function page(body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#fff}#out{display:inline-block;padding:24px}
</style></head><body><div id="out">${body}</div></body></html>`;
}

function mermaidPage(code) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}#out{display:inline-block;padding:24px}</style>
</head><body><div id="out"></div>
<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.14.0/dist/mermaid.esm.min.mjs";
import elkLayouts from "https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0.2.1/dist/mermaid-layout-elk.esm.min.mjs";
mermaid.registerLayoutLoaders(elkLayouts);
mermaid.initialize({ startOnLoad: false, theme: "base", securityLevel: "strict", layout: ${JSON.stringify(process.env.LAYOUT || "elk")},
  elk: { mergeEdges: false, nodePlacementStrategy: "BRANDES_KOEPF" },
  // ป้ายบนเส้น + ชื่อรูป ให้ใหญ่พอพิมพ์ลง A4 (ค่าเริ่มต้นเล็กกว่าตัวในกล่องมาก)
  themeCSS: ".edgeLabel, .edgeLabel p, .edgeLabel span { font-size: 18px !important; background: #fff !important; } .erDiagramTitleText, .titleText { font-size: 26px !important; font-weight: 700 !important; fill: #172033 !important; }",
  er: { useMaxWidth: false, layoutDirection: "TB", minEntityWidth: 120, entityPadding: 12 },
  themeVariables: { fontFamily: ${JSON.stringify(FONT)}, fontSize: "20px",
    primaryColor: "#EFF5FF", primaryBorderColor: "#2563EB", primaryTextColor: "#172033",
    lineColor: "#475569", tertiaryColor: "#FFFFFF", attributeBackgroundColorOdd: "#FFFFFF", attributeBackgroundColorEven: "#F5F8FE" } });
mermaid.render("d", ${JSON.stringify(code)}).then(({ svg }) => { document.getElementById("out").innerHTML = svg; });
</script></body></html>`;
}

// render 1 หน้า → ดึง <svg> ที่วาดเสร็จ → ถ่าย PNG ขนาดพอดี (×2 ให้คมตอนพิมพ์)
function render(name, html) {
  const htmlPath = path.join(TMP, name + ".html");
  fs.writeFileSync(htmlPath, html);
  const dom = chrome(["--virtual-time-budget=20000", "--dump-dom", fileUrl(htmlPath)]);
  const m = dom.match(/<svg[\s\S]*<\/svg>/);
  if (!m) throw new Error(name + ": render ไม่สำเร็จ (ไม่มี <svg>)");
  let svg = m[0];
  if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg)) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const vb = svg.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
  if (!vb) throw new Error(name + ": ไม่มี viewBox");
  const w = Math.ceil(+vb[3]), h = Math.ceil(+vb[4]);
  // ให้ไฟล์ SVG เดี่ยวมีขนาดชัดเจน + พื้นขาว (Word/PowerPoint เปิดได้ตรง)
  svg = svg.replace(/<svg([^>]*?)\swidth="[^"]*"/, "<svg$1").replace(/<svg([^>]*?)\sheight="[^"]*"/, "<svg$1")
    .replace(/<svg([^>]*?)\sstyle="[^"]*"/, "<svg$1")
    .replace("<svg", `<svg width="${w}" height="${h}" style="background:#fff"`);
  fs.writeFileSync(path.join(OUT, name + ".svg"), svg);

  const pngHtml = path.join(TMP, name + ".png.html");
  fs.writeFileSync(pngHtml, page(svg));
  chrome(["--force-device-scale-factor=2", `--window-size=${w + 48},${h + 48}`, `--screenshot=${path.join(OUT, name + ".png")}`, fileUrl(pngHtml)]);
  console.log(`${name}: ${w}×${h}`);
}

const only = process.argv[2];
for (const f of fs.readdirSync(SRC)) {
  const name = f.replace(/\.(mmd|svg\.html)$/, "");
  if (only && name !== only) continue;
  if (f.endsWith(".mmd")) {
    const code = fs.readFileSync(path.join(SRC, f), "utf8");
    render(name, mermaidPage(code));
  } else if (f.endsWith(".svg.html")) {
    // แผนภาพวาดเอง (use case): ไฟล์มี <svg> พร้อมแล้ว
    render(name, page(fs.readFileSync(path.join(SRC, f), "utf8")));
  }
}
fs.rmSync(TMP, { recursive: true, force: true });
