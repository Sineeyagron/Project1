# งานที่ต้องทำต่อ (สำหรับ Claude Code)

## บริบทโปรเจกต์
IoT Lab Management App — React Native + Expo + Supabase + TypeScript
ดูรายละเอียดเต็มได้ใน `CLAUDE.md`

---

## สิ่งที่ต้องทำ

### 1. รัน SQL ใน Supabase
สร้างตาราง `item_inspections` สำหรับบันทึกผลตรวจสภาพอุปกรณ์ IoT ประจำเทอม:

```sql
CREATE TABLE IF NOT EXISTS item_inspections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  term text NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  condition text DEFAULT 'good' CHECK (condition IN ('good','damaged','missing')),
  notes text,
  inspector_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  inspected_at timestamptz DEFAULT now()
);
```

---

### 2. แก้ไข `app/admin/inspection.tsx`
ลบส่วน borrow history ที่เพิ่งเพิ่มเข้ามาออกทั้งหมด ได้แก่:
- state `borrowHistory` และ `setBorrowHistory`
- โค้ด fetch borrow_records ใน `fetchInspections()`
- UI section "ประวัติผู้ยืมก่อนเกิดความเสียหาย"
- styles ที่ขึ้นต้นด้วย `history` ทุกตัว

หน้านี้ให้คงไว้เฉพาะการตรวจ **จอ/เมาส์/คีย์บอร์ดประจำเครื่องคอม** เท่านั้น

---

### 3. สร้างหน้าใหม่ `app/admin/iotinspection.tsx`
หน้าตรวจสภาพอุปกรณ์ IoT ประจำเทอม มี feature ดังนี้:

**UI หลัก:**
- input ระบุเทอม (เช่น 1/2568) + ปุ่มค้นหา
- แสดงรายการ items ทั้งหมดจากตาราง `items`
- แต่ละ item กดเพื่อบันทึกผลตรวจ: ปกติ / ชำรุด / หาย + หมายเหตุ
- ใช้ upsert (term + item_id) กันบันทึกซ้ำ

**ส่วนสรุปปัญหา:**
- แสดงรายการ item ที่มีสถานะ damaged/missing ในเทอมนั้น
- ใต้แต่ละ item ที่มีปัญหา ให้แสดง **ประวัติผู้ยืม** item นั้น (query จาก `borrow_records` join `profiles` และ `items` เรียงตาม created_at DESC limit 5) เพื่อดูว่าใครยืมก่อนของพัง

**Style:** ใช้ theme สีม่วง `#7c3aed` เหมือนหน้าอื่นในแอป

---

### 4. เพิ่ม Navigation
- `app/admin/home.tsx` — เพิ่มปุ่ม/เมนูไปหน้า `iotinspection` (ชื่อปุ่ม: "ตรวจสภาพ IoT")
- `app/_layout.tsx` — ลงทะเบียน route `admin/iotinspection`

---

## สรุปความสัมพันธ์ระหว่างบรีฟกับหน้าต่างๆ

| บรีฟอาจารย์ | หน้าที่รับผิดชอบ |
|---|---|
| ข้อ 1: ยืม-คืนอุปกรณ์ | `admin/borrowscan.tsx`, `admin/returnscan.tsx` ✅ |
| ข้อ 2: ผังห้อง | `roommap.tsx` ✅ |
| ข้อ 3: อุปกรณ์แต่ละเครื่อง (จอ/เมาส์/คีย์บอร์ด) | `admin/inspection.tsx` ✅ |
| ข้อ 4: ตรวจสภาพ IoT ประจำเทอม + ประวัติผู้ยืม | `admin/iotinspection.tsx` ← **ต้องสร้างใหม่** |
| ข้อ 5: ซ่อมบำรุง | `admin/repairs.tsx` ✅ |
