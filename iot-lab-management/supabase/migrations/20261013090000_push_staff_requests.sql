-- Web Push ถึงผู้ดูแล (admin + TA) เมื่อมีคำขอใหม่ — คำขอยืม/คืน/ยืมต่อ (borrow_requests) + คำขอนัดรับ (pickup_requests)
--   คำขอพวกนี้ "ขึ้นกล่องคำขออย่างเดียว" ไม่สร้างแถวใน notifications (staff_inbox_split) → เดิมไม่มี push
--   ทางนี้ส่ง push อย่างเดียว ไม่เพิ่มรายการในกระดิ่ง (กระดิ่งผู้ดูแลเหมือนเดิม)
-- ยิง pg_net เฉพาะเมื่อมีผู้ดูแล (ที่ไม่ใช่คนขอเอง) ลงทะเบียนเครื่องไว้ — ประหยัด Disk IO
-- Edge Function send-push รับ { request_id, source } → ตรวจว่าคำขอยัง pending และเพิ่งสร้างไม่เกิน 2 นาที แล้วส่ง

create or replace function public._push_staff_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' and exists (
    select 1
    from public.push_subscriptions s
    join public.profiles p on p.id = s.user_id
    where p.role = any (public._staff_roles()) and s.user_id <> new.user_id
  ) then
    perform net.http_post(
      url := 'https://enupmlxmajjwskvzgcdq.supabase.co/functions/v1/send-push',
      body := jsonb_build_object('request_id', new.id, 'source', tg_argv[0]),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  end if;
  return null;
exception when others then
  -- ส่ง push ไม่ได้ต้องไม่ทำให้การส่งคำขอล้ม
  return null;
end;
$$;

revoke execute on function public._push_staff_request() from public, anon, authenticated;

drop trigger if exists borrow_requests_push on public.borrow_requests;
create trigger borrow_requests_push
  after insert on public.borrow_requests
  for each row execute function public._push_staff_request('borrow');

drop trigger if exists pickup_requests_push on public.pickup_requests;
create trigger pickup_requests_push
  after insert on public.pickup_requests
  for each row execute function public._push_staff_request('pickup');
