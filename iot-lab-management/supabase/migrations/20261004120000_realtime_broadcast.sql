-- =====================================================================
-- Realtime Broadcast: ฐานข้อมูลส่งสัญญาณเอง แทนแอปรีเฟรชถามทุก 30 วินาที
-- (เบากว่า Postgres Changes เพราะไม่ต้องคอยอ่าน WAL ตลอดเวลา — เหมาะกับแพ็กเกจฟรี)
--
-- ช่อง (private channel):
--   user:<uuid>  → แจ้งเตือนใหม่ของคนนั้น (event "notification")
--   staff        → คำขอยืม/คืน/ยืมต่อ ใหม่หรือเปลี่ยนสถานะ (event "request") — admin + TA
-- payload มีแค่ id/ประเภท/สถานะ — แอปโหลดข้อมูลจริงเองผ่าน RLS ตามปกติ (ไม่ส่งข้อมูลส่วนตัวผ่านช่อง)
-- =====================================================================

-- 1. แจ้งเตือนใหม่ → ช่องของผู้รับ
create or replace function public.broadcast_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('id', new.id, 'type', new.type),
    'notification',
    'user:' || new.user_id::text,
    true
  );
  return null;
end;
$$;

revoke execute on function public.broadcast_notification() from public, anon, authenticated;

create trigger notifications_broadcast
  after insert on public.notifications
  for each row execute function public.broadcast_notification();

-- 2. คำขอใหม่ / เปลี่ยนสถานะ → ช่องผู้ดูแล (เลขกล่องคำขอ + รายการในกล่อง)
create or replace function public.broadcast_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  perform realtime.send(
    jsonb_build_object('id', new.id, 'kind', new.kind, 'status', new.status),
    'request',
    'staff',
    true
  );
  return null;
end;
$$;

revoke execute on function public.broadcast_request() from public, anon, authenticated;

create trigger borrow_requests_broadcast
  after insert or update of status on public.borrow_requests
  for each row execute function public.broadcast_request();

-- 3. ใครฟังช่องไหนได้: ช่องของตัวเอง / ช่อง staff เฉพาะ admin + TA
create policy "realtime: ฟังช่องของตัวเอง หรือช่อง staff"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.topic() = 'user:' || (select auth.uid())::text
    or (realtime.topic() = 'staff' and (select public.is_staff()))
  );
