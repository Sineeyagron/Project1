-- ก่อนเปิดเว็บสาธารณะ (PWA): เก็บคำเตือน Supabase Advisors (security) — ไม่เปลี่ยนการทำงานของแอป
-- 1) ฟังก์ชัน trigger ไม่ควรเรียกผ่าน /rest/v1/rpc ได้ (ถูกเรียกจาก trigger เท่านั้น — trigger ไม่ต้องใช้สิทธิ์ EXECUTE ของผู้ใช้)
revoke execute on function public._profile_sync_from_auth() from public, anon, authenticated;
revoke execute on function public._room_broadcast_change() from public, anon, authenticated;
revoke execute on function public._room_inspection_sync_checklist() from public, anon, authenticated;
revoke execute on function public._room_log_lan_status() from public, anon, authenticated;
revoke execute on function public._room_log_station_status() from public, anon, authenticated;
revoke execute on function public._room_repair_sync_station() from public, anon, authenticated;
revoke execute on function public._room_station_default_checklist() from public, anon, authenticated;

-- 2) ล็อก search_path ของฟังก์ชันช่วยที่ยังไม่ได้ตั้ง (กันการแทรก schema)
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('_profile_meta_name', '_profile_meta_avatar', '_item_model', '_thai_datetime')
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;
