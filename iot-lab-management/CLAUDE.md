# 📱 IoT Lab Management App (LabHub)

> อ่านก่อนเริ่มงานทุกครั้ง — เก็บเฉพาะกติกาที่ยังใช้อยู่ (ประวัติงานดูใน git log)

## หลัก
- **Stack**: React Native + Expo (expo-router) + Supabase (Auth/DB/Storage/Realtime) + TypeScript · ผู้ใช้ = นศ./อาจารย์ห้องแล็บ IoT
- **UI**: ใช้ `docs/DESIGN.md` เท่านั้น (ฟ้า #2563EB, สี/การ์ด/ปุ่มจาก `lib/theme.ts`) ห้ามผสม design system อื่น · **ทำ mockup ให้เจ้าของโปรเจกต์ดูก่อน** แล้วค่อยแก้โค้ดจริง
- **Role**: `profiles.role` = `user | ta | admin` — user ดู + ขอยืม/คืนเอง, ta = ผู้ช่วย (สิทธิ์บางส่วน), admin = ทุกอย่าง
- **ระบบห้องคอม แยกจากระบบยืม-คืนเด็ดขาด** (ตาราง/หน้า/lib/กติกา) — งานฝั่งหนึ่งห้ามแก้หรือ import ของอีกฝั่ง (สั่ง 5 ต.ค. 2569)

## กติกาโค้ดทั้งแอป
- **แอปมือถือคือหลัก** · เว็บ: แท่งกว้าง 480px กลางจอ (`app/_layout`) · **แบบจอใหญ่เฉพาะหน้า admin** (เว็บกว้าง ≥1024 — ตัดสินที่ `lib/layout.ts` ที่เดียว ห้ามเช็กเองในหน้า): เมนูซ้าย `components/desktop/AdminShell` + หน้าที่ทำแล้วอยู่ใน `ADMIN_DESKTOP_READY` (แดชบอร์ด/กล่องคำขอ/ประวัติ = `components/desktop/*` · อุปกรณ์ = ตาราง · หน้ารายการ = `desktopGrid` 2 คอลัมน์ · หน้าที่มี 2 ส่วน = `desktopCols` · `desktopBody.wide` = กว้าง `DESKTOP_MAX` · หัวหน้าจอใหญ่ชิดซ้ายในกรอบเดียวกับเนื้อหา (ScreenHeader) · แถบสถิติ/แท็บ/ปุ่มติดล่างใต้หัว ห่อ `components/desktop/DesktopBox` · ตัวหนังสือขยายเองบนจอกว้าง (`TextScale` ใน AdminShell) · โทนฟ้า-ขาว: พื้นหน้า/เงาการ์ดจอใหญ่ = ตัวแปร CSS `--lh-page-bg`/`--lh-card-shadow` ใน `app/+html` (W.page/W.card อ่านบนเว็บ ไม่มีตัวแปร = ค่ามือถือเดิม)) · ไม่มีปุ่ม ← บนจอใหญ่ — ฟีเจอร์/สิทธิ์เหมือนมือถือทุกอย่าง แยกแค่ส่วนแสดงผล · `<BottomSheet>` บนเว็บ = หน้าต่างกลางจอ/แผ่นล่าง (แผ่น iOS ใช้ไม่ได้บนเว็บ)
- ป๊อปอัป: `notify` / `confirmAction` / `pickOption` (lib/notify) — หน้าตาของแอปทุกแพลตฟอร์ม ห้ามใช้ `Alert.alert` · **`<Modal>` ใหม่ต้องใส่ `<DialogHost />` เป็นลูกตัวสุดท้าย** (แผ่น formSheet ที่เรียก notify ก็ต้องใส่) ไม่งั้นป๊อปอัปอยู่ใต้หน้าต่าง
- นำทาง `lib/nav.ts`: ← = `goBack(fallback)` (ห้าม `router.replace` เป็นปุ่มย้อน) / แถบล่าง นศ. `goTab` / หน้าที่ต้องสดตอนกลับมา `useRefreshOnFocus(load)`
- user ที่ล็อกอิน: `currentUser()` (lib/session) ไม่ใช่ `auth.getUser()` (ยิงเซิร์ฟเวอร์ กิน Disk IO แพ็กเกจฟรี)
- แป้นพิมพ์: `react-native-keyboard-controller` (`KeyboardProvider` ใน `_layout`, `KeyboardAwareScrollView`) · บนเว็บ `metro.config.js` สลับเป็น `lib/shims/keyboard-controller.web.tsx` (ตัด reanimated ~840 KB ออกจาก build เว็บ) — import ตัวอื่นจากไลบรารีนี้เพิ่ม ต้องเพิ่มใน shim ด้วย · ฟอนต์ไอคอน Ionicons บนเว็บ production = ฉบับย่อเฉพาะไอคอนที่มีชื่อเป็น string ในโค้ด (`scripts/subset-ionicons.js` รันใน buildCommand) — ห้ามประกอบชื่อไอคอนด้วยการต่อ string
- **แผ่นล่างจอทุกอันใช้ `<BottomSheet visible onClose style>`** (components/BottomSheet) = เปิดแผ่น iOS แท้ผ่าน route `app/sheet-host.tsx` + `lib/sheetHost` (120Hz, ฉากมืดระบบ, ปัดลงปิด) — ห้ามทำแผ่นเองด้วย `<Modal>` (ใช้ `<Modal>` ได้เฉพาะของเต็มจอ เช่น ซูมรูป) · เนื้อหาห้ามมี ScrollView แนวตั้งซ้อน
- แผ่น iOS (`presentation: "formSheet"`, `SHEET` ใน `_layout`): ความสูงพอดีเนื้อหาด้วย `lib/sheetFit` · **ScrollView ต้องเป็นรากของแผ่นเลย** (ห้ามห่อ View → แผ่นขาว / ห้าม padding นอก ScrollView → ตัวหนังสือตกขอบ / ห้ามมี ScrollView ซ้อนข้างใน → ยืดทับ) ดูตัวอย่าง `app/equipment-sheet.tsx`
- รูปก่อนอัปโหลด: `lib/shrinkPhoto.ts` (อุปกรณ์ 1000px, หลักฐานยืม 1600px) · รูปแสดงผลใช้ `expo-image`
- วันหมดประกัน: ช่องกรอก วว/ดด/ปปปป พ.ศ. (`components/WarrantyDateField`, `parseThaiDate`/`toThaiDateInput` ใน lib/itemInfo) — DB เก็บ ค.ศ. `date`
- รหัสผ่าน `lib/password.ts` (8 ตัว มีตัวอักษร+ตัวเลข) · เปลี่ยนรหัสจากโปรไฟล์ = `/reset-password` (ต้องล็อกอิน) · **ไม่มีหน้าสมัครสมาชิก/ลืมรหัสผ่าน** (ถอดออก 12 ต.ค. 2569 — นศ. เข้าด้วย Google @kkumail.com ครั้งแรก = สร้างบัญชีเอง / จำรหัสไม่ได้ให้ติดต่อผู้ดูแล)
- `app/index.tsx` ต้องเป็น `<Redirect href="/admin/home" />` (ห้าม router.replace ใน useEffect) · router ใน `onAuthStateChange`/deep link ห่อ `setTimeout(...,0)`
- **PWA/Web Push** (เว็บเท่านั้น): `public/` (manifest, ไอคอน, `sw.js` — แก้แล้วเปลี่ยน `VERSION`), meta ใน `app/+html.tsx`, `lib/webPush.ts` (ลงทะเบียน SW ใน `_layout`), การ์ด `WebPushCard` ในหน้าแจ้งเตือน · แถวใหม่ใน `notifications` → trigger `notifications_push` (pg_net, เฉพาะคนที่มี `push_subscriptions`) → Edge Function `send-push` (deploy `--no-verify-jwt`, VAPID ใน secrets) · คำขอใหม่ (ไม่มีแถวใน notifications) → trigger `borrow_requests_push`/`pickup_requests_push` + นศ. ยกเลิกเอง (`cancel_pickup`, `cancel_request`) → `_push_staff()` → push ถึง admin+TA (ไม่เพิ่มในกระดิ่ง) · ขั้นตอน deploy: `docs/DEPLOY_PWA.md`
- `expo-file-system`: `import * as FileSystem` แล้ว `const FS = FileSystem as any` · UI ค้าง → `npx expo start --clear`

## Supabase — กติกาทั่วไป
- SQL ทั้งหมดอยู่ใน `supabase/migrations/` · event trigger `ensure_rls` เปิด RLS ให้ตารางใหม่อัตโนมัติ → **ตาราง/หน้าใหม่ต้องเขียน policy ในไฟล์เดียวกัน**
- RLS: ยังไม่ล็อกอิน = เข้าไม่ได้ / user อ่านของสาธารณะ + ของตัวเอง / `is_admin()`, `is_staff()` (admin+ta) / เขียนข้อมูลใช้ `.select("id")` เช็ก (RLS ไม่ให้ = 0 แถว ไม่ error)
- `profiles_protect`: user แก้ role/email/ชื่อ/รูปไม่ได้, `student_id` (`^[0-9]{9}-[0-9]$`) ตั้งได้ครั้งเดียว · admin แก้ที่ `admin/users` · ชื่อผู้ใช้ในหน้าผู้ดูแลใช้ `who()` (lib/people)
- Storage: `item-images` (admin อัปโหลด — มือถือส่ง `session.access_token`), `borrow-photos/<user_id>/` (หลักฐานยืม-คืน)
- Realtime Broadcast (`realtime.send`): ช่อง `user:<id>` (notification), `staff` (request), `lab` (presence), `room` (room_status) · ระบบยืมฟังด้วย `useRealtime()` (lib/realtime) ระบบห้องใช้ `useRoomLive()` (lib/roomRealtime) — ตาราง `realtime.messages` แบ่งพาร์ทิชันรายวัน ไม่มีพาร์ทิชัน = ส่งล้มเงียบ (แอปมีรีเฟรชสำรอง 5 นาที)
- cron (แพ็กเกจฟรี ระวัง Disk IO): `expire-borrow-requests` ทุก 5 นาที (+ `expire_pickups`), `send_due_reminders` + `item-health-alerts` 08:00 ไทย, `staff-auto-checkout` 17:00 ไทย, `cleanup-cron-history` (เก็บ 7 วัน)
- ล็อกอิน Google (`lib/googleAuth.ts`): อีเมล มข. = `@kkumail.com` (นศ.) + `@kku.ac.th` (อาจารย์/บุคลากร ทุกคณะ — เข้าครั้งแรกเป็น user ไม่ถามรหัส นศ. admin ตั้งสิทธิ์ให้เองใน `admin/users` ห้ามให้สิทธิ์ตามโดเมนอัตโนมัติ) · Auth Hook `hook_restrict_signup_domain` อ่าน `app_settings.allowed_email_domain` (คั่นด้วย `,`) — **ช่วงพัฒนาว่างไว้** / ตอน Final เปิดสวิตช์ "รับเฉพาะอีเมล มข." ที่ `admin/settings` + เปิด Hook ใน Dashboard
- จำการล็อกอิน: มือถือ AsyncStorage / เว็บ localStorage · ไม่ติ๊ก "จดจำ" = เปิดแอปครั้งหน้าออกจากระบบ (`applyRememberLogin`)

## ระบบยืม-คืน
- ตาราง: `items` (status `available|reserved|borrowed|repair|retired`), `borrow_requests`, `borrow_records` (ไม่มี `created_at` → เรียง `borrow_date`), `pickup_requests`, `categories`, `borrow_locations`, `app_settings`, `notifications`, `item_alerts`, `staff_presence`
- ชื่อ/สีสถานะ: `lib/status.ts` ที่เดียว (`ITEM_STATUS`, `PICKUP_STATUS` ฯลฯ)
- **รหัสอุปกรณ์**: trigger `items_before_insert` ออก `item_code` (เช่น `DHT22 012`) + `barcode` 4 ตัว + `location_id` เอง (แอปไม่ส่ง) / `items_before_update` ล็อกรหัส · ป้าย QR `lib/labels.ts`
- **ยืม/คืน** (กติกาทั้งหมดอยู่ใน RPC security definer — แอปเรียกอย่างเดียว): นศ. สแกน QR (`app/scan.tsx` → `scan_lookup`) → ถ่ายรูป + สภาพ (`lib/borrowPhotos.ts`) → `request_borrow` / `request_return` / `request_renew` → ผู้ดูแลอนุมัติใน `admin/requests` (`decide_request`) · ไม่มีคนตอบใน `request_expiry_minutes` = ยืมหมดอายุ / คืนอัตโนมัติ · ผู้ดูแลยืม/คืนแทนไม่ได้ · ผู้ดูแลสแกน = ดูอย่างเดียว (`admin/lookup`)
- โควตา `max_active_borrows` (3) นับ ยืม + รออนุมัติ + นัดรับ (`_active_borrow_count`) · วันยืม `borrow_day_options`
- กระดิ่งผู้ดูแล = ประกัน/อายุ/เกินกำหนด/คืนอัตโนมัติ (คำขอขึ้นกล่องคำขออย่างเดียว) · แจ้งเตือนประกัน/อายุ ส่งเฉพาะ admin
- **F1 กฎยืม**: `app_settings.borrow_rules` (ตัวแปร `{max}{days}{expiry}` ใน `lib/borrowRules.ts`) · `ConfirmRulesSheet` เด้งก่อนส่งทุกคำขอ · ยืมต่อไม่ได้ถ้าเกินกำหนด
- **F2 นัดรับ**: `pickup_requests` (pending→scheduled→picked_up | declined | expired | cancelled | no_show), รุ่น = `_item_model(item_prefix, name)`
  - RPC `request_pickup` / `schedule_pickup` / `decline_pickup` / `cancel_pickup(p_no_show)` / `claim_pickup` / `my_pickups()` · หมดอายุ 12 ชม. / เลยนัด 10 นาที
  - **กันของตั้งแต่ส่งคำขอ**: `_pickup_free` = ว่าง − (pending + scheduled) · `schedule_pickup` ปฏิเสธเมื่อติดลบ · เจ้าของคำขอรอนัดสแกนยืมเอง = คำขอนัดรับถูกยกเลิกให้ · หน้าอุปกรณ์หักด้วย `pickup_holds()`
  - แอป: `app/pickup-sheet.tsx` + `PickupRequestForm`, ส่วนนัดรับใน `borrow.tsx`, `PickupInbox` ใน `admin/requests`, ปุ่ม "ยืนยันรับของตามนัด" ใน `scan.tsx`
- **F3 ประวัติแบบแอปธนาคาร**: `lib/timeline.ts` + `TimelineDays` (`borrow.tsx`, `admin/history.tsx`)
- **F4 ผู้ดูแลอยู่ห้อง**: `staff_presence` ผ่าน `staff_check_in/out`, อ่าน `lab_presence()` · `StaffPresenceBanner` (หน้าแรก นศ.), `StaffCheckInCard` (แดชบอร์ด)
- **TA**: `lib/roles.ts` (`canAccess`, `TA_ROUTES`) · `set_user_role` (admin ตั้ง user/ta/admin ได้ — เปลี่ยนของตัวเองไม่ได้, ต้องเหลือ admin ≥ 1) · TA อนุมัติคำขอของตัวเองไม่ได้
- หน้า admin อื่น: `categories` (หมวด "อื่นๆ" ห้ามแก้), `stock` (`?watch=soon|expired|ageWarn|ageReplace`), `settings`, `import` (CSV — ตรรกะใน `lib/importItems.ts`), `report` (CSV/PDF — `lib/report.ts`, `lib/fileExport.ts`), `items` (กดการ์ด → แก้ประกัน/Serial), `users`
- นศ. ไม่มีรหัส นศ. → บังคับไป `/student-id`

## ระบบห้องคอม (R0–R3, แผนใน PLAN/REVIEW_ระบบห้อง.md)
- โครง: 1 ห้อง → 6 กลุ่ม → คอม 9 เครื่อง (C1–C9) + Server LAN 12 port · ห้องอ่านจากตาราง `rooms` ผ่าน `lib/rooms.ts` (ห้ามเขียนรหัสห้องตายตัว)
- ไฟล์: `lib/roomStatus.ts` (ชื่อ/สีสถานะ — ห้ามใช้ lib/status), `lib/rooms.ts`, `lib/term.ts`, `lib/roomRealtime.ts`, `components/LoadError.tsx` (โหลดพัง = แถบลองใหม่), `RoomReportForm`, หน้า stations/lanports/repairs/room/roomreports/inspection/iotinspection/roommap/lanstatus + การ์ดห้องใน `home.tsx`
- DB: `computer_stations` (status available|repair|broken, `active` — มีประวัติลบไม่ได้ → ปิดใช้งาน, ชื่อห้ามซ้ำในกลุ่ม), `lan_ports` (1–12 ห้ามซ้ำในกลุ่ม), `station_equipment` (mouse/keyboard/monitor), `equipment_inspections` (ไม่มี `created_at` ใช้ `inspected_at`), `repair_records` (ห้ามย้อนสถานะ, เปิดงาน → เครื่อง repair / ปิดงาน → available), `room_status_log` (trigger บันทึกเอง), `room_reports`
- TA ในระบบห้อง: เปลี่ยนสถานะเครื่อง/LAN, เช็กลิสต์, ตรวจประจำเทอม, งานซ่อม (trigger กันแก้อย่างอื่น) · เพิ่ม/ลบ ห้อง/เครื่อง/port = admin
- นศ. แจ้งปัญหา: RPC `report_room_problem` (กันซ้ำ, 5 ครั้ง/วัน) → คิว `admin/roomreports` (`decide_room_report`) · แจ้งเตือนผ่าน `_room_notify_staff` ของระบบห้องเอง · `app/notifications.tsx` ใช้ร่วม — แตะได้เฉพาะส่วนระบบห้อง
- ผลตรวจประจำเทอมอัปเดตเช็กลิสต์อัตโนมัติ · `currentTerm()` ใช้ทั้ง inspection และ iotinspection
