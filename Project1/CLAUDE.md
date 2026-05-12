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
5. Admin เพิ่มอุปกรณ์โดยสแกน Item → AI Gen รูป → ใส่รายละเอียด

---

## 🗄️ Supabase Tables

### ที่มีอยู่แล้ว
| Table | ใช้ทำอะไร |
|-------|-----------|
| `profiles` | เก็บ user info + role (user/admin) |
| `items` | รายการอุปกรณ์ IoT ที่ให้ยืม |
| `borrow_records` | ประวัติการยืม-คืน |

### ที่ต้องสร้างใหม่ (ยังไม่มี)
| Table | ใช้ทำอะไร |
|-------|-----------|
| `computer_stations` | เครื่องคอมแต่ละห้อง (room_id, name เช่น C01, group_no, status) |
| `room_bookings` | การจองห้อง (user_id, station_id, booking_date, time_slot 1-4, status) |

### ที่ต้องแก้ไข
- `items` — เพิ่มคอลัมน์ `image_url` (สำหรับรูป IoT ที่ AI gen)
- Supabase Storage — สร้าง bucket สำหรับรูปภาพอุปกรณ์

---

## 🕐 Room Booking — ข้อตกลง
- **Time Slot คงที่** 4 ช่วงต่อวัน:
  - Slot 1: 08:00–10:00
  - Slot 2: 10:00–12:00
  - Slot 3: 13:00–15:00
  - Slot 4: 15:00–17:00
- **จองปุ๊บได้เลย** ไม่ต้องรอ Admin อนุมัติ
- **หลายห้อง** รองรับ CP9524, SC9604 และห้องอื่นๆ

---

## 📊 สถานะปัจจุบัน (ณ 12 พ.ค. 2569)

### ✅ เสร็จแล้ว
- [x] Login / Signup / Forgot Password / Reset Password (Supabase Auth)
- [x] Equipment list (ดึงจาก Supabase)
- [x] ยืมอุปกรณ์ + filter by user
- [x] Admin Dashboard (สถิติ real-time)
- [x] Admin จัดการอุปกรณ์ (เพิ่ม/ลบ + foreign key guard)
- [x] Admin ยืนยันการคืน
- [x] Admin ประวัติการยืม (แสดง email user)
- [x] Logout (Supabase signOut)

### ⚠️ ทำไว้บางส่วน (UI อย่างเดียว / hardcode)
- [ ] Profile — ข้อมูลยัง hardcode ยังไม่ดึงจาก Supabase
- [ ] Home — rooms ยัง hardcode ยังไม่ดึงจาก DB
- [ ] editStatus — ข้อมูลยัง hardcode ยังไม่บันทึก DB

### ❌ ยังไม่ได้ทำ (return null / placeholder)
- [ ] Notifications
- [ ] Room Booking (ทั้งระบบ)
- [ ] Admin Scan → AI Gen รูป → เพิ่ม Item
- [ ] SC9604 room detail

---

## 🗺️ Roadmap — ลำดับงานที่แนะนำ

### Phase 0 — DB Foundation (ทำก่อนทุกอย่าง ~1-2 ชม.)
1. สร้างตาราง `computer_stations` + seed ข้อมูล C01-C12 ทุกห้อง
2. สร้างตาราง `room_bookings`
3. เพิ่ม `image_url` ใน `items`
4. สร้าง Supabase Storage bucket

### Phase 1 — Quick Fixes (~2-3 ชม.)
1. Profile → ดึงข้อมูลจริงจาก Supabase
2. Home → ดึงรายการห้องจาก `computer_stations`

### Phase 2 — ฟีเจอร์หลัก (แบ่งทำคู่ขนานได้ ~1-2 วัน)
**Lane A — Room Booking**
1. ผังห้อง Interactive (grid เครื่อง + สีสถานะ real-time)
2. Booking popup (เลือก slot + จองทันที)
3. My Bookings history

**Lane B — Admin Scan & Add Item**
1. สแกน Barcode (expo-camera)
2. AI Gen รูป IoT Device
3. กรอกรายละเอียด + upload รูป + บันทึก

### Phase 3 — Admin Extensions (~1 วัน)
1. Admin — ดูการจองห้องทั้งหมด
2. editStatus → เชื่อม `computer_stations` จริง
3. Admin Dashboard → เพิ่มสถิติ booking

### Phase 4 — Notifications & Polish (~1 วัน)
1. Notifications — feed กิจกรรมของ user
2. แสดงรูป IoT ใน Equipment & Borrow

---

## 📁 โครงสร้างไฟล์สำคัญ
```
app/
├── index.tsx          — หน้าแรก (landing)
├── login.tsx          — Login (✅ เสร็จ)
├── signup.tsx         — Signup (✅ เสร็จ)
├── forgot.tsx         — Forgot Password (✅ เสร็จ)
├── reset-password.tsx — Reset Password (✅ เสร็จ)
├── home.tsx           — หน้าหลัก user (⚠️ rooms hardcode)
├── equipment.tsx      — รายการอุปกรณ์ (✅ เสร็จ)
├── borrow.tsx         — ประวัติยืม user (✅ เสร็จ)
├── profile.tsx        — โปรไฟล์ (⚠️ hardcode)
├── sittings.tsx       — Settings + Logout (✅ เสร็จ)
├── notifications.tsx  — การแจ้งเตือน (❌ return null)
├── roommap.tsx        — ผังห้อง (⚠️ ยังไม่สมบูรณ์)
├── room/
│   ├── cp9524.tsx     — ห้อง CP9524 (⚠️ basic)
│   └── sc9604.tsx     — ห้อง SC9604 (❌ return null)
├── groups/
│   └── group1-6.tsx   — กลุ่มคอม (⚠️ hardcode)
└── admin/
    ├── home.tsx       — Admin Dashboard (✅ เสร็จ)
    ├── items.tsx      — จัดการอุปกรณ์ (✅ เสร็จ)
    ├── borrow.tsx     — ยืนยันคืน (✅ เสร็จ)
    ├── history.tsx    — ประวัติทั้งหมด (✅ เสร็จ)
    ├── scan.tsx       — สแกน Item (❌ placeholder)
    ├── room.tsx       — จัดการห้อง (❌ return null)
    └── status/
        └── editStatus.tsx — สถานะเครื่อง (⚠️ hardcode)

lib/
└── supabase.ts        — Supabase client
```
