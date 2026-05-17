# งานที่ต้องทำต่อ — จาก Code Review

> Review ทำเมื่อ 2026-05-17 หลังเสร็จ feature iotinspection + rename project

---

## 🔴 Critical — ต้องแก้ก่อน production

### 1. Security: เปิด RLS + ย้าย anon key ออกจาก repo
**ปัญหา:** `lib/supabase.js:4` hardcode anon key + push ขึ้น public GitHub แล้ว + RLS ปิดบน 4 ตาราง (`computer_stations`, `room_bookings`, `lan_ports`, `item_inspections`) → ใครก็ INSERT/UPDATE/DELETE ได้

**ต้องทำ:**
- [ ] Rotate anon key ใน Supabase Dashboard (Settings → API → Reset)
- [ ] สร้าง `.env` + ใช้ `process.env.EXPO_PUBLIC_SUPABASE_URL` และ `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] เปิด RLS ทุกตาราง + เขียน policy:
  - admin role → ทุก action
  - user role → SELECT เท่านั้น (ยกเว้น profiles ของตัวเอง)
- [ ] เพิ่ม `.env` ลง `.gitignore` (ถ้ายังไม่ได้เพิ่ม)

### 2. ลบ `lib/uploadSignature.ts` (dead abstraction)
**ปัญหา:** ชื่อ "upload" แต่แค่ `return svgString` ทำให้สับสน

**ต้องทำ:**
- [ ] ลบ `lib/uploadSignature.ts`
- [ ] แก้ `app/admin/borrowscan.tsx` + `returnscan.tsx` ให้เก็บ SVG ลง DB ตรงๆ (หรือ upload จริงถ้าจะใช้ Supabase Storage)

---

## 🟠 Important — กระทบ maintainability/UX

### 3. ลบ orphan files (ไฟล์ตายที่ไม่ได้ register)
- [ ] `app/groups/group1.tsx` ถึง `group6.tsx`
- [ ] `app/room/cp9524.tsx`, `app/room/sc9604.tsx`
- [ ] `app/admin/group/group1.tsx`, `app/admin/room/cp9524.tsx`
- [ ] `app/device/deviceList.tsx`
- [ ] `app/components/BorrowItem.tsx`, `app/components/RoomCard.tsx` (อยู่ผิด folder)
- [ ] `app/admin/borrow.tsx` (CLAUDE.md บอก "ไม่ได้ link")

### 4. เคลียร์ inspection 2 ระบบทับซ้อน
- [ ] ตัดสินใจว่า `equipment_inspections` (per station + 3 อุปกรณ์) กับ `item_inspections` (per item) จะแยกหน้าที่ยังไง
- [ ] อัปเดต CLAUDE.md ให้ระบุชัด

### 5. ทำ `<ResultModal />` reusable
**ปัญหา:** `login.tsx` + `signup.tsx` ใช้ `Alert.alert`, `reset-password.tsx` ใช้ custom Modal → UX ไม่ consistent

**ต้องทำ:**
- [ ] สร้าง `components/ResultModal.tsx` (copy pattern จาก reset-password.tsx)
- [ ] แทน `Alert.alert` ในทุกหน้า

### 6. แปลง `lib/supabase.js` → `.ts` + gen types
- [ ] `npx supabase gen types typescript --project-id enupmlxmajjwskvzgcdq > lib/database.types.ts`
- [ ] rename `supabase.js` → `supabase.ts`
- [ ] ใช้ `createClient<Database>(...)` เพื่อได้ type hints ทั่วโปรเจกต์

---

## 🟡 Code quality

- [ ] **Hardcoded room IDs** — `["CP9524", "SC9604"]` กระจายหลายไฟล์ → ทำ `useRooms()` hook ดึงจาก DB
- [ ] **TypeScript route safety** — เลิก `router.push(m.route as any)`; ใช้ literal union type (`typedRoutes: true` เปิดไว้แล้ว)
- [ ] **Role check duplication** — ทำ `useAdminGuard()` hook แทน copy-paste pattern
- [ ] **`select("*")` ไม่ limit** — เพิ่ม `.limit(50)` + pagination ที่ history, inspection
- [ ] **SVG ลายเซ็นใน DB column** — ย้ายไป Supabase Storage จริง เก็บแค่ URL

---

## 🟢 Nice-to-have

- [ ] เพิ่ม test (jest + react-native-testing-library) — เริ่มจาก login, borrow flow
- [ ] ขอ Sineeyagron rename GitHub repo: `Project1` → `iot-lab-management`
- [ ] ESLint strict rules + Prettier config
- [ ] CI/CD (GitHub Actions: type check + lint บน push)
- [ ] bump version ใน `app.json` + `package.json` เป็น `1.1.0`

---

## ✅ ที่ทำดีอยู่แล้ว (ไม่ต้องแก้)

- CLAUDE.md context ละเอียดมาก
- Borrow/return flow ครบ (scan + email autocomplete + due date + signature)
- Notification system + relative timestamp
- Image upload bug fix (BINARY_CONTENT) ใช้ได้แล้ว
- Auth flow + deep link recovery (2 layers)
- Scan fallback 3 ระดับ (barcode → UUID → JSON)
- UI consistency หน้า login/signup/reset-password (เพิ่งแก้)

---

## 🎯 ลำดับที่แนะนำ

1. **Security** (RLS + .env + rotate key) — 1-2 ชม. กันข้อมูลรั่ว
2. **ลบ orphan files** — 15 นาที ลดความรก
3. **`supabase.ts` + gen types** — 30 นาที ได้ type safety ทั้งโปรเจกต์
4. **`<ResultModal />` reusable** — 1 ชม. UX consistent
5. **Hardcoded rooms → DB-driven** — 30 นาที

ที่เหลือทำตามสะดวก
