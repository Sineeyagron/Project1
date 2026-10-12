-- แจ้งเตือน "นัดรับถูกยกเลิก" ใช้รูปแบบวันเวลาเดียวกับ "นัดรับของแล้ว" (20261013100000)
--   เดิม: ... (14/10/2569 13:00) ...   ใหม่: ... (นัดวันที่ 14/10/2569 เวลา 13:00 น.) ...
-- เปลี่ยนเฉพาะข้อความ — เงื่อนไขของ expire_pickups / cancel_pickup เหมือนเดิมทุกบรรทัด

-- "วันที่ 14/10/2569 เวลา 13:00 น." (เวลาไทย, ปี พ.ศ.)
create or replace function public._thai_when(p_at timestamp with time zone)
returns text
language sql
stable
set search_path = public
as $$
  select format('วันที่ %s เวลา %s น.',
    split_part(public._thai_datetime(p_at), ' ', 1),
    split_part(public._thai_datetime(p_at), ' ', 2))
$$;

revoke execute on function public._thai_when(timestamp with time zone) from public, anon, authenticated;

-- ระบบยกเลิกเอง: คำขอไม่มีใครนัด (หมดอายุ) / เลยเวลานัดเกิน grace (ไม่มาตามนัด)
create or replace function public.expire_pickups()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
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
        format('เลยเวลานัดรับ "%s" (นัด%s) เกิน %s นาที ระบบยกเลิกนัดให้อัตโนมัติ', r.item_prefix, public._thai_when(r.pickup_at), v_grace),
        r.item_prefix, null, null);
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$;

-- ผู้ดูแลยกเลิก / กดว่าไม่มาตามนัด
create or replace function public.cancel_pickup(p_id uuid, p_no_show boolean default false)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  r record;
  v_staff boolean := public.is_staff();
begin
  if v_uid is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  select * into r from public.pickup_requests where id = p_id for update;
  if not found then raise exception 'ไม่พบคำขอนัดรับ'; end if;
  if r.status not in ('pending', 'scheduled') then raise exception 'คำขอนี้จบไปแล้ว'; end if;

  if r.user_id = v_uid then
    update public.pickup_requests set status = 'cancelled', decided_at = now() where id = p_id;
    return;
  end if;
  if not v_staff then raise exception 'ยกเลิกคำขอของคนอื่นไม่ได้'; end if;

  if p_no_show then
    if r.status <> 'scheduled' then raise exception 'ยังไม่ได้นัดเวลา'; end if;
    update public.pickup_requests set status = 'no_show', decided_at = now(),
      decision_note = 'นักศึกษาไม่มาตามนัด' where id = p_id;
    perform public._notify(r.user_id, 'pickup_no_show', 'นัดรับถูกยกเลิก',
      format('ผู้ดูแลยกเลิกนัดรับ "%s" เพราะไม่มาตามนัด (นัด%s)', r.item_prefix, public._thai_when(r.pickup_at)),
      r.item_prefix, null, null);
  else
    update public.pickup_requests set status = 'cancelled', decided_at = now() where id = p_id;
    perform public._notify(r.user_id, 'pickup_cancelled', 'นัดรับถูกยกเลิก',
      format('ผู้ดูแลยกเลิกคำขอนัดรับ "%s"', r.item_prefix), r.item_prefix, null, null);
  end if;
end;
$function$;
