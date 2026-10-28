# LabHub — IoT Lab Management (มข.)

แอปจัดการห้องปฏิบัติการ IoT มหาวิทยาลัยขอนแก่น มี 2 ระบบที่แยกกันเด็ดขาด

1. **ระบบยืม-คืนอุปกรณ์** — นักศึกษาสแกน QR ที่ตัวของ → ส่งคำขอยืม/คืน/ยืมต่อ/นัดรับ → ผู้ดูแลอนุมัติ
2. **ระบบห้องคอม** — ผังห้อง (เครื่องคอม + LAN port), แจ้งปัญหา, งานซ่อม, ตรวจประจำเทอม

Stack: React Native + Expo (expo-router) + Supabase · ใช้ได้ทั้งแอปมือถือและเว็บ (PWA ที่ labhub-kku.vercel.app)

## เริ่มใช้งาน

```bash
npm install
npx expo start          # มือถือ (Expo Go) / กด w = เว็บ
npx tsc --noEmit        # ตรวจ type
npx expo export -p web  # build เว็บ (Vercel ใช้คำสั่งใน vercel.json)
```

## โครงสร้าง

| โฟลเดอร์ | เก็บอะไร |
|---|---|
| `app/` | หน้าจอ (ชื่อไฟล์ = URL ของ expo-router) · `app/admin/` = หน้าผู้ดูแล/TA |
| `components/` | ชิ้นส่วน UI ใช้ร่วม · `borrow/` ระบบยืม-คืน · `room/` ระบบห้องคอม · `desktop/` แบบจอใหญ่ของหน้า admin |
| `lib/` | ตรรกะ/ตัวช่วย (ระบบยืม-คืน + ใช้ร่วม) · `room/` ระบบห้องคอม · `web/` เฉพาะเว็บ (PWA, push, ป้ายติดตั้ง) · `shims/` ตัวแทนไลบรารีมือถือบนเว็บ |
| `supabase/` | migration (SQL ทั้งหมด), Edge Function `send-push`, เทส SQL |
| `public/` | ไฟล์ PWA (manifest, service worker, ไอคอน) |
| `scripts/` | `subset-ionicons.js` (ตอน build), `make-web-icons.js`, `backup-db.js` |
| `docs/` | `DESIGN.md` (ระบบดีไซน์), คู่มือ deploy/ดูแลระบบ, `guides/` คู่มือผู้ใช้, `archive/` เอกสารเก่า |

กติกาการเขียนโค้ดทั้งหมดอยู่ใน [`CLAUDE.md`](CLAUDE.md)
