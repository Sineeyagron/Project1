-- ขยายระยะยืม / ยืมต่อ สูงสุดจาก 60 เป็น 160 วัน (ให้ตรงกับ DAY_MAX ในหน้า admin/settings)
-- ตัวเลือกที่ นศ. เลือกได้จริงยังมาจาก app_settings.borrow_day_options (ตรวจด้วย _valid_days)

-- 1) ลบ check เดิมของคอลัมน์ days (หาจากนิยาม ไม่พึ่งชื่อ constraint)
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.borrow_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%days%'
  loop
    execute format('alter table public.borrow_requests drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.borrow_requests
  add constraint borrow_requests_days_check check (days between 1 and 160);

-- 2) เพิ่ม 160 วันเข้าตัวเลือกระยะยืม (ถ้ายังไม่มี) เรียงจากน้อยไปมาก
update public.app_settings
set value = (
      select jsonb_agg(d order by d)
      from (select distinct x::int as d from jsonb_array_elements_text(value || '[160]'::jsonb) x) t
    ),
    updated_at = now()
where key = 'borrow_day_options'
  and not value @> '[160]'::jsonb;
