-- F4 สถานะ "มีผู้ดูแลอยู่ที่ IoT Lab ไหม" (เช็กอิน/เช็กเอาท์) — ระบบยืม-คืน (docs/SPEC_NEW_FEATURES.md)
-- มีแถว = อยู่ / ไม่มี = ไม่อยู่ · เขียนผ่าน RPC เท่านั้น · 17:00 ไทย เช็กเอาท์ทุกคนอัตโนมัติ
-- สัญญาณ Realtime ช่องใหม่ของระบบยืม "lab" (event "presence") — ไม่ใช้ช่อง room ของระบบห้อง

create table if not exists public.staff_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  location_id uuid references public.borrow_locations(id) on delete set null,
  checked_in_at timestamptz not null default now()
);

alter table public.staff_presence enable row level security;

drop policy if exists "staff_presence: อ่านได้ทุกคนที่ล็อกอิน" on public.staff_presence;
create policy "staff_presence: อ่านได้ทุกคนที่ล็อกอิน" on public.staff_presence
  for select to authenticated using (true);
-- ไม่มี policy เขียน → แอปเขียนตรงไม่ได้ ต้องผ่าน RPC

-- ส่งสัญญาณให้แอปโหลดแถบใหม่ (payload ว่าง — แอปอ่านรายชื่อผ่าน lab_presence())
create or replace function public._lab_broadcast_presence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send('{}'::jsonb, 'presence', 'lab', true);
  return null;
end;
$$;
revoke execute on function public._lab_broadcast_presence() from public, anon, authenticated;

drop trigger if exists staff_presence_broadcast on public.staff_presence;
create trigger staff_presence_broadcast
  after insert or delete on public.staff_presence
  for each statement execute function public._lab_broadcast_presence();

-- รายชื่อผู้ดูแลที่อยู่ตอนนี้ (นศ. อ่าน profiles คนอื่นไม่ได้ → ส่งเฉพาะบทบาท + ชื่อ + เวลา)
create or replace function public.lab_presence()
returns table (user_id uuid, role text, name text, checked_in_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select sp.user_id, p.role,
         coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1), 'ผู้ดูแล'),
         sp.checked_in_at
  from public.staff_presence sp
  join public.profiles p on p.id = sp.user_id
  where auth.uid() is not null
  order by sp.checked_in_at;
$$;

create or replace function public.staff_check_in()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'เฉพาะผู้ดูแล (TA / Admin) เท่านั้น';
  end if;
  insert into public.staff_presence (user_id, location_id, checked_in_at)
  values (auth.uid(), (select id from public.borrow_locations order by name limit 1), now())
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.staff_check_out()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'เฉพาะผู้ดูแล (TA / Admin) เท่านั้น';
  end if;
  delete from public.staff_presence where user_id = auth.uid();
end;
$$;

-- 17:00 ไทย เช็กเอาท์ทุกคน (cron วันละครั้ง)
create or replace function public.staff_checkout_all()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.staff_presence;
$$;

revoke execute on function public.lab_presence() from public, anon;
revoke execute on function public.staff_check_in() from public, anon;
revoke execute on function public.staff_check_out() from public, anon;
revoke execute on function public.staff_checkout_all() from public, anon, authenticated;
grant execute on function public.lab_presence() to authenticated;
grant execute on function public.staff_check_in() to authenticated;
grant execute on function public.staff_check_out() to authenticated;

select cron.schedule('staff-auto-checkout', '0 10 * * *', $$select public.staff_checkout_all()$$); -- 10:00 UTC = 17:00 ไทย

drop policy if exists "realtime: ช่อง lab (ทุกคนที่ล็อกอิน)" on realtime.messages;
create policy "realtime: ช่อง lab (ทุกคนที่ล็อกอิน)" on realtime.messages
  for select to authenticated using ((select realtime.topic()) = 'lab');
