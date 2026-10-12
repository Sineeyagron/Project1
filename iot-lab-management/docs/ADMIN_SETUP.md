# เพิ่ม / ถอด ผู้ดูแลระบบ (admin)

> ในแอปตั้งได้แค่ TA (`admin/users`) — admin ต้องตั้งจาก Supabase Dashboard เพื่อความปลอดภัย
> ใช้ได้ทั้งแอปมือถือและ PWA (บัญชีอยู่ที่ Supabase ที่เดียวกัน)

## เพิ่ม admin (เช่น อาจารย์ที่ใช้อีเมล @kku.ac.th)

1. **ถ้าเปิดสวิตช์ "รับเฉพาะ @kkumail.com" อยู่ → ปิดชั่วคราวก่อน** (`admin/settings`)
   Auth Hook `hook_restrict_signup_domain` อ่านค่าจากสวิตช์นี้ — เปิดอยู่ = สร้างบัญชีที่ไม่ใช่ @kkumail.com ไม่ได้ (รวมจาก Dashboard)
2. **สร้างบัญชี**: Supabase Dashboard → Authentication → Users → **Add user → Create new user**
   - อีเมล + รหัสผ่านชั่วคราว (8 ตัวขึ้นไป มีตัวอักษรและตัวเลข)
   - ติ๊ก **Auto Confirm User**
3. **ตั้งเป็น admin**: Dashboard → SQL Editor
   ```sql
   update public.profiles
   set role = 'admin', full_name = 'ชื่อ-นามสกุล'
   where email = 'อีเมลที่สร้าง';
   ```
   ต้องได้ `UPDATE 1` · **ต้องทำก่อนล็อกอินครั้งแรก** (ไม่งั้นระบบถือเป็นนักศึกษา → บังคับใส่รหัสนักศึกษา)
4. **เปิดสวิตช์กลับ** (ถ้าปิดไว้ในข้อ 1)
5. ให้ผู้ดูแลคนใหม่ล็อกอินด้วยอีเมล + รหัสผ่าน (ไม่ใช่ kkumail → หน้า login แสดงช่องรหัสผ่าน) แล้วเปลี่ยนรหัสเองที่ โปรไฟล์ → เปลี่ยนรหัสผ่าน

## ถอด admin

```sql
update public.profiles set role = 'user' where email = 'อีเมล';
```

## หมายเหตุ

- นักศึกษา: เข้าด้วย Google @kkumail.com เท่านั้น ครั้งแรกระบบสร้างบัญชีให้เอง
- TA: admin ตั้งในแอปที่ `admin/users` (user ↔ ta)
- ไม่มีหน้าสมัครสมาชิก / ลืมรหัสผ่านในแอป — ผู้ดูแลลืมรหัส: Dashboard → Authentication → Users → เลือกบัญชี → ตั้งรหัสใหม่
