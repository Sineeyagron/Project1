-- นักศึกษายกเลิกคำขอนัดรับเอง → push ถึงผู้ดูแล (admin + TA) — เดิมไม่มีอะไรแจ้งเลย
--   แบบเดียวกับคำขอใหม่ (20261013090000): push อย่างเดียว ไม่เพิ่มรายการในกระดิ่ง
--   Edge Function send-push รับ { request_id, source: "pickup_cancel" } → ตรวจว่าเพิ่งยกเลิก (ไม่เกิน 2 นาที) แล้วส่ง

-- ตัวช่วยยิง send-push ถึงผู้ดูแล (เฉพาะเมื่อมีผู้ดูแลที่ไม่ใช่เจ้าของคำขอลงทะเบียนเครื่องไว้ — ประหยัด Disk IO)
create or replace function public._push_staff(p_request_id uuid, p_owner uuid, p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.push_subscriptions s
    join public.profiles p on p.id = s.user_id
    where p.role = any (public._staff_roles()) and s.user_id <> p_owner
  ) then
    perform net.http_post(
      url := 'https://enupmlxmajjwskvzgcdq.supabase.co/functions/v1/send-push',
      body := jsonb_build_object('request_id', p_request_id, 'source', p_source),
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 5000
    );
  end if;
exception when others then
  -- ส่ง push ไม่ได้ต้องไม่ทำให้งานหลักล้ม
  null;
end;
$$;

revoke execute on function public._push_staff(uuid, uuid, text) from public, anon, authenticated;

-- trigger คำขอใหม่ใช้ตัวช่วยเดียวกัน
create or replace function public._push_staff_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    perform public._push_staff(new.id, new.user_id, tg_argv[0]);
  end if;
  return null;
end;
$$;

-- cancel_pickup: เหมือนเดิมทุกบรรทัด + เจ้าของยกเลิกเอง → push ถึงผู้ดูแล
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
    perform public._push_staff(p_id, r.user_id, 'pickup_cancel');
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
