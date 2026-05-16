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

### RLS — DISABLED สำหรับ:
- `computer_stations`, `room_bookings`, `lan_ports`

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

## 🔄 Borrow Flow

### ยืม (Admin ทำ):
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

## 📊 สถานะปัจจุบัน (อัปเดต 16 พ.ค. 2569 — session 2)

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
└── uploadSignature.ts   — helper upload SVG ลายเซ็น → Supabase Storage

components/
└── SignatureCanvas.tsx   — reusable signature pad (PanResponder + react-native-svg)
```

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
