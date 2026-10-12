-- ผู้ดูแลหลายคนกดคำขอเดียวกันพร้อมกัน: decide_request ล็อกแถว (for update) + เช็ก pending อยู่แล้ว → คนที่ 2 ไม่ทำซ้ำ
--   แต่ข้อความเดิมมีสถานะภาษาอังกฤษ: "คำขอนี้ถูกดำเนินการไปแล้ว (สถานะ: approved)"
--   → เปลี่ยนเป็นภาษาไทยตามสถานะ เช่น "ผู้ดูแลคนอื่นอนุมัติคำขอนี้ไปแล้ว"
-- แก้เฉพาะบรรทัด raise ในฟังก์ชันเดิม (แทนข้อความใน definition ปัจจุบัน — ส่วนอื่นไม่แตะ)

do $migration$
declare
  v_def text := pg_get_functiondef('public.decide_request(uuid, boolean, text, text, numeric)'::regprocedure);
  v_old text := $x$raise exception 'คำขอนี้ถูกดำเนินการไปแล้ว (สถานะ: %)', r.status;$x$;
  v_new text := $x$raise exception '%', case r.status
      when 'approved' then 'ผู้ดูแลคนอื่นอนุมัติคำขอนี้ไปแล้ว'
      when 'declined' then 'ผู้ดูแลคนอื่นปฏิเสธคำขอนี้ไปแล้ว'
      when 'cancelled' then 'นักศึกษายกเลิกคำขอนี้แล้ว'
      when 'expired' then 'คำขอนี้หมดเวลารออนุมัติแล้ว'
      when 'auto_returned' then 'ระบบคืนอุปกรณ์ให้อัตโนมัติแล้ว'
      else 'คำขอนี้ถูกจัดการไปแล้ว'
    end;$x$;
begin
  if position(v_new in v_def) > 0 then
    return; -- เคยแก้แล้ว
  end if;
  if position(v_old in v_def) = 0 then
    raise exception 'decide_request: ไม่พบข้อความเดิม — ตรวจ definition ก่อนแก้';
  end if;
  execute replace(v_def, v_old, v_new);
end
$migration$;
