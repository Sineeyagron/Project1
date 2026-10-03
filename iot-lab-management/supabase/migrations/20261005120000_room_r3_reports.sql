-- ระบบห้อง R3: นักศึกษาแจ้งปัญหาเครื่อง/LAN → คิวให้ Admin/TA รับเป็นงานซ่อมหรือปิด → แจ้งเตือน
-- ระบบห้องคอม แยกจากระบบยืม-คืนเด็ดขาด — ใช้ตาราง notifications เดิม (เพิ่มประเภทใหม่เท่านั้น)
-- ไม่แตะฟังก์ชัน/ตารางของระบบยืม (_notify_staff ของระบบยืมไม่ใช้ — มี _room_notify_staff ของตัวเอง)

-- ───────────────────────────────────────────────────────────────
-- 1) ตารางคำแจ้ง — นักศึกษาเขียนตรงไม่ได้ ต้องผ่าน RPC report_room_problem (ตรวจซ้ำ/จำกัดต่อวัน)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.room_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('station', 'lan')),
  station_id uuid references public.computer_stations(id) on delete set null,
  lan_port_id uuid references public.lan_ports(id) on delete set null,
  room_id text not null references public.rooms(id) on update cascade,
  label text not null, -- "กลุ่ม 1 C9" / "กลุ่ม 1 Port 5"
  description text not null check (char_length(btrim(description)) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'accepted', 'closed')),
  reported_by uuid not null references public.profiles(id) on delete cascade,
  reported_at timestamptz not null default now(),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  handle_note text,
  repair_id uuid references public.repair_records(id) on delete set null
);
create index if not exists room_reports_status_idx on public.room_reports (status, reported_at desc);
create index if not exists room_reports_reporter_idx on public.room_reports (reported_by, reported_at desc);

alter table public.room_reports enable row level security;
-- นักศึกษาเห็นคำแจ้งของตัวเอง / Admin+TA เห็นทั้งหมด — ไม่มี policy เขียน (ผ่าน RPC เท่านั้น)
drop policy if exists "room_reports: อ่านของตัวเอง หรือ staff" on public.room_reports;
create policy "room_reports: อ่านของตัวเอง หรือ staff" on public.room_reports
  for select to authenticated using (reported_by = (select auth.uid()) or (select public.is_staff()));

-- ───────────────────────────────────────────────────────────────
-- 2) ประเภทแจ้งเตือนใหม่ (เพิ่มต่อท้าย ของเดิมไม่เปลี่ยน)
--    room_report = ถึง Admin/TA: มีคำแจ้งใหม่ / room_report_accepted, room_report_closed = ถึงผู้แจ้ง
-- ───────────────────────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'borrow', 'return', 'request_borrow', 'request_return', 'request_renew', 'approved', 'declined', 'expired',
  'cancelled', 'auto_returned', 'renewed', 'due_soon', 'overdue', 'warranty_soon', 'warranty_expired',
  'age_warn', 'age_replace', 'role_changed',
  'room_report', 'room_report_accepted', 'room_report_closed'
]));

-- แจ้ง Admin + TA ทุกคน (trigger notifications_broadcast เดิมส่ง Realtime ให้เอง)
create or replace function public._room_notify_staff(p_title text, p_body text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body)
  select id, 'room_report', p_title, p_body from public.profiles where role = any (public._staff_roles());
$$;
revoke all on function public._room_notify_staff(text, text) from public, anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- 3) RPC นักศึกษาแจ้งปัญหา
--    กันซ้ำ: เครื่อง/port เดียวกันที่ยังมีคำแจ้งค้าง (open) แจ้งซ้ำไม่ได้
--    จำกัด: คนละไม่เกิน 5 ครั้งต่อวัน (นับตามวันไทย)
-- ───────────────────────────────────────────────────────────────
create or replace function public.report_room_problem(p_kind text, p_target uuid, p_description text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_desc text := btrim(coalesce(p_description, ''));
  v_room text;
  v_label text;
  v_today int;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'กรุณาเข้าสู่ระบบก่อน' using errcode = '42501';
  end if;
  if char_length(v_desc) < 3 then
    raise exception 'กรุณาอธิบายปัญหาอย่างน้อย 3 ตัวอักษร' using errcode = 'P0001';
  end if;
  if char_length(v_desc) > 500 then
    raise exception 'คำอธิบายยาวเกิน 500 ตัวอักษร' using errcode = 'P0001';
  end if;

  if p_kind = 'station' then
    select s.room_id, 'กลุ่ม ' || s.group_no || ' ' || s.name into v_room, v_label
    from public.computer_stations s join public.rooms r on r.id = s.room_id
    where s.id = p_target and s.active and r.active;
  elsif p_kind = 'lan' then
    select l.room_id, 'กลุ่ม ' || l.group_no || ' Port ' || l.port_no into v_room, v_label
    from public.lan_ports l join public.rooms r on r.id = l.room_id
    where l.id = p_target and r.active;
  else
    raise exception 'ประเภทคำแจ้งไม่ถูกต้อง' using errcode = 'P0001';
  end if;
  if v_room is null then
    raise exception 'ไม่พบเครื่อง/port นี้ หรือห้องปิดอยู่' using errcode = 'P0001';
  end if;

  -- ล็อกตามเป้าหมาย กันสองคนกดแจ้งพร้อมกันแล้วได้คำแจ้งซ้ำ
  perform pg_advisory_xact_lock(hashtext('room_report:' || p_target::text));
  if exists (
    select 1 from public.room_reports
    where status = 'open' and (station_id = p_target or lan_port_id = p_target)
  ) then
    raise exception '% ห้อง % มีคนแจ้งไว้แล้ว รอผู้ดูแลตรวจสอบ', v_label, v_room using errcode = 'P0001';
  end if;

  select count(*) into v_today from public.room_reports
  where reported_by = v_uid
    and reported_at >= (date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok');
  if v_today >= 5 then
    raise exception 'วันนี้แจ้งครบ 5 ครั้งแล้ว ลองใหม่พรุ่งนี้ หรือแจ้งผู้ดูแลในห้อง' using errcode = 'P0001';
  end if;

  insert into public.room_reports (kind, station_id, lan_port_id, room_id, label, description, reported_by)
  values (p_kind,
          case when p_kind = 'station' then p_target end,
          case when p_kind = 'lan' then p_target end,
          v_room, v_label, v_desc, v_uid)
  returning id into v_id;

  perform public._room_notify_staff(
    'แจ้งปัญหา ' || v_room || ' ' || v_label,
    left(v_desc, 120)
  );
  return v_id;
end $$;
revoke all on function public.report_room_problem(text, uuid, text) from public, anon;
grant execute on function public.report_room_problem(text, uuid, text) to authenticated;

-- ───────────────────────────────────────────────────────────────
-- 4) RPC Admin/TA ตัดสินคำแจ้ง
--    รับ: เครื่อง → สร้างงานซ่อม (เครื่องเป็น "กำลังซ่อม" ผ่าน trigger R2) / LAN → port เป็น "กำลังซ่อม"
--    ปิด: ไม่ใช่ปัญหา/แก้แล้ว — แจ้งผู้แจ้งทั้งสองกรณี
-- ───────────────────────────────────────────────────────────────
create or replace function public.decide_room_report(p_id uuid, p_accept boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.room_reports;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_repair uuid;
  v_reporter text;
begin
  if not public.is_staff() then
    raise exception 'เฉพาะ Admin/TA' using errcode = '42501';
  end if;
  select * into r from public.room_reports where id = p_id for update;
  if not found then
    raise exception 'ไม่พบคำแจ้งนี้' using errcode = 'P0001';
  end if;
  if r.status <> 'open' then
    raise exception 'คำแจ้งนี้ถูกจัดการไปแล้ว' using errcode = 'P0001';
  end if;
  if not p_accept and v_note is null then
    raise exception 'ปิดคำแจ้งต้องใส่เหตุผล' using errcode = 'P0001';
  end if;

  if p_accept then
    if r.kind = 'station' and r.station_id is not null then
      select split_part(email, '@', 1) into v_reporter from public.profiles where id = r.reported_by;
      insert into public.repair_records (station_id, description, notes, status)
      values (r.station_id, r.description,
              concat_ws(' · ', 'นักศึกษาแจ้ง: ' || coalesce(v_reporter, '-'), v_note), 'pending')
      returning id into v_repair;
    elsif r.kind = 'lan' and r.lan_port_id is not null then
      update public.lan_ports set status = 'repair' where id = r.lan_port_id and status = 'available';
    end if;
  end if;

  update public.room_reports
  set status = case when p_accept then 'accepted' else 'closed' end,
      handled_by = auth.uid(), handled_at = now(), handle_note = v_note, repair_id = v_repair
  where id = p_id;

  insert into public.notifications (user_id, type, title, body)
  values (r.reported_by,
          case when p_accept then 'room_report_accepted' else 'room_report_closed' end,
          case when p_accept then 'รับเรื่องแล้ว: ' else 'ปิดคำแจ้ง: ' end || r.room_id || ' ' || r.label,
          coalesce(v_note, case when p_accept then 'ผู้ดูแลรับเป็นงานซ่อมแล้ว ขอบคุณที่แจ้ง' else '-' end));
end $$;
revoke all on function public.decide_room_report(uuid, boolean, text) from public, anon;
grant execute on function public.decide_room_report(uuid, boolean, text) to authenticated;
