-- ผู้ดูแลอยู่ห้อง: จำกัดเวลาทำการ 07:00–18:00 ไทย
-- เดิมเช็กอินได้ตลอด → กดตอนดึก = ขึ้น "ผู้ดูแลอยู่ห้อง" ค้างถึง 17:00
-- 1) เช็กอินนอกเวลา = ปฏิเสธ  2) lab_presence ไม่แสดงคนนอกเวลา/เช็กอินก่อน 07:00 วันนี้ (กันค้างถ้า cron ไม่ทำงาน)
-- 3) เช็กเอาท์อัตโนมัติเลื่อนเป็น 18:00

create or replace function public._lab_open_since()
returns timestamptz
language sql
stable
set search_path = public
as $$
  -- 07:00 ไทยของวันนี้ ถ้าตอนนี้อยู่ในช่วง 07:00–18:00 / นอกเวลา = null
  select case
    when (now() at time zone 'Asia/Bangkok')::time >= time '07:00'
     and (now() at time zone 'Asia/Bangkok')::time <  time '18:00'
    then ((now() at time zone 'Asia/Bangkok')::date + time '07:00') at time zone 'Asia/Bangkok'
  end;
$$;

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
    and sp.checked_in_at >= public._lab_open_since()
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
  if public._lab_open_since() is null then
    raise exception 'เช็กอินได้เฉพาะเวลา 07:00–18:00';
  end if;
  -- แถวค้างจากวันก่อน → ลบก่อน จะได้เช็กอินใหม่ได้
  delete from public.staff_presence
  where user_id = auth.uid() and checked_in_at < public._lab_open_since();
  insert into public.staff_presence (user_id, location_id, checked_in_at)
  values (auth.uid(), (select id from public.borrow_locations order by name limit 1), now())
  on conflict (user_id) do nothing;
end;
$$;

revoke execute on function public._lab_open_since() from public, anon;

select cron.unschedule('staff-auto-checkout');
select cron.schedule('staff-auto-checkout', '0 11 * * *', $$select public.staff_checkout_all()$$); -- 11:00 UTC = 18:00 ไทย
