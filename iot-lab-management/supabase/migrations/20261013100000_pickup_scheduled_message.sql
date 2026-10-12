-- แจ้งเตือน "นัดรับของแล้ว" อ่านง่ายขึ้น (ผู้ใช้อ่านแล้วไม่เข้าใจ "ได้ 14/10/2569 13:00")
--   เดิม: มารับ "SG90" ได้ 14/10/2569 13:00 · นัดโดย armzascout
--   ใหม่: มารับ "SG90" ได้วันที่ 14/10/2569 เวลา 13:00 น. ที่ IoT Lab · เลยเวลานัดเกิน 10 นาที นัดจะถูกยกเลิก · นัดโดย armzascout
-- เปลี่ยนเฉพาะข้อความแจ้งเตือน — เงื่อนไขของ schedule_pickup เหมือนเดิมทุกบรรทัด

create or replace function public.schedule_pickup(p_id uuid, p_pickup_at timestamp with time zone)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  r record;
  v_by text;
  v_when text;
  v_loc text;
  v_grace int := public._setting_int('pickup_grace_minutes', 10, 5, 120);
begin
  if v_uid is null or not public.is_staff() then raise exception 'เฉพาะผู้ดูแล (TA / Admin) เท่านั้น'; end if;
  perform public.expire_pickups();
  select * into r from public.pickup_requests where id = p_id for update;
  if not found then raise exception 'ไม่พบคำขอนัดรับ'; end if;
  if r.status <> 'pending' then raise exception 'คำขอนี้ไม่ได้รอนัดเวลาแล้ว'; end if;
  if r.user_id = v_uid and not public.is_admin() then
    raise exception 'จัดการคำขอของตัวเองไม่ได้ — ให้ผู้ดูแลคนอื่นนัดให้';
  end if;
  if p_pickup_at is null or p_pickup_at < now() - interval '2 minutes' then
    raise exception 'เวลานัดต้องไม่ย้อนหลัง';
  end if;
  if p_pickup_at > now() + interval '14 days' then
    raise exception 'นัดล่วงหน้าได้ไม่เกิน 14 วัน';
  end if;
  if public._pickup_free(r.item_prefix) < 0 then
    raise exception 'รุ่นนี้ไม่มีชิ้นว่างให้กันไว้ตอนนี้';
  end if;

  update public.pickup_requests
  set status = 'scheduled', pickup_at = p_pickup_at, scheduled_by = v_uid, decided_at = now()
  where id = p_id;

  select coalesce(nullif(full_name, ''), split_part(email, '@', 1)) into v_by from public.profiles where id = v_uid;
  select name into v_loc from public.borrow_locations where id = r.location_id;
  -- _thai_datetime = "14/10/2569 13:00" → "วันที่ 14/10/2569 เวลา 13:00 น."
  v_when := public._thai_datetime(p_pickup_at);
  v_when := format('วันที่ %s เวลา %s น.', split_part(v_when, ' ', 1), split_part(v_when, ' ', 2));

  perform public._notify(r.user_id, 'pickup_scheduled', 'นัดรับของแล้ว',
    format('มารับ "%s" ได้%s%s · เลยเวลานัดเกิน %s นาที นัดจะถูกยกเลิก · นัดโดย %s',
      r.item_prefix, v_when,
      case when v_loc is not null then ' ที่ ' || v_loc else '' end,
      v_grace, coalesce(v_by, 'ผู้ดูแล')),
    r.item_prefix, null, null);
end;
$function$;
