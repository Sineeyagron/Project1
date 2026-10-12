-- F1 ป๊อปอัปยืนยัน + กฎการยืม-คืน (docs/SPEC_NEW_FEATURES.md)
-- 1) กฎตั้งต้นใน app_settings.borrow_rules (jsonb array ของข้อความ) — อ่านได้ทุกคนที่ล็อกอิน / แก้ได้เฉพาะ admin (policy เดิมของ app_settings)
--    ตัวแปร {max} {days} {expiry} แอปแทนค่าจาก app_settings ตอนแสดงผล
-- 2) request_renew: เกินกำหนดแล้ว (due_date < วันนี้ไทย) ห้ามยืมต่อ — วันครบกำหนดพอดียังยืมต่อได้
-- 3) scan_lookup: can_renew = false เมื่อเกินกำหนด + เพิ่ม overdue ให้แอปบอกเหตุผล
-- (คำขอยืมต่อที่ส่งภายในวันครบกำหนด แล้วผู้ดูแลอนุมัติหลังเที่ยงคืน ยังอนุมัติได้ — decide_request ไม่แตะ)

insert into public.app_settings (key, value, updated_at)
values ('borrow_rules', jsonb_build_array(
  'ยืมพร้อมกันได้สูงสุด {max} ชิ้น (นับรวมคำขอที่รออนุมัติ)',
  'เลือกระยะยืมได้ {days} วัน',
  'ต้องถ่ายรูปและระบุสภาพทุกครั้งที่ยืมและคืน',
  'คำขอรอผู้ดูแลอนุมัติภายใน {expiry} นาที ไม่มีคนตอบ: ขอยืม = หมดอายุ / ขอคืน = คืนอัตโนมัติ (ผู้ดูแลตรวจย้อนหลัง)',
  'คืนแล้วของชำรุด อาจมีค่าเสียหาย',
  'ยืมต่อได้ 1 ครั้ง ต้องขอภายในวันครบกำหนด วันที่เพิ่มนับต่อจากวันครบกำหนดเดิม'
), now())
on conflict (key) do nothing;

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
  if rec.due_date is not null and rec.due_date < public._bkk_today() then
    raise exception 'เกินกำหนดคืนแล้ว ยืมต่อไม่ได้ กรุณานำมาคืน';
  end if;
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
  v_overdue boolean;
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
  v_overdue := coalesce(rec.due_date < public._bkk_today(), false);

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
    'day_options', (select value from public.app_settings where key = 'borrow_day_options'),
    'max_active_borrows', public._setting_int('max_active_borrows', 3)
  );
end;
$$;
