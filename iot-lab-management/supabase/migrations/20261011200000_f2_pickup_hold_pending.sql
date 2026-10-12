-- F2 นัดรับ: กันของตั้งแต่ส่งคำขอ (pending) ไม่ใช่แค่ตอนผู้ดูแลนัดแล้ว (scheduled)
--   เจ้าของโปรเจกต์สั่ง 11 ต.ค. 2569 — ของว่างที่ นศ. เห็นในหน้าอุปกรณ์ต้องตรงกับที่ยืมได้จริง
--   (จองเล่นไม่น่ากังวล: ทุกคำขอผูกกับบัญชี @kkumail.com ตามตัวได้ / คำขอค้างไม่มีคนนัด หมดอายุเองใน 12 ชม.)
--
--   1. _pickup_free หักทั้ง pending + scheduled
--   2. schedule_pickup: คำขอนี้กันของไว้แล้ว → ปฏิเสธเฉพาะเมื่อของว่างติดลบ (ของหายไประหว่างรอ เช่น ส่งซ่อม)
--   3. request_borrow: เจ้าของคำขอที่ยังรอนัด มาสแกนยืมรุ่นเดียวกันเอง → ยกเลิกคำขอนัดรับให้ (ชิ้นที่กันไว้ใช้กับการยืมนี้)
--   4. scan_lookup: "ถูกกันไว้" ไม่นับคำขอรอนัดของตัวเอง
--   5. pickup_holds(): จำนวนที่ถูกกันต่อรุ่น ให้หน้าอุปกรณ์ (ไม่บอกว่าใครขอ)

create or replace function public._pickup_free(p_model text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select (select count(*) from public.items
           where status = 'available' and retired_at is null
             and public._item_model(item_prefix, name) = lower(btrim(p_model)))::int
       - (select count(*) from public.pickup_requests
           where status in ('pending', 'scheduled') and lower(btrim(item_prefix)) = lower(btrim(p_model)))::int
$$;
revoke execute on function public._pickup_free(text) from public, anon, authenticated;

-- จำนวนชิ้นที่ถูกกันไว้ให้คำขอนัดรับ ต่อรุ่น (หน้าอุปกรณ์ของ นศ. หักออกจากชิ้นว่าง)
create or replace function public.pickup_holds()
returns table (model text, held int)
language sql
stable
security definer
set search_path = public
as $$
  select lower(btrim(item_prefix)), count(*)::int
  from public.pickup_requests
  where status in ('pending', 'scheduled')
  group by 1
$$;
revoke execute on function public.pickup_holds() from public, anon;
grant execute on function public.pickup_holds() to authenticated;

create or replace function public.schedule_pickup(p_id uuid, p_pickup_at timestamp with time zone)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
  v_by text;
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
  -- คำขอนี้ถูกนับกันของไว้แล้วตั้งแต่ส่ง → ติดลบ = ของไม่พอจริง (ชิ้นถูกยืม/ส่งซ่อมไประหว่างรอ)
  if public._pickup_free(r.item_prefix) < 0 then
    raise exception 'รุ่นนี้ไม่มีชิ้นว่างให้กันไว้ตอนนี้';
  end if;

  update public.pickup_requests
  set status = 'scheduled', pickup_at = p_pickup_at, scheduled_by = v_uid, decided_at = now()
  where id = p_id;

  select coalesce(nullif(full_name, ''), split_part(email, '@', 1)) into v_by from public.profiles where id = v_uid;
  perform public._notify(r.user_id, 'pickup_scheduled', 'นัดรับของแล้ว',
    format('มารับ "%s" ได้ %s · นัดโดย %s', r.item_prefix, public._thai_datetime(p_pickup_at), coalesce(v_by, 'ผู้ดูแล')),
    r.item_prefix, null, null);
end;
$$;

create or replace function public.request_borrow(p_item_id uuid, p_days integer, p_condition text, p_note text, p_photo_path text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  i        record;
  v_max    int;
  v_active int;
  v_req    uuid;
  v_label  text;
  v_email  text;
  v_loc    text;
  v_model  text;
begin
  if v_uid is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  perform public.expire_requests();
  perform public.expire_pickups();

  if not public._valid_days(p_days) then
    raise exception 'จำนวนวันยืมไม่ถูกต้อง';
  end if;
  perform public._check_evidence(v_uid, p_condition, p_note, p_photo_path);

  select * into i from public.items where id = p_item_id for update;
  if not found then raise exception 'ไม่พบอุปกรณ์'; end if;
  v_label := coalesce(i.item_code, i.name);
  if i.status <> 'available' then
    raise exception '% ยืมไม่ได้ตอนนี้ (สถานะ: %)', v_label, public._status_th(i.status);
  end if;

  v_model := public._item_model(i.item_prefix, i.name);
  if exists (select 1 from public.pickup_requests where user_id = v_uid and status = 'scheduled'
             and lower(btrim(item_prefix)) = v_model) then
    raise exception 'คุณมีนัดรับรุ่นนี้อยู่ — กด "ยืนยันรับของตามนัด" แทน';
  end if;
  -- มีคำขอนัดรับรุ่นนี้ที่ยังรอนัด แต่มาสแกนยืมเองเลย → ยกเลิกคำขอนัดรับ (ชิ้นที่กันไว้ใช้กับการยืมนี้แทน)
  --   ยืมไม่สำเร็จ (raise ด้านล่าง) = ย้อนกลับทั้งหมด คำขอนัดรับยังอยู่
  update public.pickup_requests set status = 'cancelled', decided_at = now(),
         decision_note = 'ยืมเองด้วยการสแกนแล้ว'
   where user_id = v_uid and status = 'pending' and lower(btrim(item_prefix)) = v_model;
  if public._pickup_free(v_model) <= 0 then
    raise exception 'ชิ้นที่เหลือถูกกันไว้ให้คนที่ขอนัดรับแล้ว';
  end if;

  v_max := public._setting_int('max_active_borrows', 3);
  v_active := public._active_borrow_count(v_uid);
  if v_active >= v_max then
    raise exception 'ยืมพร้อมกันได้สูงสุด % ชิ้น (ตอนนี้ยืม/รออนุมัติอยู่ % ชิ้น)', v_max, v_active;
  end if;

  insert into public.borrow_requests
    (kind, item_id, user_id, location_id, days, condition, condition_note, photo_path, expires_at)
  values
    ('borrow', i.id, v_uid, i.location_id, p_days, p_condition, nullif(btrim(p_note), ''), p_photo_path,
     now() + make_interval(mins => public._setting_int('request_expiry_minutes', 30)))
  returning id into v_req;

  update public.items set status = 'reserved' where id = i.id;

  select email into v_email from public.profiles where id = v_uid;
  select name into v_loc from public.borrow_locations where id = i.location_id;
  perform public._notify_staff('request_borrow', 'มีคำขอยืมใหม่',
    format('%s ขอยืม "%s" %s วัน · ห้อง %s', coalesce(v_email, 'นักศึกษา'), v_label, p_days, coalesce(v_loc, '-')),
    v_label, v_req, i.id);

  return v_req;
end;
$$;

create or replace function public.scan_lookup(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_item uuid;
  i      record;
  rec    record;
  req    record;
  pk     record;
  v_loc  text;
  v_state text;
  v_overdue boolean;
  v_model text;
  v_held boolean := false;
  v_own_pending int;
begin
  if v_uid is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  perform public.expire_requests();
  perform public.expire_pickups();

  v_item := public._find_item(p_code);
  if v_item is null then
    return jsonb_build_object('found', false);
  end if;

  select * into i from public.items where id = v_item;
  select name into v_loc from public.borrow_locations where id = i.location_id;
  select * into rec from public.borrow_records
    where item_id = i.id and status in ('borrowed', 'pending_return')
    order by borrow_date desc limit 1;
  select * into req from public.borrow_requests
    where item_id = i.id and status = 'pending' limit 1;

  v_state := case
    when i.status in ('repair', 'retired')             then 'unavailable'
    when req.id is not null and req.user_id = v_uid    then 'my_pending'
    when rec.id is not null and rec.user_id = v_uid    then 'mine'
    when i.status = 'available' and req.id is null     then 'available'
    else 'taken'
  end;
  v_overdue := coalesce(rec.due_date < public._bkk_today(), false);

  v_model := public._item_model(i.item_prefix, i.name);
  select * into pk from public.pickup_requests
    where user_id = v_uid and status = 'scheduled' and lower(btrim(item_prefix)) = v_model
    order by pickup_at limit 1;
  if v_state = 'available' and pk.id is null then
    -- คำขอรอนัดของตัวเองกันชิ้นไว้ให้ตัวเอง → ไม่นับว่าถูกกัน (ยืมแล้วคำขอนัดรับถูกยกเลิกให้ใน request_borrow)
    select count(*) into v_own_pending from public.pickup_requests
      where user_id = v_uid and status = 'pending' and lower(btrim(item_prefix)) = v_model;
    v_held := public._pickup_free(v_model) + v_own_pending <= 0;
  end if;

  return jsonb_build_object(
    'found', true,
    'state', v_state,
    'item', jsonb_build_object(
      'id', i.id, 'item_code', i.item_code, 'name', i.name, 'status', i.status,
      'status_th', public._status_th(i.status), 'image_url', i.image_url,
      'barcode', i.barcode, 'location', v_loc
    ),
    'due_date', rec.due_date,
    'overdue', v_overdue,
    'can_renew', coalesce(rec.user_id = v_uid and rec.status = 'borrowed' and rec.renew_count = 0 and not v_overdue, false),
    'pending', case when req.user_id = v_uid then
      jsonb_build_object('id', req.id, 'kind', req.kind, 'expires_at', req.expires_at) end,
    'my_pickup', case when pk.id is not null then
      jsonb_build_object('id', pk.id, 'pickup_at', pk.pickup_at, 'days', pk.days) end,
    'held', v_held,
    'day_options', (select value from public.app_settings where key = 'borrow_day_options'),
    'max_active_borrows', public._setting_int('max_active_borrows', 3)
  );
end;
$$;
