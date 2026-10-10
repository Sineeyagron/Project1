-- F2 ขอยืมแบบนัดรับ (ระบบยืม-คืน) — docs/SPEC_NEW_FEATURES.md
-- นศ. เลือกรุ่น (items.item_prefix — ไม่มีใช้ชื่อ) ไม่ต้องสแกน → ผู้ดูแลกำหนดวัน-เวลานัด → กันของรุ่นนั้น 1 ชิ้น
-- วันนัด นศ. สแกน QR ชิ้นที่ได้ + ถ่ายรูป = ยืมทันที (claim_pickup) ไม่ต้องอนุมัติซ้ำ
-- หมดอายุ 12 ชม. (ไม่มีคนนัด) / เลยนัด 10 นาที = no_show → รวมใน cron expire-borrow-requests เดิม (ไม่สร้าง cron ใหม่)
-- กันของซ้อน: ว่างของรุ่น = ชิ้น available − นัด scheduled ที่ยังไม่รับ → request_borrow เดิมเช็กด้วย
-- โควตา max_active_borrows นับรวมนัดรับ pending/scheduled

-- ───────────── ตาราง ─────────────
create table if not exists public.pickup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_prefix text not null,
  location_id uuid references public.borrow_locations(id) on delete set null,
  days int not null,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'picked_up', 'declined', 'expired', 'cancelled', 'no_show')),
  pickup_at timestamptz,
  scheduled_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  picked_item_id uuid references public.items(id) on delete set null,
  borrow_record_id uuid references public.borrow_records(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);
create index if not exists pickup_requests_status_idx on public.pickup_requests (status);
create index if not exists pickup_requests_user_idx on public.pickup_requests (user_id);

alter table public.pickup_requests enable row level security;
drop policy if exists "pickup_requests: เจ้าของหรือผู้ดูแลอ่านได้" on public.pickup_requests;
create policy "pickup_requests: เจ้าของหรือผู้ดูแลอ่านได้" on public.pickup_requests
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_staff()));
-- ไม่มี policy เขียน → ผ่าน RPC เท่านั้น

-- แจ้งเตือนประเภทใหม่ (ถึง นศ.)
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'borrow', 'return', 'request_borrow', 'request_return', 'request_renew', 'approved', 'declined', 'expired',
  'cancelled', 'auto_returned', 'renewed', 'due_soon', 'overdue', 'warranty_soon', 'warranty_expired',
  'age_warn', 'age_replace', 'role_changed', 'room_report', 'room_report_accepted', 'room_report_closed',
  'pickup_scheduled', 'pickup_declined', 'pickup_expired', 'pickup_cancelled', 'pickup_no_show'
]));

-- สัญญาณกล่องคำขอผู้ดูแล (ช่อง staff เดิม event "request")
create or replace function public._pickup_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  perform realtime.send(jsonb_build_object('id', new.id, 'kind', 'pickup', 'status', new.status), 'request', 'staff', true);
  return null;
end;
$$;
revoke execute on function public._pickup_broadcast() from public, anon, authenticated;
drop trigger if exists pickup_requests_broadcast on public.pickup_requests;
create trigger pickup_requests_broadcast
  after insert or update of status on public.pickup_requests
  for each row execute function public._pickup_broadcast();

-- ───────────── ตัวช่วย ─────────────
-- รุ่นของอุปกรณ์ (ตรงกับที่หน้าอุปกรณ์จัดกลุ่ม: item_prefix → ไม่มีใช้ชื่อ)
create or replace function public._item_model(p_prefix text, p_name text)
returns text
language sql
immutable
as $$ select lower(btrim(coalesce(nullif(btrim(p_prefix), ''), p_name, ''))) $$;

-- ชิ้นว่างของรุ่น หลังหักนัด scheduled ที่ยังไม่รับ
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
           where status = 'scheduled' and lower(btrim(item_prefix)) = lower(btrim(p_model)))::int
$$;

-- ยืม/รออนุมัติ/นัดรับ ที่นับโควตา
create or replace function public._active_borrow_count(p_user uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select ((select count(*) from public.borrow_records where user_id = p_user and status in ('borrowed', 'pending_return'))
        + (select count(*) from public.borrow_requests where user_id = p_user and kind = 'borrow' and status = 'pending')
        + (select count(*) from public.pickup_requests where user_id = p_user and status in ('pending', 'scheduled')))::int
$$;

-- "10/10/2569 13:05" เวลาไทย
create or replace function public._thai_datetime(p_at timestamptz)
returns text
language sql
stable
as $$
  select to_char(p_at at time zone 'Asia/Bangkok', 'DD/MM/')
      || (extract(year from (p_at at time zone 'Asia/Bangkok'))::int + 543)
      || ' ' || to_char(p_at at time zone 'Asia/Bangkok', 'HH24:MI')
$$;

revoke execute on function public._pickup_free(text) from public, anon, authenticated;
revoke execute on function public._active_borrow_count(uuid) from public, anon, authenticated;

-- ───────────── หมดอายุ / ไม่มาตามนัด (เรียกจาก cron เดิม + ต้น RPC) ─────────────
create or replace function public.expire_pickups()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    select * from public.pickup_requests
    where (status = 'pending' and expires_at <= now())
       or (status = 'scheduled' and pickup_at + interval '10 minutes' <= now())
    for update skip locked
  loop
    if r.status = 'pending' then
      update public.pickup_requests set status = 'expired', decided_at = now() where id = r.id;
      perform public._notify(r.user_id, 'pickup_expired', 'คำขอนัดรับหมดอายุ',
        format('ไม่มีผู้ดูแลนัดเวลารับ "%s" ภายใน 12 ชั่วโมง ส่งคำขอใหม่ได้', r.item_prefix), r.item_prefix, null, null);
    else
      update public.pickup_requests set status = 'no_show', decided_at = now(),
        decision_note = 'เลยเวลานัด 10 นาที ยกเลิกอัตโนมัติ' where id = r.id;
      perform public._notify(r.user_id, 'pickup_no_show', 'นัดรับถูกยกเลิก',
        format('เลยเวลานัดรับ "%s" (%s) เกิน 10 นาที ระบบยกเลิกนัดให้อัตโนมัติ', r.item_prefix, public._thai_datetime(r.pickup_at)),
        r.item_prefix, null, null);
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.expire_pickups() from public, anon, authenticated;

-- ───────────── RPC นักศึกษา ─────────────
create or replace function public.request_pickup(p_prefix text, p_days int, p_note text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_model text := lower(btrim(coalesce(p_prefix, '')));
  v_name text;
  v_loc uuid;
  v_max int;
  v_active int;
  v_id uuid;
begin
  if v_uid is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  perform public.expire_requests();
  perform public.expire_pickups();

  if not public._valid_days(p_days) then raise exception 'จำนวนวันยืมไม่ถูกต้อง'; end if;
  if length(coalesce(p_note, '')) > 200 then raise exception 'หมายเหตุยาวเกิน 200 ตัวอักษร'; end if;

  select coalesce(nullif(btrim(item_prefix), ''), name), location_id into v_name, v_loc
  from public.items
  where retired_at is null and public._item_model(item_prefix, name) = v_model
  order by item_no nulls last limit 1;
  if v_name is null then raise exception 'ไม่พบอุปกรณ์รุ่นนี้'; end if;

  if exists (select 1 from public.pickup_requests where user_id = v_uid and status in ('pending', 'scheduled')
             and lower(btrim(item_prefix)) = v_model) then
    raise exception 'คุณมีคำขอนัดรับรุ่นนี้อยู่แล้ว';
  end if;

  v_max := public._setting_int('max_active_borrows', 3);
  v_active := public._active_borrow_count(v_uid);
  if v_active >= v_max then
    raise exception 'ยืมพร้อมกันได้สูงสุด % ชิ้น (ตอนนี้ยืม/รออนุมัติ/นัดรับอยู่ % ชิ้น)', v_max, v_active;
  end if;

  if public._pickup_free(v_model) <= 0 then
    raise exception 'รุ่นนี้ไม่มีชิ้นว่างตอนนี้';
  end if;

  insert into public.pickup_requests (user_id, item_prefix, location_id, days, note)
  values (v_uid, v_name, v_loc, p_days, nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- ยกเลิก: เจ้าของ (รอ/นัดแล้ว) หรือผู้ดูแล (p_no_show = นศ. ไม่มาตามนัด)
create or replace function public.cancel_pickup(p_id uuid, p_no_show boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
      format('ผู้ดูแลยกเลิกนัดรับ "%s" เพราะไม่มาตามนัด (%s)', r.item_prefix, public._thai_datetime(r.pickup_at)),
      r.item_prefix, null, null);
  else
    update public.pickup_requests set status = 'cancelled', decided_at = now() where id = p_id;
    perform public._notify(r.user_id, 'pickup_cancelled', 'นัดรับถูกยกเลิก',
      format('ผู้ดูแลยกเลิกคำขอนัดรับ "%s"', r.item_prefix), r.item_prefix, null, null);
  end if;
end;
$$;

-- วันนัด: สแกนชิ้นที่ได้ + รูป/สภาพ → บันทึกยืมทันที
create or replace function public.claim_pickup(p_item_id uuid, p_condition text, p_note text, p_photo_path text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  i record;
  r record;
  v_label text;
  v_due date;
  v_rec uuid;
begin
  if v_uid is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  perform public.expire_requests();
  perform public.expire_pickups();
  perform public._check_evidence(v_uid, p_condition, p_note, p_photo_path);
  if exists (select 1 from public.borrow_records where borrow_photo_path = p_photo_path) then
    raise exception 'รูปนี้ถูกใช้ไปแล้ว กรุณาถ่ายรูปใหม่';
  end if;

  select * into i from public.items where id = p_item_id for update;
  if not found then raise exception 'ไม่พบอุปกรณ์'; end if;
  v_label := coalesce(i.item_code, i.name);
  if i.status <> 'available' then
    raise exception '% รับไม่ได้ตอนนี้ (สถานะ: %)', v_label, public._status_th(i.status);
  end if;

  select * into r from public.pickup_requests
  where user_id = v_uid and status = 'scheduled'
    and lower(btrim(item_prefix)) = public._item_model(i.item_prefix, i.name)
  order by pickup_at limit 1
  for update;
  if not found then raise exception 'คุณไม่มีนัดรับอุปกรณ์รุ่นนี้'; end if;

  v_due := public._bkk_today() + r.days;
  insert into public.borrow_records
    (user_id, item_id, status, borrow_date, due_date, borrow_photo_path, borrow_condition, borrow_condition_note)
  values
    (v_uid, i.id, 'borrowed', now(), v_due, p_photo_path, p_condition, nullif(btrim(p_note), ''))
  returning id into v_rec;
  update public.items set status = 'borrowed' where id = i.id;
  update public.pickup_requests set status = 'picked_up', picked_item_id = i.id, borrow_record_id = v_rec
  where id = r.id;

  perform public._notify(v_uid, 'borrow', 'รับของตามนัดแล้ว',
    format('ยืม "%s" แล้ว ครบกำหนดคืน %s', v_label, public._thai_date(v_due)), v_label, null, i.id);
  return v_rec;
end;
$$;

-- ───────────── RPC ผู้ดูแล ─────────────
create or replace function public.schedule_pickup(p_id uuid, p_pickup_at timestamptz)
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
  if public._pickup_free(r.item_prefix) <= 0 then
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

create or replace function public.decline_pickup(p_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null or not public.is_staff() then raise exception 'เฉพาะผู้ดูแล (TA / Admin) เท่านั้น'; end if;
  if nullif(btrim(p_note), '') is null then raise exception 'กรุณาระบุเหตุผล'; end if;
  select * into r from public.pickup_requests where id = p_id for update;
  if not found then raise exception 'ไม่พบคำขอนัดรับ'; end if;
  if r.status <> 'pending' then raise exception 'คำขอนี้ไม่ได้รอนัดเวลาแล้ว'; end if;
  if r.user_id = v_uid and not public.is_admin() then
    raise exception 'จัดการคำขอของตัวเองไม่ได้ — ให้ผู้ดูแลคนอื่นตัดสิน';
  end if;

  update public.pickup_requests
  set status = 'declined', decided_at = now(), scheduled_by = v_uid, decision_note = btrim(p_note)
  where id = p_id;
  perform public._notify(r.user_id, 'pickup_declined', 'คำขอนัดรับถูกปฏิเสธ',
    format('คำขอนัดรับ "%s" ถูกปฏิเสธ · เหตุผล: %s', r.item_prefix, btrim(p_note)), r.item_prefix, null, null);
end;
$$;

-- ───────────── ของเดิมที่ต้องรู้จักนัดรับ ─────────────
-- request_borrow: โควตานับนัดรับ + ห้ามสแกนยืมชิ้นที่ถูกกันไว้ให้คนนัด
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
  if public._pickup_free(v_model) <= 0 then
    raise exception 'ชิ้นที่เหลือถูกกันไว้ให้คนที่นัดรับแล้ว';
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

-- scan_lookup (ต่อจาก F1): + my_pickup (มีนัดรับรุ่นนี้) / held (ชิ้นที่เหลือถูกกันไว้ให้คนนัด)
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
    v_held := public._pickup_free(v_model) <= 0;
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

-- ───────────── สิทธิ์ ─────────────
revoke execute on function public.request_pickup(text, int, text) from public, anon;
revoke execute on function public.cancel_pickup(uuid, boolean) from public, anon;
revoke execute on function public.claim_pickup(uuid, text, text, text) from public, anon;
revoke execute on function public.schedule_pickup(uuid, timestamptz) from public, anon;
revoke execute on function public.decline_pickup(uuid, text) from public, anon;
grant execute on function public.request_pickup(text, int, text) to authenticated;
grant execute on function public.cancel_pickup(uuid, boolean) to authenticated;
grant execute on function public.claim_pickup(uuid, text, text, text) to authenticated;
grant execute on function public.schedule_pickup(uuid, timestamptz) to authenticated;
grant execute on function public.decline_pickup(uuid, text) to authenticated;

-- รวมการหมดอายุของนัดรับใน cron เดิม (ทุก 5 นาที) — ไม่สร้าง cron ใหม่
select cron.alter_job(
  (select jobid from cron.job where jobname = 'expire-borrow-requests'),
  command := 'select public.expire_requests(); select public.expire_pickups();'
);

-- นัดรับที่ยังไม่จบของฉัน + ชื่อคนนัด (นศ. อ่าน profiles ของผู้ดูแลไม่ได้)
create or replace function public.my_pickups()
returns table (id uuid, item_prefix text, days int, note text, status text, pickup_at timestamptz,
               scheduled_by_name text, created_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select pr.id, pr.item_prefix, pr.days, pr.note, pr.status, pr.pickup_at,
         coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)),
         pr.created_at, pr.expires_at
  from public.pickup_requests pr
  left join public.profiles p on p.id = pr.scheduled_by
  where pr.user_id = auth.uid() and pr.status in ('pending', 'scheduled')
  order by pr.created_at desc;
$$;
revoke execute on function public.my_pickups() from public, anon;
grant execute on function public.my_pickups() to authenticated;
