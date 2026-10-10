# LabHub — ภาพรวมระบบทั้งหมด (สำหรับวางแผนต่อ)

> สรุป ณ 10 ต.ค. 2569 · branch `main` (merge จาก `Addfeature` แล้ว) · ใช้เป็นบริบทให้ AI/ทีมวางแผนงานต่อ

---

## 1. ระบบนี้คืออะไร

แอปจัดการห้องปฏิบัติการ IoT (มหาวิทยาลัยขอนแก่น) มี 2 ระบบย่อยที่ **แยกกันเด็ดขาด** (ตาราง/หน้า/ไฟล์ lib/กติกา ไม่ import ข้ามกัน):

1. **ระบบยืม-คืนอุปกรณ์ IoT** — นักศึกษาสแกน QR ที่ตัวของ → ส่งคำขอยืม/คืน/ยืมต่อ (ถ่ายรูปหลักฐาน) → ผู้ดูแลอนุมัติในกล่องคำขอ
2. **ระบบห้องคอม** — ผังห้อง (เครื่องคอม + LAN port) ดูสถานะว่าง/ซ่อม/พัง, นักศึกษาแจ้งปัญหา, ผู้ดูแลจัดการงานซ่อม + ตรวจประจำเทอม

ผู้ใช้ 3 บทบาท: **นักศึกษา (user)**, **TA (ta)**, **ผู้ดูแลระบบ (admin)**

---

## 2. Tech stack

| ส่วน | ใช้ |
|---|---|
| แอป | React Native 0.86 + Expo SDK 57 + expo-router (TypeScript) — รันได้ทั้งมือถือ (Expo Go) และเว็บ |
| Backend | Supabase: Postgres + RLS, Auth (อีเมล/รหัสผ่าน + Google OAuth), Storage, Realtime Broadcast, pg_cron |
| ฟอนต์/ธีม | Noto Sans Thai ทั้งแอป, ธีมสีฟ้า #2563EB ตาม `docs/DESIGN.md`, token ใน `lib/theme.ts` |
| อื่น ๆ | expo-camera (สแกน QR), expo-image-picker (ถ่ายรูปหลักฐาน), expo-print/sharing (PDF/CSV), qrcode (สร้างป้าย), Open-Meteo (อากาศ) |

แพ็กเกจ Supabase = ฟรี (ระวัง Disk IO → ลดการ polling, cron ทุก 5 นาที)

---

## 3. บทบาทและสิทธิ์

| | นักศึกษา | TA | Admin |
|---|---|---|---|
| ดูห้อง/อุปกรณ์/LAN | ✅ | ✅ | ✅ |
| สแกนขอยืม/คืน/ยืมต่อ | ✅ | ✅ (ยืมเองได้) | ✅ |
| แจ้งปัญหาเครื่อง/LAN | ✅ | ✅ | ✅ |
| อนุมัติ/ปฏิเสธคำขอ + ตรวจสภาพตอนคืน | – | ✅ (ยกเว้นคำขอของตัวเอง) | ✅ |
| สแกนดูสถานะ, ประวัติ, รายงาน, สต็อก, พิมพ์ QR | – | ✅ | ✅ |
| ตรวจสภาพประจำเทอม (IoT + ห้องคอม) | – | ✅ | ✅ |
| เปลี่ยนสถานะเครื่อง/LAN, เช็กลิสต์, งานซ่อม | – | ✅ | ✅ |
| เพิ่ม/แก้/จำหน่ายอุปกรณ์, หมวด, นำเข้า CSV | – | – | ✅ |
| เพิ่ม/แก้/ลบ ห้อง เครื่อง port | – | – | ✅ |
| ตั้งค่าระบบ, จัดการผู้ใช้ (แต่งตั้ง TA, แก้รหัส นศ.) | – | – | ✅ |

- สิทธิ์จริงอยู่ที่ **RLS + RPC security definer + trigger** ในฐานข้อมูล ฝั่งแอปแค่ซ่อนปุ่ม/กันหน้า (`lib/roles.ts` → `TA_ROUTES`, `app/admin/_layout.tsx`)
- `is_admin()`, `is_staff()` (= admin + ta)
- บัญชีใหม่ = นักศึกษาเสมอ / ตั้ง TA ผ่าน RPC `set_user_role` (admin เท่านั้น, ตั้งได้แค่ user↔ta)

---

## 4. หน้าจอทั้งหมด

### นักศึกษา (แถบเมนูล่าง: หน้าแรก / อุปกรณ์ / แจ้งเตือน / โปรไฟล์)
| หน้า | ไฟล์ | ทำอะไร |
|---|---|---|
| ล็อกอิน / สมัคร / ลืมรหัส / ตั้งรหัสใหม่ | `login`, `signup`, `forgot`, `reset-password` | อีเมล+รหัสผ่าน หรือ Google (@kkumail.com), "จดจำการเข้าสู่ระบบ" |
| กรอกรหัสนักศึกษา | `student-id` | บังคับครั้งแรก รูปแบบ `633021098-9` ตั้งได้ครั้งเดียว |
| หน้าแรก | `home` | ทักทาย+อากาศ, สถิติเครื่องคอม, ค้นหาห้อง, การ์ดห้อง (รายการ/ตาราง), ลิงก์ด่วน: สแกน / LAN / "การยืมของฉัน" (สีตามความเร่งด่วนครบกำหนด) |
| อุปกรณ์ | `equipment` | รวมเป็นรุ่น, จำนวนว่าง, วันคืนเร็วสุด, หมวด, ค้นหา, แผ่นรายละเอียด |
| สแกนยืม/คืน | `scan` | สแกน QR / พิมพ์รหัส 4 ตัว → ขอยืม (เลือกวัน 3/5/7) / ขอคืน / ขอยืมต่อ, ถ่ายรูปสด + ระบุสภาพ, เตือนเมื่อยืมครบโควตา |
| ประวัติการยืม | `borrow` | คำขอที่รอ (นับถอยหลัง, ยกเลิกได้), ผลคำขอล่าสุด, รายการยืมทั้งหมด |
| ผังห้อง | `roommap` | เลือกห้อง, สรุปว่าง, ผัง 6 กลุ่ม × 9 เครื่อง + Server, กดเครื่องดูสถานะ/เช็กลิสต์/แจ้งปัญหา, กด Server ดู LAN 12 port |
| สถานะ LAN | `lanstatus` | port แยกห้อง/กลุ่ม |
| แจ้งเตือน | `notifications` | ทุกประเภท, อ่านแล้ว, กดแล้วพาไปหน้าที่เกี่ยวข้อง (ใช้ร่วมทุกบทบาท) |
| โปรไฟล์ | `profile` | ชื่อ/รูปจาก Google, รหัส นศ., โควตายืม, ของที่ยืมอยู่, กติกา |

### ผู้ดูแล (Admin/TA) — `app/admin/*`
| หน้า | ไฟล์ | ทำอะไร |
|---|---|---|
| แดชบอร์ด | `home` | กล่องคำขอ (เลขค้าง), ไทล์ด่วน, สถิติอุปกรณ์, เครื่องมือแบ่งหมวด, กิจกรรมล่าสุด |
| กล่องคำขอ | `requests` | อนุมัติ/ปฏิเสธ (ต้องมีเหตุผล), ตรวจสภาพตอนคืน (ปกติ/ชำรุด + ค่าเสียหาย), เทียบรูปตอนยืม-คืน, ประวัติ |
| สแกนดูสถานะ | `lookup` | สแกนของ → ใครยืม, กำหนดคืน, รูป, ประวัติ 10 ครั้ง |
| ประวัติยืม | `history` | ทั้งหมด/กำลังยืม/เกินกำหนด/คืนแล้ว + ค้นหา |
| รายงาน | `report` | ช่วง 30 วัน/3 เดือน/ปีนี้/ทั้งหมด/กำหนดเอง → ส่งออก CSV + PDF |
| สต็อก | `stock` | นับตามหมวด, ประกันใกล้หมด/หมด, อายุควรตรวจ/ควรเปลี่ยน |
| อุปกรณ์ | `items` | รายการ, เปลี่ยนสถานะ/หมวด, แก้ประกัน/Serial, จำหน่ายออก, ลบ (ถ้าไม่เคยถูกยืม) |
| เพิ่มอุปกรณ์ | `scan` | ชื่อ หมวด จำนวน รูป ประกัน → ฐานข้อมูลออกรหัส `NodeMCU 001` + รหัสสแกน 4 ตัวให้เอง |
| นำเข้า CSV | `import` | ตรวจไฟล์ละเอียด (หมวดสะกดผิด, ปี พ.ศ., ซ้ำ ฯลฯ) + ยกเลิกการนำเข้าได้ |
| หมวดหมู่ | `categories` | เพิ่ม/แก้/เรียง/ปิด/ลบ (ย้ายของก่อน) |
| พิมพ์ป้าย QR | `qrgen` | ป้าย 6×2.8 ซม. A4 27 ชิ้น |
| ตรวจสภาพ IoT ประจำเทอม | `iotinspection` | บันทึกสภาพรายชิ้น |
| จัดการห้อง | `room` | สถิติห้อง, เพิ่ม/แก้/ปิดห้อง, ทางเข้าคิวแจ้งปัญหา |
| เครื่องคอม | `stations` | เพิ่ม/แก้/ปิดใช้งาน/ลบ, เปลี่ยนสถานะ |
| LAN port | `lanports` | เพิ่ม/ลบ/เปลี่ยนสถานะ |
| ตรวจห้องคอมประจำเทอม | `inspection` | เมาส์/คีย์บอร์ด/จอ ต่อเครื่อง |
| งานซ่อม | `repairs` | pending → in-repair → done (ย้อนไม่ได้) |
| คิวแจ้งปัญหา | `roomreports` | รับเรื่อง (สร้างงานซ่อม) / ปิดเรื่อง (ต้องมีเหตุผล) |
| ตั้งค่าระบบ | `settings` | โควตายืม, เวลาหมดอายุคำขอ, เกณฑ์ประกัน/อายุ, สวิตช์รับเฉพาะ @kkumail.com |
| จัดการผู้ใช้ | `users` | แต่งตั้ง/ถอด TA, ค้นหา, แก้รหัส นศ. |

---

## 5. Flow หลัก: ยืม-คืน (เฟส 3)

1. นักศึกษาสแกน QR บนตัวของ → RPC `scan_lookup` บอกสถานะ (`available / my_pending / mine / taken / unavailable`)
2. **ขอยืม**: เลือกวัน + ถ่ายรูปสด (เก็บ `borrow-photos/<user_id>/`) + สภาพ → `request_borrow`
   - กติกาใน RPC: ยืมพร้อมกันได้สูงสุด `max_active_borrows` (3, รวมคำขอที่รอ), รูปต้องอยู่ในโฟลเดอร์ตัวเองจริงและห้ามใช้ซ้ำ, ของต้องว่าง
   - ของเปลี่ยนเป็น `reserved`
3. ผู้ดูแลอนุมัติใน **กล่องคำขอ** → `decide_request` → สร้าง `borrow_records` (กำหนดคืน = วันนี้ไทย + จำนวนวัน), ของ = `borrowed`
4. **ขอคืน**: ถ่ายรูป + สภาพ → `request_return` → record = `pending_return` → ผู้ดูแลตรวจสภาพ: ปกติ = ของว่าง / ชำรุด = ของ `repair` + ค่าเสียหาย
5. **ยืมต่อ**: ได้ครั้งเดียว (`request_renew`) → อนุมัติแล้วเลื่อนกำหนดคืน
6. ไม่มีใครตอบภายใน `request_expiry_minutes` (30 นาที) → cron `expire_requests` ทุก 5 นาที: ขอยืม = หมดอายุ / ขอคืน = **คืนอัตโนมัติ** (แจ้งผู้ดูแลให้ตรวจย้อนหลัง)
7. cron 08:00 ไทย: แจ้ง "พรุ่งนี้ครบกำหนด" + "เกินกำหนด" (ผู้ยืม + ผู้ดูแล)
8. นักศึกษายกเลิกคำขอที่รอได้ (`cancel_request`), TA อนุมัติคำขอของตัวเองไม่ได้ (trigger)

> Admin ยืม/คืนแทนนักศึกษาไม่ได้ (ระบบเก่าแบบลายเซ็นถูกเอาออกแล้ว)

## 6. Flow หลัก: ระบบห้องคอม (R0–R3)

- โครงสร้าง: 1 ห้อง → 6 กลุ่ม → กลุ่มละ 9 เครื่อง (C1–C9) + Server 1 เครื่อง (LAN 12 port) / ห้องตอนนี้: CP9524, SC9604 (ตาราง `rooms`)
- สถานะเครื่อง/port: `available / repair / broken` · เช็กลิสต์ต่อเครื่อง: mouse/keyboard/monitor = `present / missing / broken`
- ทุกการเปลี่ยนสถานะถูกบันทึกใน `room_status_log` (ใคร, ก่อน→หลัง, manual/repair)
- งานซ่อม: เปิดงาน → เครื่องเป็น `repair` อัตโนมัติ / ปิดงานหมด → กลับ `available` / ห้ามย้อนสถานะ
- นักศึกษาแจ้งปัญหา (`report_room_problem`): กันแจ้งซ้ำเรื่องเดิม, 5 ครั้ง/วัน, 3–500 ตัวอักษร → แจ้ง admin+TA → คิว `decide_room_report`: รับ = สร้างงานซ่อม / ปิด = ต้องมีเหตุผล → ผลแจ้งกลับผู้แจ้ง
- ตรวจประจำเทอม → อัปเดตเช็กลิสต์อัตโนมัติ (`lib/term.ts` คำนวณเทอม)
- TA เปลี่ยนได้แค่ status (trigger กันแก้ชื่อ/กลุ่ม)
- อัปเดตสด: trigger → Realtime ช่อง `room` → หน้า home/roommap/lanstatus/admin รีโหลดเอง

---

## 7. ฐานข้อมูล (Supabase, schema public — RLS เปิดทุกตาราง)

| ตาราง | หน้าที่ | คอลัมน์สำคัญ |
|---|---|---|
| `profiles` | ผู้ใช้ | role (user/ta/admin), email, full_name, avatar_url (จาก Google), student_id (unique, `^\d{9}-\d$`) |
| `items` | อุปกรณ์ IoT 1 แถว/ชิ้น | item_code (`NodeMCU 001`), barcode (4 ตัว สุ่ม ไม่ซ้ำ), status (available/reserved/borrowed/repair/retired), category_id, location_id, warranty_expires_at, retired_at/reason |
| `categories` | หมวด | name, sort_order, active ("อื่นๆ" = หมวดสำรอง) |
| `borrow_locations` | ห้องยืมของ | ตอนนี้มี "IoT Lab" ห้องเดียว |
| `borrow_requests` | คำขอ | kind (borrow/return/renew), status (pending/approved/declined/expired/cancelled/auto_returned), days, condition, photo_path, expires_at, decided_by |
| `borrow_records` | การยืม | status (borrowed/pending_return/returned), borrow_date, due_date, return_date, รูป+สภาพตอนยืม/คืน, damage_cost, auto_returned, renew_count (ไม่มี created_at) |
| `notifications` | แจ้งเตือนในแอป | type, title, body, read, request_id, item_id |
| `app_settings` | ค่าตั้ง key/value | max_active_borrows=3, request_expiry_minutes=30, borrow_day_options=[3,5,7], warranty_warn_days=30, age_warn_years=3, age_replace_years=4, allowed_email_domain="" |
| `item_inspections` | ตรวจ IoT ประจำเทอม | term, item_id, condition |
| `item_alerts`, `item_code_counters` | ภายใน (แอปเข้าไม่ได้) | กันเตือนซ้ำ / ตัวนับเลขรหัส |
| `rooms` | ห้องคอม | id = รหัสห้อง, building, floor, active |
| `computer_stations` | เครื่องคอม | room_id, group_no, name (ห้ามซ้ำในกลุ่ม), status, active |
| `lan_ports` | LAN | room_id, group_no, port_no 1–12, status |
| `station_equipment` | เช็กลิสต์ | station_id, equipment_type, status |
| `equipment_inspections` | ตรวจห้องคอมประจำเทอม | unique (station, term, type) |
| `repair_records` | งานซ่อม | station_id, status pending/in-repair/done |
| `room_reports` | นักศึกษาแจ้งปัญหา | kind station/lan, status, repair_id |
| `room_status_log` | ประวัติสถานะ | from/to, source, changed_by |

**RPC ที่แอปเรียก:** `scan_lookup`, `request_borrow`, `request_return`, `request_renew`, `cancel_request`, `decide_request`, `expire_requests`, `item_active_loans`, `is_staff`, `set_user_role`, `report_room_problem`, `decide_room_report`

**Trigger สำคัญ:** `items_before_insert` (ออกรหัส+barcode), `items_before_update` (ล็อกรหัส), `profiles_protect` (กันแก้ role/email/ชื่อ, รหัส นศ. ตั้งครั้งเดียว), `handle_new_user` + `_profile_sync_from_auth` (คัดชื่อ/รูปจาก Google), `borrow_requests_no_self_decide`, ระบบห้อง `_room_*` (log, sync เช็กลิสต์, sync สถานะซ่อม, TA guard, broadcast)

**Storage:** `item-images` (public, admin เขียน), `borrow-photos` (private, เจ้าของ/ผู้ดูแลขอ signed URL)

**pg_cron:** `expire-borrow-requests` ทุก 5 นาที · `borrow-due-reminders` 08:00 · `item-health-alerts` 08:00 (ประกัน/อายุ → admin) · `cleanup-cron-history` ทุกวัน

**Realtime Broadcast (private channels):** `user:<id>` (แจ้งเตือนใหม่) · `staff` (คำขอเปลี่ยน) · `room` (สถานะห้อง) — ใช้แทน polling, สำรองรีเฟรชทุก 5 นาที

SQL ทั้งหมดอยู่ใน `supabase/migrations/` (18 ไฟล์ รันครบแล้ว)

---

## 8. การยืนยันตัวตน

- อีเมล+รหัสผ่าน (8 ตัว มีตัวอักษร+ตัวเลข) และ Google OAuth (`hd=kkumail.com`)
- สวิตช์ "รับเฉพาะ @kkumail.com" **ปิดไว้ช่วงพัฒนา** → ตอน Final Project: เปิดในหน้าตั้งค่าระบบ + เปิด Auth Hook "Before User Created" (`hook_restrict_signup_domain`) ใน Supabase Dashboard
- มือถือจำ session ใน AsyncStorage / เว็บใช้ localStorage
- ปุ่มออกจากระบบตอนนี้ = ออกทุกเครื่องของบัญชีนั้น (ค่าเริ่มต้น Supabase)

---

## 9. โค้ด: ไฟล์ที่ใช้ร่วม

- `lib/nav.ts` — `goBack(fallback)`, `goTab()`, `useRefreshOnFocus()` (ใช้เสมอ ห้าม router.replace เป็นปุ่มย้อน)
- `lib/notify.tsx` — `notify()` / `confirmAction()` แทน Alert (Alert ไม่ทำงานบนเว็บ)
- `lib/session.ts` — `currentUser()` (อ่าน session ในเครื่อง ลดภาระ DB)
- `lib/realtime.ts` (ระบบยืม) / `lib/roomRealtime.ts` (ระบบห้อง)
- `lib/status.ts` (สถานะระบบยืม) / `lib/roomStatus.ts` (สถานะระบบห้อง)
- `lib/people.ts` — `who()` แสดง "ชื่อ · รหัส นศ."
- `lib/report.ts`, `lib/importItems.ts`, `lib/itemInfo.ts`, `lib/labels.ts` — ตรรกะล้วน แยกจาก UI
- components: `ScreenHeader`, `SearchBar`, `TabBar`, `BottomSheet`, `Motion` (PressScale/FadeIn/Pulse/haptic), `GreetingLine`, `LoanSummary`, `StatWidget`, `RoomReportForm`, `LoadError`

---

## 10. สถานะปัจจุบัน

**เสร็จแล้ว:** เฟส 1–5 ระบบยืม-คืน, TA, Google login, รายงาน, ระบบห้อง R0–R3 + อัปเดตสด, UI ใหม่ทั้งแอป (ธีมฟ้า), รหัส นศ. + โปรไฟล์ใหม่, คู่มือ PDF 3 เล่ม (`docs/guides/`), ตรวจความถูกต้องทั้งระบบ 2 รอบ (ทดสอบ DB end-to-end ผ่านทุกกติกา)

**ข้อจำกัด/เรื่องค้าง:**
- ถ่ายรูปหลักฐานยืม-คืนได้เฉพาะแอปมือถือ (เว็บถ่ายสดไม่ได้)
- รันผ่าน Expo Go (ยังไม่ได้ build เป็นแอปจริง / ไม่มี push notification — iOS ต้องใช้ Apple Developer $99/ปี, Android APK ฟรี, หรือทำ PWA + Web Push)
- Performance pass ยังไม่ได้ทำ (ตั้งใจทำท้ายสุด: ลด round trip, spinner เต็มหน้า)
- หน้า `sittings.tsx` ไม่มีลิงก์ไปแล้ว (ลบได้)
- ข้อมูลทดสอบในระบบ: อุปกรณ์ Test1 / ทดสอบ1 / ทดสอบ2 (ควรจำหน่ายออกก่อนใช้จริง), เครื่อง SC9604 กลุ่ม 1 C9 ค้างสถานะซ่อมโดยไม่มีงานซ่อม
- หน้าห้องคอม (งานซ่อม/คิวแจ้งปัญหา/ผังห้อง) ยังแสดงผู้แจ้งเป็นอีเมล ไม่ใช่ชื่อ · รหัส

**Backlog UI ที่เคยจดไว้:**
- การ์ด "ยืม/คืน/ซ่อม" ข้างวันที่บนแดชบอร์ด เป็นยอดสะสม ไม่ใช่ของวันนี้ (ชวนเข้าใจผิด)
- หน้า PDF รายงานยังไม่สวย/ไม่เป็นระเบียบ
- หน้าอุปกรณ์ของ นศ. โหลดไม่สำเร็จจะเห็นรายการว่าง (ไม่บอก error)
- ปุ่มออกจากระบบอาจควรเป็น "เฉพาะเครื่องนี้"

---

## 11. กติกาการทำงานในโปรเจกต์ (ต้องรักษาไว้)

- ระบบห้องห้ามแตะ/import ไฟล์หรือตารางของระบบยืม-คืน และกลับกัน
- เพิ่มตารางใหม่ต้องเขียน RLS policy ในไฟล์ migration เดียวกัน (มี event trigger เปิด RLS อัตโนมัติ)
- กติกาธุรกิจอยู่ใน RPC/trigger ฝั่งฐานข้อมูล แอปเรียกอย่างเดียว
- เขียนข้อมูลแล้วใช้ `.select("id")` เช็กว่าแก้ได้จริง (RLS ไม่ให้สิทธิ์ = 0 แถว ไม่ error)
- UI ใช้ `docs/DESIGN.md` เท่านั้น, ทำ mockup ให้เจ้าของดูก่อนแก้โค้ดจริง
- ระวังโควตาแพ็กเกจฟรีของ Supabase (Disk IO)
