-- ที่เก็บไฟล์ signatures: เลิกใช้แล้ว (ลายเซ็นเก็บเป็น SVG ใน borrow_records ตั้งแต่ 20261002130000_security_rls)
-- ว่างเปล่า ไม่มี policy และเปิดสาธารณะค้างไว้ (Security Advisor) — ไม่มีโค้ดในแอปเรียกใช้
-- ลบแล้วผ่าน Supabase Dashboard → Storage (23 ต.ค. 2569)
-- ไฟล์นี้เป็นบันทึกเท่านั้น: storage.buckets มี trigger protect_buckets_delete กันการลบด้วย SQL
--   (ทำงานทั้งคำสั่ง แม้ไม่มีแถวให้ลบ) — ถ้าใส่ DELETE ไว้ การรัน migration ทั้งชุดบนโปรเจกต์ใหม่จะพังที่ไฟล์นี้
select 1;
