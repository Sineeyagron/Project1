# ระบบห้องคอม (R0–R3)

> อ่านเมื่อแก้งานฝั่งห้องคอม (ห้ามแตะ/ import ระบบยืม-คืน)

- โครง: 1 ห้อง → 6 กลุ่ม → คอม 9 เครื่อง (C1–C9) + Server LAN 12 port · ห้องอ่านจากตาราง `rooms` ผ่าน `lib/room/rooms.ts` (ห้ามเขียนรหัสห้องตายตัว)
- ไฟล์: `lib/room/` (`roomStatus` ชื่อ/สีสถานะ — ห้ามใช้ lib/status, `rooms`, `term`, `roomRealtime`, `roomPeople`), `components/room/` (`LoadError` โหลดพัง = แถบลองใหม่, `RoomReportForm`, `HeroChip`), หน้า stations/lanports/repairs/room/roomreports/inspection/roommap/lanstatus + การ์ดห้องใน `home.tsx`
- DB: `computer_stations` (status available|repair|broken, `active` — มีประวัติลบไม่ได้ → ปิดใช้งาน, ชื่อห้ามซ้ำในกลุ่ม), `lan_ports` (1–12 ห้ามซ้ำในกลุ่ม), `station_equipment` (mouse/keyboard/monitor), `equipment_inspections` (ไม่มี `created_at` ใช้ `inspected_at`), `repair_records` (ห้ามย้อนสถานะ, เปิดงาน → เครื่อง repair / ปิดงาน → available), `room_status_log` (trigger บันทึกเอง), `room_reports`
- TA: เปลี่ยนสถานะเครื่อง/LAN, เช็กลิสต์, ตรวจประจำเทอม, งานซ่อม (trigger กันแก้อย่างอื่น) · เพิ่ม/ลบ ห้อง/เครื่อง/port = admin
- นศ. แจ้งปัญหา: RPC `report_room_problem` (กันซ้ำ, 5 ครั้ง/วัน) → คิว `admin/roomreports` (`decide_room_report`) · แจ้งเตือนผ่าน `_room_notify_staff` ของระบบห้องเอง · `app/notifications.tsx` ใช้ร่วม — แตะได้เฉพาะส่วนระบบห้อง
- ผลตรวจประจำเทอมอัปเดตเช็กลิสต์อัตโนมัติ · `currentTerm()` (lib/room/term) ใช้ที่ `admin/inspection` — `admin/iotinspection` (ระบบยืม) มีสูตรเดียวกันของตัวเอง **แก้สูตรเทอมต้องแก้ 2 ที่**
