# LabHub (IoT Lab Management) — ภาพรวมระบบ

> อัปเดต 4 ต.ค. 2569 · branch `Addfeature` (PR #3 → `main` รอทีมตรวจ)
> เอกสารนี้ไว้ให้ AI/ทีมใช้วางแผนงานต่อ โดยเฉพาะ **ส่วนห้องเรียน (ระบบห้องคอม)** ซึ่งยังไม่ได้ปรับปรุง
> เขียนใหม่จากฐานข้อมูลและโค้ดจริง ณ วันที่ข้างบน — **ถ้าขัดกับ `CLAUDE.md` ให้ยึดเอกสารนี้** (`CLAUDE.md` ช่วงท้ายมีข้อมูลรุ่นเก่า)

---

## 1. ภาพรวม

แอปจัดการห้องแล็บ IoT มหาวิทยาลัยขอนแก่น มี 2 ระบบใหญ่ในแอปเดียว

| ระบบ | สถานะ | ขอบเขต |
|---|---|---|
| **ยืม-คืนอุปกรณ์** | ✅ ปรับปรุงเสร็จแล้ว (เฟส 1–5) | อุปกรณ์ IoT, รหัส/QR, คำขอยืม-คืน, TA, รายงาน |
| **ห้องเรียน / ห้องคอม** | ⏳ ยังเป็นโค้ดรุ่นเดิม (ยังไม่ได้แตะ) | เครื่องคอมแต่ละห้อง, LAN port, ตรวจอุปกรณ์ประจำเทอม, แจ้งซ่อม |

**Tech stack**
- Expo SDK 57 + expo-router 57 (file-based routing) + React Native 0.86 + TypeScript, React Compiler เปิดอยู่
- Supabase (Postgres 17, Auth, Storage, Realtime, pg_cron, pg_net) — โปรเจกต์ `borrow-app` (`enupmlxmajjwskvzgcdq`), **แพ็กเกจฟรี**
- ทดสอบบน iPhone ผ่าน **Expo Go** + เว็บ (`npx expo start --web`)
- ภาษาในแอป: ไทยทั้งหมด

**ข้อจำกัดสำคัญ**
- แพ็กเกจฟรี: RAM น้อย (Swap ตลอด) → Supabase เตือน Disk IO บ่อย → ออกแบบให้ **ไม่ polling ถี่** ใช้ Realtime แทน
- Expo Go: ไม่มี push notification / ไม่มี native module นอกชุด Expo
- iOS แจกแอปจริง (TestFlight) ต้องมี Apple Developer $99/ปี — ยังไม่ได้ตัดสินใจ

---

## 2. บทบาทและการล็อกอิน

| บทบาท (`profiles.role`) | ทำอะไรได้ |
|---|---|
| `user` (นักศึกษา) | ดูอุปกรณ์/ห้อง, สแกน QR ขอยืม-คืน, ดูการยืมของตัวเอง |
| `ta` (ผู้ช่วย) | อนุมัติ/ปฏิเสธคำขอ, ตรวจสภาพ, ดูรายงาน, พิมพ์ QR — **แก้ข้อมูลอุปกรณ์/ตั้งค่า/ระบบห้องไม่ได้** |
| `admin` | ทุกอย่าง |

- ล็อกอิน: อีเมล+รหัสผ่าน หรือ **Google** (มีสวิตช์ "รับเฉพาะ @kkumail.com" ปิดไว้ช่วงพัฒนา เปิดตอน Final)
- รหัสผ่าน: ≥ 8 ตัว มีตัวอักษร+ตัวเลข (ตั้งใน Supabase + `lib/password.ts`)
- แต่งตั้ง TA: หน้า `admin/users` → RPC `set_user_role` (admin เท่านั้น, user↔ta)
- สิทธิ์จริงอยู่ที่ **RLS + RPC ในฐานข้อมูล** แอปแค่ซ่อน/กันหน้า (`lib/roles.ts`)
  - `is_admin()` / `is_staff()` (admin+ta) ใช้ใน policy
  - TA เข้าหน้า `/admin/*` ได้เฉพาะ `TA_ROUTES` ใน `lib/roles.ts` — **หน้าระบบห้องทั้งหมดตอนนี้เป็น admin เท่านั้น**

---

## 3. โครงหน้า (expo-router)

```
app/
├── _layout.tsx        ด่านล็อกอินหน้านักศึกษา + deep link + DialogHost
├── index.tsx          → /admin/home (ด่าน admin พาไปหน้าตามบทบาท)
├── login / signup / forgot / reset-password   (หน้าสาธารณะ)
│
├── home.tsx           🏠 หน้าแรกนักศึกษา = "ห้องเรียน IoT" (การ์ดห้อง + ทางลัด)   ← ระบบห้อง
├── roommap.tsx        ผังห้อง กดเครื่องดูสถานะ / Server ดู LAN                   ← ระบบห้อง
├── lanstatus.tsx      สถานะ LAN port แยกห้อง/กลุ่ม                                ← ระบบห้อง
├── equipment.tsx      รายการอุปกรณ์ IoT (นักศึกษา)                                ← ยืม-คืน
├── scan.tsx           สแกน QR ขอยืม/คืน/ยืมต่อ                                     ← ยืม-คืน
├── borrow.tsx         การยืมของฉัน + คำขอที่รอ                                     ← ยืม-คืน
├── notifications.tsx  แจ้งเตือน (ทุกบทบาท)                                          ← ใช้ร่วม
├── profile.tsx, sittings.tsx                                                        ← ใช้ร่วม
│
└── admin/
    ├── _layout.tsx    ด่าน admin/TA + RoleContext
    ├── home.tsx       แดชบอร์ด (สถิติอุปกรณ์ + กิจกรรมล่าสุดรวม repair_records)   ← ใช้ร่วม
    ├── room.tsx       ภาพรวมห้อง + ทางลัด                                          ← ระบบห้อง
    ├── stations.tsx   จัดการเครื่องคอม (เพิ่ม/ลบ/แก้/สถานะ)                        ← ระบบห้อง
    ├── lanports.tsx   จัดการ LAN port                                              ← ระบบห้อง
    ├── inspection.tsx ตรวจอุปกรณ์ประจำเทอม (mouse/keyboard/monitor ต่อเครื่อง)    ← ระบบห้อง
    ├── repairs.tsx    แจ้งซ่อม/ติดตาม pending → in-repair → done                   ← ระบบห้อง
    ├── status/editStatus.tsx  สลับสถานะเครื่อง (ไม่มีหน้าไหนลิงก์ไป)              ← ระบบห้อง
    ├── group/group1.tsx, room/cp9524.tsx   ไฟล์ร้าง (ไม่มีลิงก์)                  ← ระบบห้อง
    └── items, scan, import, categories, qrgen, requests, lookup, stock, report,
        history, iotinspection, settings, users                                    ← ยืม-คืน
app/groups/group1–6.tsx, app/room/cp9524.tsx, sc9604.tsx    ไฟล์ร้างระบบห้อง (ไม่มีลิงก์)
```

---

## 4. ระบบห้องเรียน — สภาพปัจจุบัน (สิ่งที่ต้องวางแผน)

### 4.1 โครงห้อง (ตามการออกแบบเดิม)
- มี 2 ห้อง: **CP9524** (อาคารคอมพิวเตอร์ ชั้น 5), **SC9604** (อาคารวิทยาศาสตร์ ชั้น 6)
- 1 ห้อง = 6 กลุ่ม, 1 กลุ่ม = คอม 9 เครื่อง (C1–C9) + Server 1 เครื่อง
- Server มี LAN 12 port ต่อกลุ่ม
- ทุกเครื่องมี checklist: mouse / keyboard / monitor
- เทียบกับข้อมูลจริง (4 ต.ค. 2569): LAN 144 = 2×6×12 ✅, checklist 321 = 107×3 ✅ แต่ **เครื่องคอมมี 107 เครื่อง ตามแบบควรเป็น 108** (2×6×9) — ขาด 1 เครื่อง ต้องเช็ก

### 4.2 ตารางในฐานข้อมูล
| ตาราง | คอลัมน์หลัก | ข้อมูลตอนนี้ |
|---|---|---|
| `computer_stations` | id, **room_id (text)**, name, group_no, status, created_at | 107 แถว (CP9524, SC9604) |
| `station_equipment` | id, station_id, equipment_type, status (present/missing/broken), updated_at, updated_by | 321 แถว (present ทั้งหมด) |
| `lan_ports` | id, **room_id (text)**, group_no, port_no, label, status (available/repair/broken) | 144 แถว |
| `equipment_inspections` | id, term, station_id, inspector_id, equipment_type, condition, notes, last_borrower_id, inspected_at | 24 แถว (เทอม 1/2568, 1/2569) |
| `repair_records` | id, station_id, item_id, description, status (pending/in-repair/done), reported_by, repaired_by, reported_at, repaired_at, notes | 1 แถว |
| `room_bookings` | id, user_id, station_id, booking_date, time_slot, status | 0 แถว — **ระบบจองห้องถูกเอาออกแล้ว** ตารางยังอยู่ |

**RLS (เปิดครบแล้ว):** ทุกคนที่ล็อกอินอ่าน `computer_stations`, `station_equipment`, `lan_ports` ได้ / เขียนได้เฉพาะ admin / `equipment_inspections`, `repair_records`, `room_bookings` = admin เท่านั้น

### 4.3 ปัญหา/หนี้เทคนิคที่เห็นแล้ว
1. **ไม่มีตาราง "ห้อง"** — ห้องเป็นแค่ข้อความ `room_id` ใน `computer_stations`/`lan_ports`
   - ชื่ออาคาร/ชั้น เขียนตายตัวใน `app/home.tsx` (`/9524/` → "อาคารคอมพิวเตอร์ ชั้น 5")
   - รหัสห้อง `"CP9524"`, `"SC9604"` เขียนตายตัวหลายไฟล์ (stations ×2, repairs ×4, room, inspection, roommap, editStatus)
   - เพิ่มห้องใหม่ = ต้องแก้โค้ด
2. **ยังไม่ใช้รูปแบบกลางของแอป** (ที่ระบบยืม-คืนใช้แล้ว):
   - ปุ่ม ← ใช้ `router.replace("/admin/home")` ตายตัว (ควรใช้ `goBack()` ใน `lib/nav.ts`)
   - ป๊อปอัปใช้ `Alert.alert` ซึ่ง **ไม่ทำงานบนเว็บ** (stations 6, lanports 5, repairs 5, inspection 4 จุด) ควรใช้ `notify`/`confirmAction` ใน `lib/notify`
   - ใช้ `auth.getUser()` (ยิงเซิร์ฟเวอร์ทุกครั้ง) ควรใช้ `currentUser()` ใน `lib/session.ts`
3. **TA เข้าระบบห้องไม่ได้เลย** — ต้องตัดสินใจว่า TA ควรทำอะไรได้ (เช่น แจ้งซ่อม, ตรวจประจำเทอม)
4. **ตรวจอุปกรณ์ 2 ระบบทับซ้อน:** `equipment_inspections` (ต่อเครื่องคอม, ระบบห้อง) กับ `item_inspections` (ต่ออุปกรณ์ IoT, ระบบยืม-คืน) — แยกหน้าที่ให้ชัด
5. **`repair_records` มีทั้ง `station_id` และ `item_id`** — ตอนนี้ใช้กับเครื่องคอมเป็นหลัก ส่วนระบบยืม-คืนใช้สถานะ `items.status = 'repair'` แทน → ควรตัดสินใจว่าจะรวมหรือแยก
6. ไฟล์ร้าง: `app/groups/*`, `app/room/*`, `app/admin/group/*`, `app/admin/room/*`, `admin/status/editStatus.tsx` (ไม่มีลิงก์) + ตาราง `room_bookings` (ไม่ใช้)
7. หน้าแรกนักศึกษา (`home.tsx`) = หน้าห้องเรียน แต่แถบเมนูล่างเรียก "ชั้นเรียน" (ชื่อไม่ตรงกัน)
8. **แยกขาดจากห้องยืมของ:** ระบบยืม-คืนมีตาราง `borrow_locations` ("IoT Lab" ห้องเดียว) **ห้ามใช้ร่วม** กับห้องคอม (ตัดสินใจไว้แล้ว)

---

## 5. ระบบยืม-คืน (เสร็จแล้ว — สรุปสั้น ไว้เป็นตัวอย่างรูปแบบ)

- `items`: 1 แถว = 1 ชิ้น, รหัสเรียก `item_code` (เช่น `NodeMCU 001`, ไม่นำเลขกลับมาใช้) + `barcode` 4 ตัว (ค่าใน QR), สถานะ available/reserved/borrowed/repair/retired, หมวด `categories`, ประกัน, จำหน่ายออก
- Flow: นักศึกษาสแกน QR → ถ่ายรูปสด + ตรวจสภาพ → `request_borrow` / `request_return` / `request_renew` (RPC) → ของถูกกัน → admin/TA ตัดสินใน `admin/requests` (`decide_request`) → แจ้งเตือน
- กติกาทั้งหมดอยู่ใน **RPC security definer + ล็อกแถว** (`supabase/migrations/2026100310*_phase3_rpc.sql`) แอปเรียกอย่างเดียว
- pg_cron: เคลียร์คำขอหมดเวลา (ทุก 5 นาที), เตือนครบกำหนด + เตือนประกัน/อายุ (08:00), ลบ log cron เก่า
- รายงาน: `admin/stock` (สต็อก), `admin/report` (ยืม-คืนตามช่วง ส่งออก CSV/PDF)
- นำเข้า CSV: `admin/import` (ตรวจ+พรีวิว+กันพลาด ใน `lib/importItems.ts`)

---

## 6. รูปแบบกลางที่ต้องใช้ (สำหรับงานใหม่ทุกชิ้น)

| เรื่อง | ใช้อะไร |
|---|---|
| ปุ่ม ← | `goBack(fallback)` — `lib/nav.ts` |
| แถบเมนูล่างนักศึกษา | `goTab(target, current)` |
| โหลดใหม่ตอนกลับมาหน้า | `useRefreshOnFocus(load)` |
| ป๊อปอัป/ยืนยัน | `notify()`, `confirmAction()` — `lib/notify.tsx` (ห้าม `Alert.alert`) |
| user ปัจจุบัน | `currentUser()` — `lib/session.ts` (ห้าม `auth.getUser()` ในงานที่เรียกบ่อย) |
| สิทธิ์หน้า | `canAccess()`, `useRole()` — `lib/roles.ts` |
| ชื่อ/สีสถานะ | `lib/status.ts` (ห้ามตั้งเองในหน้า) |
| อัปเดตสด | Realtime Broadcast — `useRealtime(scope, event, cb)` ใน `lib/realtime.ts` + trigger `realtime.send` ในฐานข้อมูล (ห้าม polling ถี่) |
| ส่งออกไฟล์ | `exportCsv()`, `exportPdf()` — `lib/fileExport.ts` |
| วันที่/อายุ/ประกัน | `lib/itemInfo.ts` |

**ฐานข้อมูล**
- ทุกการเปลี่ยนแปลง = ไฟล์ใน `supabase/migrations/` + **ให้เจ้าของโปรเจกต์อนุมัติ SQL ก่อนรัน** + ทดลองแบบ `begin … rollback` ก่อน
- โปรเจกต์มี event trigger `ensure_rls` เปิด RLS ให้ตารางใหม่อัตโนมัติ → **ต้องเขียน policy ในไฟล์เดียวกัน** ไม่งั้นแอปอ่าน/เขียนไม่ได้
- กติกาธุรกิจสำคัญ → RPC (security definer) ไม่ใช่ให้แอปเขียนตารางตรง

**UI**
- ตอนนี้โฟกัสการใช้งานก่อน ความสวยไว้รอบ UI (ใช้ skill `ui-ux-pro-max`) — มีรายการรอแก้หน้าตาอยู่แล้ว

---

## 7. คำถามที่ต้องตอบก่อนวางแผนระบบห้อง

1. ทำตาราง `rooms` (ชื่อ, อาคาร, ชั้น, จำนวนกลุ่ม/เครื่อง) เพื่อเลิกเขียนรหัสห้องตายตัวไหม? ห้องจะเพิ่มในอนาคตไหม?
2. นักศึกษาใช้ระบบห้องทำอะไร — แค่ดูสถานะเครื่อง/LAN หรือแจ้งปัญหาเครื่องได้ด้วย?
3. TA ทำอะไรในระบบห้องได้บ้าง (แจ้งซ่อม? ตรวจประจำเทอม? เปลี่ยนสถานะเครื่อง?)
4. แจ้งซ่อม: ใครแจ้งได้, ต้องมีรูปไหม, แจ้งเตือนใคร (ใช้ระบบแจ้งเตือน + Realtime เดิมได้)
5. ตรวจประจำเทอม: รวมกับ `item_inspections` ของระบบยืม-คืน หรือแยกต่อ?
6. ระบบจองห้อง (`room_bookings`) — ลบทิ้ง หรือจะกลับมาทำ?
7. ไฟล์ร้างระบบห้อง — ลบได้เลยไหม (ต้องให้เจ้าของระบบห้องยืนยัน)
8. LAN port: ต้องมีประวัติการเปลี่ยนสถานะ/ผู้แก้ไขไหม?

---

## 8. ไฟล์อ้างอิงในโปรเจกต์
- `iot-lab-management/CLAUDE.md` — บันทึกละเอียดทุกเฟส (บางส่วนตอนท้ายเป็นข้อมูลรุ่นเก่า พ.ค. 2569)
- `iot-lab-management/TODO_for_claudecode.md` — รายการจาก code review เดิม
- `iot-lab-management/supabase/migrations/` — SQL ทุกการเปลี่ยนแปลง (เรียงตามเวลา)
- แผนระบบยืมของ: `PLAN_ระบบยืมของ.md` (อยู่นอก repo)
