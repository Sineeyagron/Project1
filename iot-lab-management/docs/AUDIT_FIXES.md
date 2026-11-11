# งานแก้จากการตรวจทั้ง repo (6 พ.ย. 2569) — ทำหลังพรีเซนต์ 13 พ.ย.

> ยังไม่แก้ · ทำเสร็จข้อไหนลบข้อนั้นออก · หมดแล้วลบไฟล์นี้ + บรรทัดใน CLAUDE.md

## วิธีแก้แบบไม่ชนระบบจริง
- **โค้ดแอป** (ข้อ 2, 4, 5, 7, 8): ไม่ถึงเว็บจริงจนกว่าจะ merge เข้า `main` · แอปบนเครื่อง/preview ต่อฐานข้อมูลจริง แต่ข้อพวกนี้แค่อ่านข้อมูล
- **ฟังก์ชันในฐานข้อมูล** (ข้อ 1, 6): วาง `create or replace function ...` ฉบับใหม่ไว้ต้น `supabase/tests/borrow_rules.test.sql` → รันใน SQL Editor → เทสจบด้วย error ตั้งใจ = ย้อนกลับทั้งหมด ฐานข้อมูลจริงไม่เปลี่ยน · ผ่านแล้วค่อยรัน migration จริง · พัง = รันฟังก์ชันเดิมทับกลับ

## ต้องแก้
1. **คืนอัตโนมัติ ของที่ นศ. แจ้งชำรุด กลับเป็น "ว่าง"** — `expire_requests` (`supabase/migrations/20261003100000_phase3_rpc.sql:231`) ตั้ง `items.status = 'available'` เสมอ
   → migration ใหม่: `set status = case when r.condition = 'damaged' then 'repair' else 'available' end` (เหมือน `decide_request`)

## ควรแก้
2. **หน้าจัดการผู้ใช้เกิน 1,000 คนหาไม่เจอ** — `app/admin/users.tsx:79` ดึง `profiles` ครั้งเดียว (Supabase ตัดที่ 1,000 แถวเงียบ ๆ)
   → ย้าย `fetchAll` จาก `app/admin/report.tsx:74` ไป `lib/` แล้วใช้ `.range()` ทีละหน้า (`items` ใน admin/items, equipment, stock มีเพดานเดียวกัน)
3. **ไม่มีเทสคืนอัตโนมัติ** — `supabase/tests/borrow_rules.test.sql` ข้อ 5 เทสแค่ยืมหมดอายุ
   → เพิ่ม: คืน good หมดเวลา → `available` / คืน damaged หมดเวลา → `repair` / `auto_returned = true`
4. **anon key + URL ก๊อปซ้ำ** — `lib/itemPhoto.ts:8-9` → ลบ แล้ว import `SUPABASE_URL`, `SUPABASE_ANON_KEY` จาก `./supabase` (แบบ `lib/borrowPhotos.ts`)
5. **ทางสำรอง "ยังไม่รัน migration" ที่ตายแล้ว** — `isMissingColumn` / `SELECT_LEGACY` ใน `lib/people.ts`, `app/admin/users.tsx:81`, `app/admin/requests.tsx:131,137`, `app/profile.tsx:82` → ลบ (คอลัมน์มีจริงแล้ว)

## ดีถ้าแก้
6. **สองแท็บกดยืมพร้อมกัน เกินโควตาได้** — `request_borrow` (`20261011200000_f2_pickup_hold_pending.sql`) → เพิ่มต้นฟังก์ชัน `perform pg_advisory_xact_lock(hashtext('borrow:' || v_uid));`
7. **ชื่อเดือนไทยซ้ำ** — `lib/report.ts:136-137`, `components/borrow/RangeCalendarSheet.tsx:26` → ใช้จาก `lib/calendar.ts`
8. **mockup ขึ้น git** — `mockups/room-qr-mockup.html` → `git rm --cached` · อัปเดตสถานะใน CLAUDE.md ให้ตรง

## ยังไม่ได้ตรวจ
ระบบนัดรับ (`_pickup_free` ตอนแย่งกัน), หน้า `app/admin/*` ส่วนใหญ่, `public/sw.js`, `scripts/`
