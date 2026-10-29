# เพิ่ม / ถอด ผู้ดูแลระบบ (admin)

> ในแอปตั้งได้แค่ TA (`admin/users`) — admin ต้องตั้งจาก Supabase Dashboard เพื่อความปลอดภัย
> ใช้ได้ทั้งแอปมือถือและ PWA (บัญชีอยู่ที่ Supabase ที่เดียวกัน)

## เพิ่ม admin

**อาจารย์/บุคลากร @kku.ac.th**: ให้ล็อกอินด้วย Google ครั้งแรกก่อน (ระบบสร้างบัญชีเป็น user) แล้วรันข้อ 3 ด้วยอีเมลนั้น — ไม่ต้องทำข้อ 1, 2, 4, 5

**อีเมลอื่น (ไม่ใช่ @kkumail.com / @kku.ac.th)**:

1. **ปิด Auth Hook ชั่วคราว**: Dashboard → Authentication → Hooks → Before User Created → ปิด
   ระบบรับเฉพาะอีเมล มข. ถาวรแล้ว (`app_settings.allowed_email_domain` = `kkumail.com,kku.ac.th` — ไม่มีสวิตช์ในแอป) Hook `hook_restrict_signup_domain` จึงกันการสร้างบัญชีอีเมลอื่นทุกทาง รวมจาก Dashboard
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
4. **เปิด Auth Hook กลับ** (ห้ามลืม — หน้า login ยังกันอีเมลอื่นอยู่ แต่ถ้า Hook ปิด ด่านฝั่งเซิร์ฟเวอร์จะหายไป)
5. ให้ผู้ดูแลคนใหม่ล็อกอินด้วยอีเมล + รหัสผ่าน (ไม่ใช่ kkumail → หน้า login แสดงช่องรหัสผ่าน) แล้วเปลี่ยนรหัสเองที่ โปรไฟล์ → เปลี่ยนรหัสผ่าน

## ถอด admin

```sql
update public.profiles set role = 'user' where email = 'อีเมล';
```

## หมายเหตุ

- นักศึกษา: เข้าด้วย Google @kkumail.com เท่านั้น ครั้งแรกระบบสร้างบัญชีให้เอง
- TA: admin ตั้งในแอปที่ `admin/users` (user ↔ ta)
- ไม่มีหน้าสมัครสมาชิก / ลืมรหัสผ่านในแอป — ผู้ดูแลลืมรหัส: Dashboard → Authentication → Users → เลือกบัญชี → ตั้งรหัสใหม่
