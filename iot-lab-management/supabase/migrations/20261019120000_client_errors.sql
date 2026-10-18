-- เก็บ error ที่เกิดบนเครื่องผู้ใช้ (แอปพังแล้วเราไม่รู้ → ตอนนี้รู้) — lib/errorReport.ts เป็นคนส่ง
-- ระวัง Disk IO แพ็กเกจฟรี:
--   · ส่งผ่าน RPC log_client_error เท่านั้น (ตารางเขียนตรงไม่ได้)
--   · ตัดความยาว · ข้อความเดิมของคนเดิมซ้ำใน 10 นาที = ไม่บันทึก · คนละไม่เกิน 20 รายการ/ชั่วโมง · ทั้งตารางไม่เกิน 2000 แถว
--   · ลบของเก่ากว่า 30 วันตอนบันทึก (ใช้ index created_at)
-- อ่านได้เฉพาะ admin (Supabase Dashboard → Table editor → client_errors หรือ SQL)

create table if not exists public.client_errors (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users (id) on delete set null,
  message    text not null,
  stack      text,
  url        text,
  platform   text,
  app_version text
);

create index if not exists client_errors_created_at_idx on public.client_errors (created_at);
create index if not exists client_errors_user_idx on public.client_errors (user_id, created_at);

alter table public.client_errors enable row level security;

drop policy if exists client_errors_admin_read on public.client_errors;
create policy client_errors_admin_read on public.client_errors
  for select to authenticated using (public.is_admin());

-- ไม่มี policy insert/update/delete → เขียนได้ทางเดียวคือ RPC ด้านล่าง

create or replace function public.log_client_error(
  p_message text,
  p_stack text default null,
  p_url text default null,
  p_platform text default null,
  p_app_version text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_msg text := left(btrim(coalesce(p_message, '')), 500);
begin
  if v_uid is null or v_msg = '' then return; end if;

  -- ข้อความเดิมซ้ำใน 10 นาที / เกิน 20 รายการต่อชั่วโมง → ข้าม
  if exists (select 1 from public.client_errors
             where user_id = v_uid and message = v_msg and created_at > now() - interval '10 minutes') then
    return;
  end if;
  if (select count(*) from public.client_errors
      where user_id = v_uid and created_at > now() - interval '1 hour') >= 20 then
    return;
  end if;
  if (select count(*) from public.client_errors) >= 2000 then
    delete from public.client_errors where created_at < now() - interval '30 days';
    if (select count(*) from public.client_errors) >= 2000 then return; end if;
  end if;

  insert into public.client_errors (user_id, message, stack, url, platform, app_version)
  values (v_uid, v_msg, left(p_stack, 2000), left(p_url, 300), left(p_platform, 40), left(p_app_version, 20));

  -- เก็บกวาดของเก่า (เบา: มี index created_at)
  delete from public.client_errors where created_at < now() - interval '30 days';
exception when others then
  -- บันทึก error ไม่ได้ต้องไม่ทำให้แอปพังซ้ำ
  null;
end;
$$;

revoke execute on function public.log_client_error(text, text, text, text, text) from public, anon;
grant execute on function public.log_client_error(text, text, text, text, text) to authenticated;
