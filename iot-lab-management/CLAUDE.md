# 📱 Project: IoT Lab Management App

> อ่านไฟล์นี้ก่อนทุกครั้งที่เริ่มทำงาน เพื่อให้รู้บริบทโปรเจกต์

---

## 🎯 ชื่อโปรเจกต์
**IoT Lab Management App** — ระบบจัดการห้องปฏิบัติการ IoT

---

## 🧱 Tech Stack
- **Framework**: React Native + Expo (expo-router)
- **Backend**: Supabase (Auth + Database + Storage)
- **Language**: TypeScript
- **กลุ่มเป้าหมาย**: นักศึกษา/อาจารย์ในห้องแล็บ IoT

---

## 🎭 Role & แนวคิดหลัก
- **User** — ดูสถานะอย่างเดียว (ห้อง, อุปกรณ์, LAN port) ไม่มีปุ่มจองหรือยืมเอง
- **Admin** — จัดการทุกอย่าง (ยืม/คืน, ห้อง, อุปกรณ์, LAN port)
- **ยืมของ** — User เอาของมาให้ Admin สแกน Barcode + บอก Email → Admin บันทึก
- **คืนของ** — Admin สแกน Barcode item → ยืนยันคืน
- **สมัครแอปก่อนถึงยืมได้** — ทุก user ต้องมีบัญชีในระบบ
- **ระบบจองห้อง** — ถูกเอาออกแล้ว ไม่ได้ใช้งาน

---

## 🗄️ Supabase Tables

| Table | ใช้ทำอะไร |
|-------|-----------|
| `profiles` | user info + role (user/admin) + email |
| `items` | อุปกรณ์ IoT + `image_url` + `description` + `barcode` + `type` |
| `borrow_records` | ประวัติยืม-คืน + `due_date` + `borrow_signature_url` + `return_signature_url` |
| `computer_stations` | เครื่องคอมแต่ละห้อง (room_id, name, group_no, status) — **9 เครื่อง/กลุ่ม** |
| `station_equipment` | checklist อุปกรณ์ต่อเครื่อง (mouse/keyboard/monitor, status: present/missing/broken) |
| `equipment_inspections` | บันทึกการตรวจประจำเทอม (term, station_id, equipment_type, condition, notes) |
| `repair_records` | ติดตามการซ่อม (station_id, description, status: pending/in-repair/done) |
| `room_bookings` | ไม่ได้ใช้แล้ว (ระบบจองถูกเอาออก) |
| `lan_ports` | LAN port ของ server แต่ละกลุ่ม (room_id, group_no, port_no, label, status) |
| `categories` | หมวดหมู่อุปกรณ์ (Admin แก้ได้) — เฟส 1 |
| `borrow_locations` | ห้องยืมของ (แยกจากห้องคอม) ตอนนี้มี "IoT Lab" ห้องเดียว — เฟส 1 |
| `app_settings` | ค่าตั้งระบบ key/value (request_expiry_minutes, age_warn_years, age_replace_years) — เฟส 1 |
| `item_code_counters` | ตัวนับรหัสเรียกต่อชื่อ แอปเข้าไม่ได้ (RLS ไม่มี policy) ใช้ผ่าน trigger — เฟส 1 |

### เฟส 1 (2 ต.ค. 2569) — รหัสเรียกอุปกรณ์
- SQL อยู่ใน `supabase/migrations/` (รันแล้ว: `phase1_items`, `phase1_hardening`)
- `items` เพิ่ม: `item_prefix`, `item_no`, `item_code` (เช่น `NodeMCU 001`, unique), `short_name`, `manufacturer_serial`, `warranty_expires_at`, `retired_at`, `retire_reason`, `category_id`, `location_id`
- `items.status` ใส่ได้แค่ `available | borrowed | repair | retired` (default `available`)
- **Trigger `items_before_insert`** ออก `item_code` + `barcode` 4 ตัว + `location_id` ให้เองทุกครั้งที่ insert (ไม่รับค่าจากแอป) / `items_before_update` ล็อกรหัสและห้องไม่ให้เปลี่ยน
- ⚠️ โปรเจกต์มี event trigger `ensure_rls` เปิด RLS ให้ตารางใหม่อัตโนมัติ → สร้างตารางใหม่ต้องเขียน policy ในไฟล์เดียวกัน
- `borrow_records` **ไม่มี** `created_at` → เรียงด้วย `borrow_date`
- `lib/notify.ts` ใช้แทน `Alert.alert` (Alert ไม่ทำงานบนเว็บ), `lib/labels.ts` สร้างป้าย QR 6×2.8 ซม. (A4 27 ชิ้น)

### เฟส 2 (3 ต.ค. 2569) — หมวด + Stock Report + แจ้งเตือนประกัน/อายุ
- `app/admin/categories.tsx` จัดการหมวด (เพิ่ม/แก้ชื่อ/เรียง/ปิด/ลบ — ลบหมวดที่มีของต้องย้ายของไปหมวดอื่นก่อน) "อื่นๆ" = หมวดสำรอง ห้ามแก้
- ชิปหมวดทั้งหน้า นศ. (`equipment.tsx`) และ Admin (`admin/items.tsx`) ดึงจาก `categories`: `category_id` → ชื่อในช่อง `type` → "อื่นๆ" / เปลี่ยนหมวดอัปเดตทั้ง `category_id` และ `type`
- `app/admin/stock.tsx` รายงานสต็อก (`?watch=soon|expired|ageWarn|ageReplace` เปิดกลุ่มนั้น) / `lib/itemInfo.ts` คำนวณอายุ+ประกัน ใช้ร่วมกัน
- `app/admin/settings.tsx` แก้ `app_settings`: `warranty_warn_days`, `age_warn_years`, `age_replace_years`, `max_active_borrows`, `request_expiry_minutes`
- `app/admin/import.tsx` นำเข้า CSV (ชื่อ, หมวด, จำนวน, วันหมดประกัน, ชื่อย่อ) — ตรรกะตรวจทั้งหมดใน `lib/importItems.ts` (แยกจาก UI ทดสอบได้)
  - ผิด = บันทึกไม่ได้ / เตือน = ต้องติ๊กยืนยัน / หมายเหตุ = แจ้งเฉยๆ · insert ครั้งเดียว + ตรวจซ้ำกับข้อมูลล่าสุดก่อนบันทึก + ยกเลิกการนำเข้าได้ (ลบชิ้นที่ยัง available)
  - กันพลาด: หมวดสะกดผิด (แนะนำ+เลือกแก้ในแอป), ปี พ.ศ./ปีผ่านไปแล้ว, เลขวันที่ Excel, เลขไทย, เครื่องหมายคำพูด iPhone, นำเข้าซ้ำ/ชื่อซ้ำ, รหัสชนของเดิม, ไฟล์ .xlsx, ตัวคั่น , ; แท็บ
  - เลือกไฟล์ได้ทั้งเว็บ (input) และมือถือ (`File.pickFileAsync` ของ expo-file-system) + วางข้อความ / แม่แบบ: เว็บดาวน์โหลด มือถือแชร์ · ถอดรหัส UTF-8/TIS-620 เขียนเอง (Hermes ไม่มี windows-874)
- แก้วันหมดประกัน/Serial: หน้า `admin/items` กดการ์ด → "แก้ประกัน / Serial" (ชื่อ-รหัสแก้ไม่ได้)
- migration `phase2_item_alerts`: แจ้งเตือนประเภท `warranty_soon|warranty_expired|age_warn|age_replace`, ตาราง `item_alerts` (กันเตือนซ้ำ แอปเข้าไม่ได้), RPC `send_item_alerts()` + pg_cron `item-health-alerts` 08:00 ไทย

### เฟส 4.1 — บทบาท TA (migration `phase4_ta_role`)
- `profiles.role` = `user | ta | admin` / `_staff_roles()` = admin+ta → `is_staff()` รวม TA
- TA อ่านได้เพิ่ม: `borrow_records`, `profiles` ทั้งหมด / บันทึก `item_inspections` ได้ (ลบได้เฉพาะ admin) / เขียนอย่างอื่นยังเป็น `is_admin()`
- แจ้งเตือนประกัน/อายุ ส่งเฉพาะ admin (`_notify_staff`) / TA ได้ เกินกำหนด + คืนอัตโนมัติ
- RPC `set_user_role(p_user, p_role)` admin เท่านั้น ตั้งได้แค่ user↔ta (ห้ามตัวเอง/ห้ามแตะ admin) + แจ้งเตือน `role_changed`
- trigger `borrow_requests_no_self_decide`: TA อนุมัติ/ปฏิเสธคำขอของตัวเองไม่ได้
- แอป: `lib/roles.ts` (`canAccess`, `TA_ROUTES`, `RoleContext`/`useRole`) / `admin/_layout.tsx` ให้ admin+ta เข้า แล้วกันหน้าที่ TA ไม่มีสิทธิ์ / `admin/users.tsx` จัดการ TA / หน้าแรกนักศึกษามีปุ่มกลับแดชบอร์ดสำหรับ staff

### เฟส 4.2 — ล็อกอิน Google (@kkumail.com)
- `lib/googleAuth.ts`: เว็บ = redirect กลับ `/login` / มือถือ = `WebBrowser.openAuthSessionAsync` + `Linking.createURL("/login")` (Expo Go = `exp://.../--/login`) / ส่ง `hd=kkumail.com`
- `app/login.tsx`: ปุ่ม Google + `finishLogin()` ใช้ร่วมกับล็อกอินรหัสผ่าน / หลัง Google ตรวจโดเมนซ้ำ ไม่ใช่ kkumail → signOut
- ด่านจริง: Auth Hook "Before User Created" → `hook_restrict_signup_domain` (migration `phase4_google_domain`) อ่าน `app_settings.allowed_email_domain` (ว่าง = รับทุกโดเมน) — บัญชีเดิมไม่โดน
- **ช่วงพัฒนาปิดไว้** (ค่าว่าง) ทุกบัญชีใช้ได้ / **ตอน Final Project** เปิดสวิตช์ "รับเฉพาะอีเมล @kkumail.com" ที่หน้า `admin/settings` + เปิด Hook ใน Dashboard
- ต้องตั้งค่าเอง: Google Cloud OAuth client + Supabase provider Google + Redirect URLs + เปิด Hook ใน Dashboard

### จำการล็อกอิน + เฟส 5.1 รายงาน (4 ต.ค. 2569)
- `lib/supabase.js`: มือถือเก็บ session ใน AsyncStorage (`@react-native-async-storage/async-storage`) + ต่ออายุเฉพาะตอนแอปเปิด / เว็บใช้ localStorage
- `lib/session.ts`: ช่อง "จดจำการเข้าสู่ระบบ" ไม่ติ๊ก → เปิดแอปครั้งหน้าออกจากระบบ (`applyRememberLogin` ใน `app/_layout.tsx`)
- `app/admin/report.tsx` (admin + TA): รายงานยืม-คืนตามช่วง (30 วัน / 3 เดือน / ปีนี้ / ทั้งหมด / กำหนดเอง) ส่งออก CSV + PDF — คำนวณใน `lib/report.ts`, ส่งออกผ่าน `lib/fileExport.ts`
- ประวัติรุ่นเก่าที่คืนแล้วแต่ไม่มี `return_date` → ไม่นับว่าคืนช้า

### การนำทาง (4 ต.ค. 2569) — ใช้ `lib/nav.ts` เสมอ
- ปุ่ม ← : `goBack(fallback)` = กลับหน้าที่มาจริง / ไม่มีหน้าก่อนหน้า → fallback (ห้ามใช้ `router.replace("/admin/home")` เป็นปุ่มย้อนกลับ)
- แถบเมนูล่างนักศึกษา: `goTab(target, current)` stack = [หน้าแรก, แท็บ] ไม่ซ้อน
- หน้าที่ต้องสดตอนกลับมา: `useRefreshOnFocus(load)` (ข้ามครั้งแรก)
- ด่านล็อกอินหน้านักศึกษาอยู่ใน `app/_layout.tsx` (`PUBLIC_PATHS` = login/signup/forgot/reset-password) / หน้า /admin มีด่านของตัวเอง
- **Realtime Broadcast** (migration `realtime_broadcast`): trigger ส่ง `realtime.send` → ช่อง `user:<id>` (event notification) / `staff` (event request) + policy บน `realtime.messages` / แอปฟังผ่าน `useRealtime()` ใน `lib/realtime.ts` (ช่องใช้ร่วม นับผู้ฟัง) — ใช้ใน หน้าแรก admin, กล่องคำขอ, แจ้งเตือน, การยืมของฉัน / รีเฟรชสำรองเหลือทุก 5 นาที
  - ⚠️ ตาราง `realtime.messages` แบ่งพาร์ทิชันรายวัน ระบบ Realtime สร้างให้เองเมื่อมีคนเชื่อมต่อ — ถ้าไม่มีพาร์ทิชัน `realtime.send` จะล้มเงียบ (แอปยังมีรีเฟรชสำรอง)
- ชื่อ/สีสถานะอุปกรณ์และการยืมอยู่ที่ `lib/status.ts` ที่เดียว (ห้ามตั้งเองในหน้า)
- หา user ที่ล็อกอินในงานที่เรียกบ่อย ใช้ `currentUser()` (lib/session.ts — อ่าน session ในเครื่อง) ไม่ใช่ `auth.getUser()` (ยิงเซิร์ฟเวอร์ทุกครั้ง กิน Disk IO แพ็กเกจฟรี)
- ป๊อปอัปใช้ `notify` / `confirmAction` (lib/notify) — `Alert.alert` ไม่ทำงานบนเว็บ / กติการหัสผ่าน `lib/password.ts` (8 ตัว มีตัวอักษร+ตัวเลข ตรงกับ Supabase)
- เปลี่ยนรหัสผ่านจากโปรไฟล์ = `/reset-password?mode=change` (ใช้ updateUser ได้ทั้งตอนล็อกอินอยู่ / ลิงก์จากอีเมลไม่มี mode) — deep link handler ใน `_layout.tsx` ต้องไม่ redirect เมื่อมี `mode=change`
- "แก้ไขข้อมูลส่วนตัว" ในโปรไฟล์ยังไม่มีฟีเจอร์จริง (แจ้งว่ายังแก้ไม่ได้) / `profiles` มีแค่ id, role, email — ชื่อจากหน้าสมัครเก็บใน auth user metadata `full_name`

### ระบบห้อง R0 (5 ต.ค. 2569) — migration `room_r0_schema`
- ระบบห้องคอม **แยกจากระบบยืม-คืนเด็ดขาด** (ตาราง/หน้า/กติกา/ไฟล์ lib) — งานระบบห้องห้ามแก้ไฟล์หรือตารางของระบบยืม-คืน และห้าม import ข้ามกัน (เจ้าของโปรเจกต์สั่งชัด 5 ต.ค. 2569) แผนเต็ม R0–R4 อยู่ใน PLAN/REVIEW_ระบบห้อง.md
  - ไฟล์ของระบบห้อง: `lib/roomStatus.ts`, `lib/rooms.ts`, `lib/term.ts`, `components/LoadError.tsx`, หน้า stations/lanports/repairs/room/inspection/roommap/lanstatus + ส่วนการ์ดห้องใน `home.tsx`
- ชื่อ/สี/ไอคอนสถานะระบบห้อง: `lib/roomStatus.ts` (`STATION_STATUS`, `LAN_STATUS`, `EQUIP_STATUS`, `REPAIR_STATUS`, `CONDITION_STATUS` + `roomStatus(map, key)` มีค่าสำรอง) — ห้ามใช้ `lib/status.ts` ของระบบยืม
- หน้าระบบห้องใช้ `confirmAction`/`notify`, `goBack`, `currentUser`, `components/LoadError.tsx` (โหลดพัง = แถบลองใหม่ ห้ามโชว์ "ปกติ") แล้ว / เขียนข้อมูลใช้ `.select("id")` เช็กว่าแก้ได้จริง (RLS ไม่ให้สิทธิ์ = 0 แถว ไม่ error)
- `lib/term.ts` `currentTerm()` ใช้ทั้ง inspection และ iotinspection
- ฐานข้อมูล: `room_bookings` ลบแล้ว / `computer_stations.status` CHECK available|repair|broken / ชื่อเครื่องห้ามซ้ำ **ในกลุ่มเดียวกัน** (ทุกกลุ่มมี C1–C9) / LAN port ห้ามซ้ำในกลุ่ม + 1–12 / `equipment_inspections` unique (station_id, term, equipment_type) — ตารางนี้ไม่มี `created_at` ใช้ `inspected_at`

### ระบบห้อง R1 — migration `room_r1_rooms`
- ตาราง `rooms` (id = รหัสห้อง เช่น CP9524, building, floor, sort_order, active) — `computer_stations.room_id` / `lan_ports.room_id` เป็น FK (แก้รหัส = cascade, ลบห้องที่มีเครื่อง/LAN ไม่ได้ → ปิดห้อง) / อ่านได้ทุกคนที่ล็อกอิน เขียนได้เฉพาะ admin
- ทุกหน้าระบบห้องอ่านรายชื่อห้องจาก `lib/rooms.ts` (`fetchRooms(includeInactive)`, `roomPlace(room)`) — ห้ามเขียนรหัสห้องตายตัว
- `admin/room.tsx` = จัดการห้อง (เพิ่ม/แก้/ปิด/ลบห้องว่าง) / `admin/stations.tsx` เพิ่มเครื่องได้ (ปุ่ม +)
- `computer_stations.active`: เครื่องที่มีประวัติตรวจ/ซ่อม ลบไม่ได้ → ปิดใช้งาน (ไม่ขึ้นในผังห้อง/สถิติ/ตรวจประจำเทอม เปิดกลับได้) / ไม่มีประวัติ = ลบได้
- `repair_records.item_id` ตัดออกแล้ว — งานซ่อมใช้กับเครื่องคอมของระบบห้องเท่านั้น

### ระบบห้อง R2 — migration `room_r2_log_ta_checklist`
- `room_status_log`: trigger บันทึกทุกการเปลี่ยนสถานะเครื่อง/LAN (ก่อน→หลัง, changed_by, source manual|repair) / staff อ่านได้ แอปเขียนไม่ได้ / ดูได้ในผังห้อง (กดเครื่อง, เฉพาะ Admin/TA)
- **TA ในระบบห้อง** (`TA_ROUTES` + RLS `is_staff()`): เปลี่ยนสถานะเครื่อง/LAN, แก้เช็กลิสต์, ตรวจประจำเทอม, แจ้งซ่อม/อัปเดตงานซ่อม — trigger `_room_station_ta_guard`/`_room_lan_ta_guard` กัน TA แก้อย่างอื่นนอกจาก status / เพิ่ม-แก้-ลบ ห้อง/เครื่อง/port + ลบผลตรวจ/งานซ่อม = admin
- เช็กลิสต์ (`station_equipment`): ผลตรวจประจำเทอมอัปเดตให้อัตโนมัติ (good→present, damaged→broken, missing→missing; แก้ผลเทอมเก่าไม่ทับ) / เครื่องใหม่ได้ 3 แถวอัตโนมัติ / staff กดเปลี่ยนในผังห้องได้
- งานซ่อม: เปิดงาน → เครื่อง `repair` / ปิดงาน (ไม่มีงานค้าง) → `available` / ห้ามย้อน pending→in-repair→done / `reported_by`, `repaired_by/at` ฐานข้อมูลใส่เอง (แอปไม่ต้องส่ง)

### ระบบห้อง R3 — migration `room_r3_reports`
- นักศึกษาแจ้งปัญหา: ผังห้อง → กดเครื่อง → "แจ้งปัญหาเครื่องนี้" / กด Server → กด port (`components/RoomReportForm.tsx`) → RPC `report_room_problem(kind, target, description)` — กันแจ้งซ้ำ (เรื่องเดิมยัง open), 5 ครั้ง/วัน/คน (วันไทย), 3–500 ตัวอักษร / เขียนตาราง `room_reports` ตรงไม่ได้
- แจ้ง Admin+TA ทุกคน (`_room_notify_staff` ของระบบห้องเอง ไม่ใช้ `_notify_staff` ของระบบยืม) ประเภท `room_report` / ผลถึงผู้แจ้ง `room_report_accepted` | `room_report_closed`
- คิว `app/admin/roomreports.tsx` (TA เข้าได้, ทางเข้า = แถบบนหน้าจัดการห้อง / กดแจ้งเตือน) → RPC `decide_room_report(id, accept, note)`: รับเครื่อง = สร้างงานซ่อม (เครื่องเป็น repair ผ่าน trigger R2) / รับ LAN = port เป็น repair / ปิด = ต้องมีเหตุผล / อัปเดตสดผ่านสัญญาณ notification ของตัวเอง
- `app/notifications.tsx` (หน้าใช้ร่วม) เพิ่มแค่ 3 ประเภทนี้ + ทางไป — ห้ามแตะส่วนระบบยืม

### ระบบห้อง อัปเดตสด — migration `room_realtime`
- trigger `_room_broadcast_change` บน computer_stations / lan_ports (insert/update/delete) + station_equipment (update) → `realtime.send` ช่อง **`room`** event `room_status` payload `{room_id, table}` / policy ให้ทุกคนที่ล็อกอินฟังช่อง room
- แอปใช้ `useRoomLive(onChange, room?)` จาก `lib/roomRealtime.ts` (ของระบบห้องเอง ไม่ใช้ `lib/realtime.ts` ของระบบยืม) — รวมสัญญาณติดกันเป็นโหลดครั้งเดียว (400 ms)
- ใช้ใน: home, roommap (เฉพาะห้องที่เปิด + หน้าต่างรายละเอียดอัปเดตตาม), lanstatus, admin/room, admin/stations, admin/lanports

### RLS — เปิดครบทุกตารางแล้ว (2 ต.ค. 2569, migration `security_rls`)
- ยังไม่ล็อกอิน = เข้าไม่ได้เลย / ผู้ใช้ = อ่านของสาธารณะ + ของตัวเอง / admin = ทุกอย่าง (`public.is_admin()`)
- ผู้ใช้อ่านได้: `items`, `categories`, `borrow_locations`, `app_settings`, `computer_stations`, `lan_ports`, `station_equipment` + `profiles` / `borrow_records` / `notifications` ของตัวเอง (กด "อ่านแล้ว" ได้)
- admin เท่านั้น: เขียนทุกตาราง, `repair_records`, `equipment_inspections`, `item_inspections`, `room_bookings`
- `profiles`: trigger `profiles_protect` กันผู้ใช้เปลี่ยน `role` / `email` ของตัวเอง (admin เปลี่ยนได้)
- RPC `item_active_loans()` = วันคืนของที่ถูกยืม (ไม่บอกผู้ยืม) ใช้ในหน้า equipment
- Storage `item-images`: อัปโหลด/แก้/ลบ เฉพาะ admin → มือถือต้องส่ง `session.access_token` ไม่ใช่ anon key
- หน้าใน `app/admin/` ผ่านด่าน `app/admin/_layout.tsx` (ไม่ใช่ admin → /home)
- **เพิ่มตารางหรือหน้าใหม่ ต้องเขียน policy ให้ครบ** ไม่งั้นแอปอ่าน/เขียนไม่ได้

### Supabase Storage
- Bucket: **`item-images`** — รูปอุปกรณ์ (public)
- Bucket: **`signatures`** — ลายเซ็น SVG ยืม/คืน (public) — ถ้ายังไม่มีต้องสร้างใน Supabase dashboard

---

## 📐 โครงสร้างห้อง
- 1 ห้อง → 6 กลุ่ม
- 1 กลุ่ม → คอม **9 เครื่อง** (C1–C9) + Server 1 เครื่อง
- Server มี LAN Port 12 ช่อง (สถานะ: available / repair / broken)
- ทุกเครื่องมี checklist: mouse / keyboard / monitor (station_equipment)
- ห้องที่มี: CP9524, SC9604

---

## 🔑 SQL ที่ต้องรัน (ถ้ายังไม่ได้รัน)

```sql
-- 1. description ใน items
ALTER TABLE items ADD COLUMN IF NOT EXISTS description text;

-- 2. due_date ใน borrow_records
ALTER TABLE borrow_records ADD COLUMN IF NOT EXISTS due_date date;

-- 3. barcode ใน items (สำหรับ scan ยืม/คืน)
ALTER TABLE items ADD COLUMN IF NOT EXISTS barcode text;

-- 4. type ใน items
ALTER TABLE items ADD COLUMN IF NOT EXISTS type text;

-- 5. สร้างตาราง lan_ports
CREATE TABLE IF NOT EXISTS lan_ports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id text NOT NULL,
  group_no int NOT NULL,
  port_no int NOT NULL,
  label text,
  status text DEFAULT 'available'
    CHECK (status IN ('available','repair','broken')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE lan_ports DISABLE ROW LEVEL SECURITY;

-- 6. Seed lan_ports
INSERT INTO lan_ports (room_id, group_no, port_no, status)
SELECT room, g, p, 'available'
FROM (VALUES ('CP9524'), ('SC9604')) AS rooms(room),
  generate_series(1,6) g, generate_series(1,12) p
ON CONFLICT DO NOTHING;
```

---

## 🔄 Borrow Flow (เฟส 3 — ใช้จริงตอนนี้)

> ⚠️ Admin **ยืม/คืนแทนนักศึกษาไม่ได้แล้ว** (หน้า `borrowscan` / `returnscan` / `admin/borrow` ถูกลบ 2 ต.ค. 2569)

1. นักศึกษาสแกน QR ที่ตัวของ (`app/scan.tsx`) → RPC `scan_lookup` บอกสถานะ
2. ขอยืม / ขอคืน: ถ่ายรูปสด (`lib/borrowPhotos.ts` → bucket `borrow-photos/<user_id>/`) + ตรวจสภาพ → RPC `request_borrow` / `request_return` / `request_renew`
3. ของถูกกันไว้ (`items.status = reserved` / `borrow_records.status = pending_return`) → คำขอขึ้นใน **กล่องคำขอ** อย่างเดียว (migration `staff_inbox_split`: `_notify_staff` ไม่ส่ง `request_*` เข้ากระดิ่ง; กระดิ่งผู้ดูแล = ประกัน/อายุ/เกินกำหนด/คืนอัตโนมัติ, ปุ่มกระดิ่งอยู่หน้า `admin/home`)
4. Admin อนุมัติ/ปฏิเสธใน `app/admin/requests.tsx` → RPC `decide_request` (คืน: ตรวจสภาพ ชำรุด → `repair` + ค่าเสียหาย)
5. ไม่มีใครตอบใน `app_settings.request_expiry_minutes` (30) → pg_cron `expire_requests` ทุก 5 นาที (เดิมทุกนาที เปลี่ยนเพราะ Disk IO ของแพ็กเกจฟรี — migration `reduce_disk_io` + `cleanup-cron-history` ลบบันทึก cron เก่ากว่า 7 วัน; หน้าแจ้งเตือน/กล่องคำขอรีเฟรชทุก 30 วิ เฉพาะตอนแอปเปิดอยู่): ยืม = หมดอายุ / คืน = คืนอัตโนมัติ
6. pg_cron `send_due_reminders` 08:00 ไทย: แจ้ง "พรุ่งนี้ครบกำหนด" + "เกินกำหนด"
- กติกาทั้งหมดอยู่ใน RPC (security definer + ล็อกแถว) แอปเรียกอย่างเดียว — SQL: `supabase/migrations/2026100309*_phase3_*.sql`
- Admin สแกน = ดูสถานะอย่างเดียว (`app/admin/lookup.tsx`)
- จำกัดยืมพร้อมกัน `app_settings.max_active_borrows` (3), จำนวนวัน `borrow_day_options` ([3,5,7])

### (เดิม) ยืม (Admin ทำ):
1. Admin กด "สแกนยืม" ใน `admin/borrowscan.tsx`
2. สแกน Barcode/QR บน item → ขึ้นชื่อ + รูป + สถานะ
3. พิมพ์ email user (มี autocomplete จาก profiles)
4. กำหนดวันคืน (preset: 1/3/7/14 วัน)
5. เซ็นลายเซ็นด้วยนิ้ว (SignatureCanvas)
6. กดยืนยัน → insert borrow_records + อัปโหลด SVG ลายเซ็น → update `borrow_signature_url` + items.status = "borrowed"

### คืน (Admin ทำ):
1. Admin กด "สแกนคืน" ใน `admin/returnscan.tsx`
2. สแกน Barcode/QR บน item → ขึ้นชื่อ user + วันยืม + วันครบกำหนด
3. เซ็นลายเซ็นด้วยนิ้ว (SignatureCanvas)
4. กดยืนยันรับคืน → อัปโหลด SVG ลายเซ็น → update `return_signature_url` + borrow_records.status = "returned" + items.status = "available"

### Logic การค้นหา item จาก scan (ทั้ง borrow และ return):
1. ค้นด้วย `barcode` field ก่อน
2. ถ้าไม่เจอ ลอง `id` (UUID)
3. ถ้าไม่เจอ ลอง parse JSON (จาก qrgen) → ค้นด้วย `name`

---

## 📊 สถานะปัจจุบัน (อัปเดต 17 พ.ค. 2569 — session 3)

### ✅ เสร็จแล้ว — ทุก feature เสร็จหมดแล้ว

#### User screens
- [x] Login / Signup (upsert + ตาดูรหัสผ่าน) / Forgot / Reset Password
- [x] Home — ดึงห้องจาก DB + ปุ่ม LAN Status
- [x] Equipment — ดูสถานะอุปกรณ์ + search (view-only)
- [x] Roommap — ผังห้อง view-only, กดเครื่องดูสถานะ (ว่าง/ซ่อม/พัง), กด Server ดู LAN port
- [x] LAN Status — ดูสถานะ port แยกห้อง/กลุ่ม
- [x] Notifications — ประวัติการยืมอุปกรณ์ (เอา booking ออกแล้ว)
- [x] Profile — ดึงข้อมูลจริงจาก Supabase
- [x] Borrow history — ประวัติยืมอุปกรณ์ + due_date + overdue indicator + รูป (เอาแท็บจองห้องออกแล้ว)

#### Admin screens
- [x] Admin Dashboard — สถิติอุปกรณ์ + เมนู (เอา booking stats ออกแล้ว)
- [x] Admin สแกนยืม (borrowscan) — barcode/UUID/JSON → email autocomplete → due date → **ลายเซ็นนิ้ว**
- [x] Admin สแกนคืน (returnscan) — barcode/UUID/JSON → ยืนยันคืน + overdue detect → **ลายเซ็นนิ้ว**
- [x] Admin จัดการห้อง (room) — สถิติเครื่องแต่ละห้อง + quick links (รวม 11 ปุ่มใน dashboard)
- [x] Admin จัดการอุปกรณ์ (items) — เพิ่ม/ลบ + barcode + type + search + stats
- [x] Admin QR Generator (qrgen)
- [x] Admin Scan & เพิ่ม Item (scan)
- [x] Admin ประวัติยืม (history)
- [x] Admin จัดการเครื่องคอม (stations) — เพิ่ม/ลบ/แก้/toggle status
- [x] Admin สถานะเครื่องคอม (editStatus) — toggle available/repair
- [x] Admin จัดการ LAN Port (lanports) — toggle status/เพิ่ม/ลบ
- [x] Admin ตรวจอุปกรณ์ประจำเทอม (inspection) — บันทึกสภาพ + ดูประวัติผู้ยืม
- [x] Admin ซ่อมบำรุง (repairs) — แจ้งซ่อม/อัปเดตสถานะ pending→in-repair→done
- [x] Logout

### ❌ เอาออกแล้ว
- ระบบจองห้อง (room_bookings) — ถูกเอาออกจากทุก UI แล้ว
- แท็บจองห้องใน borrow.tsx
- Booking feed ใน notifications.tsx
- Booking stats ใน admin/home.tsx
- Date picker + slot ใน roommap.tsx

---

## 📁 โครงสร้างไฟล์สำคัญ
```
app/
├── index.tsx            — Landing
├── login.tsx            — ✅
├── signup.tsx           — ✅ (upsert + ตาดูรหัสผ่าน)
├── forgot.tsx           — ✅
├── reset-password.tsx   — ✅
├── home.tsx             — ✅ (ห้องจาก DB + ลิงก์ LAN)
├── equipment.tsx        — ✅ (view-only + search + รูป)
├── borrow.tsx           — ✅ (ประวัติยืม + due_date + overdue + รูป)
├── profile.tsx          — ✅
├── sittings.tsx         — ✅
├── notifications.tsx    — ✅ (borrow feed อย่างเดียว)
├── roommap.tsx          — ✅ (กดเครื่องดูสถานะ, กด Server ดู LAN port)
├── lanstatus.tsx        — ✅ (แยกห้อง/กลุ่ม)
└── admin/
    ├── home.tsx         — ✅ (สถิติอุปกรณ์ + เมนู 11 ปุ่ม)
    ├── items.tsx        — ✅ (เพิ่ม/ลบ + barcode + type + search + stats)
    ├── borrow.tsx       — ✅ (ยืนยันคืน เดิม — ยังคงไว้แต่ไม่ได้ link)
    ├── history.tsx      — ✅
    ├── scan.tsx         — ✅ (QR scan + เพิ่ม item)
    ├── qrgen.tsx        — ✅
    ├── lanports.tsx     — ✅ (จัดการ port แยกห้อง/กลุ่ม)
    ├── borrowscan.tsx   — ✅ (สแกนยืม → email → due date → **ลายเซ็น**)
    ├── returnscan.tsx   — ✅ (สแกนคืน → ยืนยัน + overdue → **ลายเซ็น**)
    ├── stations.tsx     — ✅ (จัดการเครื่องคอม: เพิ่ม/ลบ/แก้/toggle)
    ├── room.tsx         — ✅ (overview: สถิติแต่ละห้อง + quick links)
    ├── inspection.tsx   — ✅ (ตรวจอุปกรณ์ประจำเทอม + ดูประวัติผู้ยืม)
    ├── repairs.tsx      — ✅ (แจ้งซ่อม/ติดตามสถานะ pending→in-repair→done)
    └── status/
        └── editStatus.tsx — ✅

lib/
├── supabase.ts
└── uploadSignature.ts   — คืนค่า SVG string โดยตรง (ไม่ upload Storage แล้ว หลีกเลี่ยง RLS)

components/
└── SignatureCanvas.tsx   — reusable signature pad (PanResponder + react-native-svg)
```

---

## 🔧 สิ่งที่แก้ใน Session 3 (17 พ.ค. 2569)

### Codebase cleanup
- ลบไฟล์เก่า: `loginAdmin.tsx`, `otp.tsx`, `admin/booking.tsx`, `admin/addDevice.tsx`, `admin/device.tsx`
- `_layout.tsx` — ลงทะเบียน screens ครบ, SIGNED_OUT → redirect /login
- `admin/home.tsx` — role protection: redirect ถ้าไม่ใช่ admin หรือไม่มี session

### UI redesign (User)
- `home.tsx` — header navy + stat pill, room cards + shadow, tab bar fixed bottom
- `profile.tsx` — avatar initial letter, stats cards, menu cards, recent borrow
- `sittings.tsx` — redesign ใหม่ทั้งหมด ภาษาไทยครบ logout มี confirm dialog
- `signup.tsx` — subtitle ภาษาไทย, สีปุ่ม navy

### Features ใหม่
- **Notification system** — table `notifications`, insert เมื่อยืม/คืน, UI timestamp relative
- **Image upload** — FileSystem.uploadAsync + BINARY_CONTENT + anon key (แก้ 0-byte bug)
- **กดรูปขยาย** — full-screen modal ใน admin/items
- **เปลี่ยนสถานะ item** — กด badge ในการ์ดเปลี่ยน available/borrowed/repair
- **borrow_date column** — เพิ่มใน DB (timestamptz) บันทึกเวลายืมจริง
- **FK constraint** — borrow_records.item_id เปลี่ยนเป็น ON DELETE SET NULL (ลบ item แล้วประวัติยังอยู่)

### Image upload flow (scan.tsx)
```
photoUri → FileSystem.uploadAsync(BINARY_CONTENT) → Supabase Storage item-images
→ getPublicUrl → เก็บใน items.image_url
```
ต้องใช้ anon key (ไม่ใช้ session token) เพราะ INSERT policy ตั้งเป็น public

---

## ⚠️ Known Issues / หมายเหตุ

### Navigation
- **`app/index.tsx` ต้องใช้ `<Redirect href="/admin/home" />` เท่านั้น** — ห้ามใช้ `router.replace()` ใน useEffect เพราะจะเกิด error "Attempted to navigate before mounting the Root Layout component"
- `_layout.tsx`: router calls ใน `onAuthStateChange` และ deep link handler ให้ wrap ด้วย `setTimeout(() => ..., 0)` เสมอ

### Expo / Build
- `expo-file-system` — ต้อง `import * as FileSystem from "expo-file-system"` แล้ว cast `const FS = FileSystem as any`
- Expo LAN mode timeout → เปิด firewall: `netsh advfirewall firewall add rule name="Expo Metro" dir=in action=allow protocol=TCP localport=8081`
- UI เก่าค้าง → `npx expo start --clear`

### Supabase
- Supabase Signup trigger อาจสร้าง profile อัตโนมัติ → ใช้ `upsert` แทน `insert` ใน signup.tsx แล้ว
- QR code จาก qrgen เก็บ JSON `{name, type, description}` ไม่ใช่ barcode → borrowscan/returnscan มี fallback parse JSON แล้ว
- borrow_records อาจไม่มี `borrow_date` → ใช้ `created_at` เป็น fallback
- profiles join ใน borrow_records อาจไม่มี FK → ดึง email แยกด้วย query ใน returnscan
- Signature upload ใช้ Supabase Storage REST API ผ่าน `fetch()` โดยตรง (ไม่ใช้ JS client) เพราะ React Native ไม่รองรับ Blob ตามปกติ — ดู `lib/uploadSignature.ts`

### SQL ที่ต้องรัน (ถ้า signatures ยังไม่มี columns):
```sql
ALTER TABLE borrow_records ADD COLUMN IF NOT EXISTS borrow_signature_url text;
ALTER TABLE borrow_records ADD COLUMN IF NOT EXISTS return_signature_url text;
```

---

## 🔧 สิ่งที่แก้ใน Session 2 (16 พ.ค. 2569)

### Bug fixes
- `app/index.tsx` — เปลี่ยนกลับเป็น `<Redirect href="/admin/home" />` (ห้ามใช้ `router.replace()` ใน useEffect)
- `admin/borrowscan.tsx` + `returnscan.tsx` — เปลี่ยน scan lock จาก `useState` → `useRef` (กัน popup เด้งซ้ำ)
- `components/SignatureCanvas.tsx` — แก้ bug ลายเซ็นหาย: ต้อง capture `const path = current.current` ก่อน reset ref ไม่งั้น React 18 batch updater วิ่งหลัง reset แล้วได้ empty string
- `components/SignatureCanvas.tsx` — เพิ่ม `collapsable={false}`, `onStartShouldSetPanResponderCapture`, ใช้ ref สำหรับ callback (กัน stale closure)
- Signature step ใน borrowscan/returnscan — เปลี่ยนจาก `ScrollView` → `View` ธรรมดา (กัน scroll แย่ง touch)
- `lib/uploadSignature.ts` — เปลี่ยนจาก anon key → ใช้ `session?.access_token` (แก้ RLS 403)

### UI ปรับปรุง
- `app/borrow.tsx` — redesign ให้ match style ทั้งแอป (stats row, left border cards, section label, RefreshControl)
- `admin/history.tsx` — redesign ใหม่ทั้งหมด (stats 4 card, search bar, filter tabs, cards with status)
- `admin/inspection.tsx` — เอา "ประวัติผู้ยืม" ออก (ไม่เกี่ยวกัน), form ตรวจ 3 อุปกรณ์พร้อมกัน, แก้ duplicate insert → upsert จาก DB, deduplicate display

### Supabase Storage (ต้องทำใน dashboard)
- Bucket `signatures` → เปิด **Public** แล้ว ✅
- Policy INSERT สำหรับ authenticated users — ถ้า 403 ยังขึ้น ให้เพิ่ม policy `true` ใต้ SIGNATURES bucket โดยตรง
