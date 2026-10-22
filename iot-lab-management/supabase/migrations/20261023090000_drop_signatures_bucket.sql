-- ลบที่เก็บไฟล์ signatures: เลิกใช้แล้ว (ลายเซ็นเก็บเป็น SVG ใน borrow_records ตั้งแต่ 20261002130000_security_rls)
-- ว่างเปล่า ไม่มี policy และเปิดสาธารณะค้างไว้ (Security Advisor) — ไม่มีโค้ดในแอปเรียกใช้
delete from storage.buckets
where id = 'signatures'
  and not exists (select 1 from storage.objects where bucket_id = 'signatures');
