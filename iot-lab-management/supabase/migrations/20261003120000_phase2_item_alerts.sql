-- =====================================================================
-- เฟส 2.3: แจ้งเตือน Admin เรื่องประกัน + อายุอุปกรณ์
-- - เตือน: ประกันใกล้หมด (≤ warranty_warn_days) / หมดประกัน / อายุถึง age_warn_years / ถึง age_replace_years
-- - แต่ละชิ้นเตือนครั้งเดียวต่อเรื่อง (จำไว้ในตาราง item_alerts)
--   ถ้าแก้วันหมดประกันหรือเปลี่ยนเกณฑ์ปี จะนับเป็นเรื่องใหม่ เตือนใหม่ได้
-- - รวมเป็นแจ้งเตือนเดียวต่อเรื่องต่อรอบ (ไม่ส่งทีละชิ้น) ไม่รวมของที่จำหน่ายแล้ว
-- - pg_cron รันทุกวัน 08:00 ไทย
-- =====================================================================

-- 1. ค่าตั้ง: เตือนก่อนประกันหมดกี่วัน
insert into public.app_settings (key, value)
values ('warranty_warn_days', '30'::jsonb)
on conflict (key) do nothing;

-- 2. ประเภทแจ้งเตือนใหม่
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'borrow', 'return', 'request_borrow', 'request_return', 'request_renew',
  'approved', 'declined', 'expired', 'cancelled', 'auto_returned', 'renewed',
  'due_soon', 'overdue',
  'warranty_soon', 'warranty_expired', 'age_warn', 'age_replace'
]));

-- 3. จำว่าเตือนชิ้นไหน เรื่องอะไรไปแล้ว
-- alert_key = วันหมดประกัน (เรื่องประกัน) หรือเกณฑ์ปี (เรื่องอายุ)
create table public.item_alerts (
  item_id   uuid not null references public.items (id) on delete cascade,
  kind      text not null check (kind in ('warranty_soon', 'warranty_expired', 'age_warn', 'age_replace')),
  alert_key text not null,
  sent_at   timestamptz not null default now(),
  primary key (item_id, kind, alert_key)
);
-- RLS เปิดอัตโนมัติ (ensure_rls) ไม่มี policy = แอปเข้าไม่ได้ ใช้ผ่านฟังก์ชันด้านล่างเท่านั้น
alter table public.item_alerts enable row level security;

-- 4. ฟังก์ชันตรวจ + ส่งแจ้งเตือน
create or replace function public.send_item_alerts()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today   date := public._bkk_today();
  v_days    int  := public._setting_int('warranty_warn_days', 30);
  v_warn    int  := public._setting_int('age_warn_years', 3);
  v_replace int  := public._setting_int('age_replace_years', 4);
  v_total   int  := 0;
  k         record;
  v_codes   text[];
begin
  for k in
    select * from (values
      ('warranty_soon',    'ประกันใกล้หมด',        format('เหลือไม่เกิน %s วัน', v_days)),
      ('warranty_expired', 'หมดประกันแล้ว',        'เลยวันหมดประกันแล้ว'),
      ('age_warn',         'อุปกรณ์ควรตรวจสภาพ',  format('ใช้มา %s ปีขึ้นไป', v_warn)),
      ('age_replace',      'อุปกรณ์ควรเปลี่ยน',    format('ใช้มา %s ปีขึ้นไป', v_replace))
    ) as t(kind, title, detail)
  loop
    with due as (
      select i.id,
             coalesce(i.item_code, i.name, 'อุปกรณ์') as label,
             case when k.kind like 'warranty%' then i.warranty_expires_at::text
                  when k.kind = 'age_warn' then v_warn::text
                  else v_replace::text end as alert_key
      from public.items i
      where i.status <> 'retired'
        and case k.kind
              when 'warranty_soon'    then i.warranty_expires_at between v_today and v_today + v_days
              when 'warranty_expired' then i.warranty_expires_at < v_today
              when 'age_warn'         then (i.created_at at time zone 'Asia/Bangkok')::date <= v_today - make_interval(years => v_warn)
                                       and (i.created_at at time zone 'Asia/Bangkok')::date >  v_today - make_interval(years => v_replace)
              when 'age_replace'      then (i.created_at at time zone 'Asia/Bangkok')::date <= v_today - make_interval(years => v_replace)
            end
    ),
    fresh as (
      insert into public.item_alerts (item_id, kind, alert_key)
      select d.id, k.kind, d.alert_key from due d
      on conflict do nothing
      returning item_id
    )
    select array_agg(d.label order by d.label) into v_codes
    from due d join fresh f on f.item_id = d.id;

    if coalesce(array_length(v_codes, 1), 0) > 0 then
      perform public._notify_staff(
        k.kind,
        format('%s %s ชิ้น', k.title, array_length(v_codes, 1)),
        format('%s: %s%s', k.detail,
               array_to_string(v_codes[1:10], ', '),
               case when array_length(v_codes, 1) > 10 then format(' และอีก %s ชิ้น', array_length(v_codes, 1) - 10) else '' end),
        null, null, null);
      v_total := v_total + array_length(v_codes, 1);
    end if;
  end loop;
  return v_total;
end;
$$;

revoke execute on function public.send_item_alerts() from public, anon, authenticated;

-- 5. ตั้งเวลา: ทุกวัน 08:00 ไทย (01:00 UTC)
select cron.schedule('item-health-alerts', '0 1 * * *', 'select public.send_item_alerts()');
