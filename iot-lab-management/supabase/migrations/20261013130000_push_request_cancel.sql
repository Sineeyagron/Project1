-- นักศึกษายกเลิกคำขอยืม/คืน/ยืมต่อเอง → push ถึงผู้ดูแล (แบบเดียวกับยกเลิกนัดรับ 20261013120000)
--   Edge Function send-push รับ { request_id, source: "borrow_cancel" } · push อย่างเดียว ไม่เพิ่มในกระดิ่ง
-- cancel_request เหมือนเดิมทุกบรรทัด + เรียก _push_staff ตอนท้าย

create or replace function public.cancel_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  r     record;
begin
  if v_uid is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;

  select * into r from public.borrow_requests
    where id = p_request_id and user_id = v_uid
    for update;
  if not found then raise exception 'ไม่พบคำขอ'; end if;
  if r.status <> 'pending' then raise exception 'คำขอนี้ไม่ได้รอดำเนินการแล้ว'; end if;

  if r.kind = 'borrow' then
    update public.items set status = 'available' where id = r.item_id and status = 'reserved';
  elsif r.kind = 'return' then
    update public.borrow_records set status = 'borrowed'
    where id = r.borrow_record_id and status = 'pending_return';
  end if;

  update public.borrow_requests
  set status = 'cancelled', decided_at = now()
  where id = r.id;

  perform public._push_staff(r.id, v_uid, 'borrow_cancel');
end;
$function$;
