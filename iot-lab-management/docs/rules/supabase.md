# Supabase — กติกาทั่วไป

> อ่านเมื่อแก้ SQL / RLS / Storage / Realtime / cron / ล็อกอิน

- SQL ทั้งหมดอยู่ใน `supabase/migrations/` · event trigger `ensure_rls` เปิด RLS ให้ตารางใหม่อัตโนมัติ → **ตาราง/หน้าใหม่ต้องเขียน policy ในไฟล์เดียวกัน**
- RLS: ยังไม่ล็อกอิน = เข้าไม่ได้ / user อ่านของสาธารณะ + ของตัวเอง / `is_admin()`, `is_staff()` (admin+ta) / เขียนข้อมูลใช้ `.select("id")` เช็ก (RLS ไม่ให้ = 0 แถว ไม่ error)
- `profiles_protect`: user แก้ role/email/ชื่อ/รูปไม่ได้, `student_id` (`^[0-9]{9}-[0-9]$`) ตั้งได้ครั้งเดียว · admin แก้ที่ `admin/users` · ชื่อผู้ใช้ในหน้าผู้ดูแลใช้ `who()` (lib/people)
- Storage: `item-images` (admin อัปโหลด — มือถือส่ง `session.access_token`), `borrow-photos/<user_id>/` (หลักฐานยืม-คืน)

## Realtime
- Broadcast (`realtime.send`): ช่อง `user:<id>` (notification), `staff` (request), `lab` (presence), `room` (room_status)
- ตัวจัดการช่องกลาง `lib/broadcast.ts` (supabase.channel คืนช่องเดิมถ้าชื่อซ้ำ → ช่องที่ฟังหลายที่ต้องผ่านทะเบียนนี้ ห้ามเปิดช่องเอง)
- ระบบยืมฟังด้วย `useRealtime()` (lib/realtime) · ระบบห้องใช้ `useRoomLive()` (lib/room/roomRealtime) · แจ้งเตือนใหม่ (ใช้ร่วม) = `useMyNotifications()` (lib/broadcast)
- ตาราง `realtime.messages` แบ่งพาร์ทิชันรายวัน ไม่มีพาร์ทิชัน = ส่งล้มเงียบ (แอปมีรีเฟรชสำรอง 5 นาที)

## cron (แพ็กเกจฟรี ระวัง Disk IO)
- `expire-borrow-requests` ทุก 5 นาที (+ `expire_pickups`), `send_due_reminders` + `item-health-alerts` 08:00 ไทย, `staff-auto-checkout` 18:00 ไทย (เช็กอินได้ 07:00–18:00), `cleanup-cron-history` (เก็บ 7 วัน)

## ล็อกอิน Google (`lib/googleAuth.ts`)
- อีเมล มข. = `@kkumail.com` (นศ.) + `@kku.ac.th` (อาจารย์/บุคลากร — เข้าครั้งแรกเป็น user ไม่ถามรหัส นศ. admin ตั้งสิทธิ์เองใน `admin/users` ห้ามให้สิทธิ์ตามโดเมนอัตโนมัติ)
- Auth Hook `hook_restrict_signup_domain` อ่าน `app_settings.allowed_email_domain` (คั่นด้วย `,`) = `kkumail.com,kku.ac.th` ใช้จริงแล้ว — แก้ได้จาก SQL เท่านั้น · Hook เปิดใน Dashboard
- บัญชีอีเมลอื่นที่มีอยู่ (รหัสผ่าน) ยังเข้าได้ · เพิ่ม admin อีเมลอื่น = `docs/ADMIN_SETUP.md`
