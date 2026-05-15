# 📱 Project: IoT Equipment & Room Booking System

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

---

## 🗄️ Supabase Tables (ครบทุกตาราง ✅)

| Table | ใช้ทำอะไร |
|-------|-----------|
| `profiles` | user info + role (user/admin) + email |
| `items` | อุปกรณ์ IoT + `image_url` + `description` + `barcode` |
| `borrow_records` | ประวัติยืม-คืน + `due_date` (วันครบกำหนด) |
| `computer_stations` | เครื่องคอมแต่ละห้อง (room_id, name, group_no, status) |
| `room_bookings` | การจองห้อง (user_id, station_id, booking_date, time_slot, status) |
| `lan_ports` | LAN port ของ server แต่ละกลุ่ม (room_id, group_no, port_no, label, status) |

### RLS — DISABLED สำหรับ:
- `computer_stations`, `room_bookings`, `lan_ports`

### Supabase Storage
- Bucket: **`item-images`** — รูปอุปกรณ์ (public)

---

## 📐 โครงสร้างห้อง
- 1 ห้อง → 6 กลุ่ม
- 1 กลุ่ม → คอม 6 เครื่อง + Server 1 เครื่อง
- Server มี LAN Port 12 ช่อง (สถานะ: available / repair / broken)
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

-- 4. สร้างตาราง lan_ports
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

-- 5. Seed lan_ports
INSERT INTO lan_ports (room_id, group_no, port_no, status)
SELECT room, g, p, 'available'
FROM (VALUES ('CP9524'), ('SC9604')) AS rooms(room),
  generate_series(1,6) g, generate_series(1,12) p
ON CONFLICT DO NOTHING;

-- 6. UNIQUE INDEX ป้องกัน double booking
CREATE UNIQUE INDEX IF NOT EXISTS room_bookings_no_overlap
  ON room_bookings (station_id, booking_date, time_slot)
  WHERE status = 'active';
```

---

## 🕐 Room Booking — ข้อตกลง
- Time Slot คงที่ 4 ช่วง/วัน: 08:00–10:00, 10:00–12:00, 13:00–15:00, 15:00–17:00
- Admin เป็นคนจัดการการจอง (user ดูสถานะอย่างเดียว)

---

## 🔄 Borrow Flow (ใหม่)

### ยืม (Admin ทำ):
1. Admin กด "สแกนยืม" ใน `admin/borrowscan.tsx`
2. สแกน Barcode บน item → ขึ้นชื่อ + รูป + สถานะ
3. พิมพ์ email user (มี autocomplete จาก profiles)
4. กำหนดวันคืน (preset: 1/3/7 วัน หรือเลือกเอง)
5. กดยืนยัน → insert borrow_records + update items.status = "borrowed"

### คืน (Admin ทำ):
1. Admin กด "สแกนคืน" ใน `admin/returnscan.tsx`
2. สแกน Barcode บน item → ขึ้นชื่อ user + วันยืม + วันครบกำหนด
3. กดยืนยันรับคืน → update borrow_records.status = "returned" + items.status = "available"

---

## 📊 สถานะปัจจุบัน (อัปเดต 14 พ.ค. 2569)

### ✅ เสร็จแล้ว
- [x] Login / Signup (แก้บัค upsert + ตาดูรหัสผ่าน) / Forgot / Reset Password
- [x] Home — ดึงห้องจาก DB + ปุ่ม LAN Status
- [x] Equipment — ดูสถานะอุปกรณ์ + search (view-only)
- [x] Roommap — ผังห้อง view-only + Server port per group
- [x] LAN Status (user) — ดูสถานะ port แยกห้อง/กลุ่ม
- [x] Notifications — feed รวม (ยืม + จอง)
- [x] Profile — ดึงข้อมูลจริงจาก Supabase
- [x] Borrow history — 2 แท็บ (ยืม + จองห้อง)
- [x] Admin Dashboard — สถิติ + เมนู 8 ปุ่ม
- [x] Admin จัดการอุปกรณ์ (เพิ่ม/ลบ)
- [x] Admin ยืนยันการคืน (เดิม — รอเปลี่ยนเป็น scan flow ใหม่)
- [x] Admin ประวัติการยืม
- [x] Admin การจองห้อง
- [x] Admin สถานะเครื่องคอม (toggle available/repair)
- [x] Admin QR Generator
- [x] Admin Scan & เพิ่ม Item (3 step)
- [x] Admin LAN Port (จัดการสถานะ port แยกห้อง/กลุ่ม)
- [x] Logout

### 🔲 ยังไม่ได้ทำ (เรียงลำดับความสำคัญ)

#### 🔴 สำคัญมาก
- [x] **admin/borrowscan.tsx** — สแกน barcode item + พิมพ์ email user + กำหนดวันคืน → ยืม ✅
- [x] **admin/returnscan.tsx** — สแกน barcode item → แสดงข้อมูล → ยืนยันคืน ✅
- [x] **admin/stations.tsx** — เพิ่ม/ลบ/แก้เครื่องคอมในห้อง (computer_stations) ผ่านแอป ✅

#### 🟡 ควรทำ
- [x] **admin/items.tsx** — เพิ่มช่อง barcode + type + รูป + search + stats ✅
- [x] รูป IoT ใน borrow list — แสดงรูปจริงจาก image_url ✅
- [x] แสดงวันครบกำหนด (due_date) ใน borrow history ของ user + overdue indicator ✅

#### 🟢 ทำทีหลังได้
- [x] **room/sc9604.tsx** — ไม่จำเป็น roommap.tsx รับ room_id param ได้อยู่แล้ว ✅
- [x] **admin/room.tsx** — Room overview: สถิติแต่ละห้อง + การจองวันนี้ + quick links ✅

---

## 📁 โครงสร้างไฟล์สำคัญ
```
app/
├── index.tsx            — Landing
├── login.tsx            — ✅ (ตาดูรหัสผ่าน)
├── signup.tsx           — ✅ (แก้บัค + ตาดูรหัสผ่าน)
├── forgot.tsx           — ✅
├── reset-password.tsx   — ✅
├── home.tsx             — ✅ (ห้องจาก DB + ลิงก์ LAN)
├── equipment.tsx        — ✅ (view-only + search + รูป)
├── borrow.tsx           — ✅ (2 แท็บ)
├── profile.tsx          — ✅ (ดึงจาก Supabase)
├── sittings.tsx         — ✅
├── notifications.tsx    — ✅
├── roommap.tsx          — ✅ (view-only + server port)
├── lanstatus.tsx        — ✅ (แยกห้อง/กลุ่ม)
└── admin/
    ├── home.tsx         — ✅ (สถิติ + 8 เมนู)
    ├── items.tsx        — ✅
    ├── borrow.tsx       — ✅ (ยืนยันคืน เดิม)
    ├── history.tsx      — ✅
    ├── booking.tsx      — ✅
    ├── scan.tsx         — ✅ (QR scan + เพิ่ม item)
    ├── qrgen.tsx        — ✅
    ├── lanports.tsx     — ✅ (จัดการ port แยกห้อง/กลุ่ม)
    ├── borrowscan.tsx   — ✅ (สแกนยืม: barcode/UUID/JSON → email autocomplete → due date)
    ├── returnscan.tsx   — ✅ (สแกนคืน: barcode/UUID/JSON → ยืนยันคืน + overdue detect)
    ├── stations.tsx     — ✅ (จัดการเครื่องคอม: เพิ่ม/ลบ/แก้/toggle status)
    ├── room.tsx         — ✅ (Room overview: สถิติแต่ละห้อง + จองวันนี้ + quick links)
    └── status/
        └── editStatus.tsx — ✅

lib/
└── supabase.ts
```

---

## ⚠️ Known Issues / หมายเหตุ
- `expo-file-system` — ต้อง `import * as FileSystem from "expo-file-system"` แล้ว cast `as any` (type ไม่ export `documentDirectory`)
- Expo LAN mode timeout → เปิด firewall: `netsh advfirewall firewall add rule name="Expo Metro" dir=in action=allow protocol=TCP localport=8081`
- UI เก่าค้าง → `npx expo start --clear`
- Supabase Signup trigger อาจสร้าง profile อัตโนมัติ → ใช้ `upsert` แทน `insert` ใน signup.tsx แล้ว
