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

## ✅ ขอบเขตฟีเจอร์ที่ต้องการ (Scope)
1. ระบบ Login / Auth (role: user / admin)
2. ยืม-คืนอุปกรณ์ IoT
3. ประวัติการยืม (History)
4. จองห้องใช้คอม (Room Booking)
5. Admin เพิ่มอุปกรณ์โดยสแกน QR → ถ่ายรูปจริง → ใส่รายละเอียด

---

## 🗄️ Supabase Tables

### ที่มีอยู่แล้ว (ครบทุกตาราง ✅)
| Table | ใช้ทำอะไร |
|-------|-----------|
| `profiles` | เก็บ user info + role (user/admin) |
| `items` | รายการอุปกรณ์ IoT ที่ให้ยืม + `image_url` + `description` |
| `borrow_records` | ประวัติการยืม-คืน |
| `computer_stations` | เครื่องคอมแต่ละห้อง (room_id, name, group_no, status) |
| `room_bookings` | การจองห้อง (user_id, station_id, booking_date, time_slot, status) |

### RLS
- `computer_stations` — **DISABLED** (ALTER TABLE ... DISABLE ROW LEVEL SECURITY)
- `room_bookings` — **DISABLED**

### Supabase Storage
- Bucket: **`item-images`** — สำหรับรูปภาพอุปกรณ์ (public)

### SQL ที่ต้องรัน (ถ้ายังไม่ได้รัน)
```sql
-- เพิ่ม description column ใน items
ALTER TABLE items ADD COLUMN IF NOT EXISTS description text;

-- UNIQUE INDEX ป้องกัน double booking
CREATE UNIQUE INDEX IF NOT EXISTS room_bookings_no_overlap
  ON room_bookings (station_id, booking_date, time_slot)
  WHERE status = 'active';
```

---

## 🕐 Room Booking — ข้อตกลง
- **Time Slot คงที่** 4 ช่วงต่อวัน:
  - Slot 1: 08:00–10:00
  - Slot 2: 10:00–12:00
  - Slot 3: 13:00–15:00
  - Slot 4: 15:00–17:00
- **จองปุ๊บได้เลย** ไม่ต้องรอ Admin อนุมัติ
- **หลายห้อง** รองรับ CP9524, SC9604 และห้องอื่นๆ (ดึงจาก computer_stations จริง)

---

## 🔑 QR Code System (Admin)
- **qrgen.tsx** — สร้าง QR encode JSON: `{"name":"ESP32","type":"Microcontroller","description":"..."}`
- **scan.tsx** — สแกน QR → auto-fill → ถ่ายรูปจริง → upload Storage → insert items
- QR API: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=...`
- expo-file-system: ต้อง `import * as FileSystem from "expo-file-system"` แล้ว cast `as any` เพราะ type ไม่ export `documentDirectory`

---

## 📊 สถานะปัจจุบัน (ณ 12 พ.ค. 2569)

### ✅ เสร็จแล้ว (พร้อมใช้งาน)
- [x] Login / Signup / Forgot Password / Reset Password (Supabase Auth)
- [x] Home — ดึงรายการห้องจาก `computer_stations` จริง
- [x] Equipment list — แสดงรูป image_url, search filter, badge สถานะ
- [x] ยืมอุปกรณ์ + ยืนยันก่อนยืม
- [x] Profile — ดึงข้อมูลจริงจาก Supabase (email, จำนวนยืม, ประวัติ)
- [x] Borrow history — 2 แท็บ (ยืมอุปกรณ์ + จองห้อง) + ยกเลิกจองได้
- [x] Notifications — feed รวม (ยืม + จอง) pull-to-refresh
- [x] Room Booking (roommap.tsx) — ผังห้อง real-time, เลือกวัน 7 วัน, จองทันที
- [x] Admin Dashboard — สถิติอุปกรณ์ + สถิติการจอง + เมนู 7 ปุ่ม
- [x] Admin จัดการอุปกรณ์ (เพิ่ม/ลบ + foreign key guard)
- [x] Admin ยืนยันการคืน
- [x] Admin ประวัติการยืม (แสดง email user)
- [x] Admin การจองห้อง (booking.tsx) — filter วันนี้/ล่วงหน้า/ทั้งหมด, ยกเลิกได้
- [x] Admin สถานะเครื่อง (editStatus.tsx) — ดึงจาก Supabase จริง, toggle available/repair
- [x] Admin QR Generator (qrgen.tsx) — สร้าง QR + บันทึกลง Gallery
- [x] Admin Scan & Add Item (scan.tsx) — 3 step: สแกน → รายละเอียด → บันทึก
- [x] Logout (Supabase signOut)

### ❌ ยังไม่ได้ทำ
- [ ] room/sc9604.tsx — ยัง return null (ถ้าต้องการหน้า detail แยก)
- [ ] admin/room.tsx — ยัง return null
- [ ] รูป IoT ใน borrow list (แสดงแค่ icon อยู่)

---

## 📁 โครงสร้างไฟล์สำคัญ
```
app/
├── index.tsx          — หน้าแรก (landing)
├── login.tsx          — Login ✅
├── signup.tsx         — Signup ✅
├── forgot.tsx         — Forgot Password ✅
├── reset-password.tsx — Reset Password ✅
├── home.tsx           — หน้าหลัก user ✅ (ดึงห้องจาก DB)
├── equipment.tsx      — รายการอุปกรณ์ ✅ (แสดงรูป + search)
├── borrow.tsx         — ประวัติยืม + จองห้อง ✅
├── profile.tsx        — โปรไฟล์ ✅ (ดึงจาก Supabase)
├── sittings.tsx       — Settings + Logout ✅
├── notifications.tsx  — การแจ้งเตือน ✅ (feed รวม)
├── roommap.tsx        — ผังห้อง + จอง ✅
├── room/
│   ├── cp9524.tsx     — ห้อง CP9524 ⚠️
│   └── sc9604.tsx     — ห้อง SC9604 ❌ return null
├── groups/
│   └── group1-6.tsx   — กลุ่มคอม ⚠️
└── admin/
    ├── home.tsx       — Admin Dashboard ✅ (สถิติ + เมนู)
    ├── items.tsx      — จัดการอุปกรณ์ ✅
    ├── borrow.tsx     — ยืนยันคืน ✅
    ├── history.tsx    — ประวัติทั้งหมด ✅
    ├── booking.tsx    — การจองห้อง ✅
    ├── scan.tsx       — สแกน QR & เพิ่ม Item ✅
    ├── qrgen.tsx      — สร้าง QR Code ✅
    ├── room.tsx       — จัดการห้อง ❌ return null
    └── status/
        └── editStatus.tsx — สถานะเครื่อง ✅ (เชื่อม DB จริง)

lib/
└── supabase.ts        — Supabase client
```

---

## ⚠️ หมายเหตุ / Known Issues
- `expo-file-system` — ต้อง cast `as any` เพื่อใช้ `documentDirectory` และ `downloadAsync` (type definition ไม่ export ตรงๆ)
- Expo LAN mode: ถ้า timeout ให้เปิด firewall port 8081 ด้วย `netsh advfirewall firewall add rule name="Expo Metro" dir=in action=allow protocol=TCP localport=8081`
- ถ้าเห็น UI เก่าค้างอยู่ให้รัน `npx expo start --clear`
