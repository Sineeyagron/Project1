-- แยกแจ้งเตือน "งานผู้ดูแล" ออกจาก "เรื่องของตัวเอง" — TA/Admin มีสองโหมด (หน้า admin / โหมดนักศึกษา) ใช้กล่องแจ้งเตือนเดียวกัน
-- เดิมทั้งสองโหมดเห็นรายการเดียวกัน (ซ้ำ) → แอปกรองด้วย for_staff:
--   หน้า admin = for_staff (+ role_changed) / โหมดนักศึกษา = ไม่ใช่ for_staff
-- คอลัมน์คำนวณเองจาก type/title (ไม่ต้องแก้ฟังก์ชันส่งแจ้งเตือนทุกตัว + แถวเก่าได้ค่าทันที)
--   overdue / auto_returned ใช้ type เดียวกันทั้งถึงผู้ยืมและถึงผู้ดูแล → แยกด้วยหัวข้อที่ _notify_staff ใช้

alter table public.notifications
  add column if not exists for_staff boolean generated always as (
    type in ('request_borrow', 'request_return', 'request_renew',
             'warranty_soon', 'warranty_expired', 'age_warn', 'age_replace',
             'room_report')
    or (type = 'overdue' and title like 'มีอุปกรณ์%')
    or (type = 'auto_returned' and title like '%ยังไม่ได้ตรวจสภาพ%')
  ) stored;
