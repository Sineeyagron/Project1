-- F2 นัดรับ: เวลาหมดอายุคำขอ / เวลาผ่อนผันหลังเลยนัด ตั้งได้ที่ admin/settings (เดิมเขียนตายตัว 12 ชม. / 10 นาที)
-- pickup_expiry_hours  = ไม่มีผู้ดูแลนัดภายในกี่ชั่วโมง → คำขอหมดอายุ (1–72)
-- pickup_grace_minutes = เลยเวลานัดกี่นาที → no_show (5–120)
-- อ่าน/แก้ผ่าน policy เดิมของ app_settings (ล็อกอินอ่านได้ / admin แก้ได้)

insert into public.app_settings (key, value) values
  ('pickup_expiry_hours', '12'::jsonb),
  ('pickup_grace_minutes', '10'::jsonb)
on conflict (key) do nothing;

-- ค่าตัวเลขจาก app_settings ในช่วงที่กำหนด (ไม่มี/ผิดรูป/นอกช่วง = fallback)
create or replace function public._setting_int(p_key text, p_fallback int, p_min int, p_max int)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select v from (
      select case when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric::int
                  when jsonb_typeof(value) = 'string' and (value #>> '{}') ~ '^\d+$' then (value #>> '{}')::int
             end as v
      from public.app_settings where key = p_key
    ) s where v between p_min and p_max
  ), p_fallback);
$$;
revoke execute on function public._setting_int(text, int, int, int) from public, anon, authenticated;

-- คำขอใหม่: expires_at ตามค่าตั้งตอนส่งคำขอ (default คอลัมน์ใช้ subquery ไม่ได้ → trigger)
create or replace function public.pickup_requests_set_expiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.expires_at := now() + make_interval(hours => public._setting_int('pickup_expiry_hours', 12, 1, 72));
  return new;
end;
$$;
revoke execute on function public.pickup_requests_set_expiry() from public, anon, authenticated;

drop trigger if exists pickup_requests_set_expiry on public.pickup_requests;
create trigger pickup_requests_set_expiry
  before insert on public.pickup_requests
  for each row execute function public.pickup_requests_set_expiry();

-- หมดอายุ / ไม่มาตามนัด — ข้อความบอกตัวเลขจริง (ชั่วโมงนับจากคำขอนั้นเอง, นาทีจากค่าตั้งปัจจุบัน)
create or replace function public.expire_pickups()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count int := 0;
  v_grace int := public._setting_int('pickup_grace_minutes', 10, 5, 120);
begin
  for r in
    select * from public.pickup_requests
    where (status = 'pending' and expires_at <= now())
       or (status = 'scheduled' and pickup_at + make_interval(mins => v_grace) <= now())
    for update skip locked
  loop
    if r.status = 'pending' then
      update public.pickup_requests set status = 'expired', decided_at = now() where id = r.id;
      perform public._notify(r.user_id, 'pickup_expired', 'คำขอนัดรับหมดอายุ',
        format('ไม่มีผู้ดูแลนัดเวลารับ "%s" ภายใน %s ชั่วโมง ส่งคำขอใหม่ได้', r.item_prefix,
          greatest(1, round(extract(epoch from (r.expires_at - r.created_at)) / 3600)::int)),
        r.item_prefix, null, null);
    else
      update public.pickup_requests set status = 'no_show', decided_at = now(),
        decision_note = format('เลยเวลานัด %s นาที ยกเลิกอัตโนมัติ', v_grace) where id = r.id;
      perform public._notify(r.user_id, 'pickup_no_show', 'นัดรับถูกยกเลิก',
        format('เลยเวลานัดรับ "%s" (%s) เกิน %s นาที ระบบยกเลิกนัดให้อัตโนมัติ', r.item_prefix, public._thai_datetime(r.pickup_at), v_grace),
        r.item_prefix, null, null);
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.expire_pickups() from public, anon, authenticated;
