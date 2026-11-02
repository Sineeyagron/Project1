# ระบบห้องคอม (R0–R3)

> อ่านเมื่อแก้งานฝั่งห้องคอม (ห้ามแตะ/ import ระบบยืม-คืน)

- โครง: 1 ห้อง → 6 กลุ่ม → คอม 9 เครื่อง (C1–C9) + Server LAN 12 port · ห้องอ่านจากตาราง `rooms` ผ่าน `lib/room/rooms.ts` (ห้ามเขียนรหัสห้องตายตัว)
- ไฟล์: `lib/room/` (`roomStatus` ชื่อ/สีสถานะ — ห้ามใช้ lib/status, `rooms`, `term`, `roomRealtime`, `roomPeople`), `components/room/` (`LoadError` โหลดพัง = แถบลองใหม่, `RoomReportForm`, `HeroChip`), หน้า stations/lanports/repairs/room/roomreports/inspection/roommap/lanstatus + การ์ดห้องใน `home.tsx`
- DB: `computer_stations` (status available|repair|broken, `active` — มีประวัติลบไม่ได้ → ปิดใช้งาน, ชื่อห้ามซ้ำในกลุ่ม), `lan_ports` (1–12 ห้ามซ้ำในกลุ่ม), `station_equipment` (mouse/keyboard/monitor), `equipment_inspections` (ไม่มี `created_at` ใช้ `inspected_at`), `repair_records` (ห้ามย้อนสถานะ, เปิดงาน → เครื่อง repair / ปิดงาน → available), `room_status_log` (trigger บันทึกเอง), `room_reports`
- TA: เปลี่ยนสถานะเครื่อง/LAN, เช็กลิสต์, ตรวจประจำเทอม, งานซ่อม (trigger กันแก้อย่างอื่น) · เพิ่ม/ลบ ห้อง/เครื่อง/port = admin
- นศ. แจ้งปัญหา: RPC `report_room_problem` (กันซ้ำ, 5 ครั้ง/วัน) → คิว `admin/roomreports` (`decide_room_report`) · แจ้งเตือนผ่าน `_room_notify_staff` ของระบบห้องเอง · `app/notifications.tsx` ใช้ร่วม — แตะได้เฉพาะส่วนระบบห้อง
- **QR แปะคอม** (`lib/room/stationQr.ts`): ค่าใน QR = ลิงก์ `https://labhub-kku.vercel.app/roommap?room_id=…&station=<id>` (`SITE_ORIGIN` — ห้ามใช้ window.location) → `roommap` เปิดแผ่นเครื่องนั้นเอง (param `station`) = ดูสถานะ + แจ้งปัญหา (ฟอร์มเดิม) · `from=admin` ต้องรอ `is_staff` ตอบก่อนค่อยเปิดแผ่น (ไม่งั้นข้ามโหลดประวัติ) · ประวัติว่าง = ขึ้น "ยังไม่มีประวัติ…" (ไม่ซ่อน)
  - ประวัติสถานะในแผ่นเครื่อง (staff) = เส้นเวลา 3 ครั้งล่าสุด + "ดูเพิ่ม" ทีละ 5 (`range` + `count`) · ป้ายสี = สถานะใหม่เท่านั้น ไม่มี "จาก…" และไม่มีไอคอน (เจ้าของเลือกแบบ A 2 พ.ย.)
  - สแกนในแอป: `app/roomscan.tsx` (การ์ด "สแกน QR คอม" ใน `home.tsx` / ปุ่ม "สแกน QR" ใน `admin/room` ส่ง `from=admin` → ผังห้องโหมดผู้ดูแล) — รับเฉพาะ QR คอม ห้ามให้ `app/scan` (ระบบยืม) อ่าน
  - สแกนด้วยกล้องมือถือตอนยังไม่ล็อกอิน → `lib/returnTo.ts` (ใช้ร่วม เว็บเท่านั้น) จำหน้าไว้ 30 นาที ล็อกอินเสร็จ `login.tsx` พากลับ
  - `admin/room` แถวที่ 2: "ป้าย QR" (`buildStationLabelsHtml` 6×4.2 ซม. A4 18 ป้าย) + "สรุป PDF" (`buildRoomSummaryHtml`) ผ่าน `exportPdf` (lib/fileExport ใช้ร่วม) — TA ใช้ได้
  - กล้อง `components/ScanCamera` = ใช้ร่วม (แค่กล้อง)
- ผลตรวจประจำเทอมอัปเดตเช็กลิสต์อัตโนมัติ · `currentTerm()` (lib/room/term) ใช้ที่ `admin/inspection` — `admin/iotinspection` (ระบบยืม) มีสูตรเดียวกันของตัวเอง **แก้สูตรเทอมต้องแก้ 2 ที่**
