# ระบบยืม-คืน

> อ่านเมื่อแก้งานฝั่งยืม-คืน (ห้ามแตะระบบห้องคอม)

- ตาราง: `items` (status `available|reserved|borrowed|repair|retired`), `borrow_requests`, `borrow_records` (ไม่มี `created_at` → เรียง `borrow_date`), `pickup_requests`, `categories`, `borrow_locations`, `app_settings`, `notifications`, `item_alerts`, `staff_presence`
- ชื่อ/สีสถานะ: `lib/status.ts` ที่เดียว (`ITEM_STATUS`, `PICKUP_STATUS` ฯลฯ)
- **รหัสอุปกรณ์**: trigger `items_before_insert` ออก `item_code` (เช่น `DHT22 012`) + `barcode` 4 ตัว + `location_id` เอง (แอปไม่ส่ง) / `items_before_update` ล็อกรหัส · ป้าย QR `lib/labels.ts`
- รูปอุปกรณ์: `lib/itemPhoto.ts` · ปุ่ม "เปลี่ยนรูปทั้งรุ่น" ใน `app/admin/items.tsx` · หน้า admin แสดงรูปจริงแทนไอคอนหมวด · ใส่รูปครบทุกรุ่นแล้ว (3 พ.ย.) · Claude อัปรูปเองไม่ได้ (แอปเปิด file picker ของ Windows) → เจ้าของเลือกไฟล์เอง
- `admin/items` จอคอม: ตารางจัดกลุ่มตามรุ่น (`itemModelKey` ใน `lib/itemInfo.ts` = item_prefix ไม่มีก็ชื่อ — ใช้ร่วมกับหน้า นศ. `equipment.tsx` · ต้องตรงกับ `_item_model` ใน DB) แถวรุ่น → กางเป็นรายชิ้น · ค้นหาอยู่ = กางรุ่นที่เจอ โชว์เฉพาะชิ้นที่ตรง · ⋯ แถวรุ่น = ปริ้นป้าย QR ทั้งรุ่น (`buildLabelSheetHtml` เดียวกับ qrgen) / เปลี่ยนรูปทั้งรุ่น · มือถือ/แอป: การ์ดละรุ่น (`ModelCard`) แตะกางรายชิ้นในการ์ด · ⋮ การ์ด = เมนูทั้งรุ่น · ปุ่ม "กางทั้งหมด" ที่หัวรายการ (ใช้ state กาง/พับชุดเดียวกับจอคอม) · รายชิ้นตอนกางวาดทีละชุด (`useProgressiveList`) · รุ่นที่จำหน่ายหมดแล้ว เมนูรุ่นไม่มีปุ่ม (บอกข้อความแทน)
- วันหมดประกัน: ช่องกรอก วว/ดด/ปปปป พ.ศ. (`components/borrow/WarrantyDateField`, `parseThaiDate`/`toThaiDateInput` ใน lib/itemInfo) — DB เก็บ ค.ศ. `date`

## ยืม/คืน (กติกาทั้งหมดอยู่ใน RPC security definer — แอปเรียกอย่างเดียว)
- นศ. สแกน QR (`app/scan.tsx` → `scan_lookup`) → ถ่ายรูป + สภาพ (`lib/borrowPhotos.ts`) → `request_borrow` / `request_return` / `request_renew` → ผู้ดูแลอนุมัติใน `admin/requests` (`decide_request`)
- ไม่มีคนตอบใน `request_expiry_minutes` = ยืมหมดอายุ / คืนอัตโนมัติ · ผู้ดูแลยืม/คืนแทนไม่ได้ · ผู้ดูแลสแกน = ดูอย่างเดียว (`admin/lookup`)
- โควตา `max_active_borrows` (3) นับ ยืม + รออนุมัติ + นัดรับ (`_active_borrow_count`) · วันยืม `borrow_day_options` (1–160 วัน: DB `borrow_requests_days_check` + `DAY_MAX` ใน `admin/settings`)
- กระดิ่งผู้ดูแล = ประกัน/อายุ/เกินกำหนด/คืนอัตโนมัติ (คำขอขึ้นกล่องคำขออย่างเดียว) · แจ้งเตือนประกัน/อายุ ส่งเฉพาะ admin
- นศ. ไม่มีรหัส นศ. → บังคับไป `/student-id`

## F1 กฎยืม
- `app_settings.borrow_rules` (ตัวแปร `{max}{days}{expiry}` ใน `lib/borrowRules.ts`) · `components/borrow/ConfirmRulesSheet` เด้งก่อนส่งทุกคำขอ · ยืมต่อไม่ได้ถ้าเกินกำหนด

## F2 นัดรับ
- `pickup_requests` (pending→scheduled→picked_up | declined | expired | cancelled | no_show), รุ่น = `_item_model(item_prefix, name)`
- RPC `request_pickup` / `schedule_pickup` / `decline_pickup` / `cancel_pickup(p_no_show)` / `claim_pickup` / `my_pickups()` · หมดอายุ 12 ชม. / เลยนัด 10 นาที
- **กันของตั้งแต่ส่งคำขอ**: `_pickup_free` = ว่าง − (pending + scheduled) · `schedule_pickup` ปฏิเสธเมื่อติดลบ · เจ้าของคำขอรอนัดสแกนยืมเอง = คำขอนัดรับถูกยกเลิกให้ · หน้าอุปกรณ์หักด้วย `pickup_holds()`
- แอป: `app/pickup-sheet.tsx` + `components/borrow/PickupRequestForm`, ส่วนนัดรับใน `borrow.tsx`, `components/borrow/PickupInbox` ใน `admin/requests`, ปุ่ม "ยืนยันรับของตามนัด" ใน `scan.tsx`

## F3 ประวัติแบบแอปธนาคาร
- `lib/timeline.ts` + `components/borrow/TimelineDays` (`borrow.tsx`, `admin/history.tsx`)

## F4 ผู้ดูแลอยู่ห้อง
- `staff_presence` ผ่าน `staff_check_in/out`, อ่าน `lab_presence()` · `components/borrow/StaffPresenceBanner` (หน้าแรก นศ.), `components/borrow/StaffCheckInCard` (แดชบอร์ด)

## TA
- `lib/roles.ts` (`canAccess`, `TA_ROUTES`) · `set_user_role` (admin ตั้ง user/ta/admin ได้ — เปลี่ยนของตัวเองไม่ได้, ต้องเหลือ admin ≥ 1) · TA อนุมัติคำขอของตัวเองไม่ได้

## หน้า admin อื่น
- `categories` (หมวด "อื่นๆ" ห้ามแก้), `stock` (`?watch=soon|expired|ageWarn|ageReplace`), `settings`, `import` (CSV — `lib/importItems.ts`), `report` (CSV/PDF — `lib/report.ts`, `lib/fileExport.ts`), `items` (กดการ์ด → แก้ประกัน/Serial), `users`
- `iotinspection` (ตรวจสภาพ IoT ประจำเทอม — `items`/`item_inspections` มีสูตรเทอม `currentTerm()` ของตัวเอง ห้าม import `lib/room/term`) · ผลตรวจ เสีย/ชำรุด = สถานะ repair อัตโนมัติ
