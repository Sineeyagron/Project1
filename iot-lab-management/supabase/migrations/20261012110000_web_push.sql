-- =====================================================================
-- Web Push (PWA บนเว็บ): แจ้งเตือนใหม่ในตาราง notifications → เด้งบนเครื่องที่กด "เปิดแจ้งเตือน" ไว้
--
--   แอปเว็บ (lib/webPush.ts) สมัครรับ push → save_push_subscription() เก็บลง push_subscriptions
--   แถวใหม่ใน notifications → trigger ยิง pg_net ไป Edge Function send-push (ส่งแค่ id)
--   send-push อ่านแถวด้วย service role แล้วส่งไปทุกเครื่องของผู้รับ (VAPID) / เครื่องที่เลิกรับแล้ว (404/410) ลบทิ้ง
--
-- ประหยัด Disk IO (แพ็กเกจฟรี): ยิงเฉพาะผู้ใช้ที่มีเครื่องลงทะเบียนไว้ (เช็กผ่าน index user_id)
--   คนที่ไม่เปิดแจ้งเตือน = ไม่มีคำขอ HTTP / ไม่มีแถวใน net._http_response เพิ่ม
-- ความปลอดภัยของ send-push (ไม่ต้องใช้ JWT): รับแค่ id แจ้งเตือน (uuid สุ่ม เห็นได้เฉพาะผู้รับ)
--   และส่งเฉพาะแจ้งเตือนที่เพิ่งสร้างไม่เกิน 2 นาที → คนนอกสั่งส่งข้อความเองไม่ได้
-- =====================================================================

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- เจ้าของเห็น/เพิ่ม/ลบเครื่องของตัวเองเท่านั้น (ไม่มี update — สมัครซ้ำใช้ save_push_subscription)
drop policy if exists push_subs_select_own on public.push_subscriptions;
create policy push_subs_select_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists push_subs_insert_own on public.push_subscriptions;
create policy push_subs_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists push_subs_delete_own on public.push_subscriptions;
create policy push_subs_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- สมัคร/สมัครซ้ำ: endpoint เดิม (เบราว์เซอร์เดิม) ย้ายมาเป็นของคนที่ล็อกอินล่าสุด
--   (insert ตรงผ่าน RLS ทำไม่ได้ถ้าเครื่องนี้เคยเป็นของบัญชีอื่น)
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000
     or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'ข้อมูลการสมัครแจ้งเตือนไม่ถูกต้อง';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- แจ้งเตือนใหม่ → Edge Function send-push (เฉพาะผู้รับที่มีเครื่องลงทะเบียน)
create or replace function public._push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.push_subscriptions where user_id = new.user_id) then
    perform net.http_post(
      url := 'https://enupmlxmajjwskvzgcdq.supabase.co/functions/v1/send-push',
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  end if;
  return null;
exception when others then
  -- ส่ง push ไม่ได้ต้องไม่ทำให้การสร้างแจ้งเตือน (และคำขอยืม/คืนที่เรียกมา) ล้ม
  return null;
end;
$$;

revoke execute on function public._push_notification() from public, anon, authenticated;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push
  after insert on public.notifications
  for each row execute function public._push_notification();
