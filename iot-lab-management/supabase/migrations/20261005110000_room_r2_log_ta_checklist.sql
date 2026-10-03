-- ระบบห้อง R2: ประวัติสถานะ + สิทธิ์ TA + เช็กลิสต์จากผลตรวจ + งานซ่อมเปลี่ยนสถานะเครื่อง
-- ระบบห้องคอม แยกจากระบบยืม-คืนเด็ดขาด — ไฟล์นี้แตะเฉพาะตารางระบบห้อง
-- (ใช้ is_admin()/is_staff() ที่มีอยู่แล้ว ไม่แก้)

-- ───────────────────────────────────────────────────────────────
-- 1) ประวัติการเปลี่ยนสถานะเครื่อง / LAN port (แผนข้อ 1.5)
--    เขียนโดย trigger เท่านั้น แอปเขียนตรงไม่ได้ (ไม่มี policy insert/update/delete)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.room_status_log (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('station', 'lan')),
  station_id uuid references public.computer_stations(id) on delete cascade,
  lan_port_id uuid references public.lan_ports(id) on delete cascade,
  room_id text not null,
  label text not null, -- "กลุ่ม 1 C9" / "กลุ่ม 1 Port 5" (เก็บไว้อ่านง่าย แม้ภายหลังเปลี่ยนชื่อ)
  from_status text,
  to_status text not null,
  source text not null default 'manual' check (source in ('manual', 'repair')),
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists room_status_log_station_idx on public.room_status_log (station_id, changed_at desc);
create index if not exists room_status_log_lan_idx on public.room_status_log (lan_port_id, changed_at desc);

alter table public.room_status_log enable row level security;
drop policy if exists "room_status_log: staff อ่าน" on public.room_status_log;
create policy "room_status_log: staff อ่าน" on public.room_status_log
  for select to authenticated using ((select public.is_staff()));

-- source = 'repair' เมื่อสถานะเปลี่ยนเพราะงานซ่อม (ตั้งโดย _room_repair_sync_station)
create or replace function public._room_log_station_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.room_status_log (kind, station_id, room_id, label, from_status, to_status, source, changed_by)
    values ('station', new.id, new.room_id, 'กลุ่ม ' || new.group_no || ' ' || new.name, old.status, new.status,
            coalesce(nullif(current_setting('app.room_status_source', true), ''), 'manual'), auth.uid());
  end if;
  return new;
end $$;

create or replace function public._room_log_lan_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.room_status_log (kind, lan_port_id, room_id, label, from_status, to_status, changed_by)
    values ('lan', new.id, new.room_id, 'กลุ่ม ' || new.group_no || ' Port ' || new.port_no, old.status, new.status, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists computer_stations_log_status on public.computer_stations;
create trigger computer_stations_log_status after update of status on public.computer_stations
  for each row execute function public._room_log_station_status();
drop trigger if exists lan_ports_log_status on public.lan_ports;
create trigger lan_ports_log_status after update of status on public.lan_ports
  for each row execute function public._room_log_lan_status();

-- ───────────────────────────────────────────────────────────────
-- 2) สิทธิ์ TA ในระบบห้อง (แผนข้อ 1.4)
--    TA: เปลี่ยนสถานะเครื่อง/LAN, แก้เช็กลิสต์, ตรวจประจำเทอม, แจ้งซ่อม/อัปเดตงานซ่อม
--    TA ทำไม่ได้: เพิ่ม/แก้/ลบ ห้อง เครื่อง LAN port (policy admin เดิมยังอยู่) — ลบผลตรวจ/งานซ่อม = admin
-- ───────────────────────────────────────────────────────────────
drop policy if exists "computer_stations: staff เปลี่ยนสถานะ" on public.computer_stations;
create policy "computer_stations: staff เปลี่ยนสถานะ" on public.computer_stations
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "lan_ports: staff เปลี่ยนสถานะ" on public.lan_ports;
create policy "lan_ports: staff เปลี่ยนสถานะ" on public.lan_ports
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
drop policy if exists "station_equipment: staff แก้เช็กลิสต์" on public.station_equipment;
create policy "station_equipment: staff แก้เช็กลิสต์" on public.station_equipment
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists "equipment_inspections: staff อ่าน" on public.equipment_inspections;
create policy "equipment_inspections: staff อ่าน" on public.equipment_inspections
  for select to authenticated using ((select public.is_staff()));
drop policy if exists "equipment_inspections: staff บันทึก" on public.equipment_inspections;
create policy "equipment_inspections: staff บันทึก" on public.equipment_inspections
  for insert to authenticated with check ((select public.is_staff()));
drop policy if exists "equipment_inspections: staff แก้" on public.equipment_inspections;
create policy "equipment_inspections: staff แก้" on public.equipment_inspections
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- REVIEW M15: TA เห็นงานซ่อม (เดิม admin อ่านได้คนเดียว แดชบอร์ด TA เลยนับ 0)
drop policy if exists "repair_records: staff อ่าน" on public.repair_records;
create policy "repair_records: staff อ่าน" on public.repair_records
  for select to authenticated using ((select public.is_staff()));
drop policy if exists "repair_records: staff แจ้งซ่อม" on public.repair_records;
create policy "repair_records: staff แจ้งซ่อม" on public.repair_records
  for insert to authenticated with check ((select public.is_staff()));
drop policy if exists "repair_records: staff อัปเดต" on public.repair_records;
create policy "repair_records: staff อัปเดต" on public.repair_records
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- RLS กันระดับคอลัมน์ไม่ได้ → trigger กัน TA แก้อย่างอื่นนอกจากสถานะ
create or replace function public._room_station_ta_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin()
     and (new.room_id, new.name, new.group_no, new.active) is distinct from (old.room_id, old.name, old.group_no, old.active) then
    raise exception 'TA เปลี่ยนได้เฉพาะสถานะเครื่อง' using errcode = '42501';
  end if;
  return new;
end $$;
create or replace function public._room_lan_ta_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin()
     and (new.room_id, new.group_no, new.port_no, new.label) is distinct from (old.room_id, old.group_no, old.port_no, old.label) then
    raise exception 'TA เปลี่ยนได้เฉพาะสถานะ LAN port' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists computer_stations_ta_guard on public.computer_stations;
create trigger computer_stations_ta_guard before update on public.computer_stations
  for each row execute function public._room_station_ta_guard();
drop trigger if exists lan_ports_ta_guard on public.lan_ports;
create trigger lan_ports_ta_guard before update on public.lan_ports
  for each row execute function public._room_lan_ta_guard();

-- ───────────────────────────────────────────────────────────────
-- 3) เช็กลิสต์เมาส์/คีย์บอร์ด/จอ (REVIEW H2) — ผลตรวจประจำเทอมอัปเดตเช็กลิสต์อัตโนมัติ
--    ปกติ → ครบ / ชำรุด → ชำรุด / หาย → หาย
--    แก้ผลตรวจเทอมเก่า (มีผลที่ใหม่กว่าอยู่แล้ว) → ไม่ทับเช็กลิสต์ปัจจุบัน
-- ───────────────────────────────────────────────────────────────
create or replace function public._room_inspection_sync_checklist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.station_id is null or new.equipment_type is null then
    return new;
  end if;
  if exists (
    select 1 from public.equipment_inspections e
    where e.station_id = new.station_id and e.equipment_type = new.equipment_type
      and e.id <> new.id and e.inspected_at > new.inspected_at
  ) then
    return new;
  end if;
  insert into public.station_equipment (station_id, equipment_type, status, updated_at, updated_by)
  values (new.station_id, new.equipment_type,
          case new.condition when 'good' then 'present' when 'damaged' then 'broken' else 'missing' end,
          now(), coalesce(auth.uid(), new.inspector_id))
  on conflict (station_id, equipment_type)
  do update set status = excluded.status, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return new;
end $$;
drop trigger if exists equipment_inspections_sync_checklist on public.equipment_inspections;
create trigger equipment_inspections_sync_checklist after insert or update on public.equipment_inspections
  for each row execute function public._room_inspection_sync_checklist();

-- เครื่องใหม่ → มีเช็กลิสต์ 3 อย่าง (ครบ) ทันที
create or replace function public._room_station_default_checklist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.station_equipment (station_id, equipment_type)
  select new.id, t from unnest(array['mouse', 'keyboard', 'monitor']) as t
  on conflict (station_id, equipment_type) do nothing;
  return new;
end $$;
drop trigger if exists computer_stations_default_checklist on public.computer_stations;
create trigger computer_stations_default_checklist after insert on public.computer_stations
  for each row execute function public._room_station_default_checklist();

-- เติมเช็กลิสต์จากผลตรวจล่าสุดที่มีอยู่แล้ว (ตอนนี้ทุกแถวเป็น "ครบ" ทั้งที่ผลตรวจบอกหาย/ชำรุด)
insert into public.station_equipment (station_id, equipment_type, status, updated_at, updated_by)
select distinct on (station_id, equipment_type)
  station_id, equipment_type,
  case condition when 'good' then 'present' when 'damaged' then 'broken' else 'missing' end,
  inspected_at, inspector_id
from public.equipment_inspections
where station_id is not null and equipment_type is not null
order by station_id, equipment_type, inspected_at desc
on conflict (station_id, equipment_type)
do update set status = excluded.status, updated_at = excluded.updated_at, updated_by = excluded.updated_by;

-- ───────────────────────────────────────────────────────────────
-- 4) งานซ่อม (REVIEW M1, M2 + ผู้แจ้ง/ผู้ซ่อมให้ฐานข้อมูลใส่)
--    ลำดับสถานะ: รอซ่อม → กำลังซ่อม → เสร็จ (ห้ามย้อน, ข้ามจากรอซ่อมไปเสร็จได้)
-- ───────────────────────────────────────────────────────────────
create or replace function public._room_repair_before()
returns trigger language plpgsql set search_path = public as $$
declare
  rank_old int;
  rank_new int;
begin
  if tg_op = 'INSERT' then
    new.reported_by := coalesce(auth.uid(), new.reported_by);
    new.reported_at := coalesce(new.reported_at, now());
    if new.status = 'done' then
      new.repaired_at := now();
      new.repaired_by := coalesce(auth.uid(), new.repaired_by);
    end if;
    return new;
  end if;

  rank_old := array_position(array['pending', 'in-repair', 'done'], old.status);
  rank_new := array_position(array['pending', 'in-repair', 'done'], new.status);
  if rank_new < rank_old then
    raise exception 'สถานะงานซ่อมย้อนกลับไม่ได้' using errcode = 'P0001';
  end if;
  if new.status = 'done' and old.status <> 'done' then
    new.repaired_at := now();
    new.repaired_by := coalesce(auth.uid(), new.repaired_by);
  end if;
  -- ผู้แจ้ง/เวลาแจ้ง แก้ไม่ได้
  new.reported_by := old.reported_by;
  new.reported_at := old.reported_at;
  return new;
end $$;
drop trigger if exists repair_records_before on public.repair_records;
create trigger repair_records_before before insert or update on public.repair_records
  for each row execute function public._room_repair_before();

-- เปิดงานซ่อม → เครื่องเป็น "กำลังซ่อม" / ปิดงาน (ไม่มีงานค้างอื่น) → กลับเป็น "ใช้งานได้"
create or replace function public._room_repair_sync_station()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.station_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status = old.status and new.station_id is not distinct from old.station_id then
    return new;
  end if;

  perform set_config('app.room_status_source', 'repair', true);
  if new.status in ('pending', 'in-repair') then
    update public.computer_stations set status = 'repair' where id = new.station_id and status <> 'repair';
  elsif new.status = 'done' and not exists (
    select 1 from public.repair_records r
    where r.station_id = new.station_id and r.status <> 'done' and r.id <> new.id
  ) then
    update public.computer_stations set status = 'available' where id = new.station_id and status = 'repair';
  end if;
  perform set_config('app.room_status_source', '', true);
  return new;
end $$;
drop trigger if exists repair_records_sync_station on public.repair_records;
create trigger repair_records_sync_station after insert or update on public.repair_records
  for each row execute function public._room_repair_sync_station();
