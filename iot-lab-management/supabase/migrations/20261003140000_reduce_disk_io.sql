-- =====================================================================
-- ลด Disk IO (Supabase เตือน Disk IO Budget ใกล้หมด — แพ็กเกจฟรี)
-- 1. งานเคลียร์คำขอหมดอายุ: ทุก 1 นาที → ทุก 5 นาที
--    (หมดอายุช้าสุด +5 นาที / หน้า Admin เรียก expire_requests ตอนเปิดอยู่แล้ว)
-- 2. ลบบันทึกการรันของ pg_cron ที่เก่ากว่า 7 วัน ทุกวัน 03:00 ไทย (20:00 UTC)
-- =====================================================================

select cron.alter_job(
  (select jobid from cron.job where jobname = 'expire-borrow-requests'),
  schedule := '*/5 * * * *'
);

select cron.schedule(
  'cleanup-cron-history',
  '0 20 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
