-- =====================================================================
-- เฟส 3.2: กติกาการยืม/คืน/ยืมต่อ (RPC) + งานตั้งเวลา (pg_cron)
-- ดูแผน: PLAN_ระบบยืมของ.md ข้อ 2.4, 2.6
--
-- ทุกฟังก์ชันเป็น security definer → ข้าม RLS ได้ จึงต้องเช็กสิทธิ์เองทุกครั้ง
-- ล็อกแถว (for update) ก่อนเปลี่ยนสถานะ → 2 คนสแกนชิ้นเดียวกันพร้อมกันได้คนเดียว
-- ข้อความ error เป็นภาษาไทย แอปเอาไปแสดงได้ตรง ๆ
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. ตัวช่วย
-- ---------------------------------------------------------------------

-- บทบาทที่เป็นผู้ดูแล (เฟส 4 เพิ่ม 'ta' ตรงนี้ที่เดียว)
create or replace function public._staff_roles()
returns text[]
language sql
immutable
set search_path = public
as $$ select array['admin']::text[]; $$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any (public._staff_roles())
  );
$$;

create or replace function public._setting_int(p_key text, p_default int)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (value #>> '{}')::int from public.app_settings where key = p_key), p_default);
$$;

-- วันที่ตามเวลาไทย (DB เป็น UTC)
create or replace function public._bkk_today()
returns date
language sql
stable
set search_path = public
as $$ select (now() at time zone 'Asia/Bangkok')::date; $$;

create or replace function public._thai_date(p_date date)
returns text
language sql
immutable
set search_path = public
as $$
  select extract(day from p_date)::int || ' '
      || (array['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'])[extract(month from p_date)::int]
      || ' ' || (extract(year from p_date)::int + 543);
$$;

create or replace function public._status_th(p_status text)
returns text
language sql
immutable
set search_path = public
as $$
  select case p_status
    when 'available' then 'ว่าง'
    when 'reserved'  then 'มีคนขอยืมอยู่'
    when 'borrowed'  then 'ถูกยืม'
    when 'repair'    then 'ซ่อมบำรุง'
    when 'retired'   then 'จำหน่ายแล้ว'
    else p_status end;
$$;

create or replace function public._notify(
  p_user uuid, p_type text, p_title text, p_body text,
  p_item_name text, p_request uuid, p_item uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, item_name, request_id, item_id)
  values (p_user, p_type, p_title, p_body, p_item_name, p_request, p_item);
$$;

create or replace function public._notify_staff(
  p_type text, p_title text, p_body text,
  p_item_name text, p_request uuid, p_item uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, item_name, request_id, item_id)
  select p.id, p_type, p_title, p_body, p_item_name, p_request, p_item
  from public.profiles p
  where p.role = any (public._staff_roles());
$$;

-- หาอุปกรณ์จากค่าที่สแกน: รหัส 4 ตัว → UUID → QR รุ่นเก่า (JSON มีแค่ชื่อ)
create or replace function public._find_item(p_code text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_name text;
begin
  select id into v_id from public.items where barcode = upper(btrim(p_code)) limit 1;
  if v_id is not null then return v_id; end if;

  begin
    select id into v_id from public.items where id = btrim(p_code)::uuid;
  exception when others then v_id := null;
  end;
  if v_id is not null then return v_id; end if;

  begin
    v_name := (p_code::jsonb) ->> 'name';
  exception when others then v_name := null;
  end;
  if v_name is not null then
    -- ชื่อซ้ำหลายชิ้น: เอาชิ้นที่ฉันยืมอยู่ก่อน แล้วค่อยชิ้นที่ว่าง
    select i.id into v_id
    from public.items i
    where lower(i.name) = lower(btrim(v_name)) and i.status <> 'retired'
    order by exists (
               select 1 from public.borrow_records b
               where b.item_id = i.id and b.user_id = auth.uid()
                 and b.status in ('borrowed', 'pending_return')
             ) desc,
             (i.status = 'available') desc,
             i.created_at
    limit 1;
  end if;
  return v_id;
end;
$$;

-- หลักฐานตอนยืม/คืน: สภาพ + รูปถ่ายที่อัปโหลดแล้วในโฟลเดอร์ของผู้ขอ และไม่ซ้ำกับคำขออื่น
create or replace function public._check_evidence(
  p_user uuid, p_condition text, p_note text, p_photo_path text
)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_condition is null or p_condition not in ('good', 'damaged') then
    raise exception 'กรุณาเลือกสภาพอุปกรณ์';
  end if;
  if p_condition = 'damaged' and nullif(btrim(p_note), '') is null then
    raise exception 'อุปกรณ์ชำรุด กรุณาระบุรายละเอียด';
  end if;
  if p_photo_path is null
     or p_photo_path not like p_user::text || '/%'
     or not exists (
       select 1 from storage.objects
       where bucket_id = 'borrow-photos' and name = p_photo_path
     ) then
    raise exception 'กรุณาถ่ายรูปอุปกรณ์ก่อนส่งคำขอ';
  end if;
  if exists (select 1 from public.borrow_requests where photo_path = p_photo_path) then
    raise exception 'รูปนี้ถูกใช้ไปแล้ว กรุณาถ่ายรูปใหม่';
  end if;
end;
$$;

create or replace function public._valid_days(p_days int)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from jsonb_array_elements_text(
      coalesce((select value from public.app_settings where key = 'borrow_day_options'), '[3,5,7]')
    ) d
    where d::int = p_days
  );
$$;

-- ---------------------------------------------------------------------
-- 1. คำขอหมดอายุ (pg_cron ทุก 1 นาที + เรียกซ้ำตอนเริ่มทุก RPC)
--    ยืม/ยืมต่อ → หมดอายุ ปล่อยของ / คืน → คืนอัตโนมัติ (ไม่ได้ตรวจสภาพ)
-- ---------------------------------------------------------------------
create or replace function public.expire_requests()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r       record;
  v_label text;
  v_count int := 0;
begin
  for r in
    select br.*, coalesce(i.item_code, i.name, 'อุปกรณ์') as label
    from public.borrow_requests br
    left join public.items i on i.id = br.item_id
    where br.status = 'pending' and br.expires_at <= now()
    for update of br skip locked
  loop
    v_label := r.label;

    if r.kind = 'return' then
      update public.borrow_records
      set status = 'returned',
          return_date = now(),
          auto_returned = true,
          return_photo_path = r.photo_path,
          return_condition = r.condition,
          return_condition_note = r.condition_note
      where id = r.borrow_record_id;

      update public.items set status = 'available'
      where id = r.item_id and status = 'borrowed';

      update public.borrow_requests
      set status = 'auto_returned', decided_at = now(),
          decision_note = 'คืนอัตโนมัติ ไม่ได้ตรวจสภาพ'
      where id = r.id;

      perform public._notify(r.user_id, 'auto_returned', 'คืนอัตโนมัติแล้ว',
        format('ไม่มีผู้ดูแลยืนยันภายในเวลา ระบบบันทึกการคืน "%s" ให้อัตโนมัติ', v_label),
        v_label, r.id, r.item_id);
      perform public._notify_staff('auto_returned', 'คืนอัตโนมัติ (ยังไม่ได้ตรวจสภาพ)',
        format('"%s" ถูกคืนอัตโนมัติ ควรตรวจสภาพย้อนหลัง', v_label),
        v_label, r.id, r.item_id);
    else
      if r.kind = 'borrow' then
        update public.items set status = 'available'
        where id = r.item_id and status = 'reserved';
      end if;

      update public.borrow_requests
      set status = 'expired', decided_at = now()
      where id = r.id;

      perform public._notify(r.user_id, 'expired',
        case when r.kind = 'borrow' then 'คำขอยืมหมดอายุ' else 'คำขอยืมต่อหมดอายุ' end,
        format('ไม่มีผู้ดูแลตอบคำขอ "%s" ภายในเวลาที่กำหนด', v_label),
        v_label, r.id, r.item_id);
    end if;

    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. สแกน → สถานะสำหรับผู้สแกน (ไม่บอกว่าคนอื่นคือใคร)
--    state: available | my_pending | mine | taken | unavailable
-- ---------------------------------------------------------------------
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
  v_loc  text;
  v_state text;
begin
  if v_uid is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  perform public.expire_requests();

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

  return jsonb_build_object(
    'found', true,
    'state', v_state,
    'item', jsonb_build_object(
      'id', i.id, 'item_code', i.item_code, 'name', i.name, 'status', i.status,
      'status_th', public._status_th(i.status), 'image_url', i.image_url,
      'barcode', i.barcode, 'location', v_loc
    ),
    'due_date', rec.due_date,
    'can_renew', coalesce(rec.user_id = v_uid and rec.status = 'borrowed' and rec.renew_count = 0, false),
    'pending', case when req.user_id = v_uid then
      jsonb_build_object('id', req.id, 'kind', req.kind, 'expires_at', req.expires_at) end,
    'day_options', (select value from public.app_settings where key = 'borrow_day_options'),
    'max_active_borrows', public._setting_int('max_active_borrows', 3)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 3. นักศึกษา: ขอยืม
-- ---------------------------------------------------------------------
create or replace function public.request_borrow(
  p_item_id uuid, p_days int, p_condition text, p_note text, p_photo_path text
)
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
begin
  if v_uid is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  perform public.expire_requests();

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

  v_max := public._setting_int('max_active_borrows', 3);
  select
    (select count(*) from public.borrow_records
      where user_id = v_uid and status in ('borrowed', 'pending_return'))
  + (select count(*) from public.borrow_requests
      where user_id = v_uid and kind = 'borrow' and status = 'pending')
  into v_active;
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

-- ---------------------------------------------------------------------
-- 4. นักศึกษา: ขอคืน
-- ---------------------------------------------------------------------
create or replace function public.request_return(
  p_item_id uuid, p_condition text, p_note text, p_photo_path text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  rec     record;
  i       record;
  v_req   uuid;
  v_label text;
  v_email text;
  v_loc   text;
begin
  if v_uid is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  perform public.expire_requests();

  select * into rec from public.borrow_records
    where item_id = p_item_id and user_id = v_uid and status = 'borrowed'
    order by borrow_date desc limit 1
    for update;
  if not found then raise exception 'คุณไม่ได้ยืมอุปกรณ์ชิ้นนี้อยู่'; end if;

  if exists (select 1 from public.borrow_requests where item_id = p_item_id and status = 'pending') then
    raise exception 'มีคำขอของอุปกรณ์ชิ้นนี้รอดำเนินการอยู่แล้ว';
  end if;
  perform public._check_evidence(v_uid, p_condition, p_note, p_photo_path);

  select * into i from public.items where id = p_item_id;
  v_label := coalesce(i.item_code, i.name);

  insert into public.borrow_requests
    (kind, item_id, user_id, borrow_record_id, location_id, condition, condition_note, photo_path, expires_at)
  values
    ('return', p_item_id, v_uid, rec.id, i.location_id, p_condition, nullif(btrim(p_note), ''), p_photo_path,
     now() + make_interval(mins => public._setting_int('request_expiry_minutes', 30)))
  returning id into v_req;

  update public.borrow_records set status = 'pending_return' where id = rec.id;

  select email into v_email from public.profiles where id = v_uid;
  select name into v_loc from public.borrow_locations where id = i.location_id;
  perform public._notify_staff('request_return', 'มีคำขอคืนใหม่',
    format('%s ขอคืน "%s"%s · ห้อง %s', coalesce(v_email, 'นักศึกษา'), v_label,
           case when p_condition = 'damaged' then ' (แจ้งว่าชำรุด)' else '' end, coalesce(v_loc, '-')),
    v_label, v_req, p_item_id);

  return v_req;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. นักศึกษา: ขอยืมต่อ (ได้ครั้งเดียวต่อการยืม)
-- ---------------------------------------------------------------------
create or replace function public.request_renew(p_item_id uuid, p_days int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  rec     record;
  i       record;
  v_req   uuid;
  v_label text;
  v_email text;
begin
  if v_uid is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  perform public.expire_requests();

  if not public._valid_days(p_days) then
    raise exception 'จำนวนวันไม่ถูกต้อง';
  end if;

  select * into rec from public.borrow_records
    where item_id = p_item_id and user_id = v_uid and status = 'borrowed'
    order by borrow_date desc limit 1
    for update;
  if not found then raise exception 'คุณไม่ได้ยืมอุปกรณ์ชิ้นนี้อยู่'; end if;
  if rec.renew_count >= 1 then raise exception 'ยืมต่อได้ครั้งเดียว'; end if;
  if exists (select 1 from public.borrow_requests where item_id = p_item_id and status = 'pending') then
    raise exception 'มีคำขอของอุปกรณ์ชิ้นนี้รอดำเนินการอยู่แล้ว';
  end if;

  select * into i from public.items where id = p_item_id;
  v_label := coalesce(i.item_code, i.name);

  insert into public.borrow_requests
    (kind, item_id, user_id, borrow_record_id, location_id, days, expires_at)
  values
    ('renew', p_item_id, v_uid, rec.id, i.location_id, p_days,
     now() + make_interval(mins => public._setting_int('request_expiry_minutes', 30)))
  returning id into v_req;

  select email into v_email from public.profiles where id = v_uid;
  perform public._notify_staff('request_renew', 'มีคำขอยืมต่อ',
    format('%s ขอยืม "%s" ต่ออีก %s วัน (เดิมครบ %s)', coalesce(v_email, 'นักศึกษา'), v_label, p_days,
           public._thai_date(rec.due_date)),
    v_label, v_req, p_item_id);

  return v_req;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. นักศึกษา: ยกเลิกคำขอของตัวเองที่ยังรออยู่
-- ---------------------------------------------------------------------
create or replace function public.cancel_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r     record;
begin
  if v_uid is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;

  select * into r from public.borrow_requests
    where id = p_request_id and user_id = v_uid
    for update;
  if not found then raise exception 'ไม่พบคำขอ'; end if;
  if r.status <> 'pending' then raise exception 'คำขอนี้ไม่ได้รอดำเนินการแล้ว'; end if;

  if r.kind = 'borrow' then
    update public.items set status = 'available' where id = r.item_id and status = 'reserved';
  elsif r.kind = 'return' then
    update public.borrow_records set status = 'borrowed'
    where id = r.borrow_record_id and status = 'pending_return';
  end if;

  update public.borrow_requests
  set status = 'cancelled', decided_at = now()
  where id = r.id;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. ผู้ดูแล: อนุมัติ / ปฏิเสธ
--    คืน: ต้องระบุผลตรวจสภาพ (good/damaged) ชำรุด → ของเป็น "ซ่อม" + ค่าเสียหาย (ไม่บังคับ)
-- ---------------------------------------------------------------------
create or replace function public.decide_request(
  p_request_id  uuid,
  p_approve     boolean,
  p_note        text default null,
  p_condition   text default null,
  p_damage_cost numeric default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  r       record;
  i       record;
  v_label text;
  v_due   date;
  v_rec   uuid;
  v_note  text := nullif(btrim(p_note), '');
begin
  if not public.is_staff() then raise exception 'เฉพาะผู้ดูแลเท่านั้น'; end if;
  perform public.expire_requests();

  select * into r from public.borrow_requests where id = p_request_id for update;
  if not found then raise exception 'ไม่พบคำขอ'; end if;
  if r.status <> 'pending' then
    raise exception 'คำขอนี้ถูกดำเนินการไปแล้ว (สถานะ: %)', r.status;
  end if;
  if not p_approve and v_note is null then
    raise exception 'กรุณาระบุเหตุผลที่ปฏิเสธ';
  end if;
  if p_damage_cost is not null and p_damage_cost < 0 then
    raise exception 'ค่าเสียหายต้องไม่ติดลบ';
  end if;

  select * into i from public.items where id = r.item_id;
  v_label := coalesce(i.item_code, i.name, 'อุปกรณ์');

  if r.kind = 'borrow' then
    if p_approve then
      v_due := public._bkk_today() + r.days;
      insert into public.borrow_records
        (user_id, item_id, status, borrow_date, due_date, borrow_request_id,
         borrow_photo_path, borrow_condition, borrow_condition_note)
      values
        (r.user_id, r.item_id, 'borrowed', now(), v_due, r.id,
         r.photo_path, r.condition, r.condition_note)
      returning id into v_rec;
      update public.items set status = 'borrowed' where id = r.item_id;
      update public.borrow_requests set borrow_record_id = v_rec where id = r.id;
      perform public._notify(r.user_id, 'approved', 'อนุมัติคำขอยืมแล้ว',
        format('ยืม "%s" ได้แล้ว กำหนดคืน %s', v_label, public._thai_date(v_due)),
        v_label, r.id, r.item_id);
    else
      update public.items set status = 'available' where id = r.item_id and status = 'reserved';
      perform public._notify(r.user_id, 'declined', 'คำขอยืมถูกปฏิเสธ',
        format('"%s": %s', v_label, v_note), v_label, r.id, r.item_id);
    end if;

  elsif r.kind = 'return' then
    if p_approve then
      if p_condition is null or p_condition not in ('good', 'damaged') then
        raise exception 'กรุณาเลือกผลตรวจสภาพ (ปกติ / ชำรุด)';
      end if;
      update public.borrow_records
      set status = 'returned',
          return_date = now(),
          return_photo_path = r.photo_path,
          return_condition = p_condition,
          return_condition_note = r.condition_note,
          return_checked_by = v_uid,
          return_checked_at = now(),
          damage_cost = case when p_condition = 'damaged' then p_damage_cost end,
          damage_note = case when p_condition = 'damaged' then v_note end
      where id = r.borrow_record_id;
      update public.items
      set status = case when p_condition = 'damaged' then 'repair' else 'available' end
      where id = r.item_id;
      perform public._notify(r.user_id, 'approved', 'ยืนยันการคืนแล้ว',
        format('คืน "%s" เรียบร้อย%s', v_label,
               case when p_condition = 'damaged' then ' (ตรวจพบชำรุด'
                    || case when p_damage_cost is not null then ' ค่าเสียหาย ' || p_damage_cost || ' บาท' else '' end
                    || ')' else '' end),
        v_label, r.id, r.item_id);
    else
      update public.borrow_records set status = 'borrowed'
      where id = r.borrow_record_id and status = 'pending_return';
      perform public._notify(r.user_id, 'declined', 'คำขอคืนถูกปฏิเสธ',
        format('"%s": %s', v_label, v_note), v_label, r.id, r.item_id);
    end if;

  else -- renew
    if p_approve then
      update public.borrow_records
      set due_date = due_date + r.days,
          renew_count = renew_count + 1,
          due_soon_notified_at = null,
          overdue_notified_at = null
      where id = r.borrow_record_id
      returning due_date into v_due;
      perform public._notify(r.user_id, 'renewed', 'อนุมัติยืมต่อแล้ว',
        format('"%s" กำหนดคืนใหม่ %s', v_label, public._thai_date(v_due)),
        v_label, r.id, r.item_id);
    else
      perform public._notify(r.user_id, 'declined', 'คำขอยืมต่อถูกปฏิเสธ',
        format('"%s": %s', v_label, v_note), v_label, r.id, r.item_id);
    end if;
  end if;

  update public.borrow_requests
  set status = case when p_approve then 'approved' else 'declined' end,
      decided_by = v_uid,
      decided_at = now(),
      decision_note = v_note
  where id = r.id;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. แจ้งเตือนกำหนดคืน (pg_cron ทุกวัน 08:00 เวลาไทย)
--    พรุ่งนี้ครบกำหนด → ผู้ยืม / เกินกำหนด → ผู้ยืม + ผู้ดูแล (ครั้งเดียว)
-- ---------------------------------------------------------------------
create or replace function public.send_due_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  rec     record;
  v_email text;
  v_count int := 0;
begin
  for rec in
    select br.*, coalesce(i.item_code, i.name, 'อุปกรณ์') as label
    from public.borrow_records br
    left join public.items i on i.id = br.item_id
    where br.status in ('borrowed', 'pending_return')
      and br.due_date = public._bkk_today() + 1
      and br.due_soon_notified_at is null
    for update of br skip locked
  loop
    perform public._notify(rec.user_id, 'due_soon', 'พรุ่งนี้ครบกำหนดคืน',
      format('"%s" ครบกำหนดคืน %s', rec.label, public._thai_date(rec.due_date)),
      rec.label, null, rec.item_id);
    update public.borrow_records set due_soon_notified_at = now() where id = rec.id;
    v_count := v_count + 1;
  end loop;

  for rec in
    select br.*, coalesce(i.item_code, i.name, 'อุปกรณ์') as label
    from public.borrow_records br
    left join public.items i on i.id = br.item_id
    where br.status in ('borrowed', 'pending_return')
      and br.due_date < public._bkk_today()
      and br.overdue_notified_at is null
    for update of br skip locked
  loop
    select email into v_email from public.profiles where id = rec.user_id;
    perform public._notify(rec.user_id, 'overdue', 'เกินกำหนดคืนแล้ว',
      format('"%s" ครบกำหนดคืนตั้งแต่ %s กรุณานำมาคืน', rec.label, public._thai_date(rec.due_date)),
      rec.label, null, rec.item_id);
    perform public._notify_staff('overdue', 'มีอุปกรณ์เกินกำหนดคืน',
      format('"%s" ยืมโดย %s ครบกำหนด %s', rec.label, coalesce(v_email, '-'), public._thai_date(rec.due_date)),
      rec.label, null, rec.item_id);
    update public.borrow_records set overdue_notified_at = now() where id = rec.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. สิทธิ์เรียกใช้
--    ตัวช่วย (_xxx) และงานตั้งเวลา: เรียกผ่าน API ไม่ได้
-- ---------------------------------------------------------------------
revoke execute on function public._staff_roles() from public, anon, authenticated;
revoke execute on function public._setting_int(text, int) from public, anon, authenticated;
revoke execute on function public._bkk_today() from public, anon, authenticated;
revoke execute on function public._thai_date(date) from public, anon, authenticated;
revoke execute on function public._status_th(text) from public, anon, authenticated;
revoke execute on function public._notify(uuid, text, text, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public._notify_staff(text, text, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public._find_item(text) from public, anon, authenticated;
revoke execute on function public._check_evidence(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public._valid_days(int) from public, anon, authenticated;
revoke execute on function public.send_due_reminders() from public, anon, authenticated;

revoke execute on function public.expire_requests() from public, anon;
revoke execute on function public.scan_lookup(text) from public, anon;
revoke execute on function public.request_borrow(uuid, int, text, text, text) from public, anon;
revoke execute on function public.request_return(uuid, text, text, text) from public, anon;
revoke execute on function public.request_renew(uuid, int) from public, anon;
revoke execute on function public.cancel_request(uuid) from public, anon;
revoke execute on function public.decide_request(uuid, boolean, text, text, numeric) from public, anon;

grant execute on function public.expire_requests() to authenticated;
grant execute on function public.scan_lookup(text) to authenticated;
grant execute on function public.request_borrow(uuid, int, text, text, text) to authenticated;
grant execute on function public.request_return(uuid, text, text, text) to authenticated;
grant execute on function public.request_renew(uuid, int) to authenticated;
grant execute on function public.cancel_request(uuid) to authenticated;
grant execute on function public.decide_request(uuid, boolean, text, text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 10. งานตั้งเวลา
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule('expire-borrow-requests', '* * * * *', $$select public.expire_requests()$$);
select cron.schedule('borrow-due-reminders', '0 1 * * *', $$select public.send_due_reminders()$$); -- 01:00 UTC = 08:00 ไทย
