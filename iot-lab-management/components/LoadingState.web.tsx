import React, { useEffect, useId, useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";

// หน้ากำลังโหลด (เว็บ/PWA): น้องขวดทดลอง + ออร่า + ประกาย + "รอสักครู่นะ" + แถบโหลด — ใช้แทนวงกลมหมุนเต็มหน้าทุกหน้า
// ให้เบาที่สุด:
//   · ลอยขึ้นลง/ออร่า/ประกาย/เงา/แถบโหลด = กล่อง HTML ขยับด้วย transform + opacity เท่านั้น → GPU ทำ (compositor) ไม่กินเธรดหลัก
//   · ใน SVG เหลือแค่น้ำกระเพื่อม ฟอง กะพริบตา (วาดซ้ำพื้นที่ ~110px เท่านั้น)
//   · CSS ใส่ครั้งเดียวทั้งแอป / ไม่มีไฟล์รูป / โหลดเสร็จใน 0.3 วิ = ไม่แสดงเลย (กันกระพริบ)
//   · หน้าที่ซ่อนอยู่ใน stack (display:none) แอนิเมชันหยุดเอง · เครื่องตั้ง "ลดการเคลื่อนไหว" = ภาพนิ่ง
// มือถือ (แอปติดตั้ง) ใช้ LoadingState.tsx

type Props = { style?: StyleProp<ViewStyle>; text?: string };

const SHOW_AFTER = 300;
const E = "cubic-bezier(.45,0,.55,1)";

const CSS = `
.lhl{display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 0 16px;pointer-events:none;user-select:none}
.lhl-stage{position:relative;width:170px;height:140px}
.lhl-stage>*{position:absolute}
.lhl-au{left:1px;top:-4px;width:168px;height:168px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,.42) 0,rgba(147,197,253,.28) 38%,rgba(191,219,254,0) 70%);animation:lhl-au 3.2s ${E} infinite}
.lhl-au2{left:27px;top:22px;width:116px;height:116px;border-radius:50%;background:radial-gradient(circle,#fff 0,rgba(219,234,254,.55) 45%,rgba(219,234,254,0) 72%);animation:lhl-au2 3.2s ${E} infinite}
.lhl-sh{left:57px;top:117px;width:56px;height:8px;border-radius:50%;background:#1E3A8A;opacity:.14;animation:lhl-sh 2.8s ${E} infinite}
.lhl-fl{left:28px;top:0;width:114px;height:132px;animation:lhl-bob 2.8s ${E} infinite}
.lhl-fl svg{display:block;width:100%;height:100%}
.lhl-st{width:12px;height:12px;margin:-6px 0 0 -6px;clip-path:polygon(50% 0,63% 37%,100% 50%,63% 63%,50% 100%,37% 63%,0 50%,37% 37%);opacity:.15;animation:lhl-tw 2.4s ease-in-out infinite}
.lhl-dt{width:4px;height:4px;margin:-2px 0 0 -2px;border-radius:50%;opacity:.15;animation:lhl-tw 2.4s ease-in-out infinite}
.lhl-wv{animation:lhl-wv 2.2s linear infinite}.lhl-wv2{animation:lhl-wv 3.4s linear infinite reverse}
.lhl-bb{transform-box:fill-box;transform-origin:center;opacity:0;animation:lhl-bb 2.2s ease-out infinite}
.lhl-ey{transform-box:fill-box;transform-origin:center;animation:lhl-ey 4.5s ease-in-out infinite}
.lhl-t1{font-family:NotoSansThai_600SemiBold,system-ui,sans-serif;font-size:17px;color:#172033;text-align:center}
.lhl-t2{font-family:NotoSansThai_400Regular,system-ui,sans-serif;font-size:13px;color:#64748B;text-align:center;margin-top:2px}
.lhl-bar{position:relative;width:150px;height:5px;margin-top:6px;border-radius:99px;background:rgba(37,99,235,.12);overflow:hidden}
.lhl-run{position:absolute;top:0;bottom:0;left:0;width:40%;border-radius:99px;background:linear-gradient(90deg,rgba(96,165,250,0),#3B82F6 45%,#1D4ED8 75%,#60A5FA);box-shadow:0 0 6px rgba(37,99,235,.5);animation:lhl-run 1s cubic-bezier(.65,0,.35,1) infinite}
@keyframes lhl-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes lhl-sh{0%,100%{transform:scaleX(1);opacity:.14}50%{transform:scaleX(.82);opacity:.08}}
@keyframes lhl-au{0%,100%{transform:scale(.9);opacity:.7}50%{transform:scale(1.1);opacity:1}}
@keyframes lhl-au2{0%,100%{transform:scale(1.08);opacity:.4}50%{transform:scale(.92);opacity:.7}}
@keyframes lhl-tw{0%,100%{transform:scale(.4) rotate(0);opacity:.15}50%{transform:scale(1) rotate(20deg);opacity:1}}
@keyframes lhl-wv{from{transform:translateX(0)}to{transform:translateX(-40px)}}
@keyframes lhl-bb{0%{transform:translateY(0) scale(.6);opacity:0}25%{opacity:1}100%{transform:translateY(-20px) scale(1);opacity:0}}
@keyframes lhl-ey{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.12)}}
@keyframes lhl-run{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}
@media (prefers-reduced-motion:reduce){.lhl *{animation:none!important}.lhl-st,.lhl-dt{opacity:.8}.lhl-run{left:30%}}`;

// ประกายรอบปากขวด: [x, y, ขนาด, สี, หน่วงเวลา] (พิกัดในกล่อง 170×160) — ตำแหน่งอยู่ที่กล่องเอง แอนิเมชันขยับแค่ transform
const STARS: [number, number, number, string, number][] = [
  [53, 32, 1, "#3B82F6", 0], [119, 28, 1, "#2563EB", 0.5], [85, 15, 0.75, "#60A5FA", 1],
  [134, 55, 0.6, "#60A5FA", 1.5], [38, 62, 0.6, "#93C5FD", 1.9], [104, 9, 0.5, "#93C5FD", 0.8],
  [66, 13, 0.45, "#BFDBFE", 1.2],
];
const DOTS: [number, number, number, string, number][] = [
  [42, 45, 1, "#93C5FD", 0.3], [130, 43, 1.1, "#93C5FD", 1.1], [110, 47, 0.75, "#60A5FA", 2], [62, 32, 0.75, "#60A5FA", 1.6],
];

const FLASK =
  "M43 26h18v22.5c0 1.6.5 3.2 1.4 4.6l17.4 27.2c3.8 6.1-.5 13.7-7.6 13.7H31.8c-7.1 0-11.4-7.6-7.6-13.7l17.4-27.2c.9-1.4 1.4-3 1.4-4.6z";

const flaskSvg = (clip: string) => `<svg viewBox="0 0 104 120" aria-hidden="true">
<defs><clipPath id="${clip}"><path d="${FLASK}"/></clipPath></defs>
<path d="${FLASK}" fill="#fff"/>
<g clip-path="url(#${clip})">
<path class="lhl-wv2" d="M2 65q10-4 20 0t20 0 20 0 20 0 20 0 20 0V102H2z" fill="#BFDBFE"/>
<path class="lhl-wv" d="M2 68q10-4.5 20 0t20 0 20 0 20 0 20 0 20 0V102H2z" fill="#2563EB"/>
<circle class="lhl-bb" cx="39" cy="89" r="2.2" fill="#fff"/>
<circle class="lhl-bb" cx="65" cy="90" r="1.7" fill="#fff" style="animation-delay:.7s"/>
<circle class="lhl-bb" cx="52" cy="91" r="1.3" fill="#fff" style="animation-delay:1.4s"/>
</g>
<path d="${FLASK}" fill="none" stroke="#1E40AF" stroke-width="4.5" stroke-linejoin="round"/>
<rect x="38.5" y="19" width="27" height="8.5" rx="4.25" fill="#1E40AF"/>
<path d="M38.5 54.5l-8 12.5" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
<g class="lhl-ey"><ellipse cx="46" cy="77" rx="2.5" ry="3.1" fill="#0F172A"/><ellipse cx="58" cy="77" rx="2.5" ry="3.1" fill="#0F172A"/></g>
<circle cx="46.9" cy="76" r=".85" fill="#fff"/><circle cx="58.9" cy="76" r=".85" fill="#fff"/>
<path d="M49.4 82.2q2.6 2.2 5.2 0" fill="none" stroke="#0F172A" stroke-width="1.9" stroke-linecap="round"/>
<ellipse cx="40.6" cy="81.6" rx="2.4" ry="1.4" fill="#F9A8D4" opacity=".6"/><ellipse cx="63.4" cy="81.6" rx="2.4" ry="1.4" fill="#F9A8D4" opacity=".6"/>
</svg>`;

function ensureCss() {
  if (typeof document === "undefined" || document.getElementById("lhl-css")) return;
  const el = document.createElement("style");
  el.id = "lhl-css";
  el.textContent = CSS;
  document.head.appendChild(el);
}

export default function LoadingState({ style, text = "กำลังโหลดข้อมูล..." }: Props) {
  const [show, setShow] = useState(false);
  const clip = "lhl" + useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    ensureCss();
    const t = setTimeout(() => setShow(true), SHOW_AFTER);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={[{ alignItems: "center" }, style]}>
      {show && (
        <div className="lhl" role="status" aria-live="polite">
          <div className="lhl-stage">
            <div className="lhl-au" />
            <div className="lhl-au2" />
            {STARS.map(([x, y, sc, color, d], i) => (
              <div key={"s" + i} style={{ left: x, top: y, width: 12 * sc, height: 12 * sc, margin: `${-6 * sc}px 0 0 ${-6 * sc}px` }}>
                <div className="lhl-st" style={{ position: "absolute", inset: 0, margin: 0, width: "100%", height: "100%", background: color, animationDelay: `${d}s` }} />
              </div>
            ))}
            {DOTS.map(([x, y, sc, color, d], i) => (
              <div key={"d" + i} className="lhl-dt" style={{ left: x, top: y, width: 4 * sc, height: 4 * sc, background: color, animationDelay: `${d}s` }} />
            ))}
            <div className="lhl-sh" />
            <div className="lhl-fl" dangerouslySetInnerHTML={{ __html: flaskSvg(clip) }} />
          </div>
          <div>
            <div className="lhl-t1">รอสักครู่นะ</div>
            <div className="lhl-t2">{text}</div>
          </div>
          <div className="lhl-bar"><div className="lhl-run" /></div>
        </div>
      )}
    </View>
  );
}
