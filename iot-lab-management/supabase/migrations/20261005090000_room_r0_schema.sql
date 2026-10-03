-- ระบบห้อง R0: เก็บโครงตารางจริง + ล้างข้อมูลซ้ำ + กันข้อมูลผิด
-- (แผน docs: PLAN_ระบบห้อง.md / REVIEW_ระบบห้อง.md)
-- ระบบห้องคอม แยกจากระบบยืม-คืนเด็ดขาด — ไฟล์นี้ไม่แตะตารางของระบบยืม

-- ───────────────────────────────────────────────────────────────
-- 1) โครงตารางจริงของระบบห้อง (เดิมสร้างผ่าน Dashboard ไม่มีใน migrations)
--    ใช้ "if not exists" → รันบนฐานข้อมูลจริงที่มีตารางแล้วจะไม่เปลี่ยนอะไร
--    มีไว้ให้สร้างฐานข้อมูลใหม่ได้ครบ และให้รู้ CHECK / FK ที่ใช้อยู่จริง
-- ───────────────────────────────────────────────────────────────
create table if not exists public.computer_stations (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  name text not null,
  group_no integer not null,
  status text default 'available',
  created_at timestamptz default now()
);

create table if not exists public.station_equipment (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.computer_stations(id) on delete cascade,
  equipment_type text not null check (equipment_type in ('mouse', 'keyboard', 'monitor')),
  status text not null default 'present' check (status in ('present', 'missing', 'broken')),
  updated_at timestamptz default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  unique (station_id, equipment_type)
);

create table if not exists public.lan_ports (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  group_no integer not null,
  port_no integer not null,
  label text,
  status text default 'available' check (status in ('available', 'repair', 'broken')),
  created_at timestamptz default now()
);

create table if not exists public.equipment_inspections (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  station_id uuid references public.computer_stations(id) on delete set null,
  inspector_id uuid references public.profiles(id) on delete set null,
  equipment_type text check (equipment_type in ('mouse', 'keyboard', 'monitor')),
  condition text not null default 'good' check (condition in ('good', 'damaged', 'missing')),
  notes text,
  last_borrower_id uuid references public.profiles(id) on delete set null,
  inspected_at timestamptz default now()
);

create table if not exists public.repair_records (
  id uuid primary key default gen_random_uuid(),
  station_id uuid references public.computer_stations(id) on delete set null,
  item_id uuid references public.items(id) on delete set null,
  description text,
  status text not null default 'pending' check (status in ('pending', 'in-repair', 'done')),
  reported_by uuid references public.profiles(id) on delete set null,
  repaired_by uuid references public.profiles(id) on delete set null,
  reported_at timestamptz default now(),
  repaired_at timestamptz,
  notes text
);

-- ───────────────────────────────────────────────────────────────
-- 2) ลบระบบจองห้อง (0 แถว ไม่มีโค้ด/ฟังก์ชันอ้างถึงแล้ว)
-- ───────────────────────────────────────────────────────────────
drop table if exists public.room_bookings;

-- ───────────────────────────────────────────────────────────────
-- 3) สถานะเครื่องคอม: เดิมไม่มี CHECK ใส่ค่าอะไรก็ได้ → ผังห้องพัง (REVIEW M14)
--    ข้อมูลตอนนี้ถูกทั้งหมด (available / repair / broken)
-- ───────────────────────────────────────────────────────────────
update public.computer_stations set status = 'available' where status is null;
alter table public.computer_stations alter column status set not null;
alter table public.computer_stations drop constraint if exists computer_stations_status_check;
alter table public.computer_stations
  add constraint computer_stations_status_check check (status in ('available', 'repair', 'broken'));

alter table public.lan_ports alter column status set not null;

-- ───────────────────────────────────────────────────────────────
-- 4) กันข้อมูลซ้ำ
--    เครื่อง: ชื่อซ้ำได้ข้ามกลุ่ม (ทุกกลุ่มมี C1–C9) แต่ห้ามซ้ำในกลุ่มเดียวกัน — ตอนนี้ไม่มีซ้ำ
--    LAN port: เลขห้ามซ้ำในกลุ่ม + ต้องอยู่ 1–12 — ตอนนี้ไม่มีซ้ำ/ไม่มีเลขผิด
-- ───────────────────────────────────────────────────────────────
create unique index if not exists computer_stations_room_group_name_key
  on public.computer_stations (room_id, group_no, lower(name));

alter table public.lan_ports drop constraint if exists lan_ports_room_group_port_key;
alter table public.lan_ports add constraint lan_ports_room_group_port_key unique (room_id, group_no, port_no);
alter table public.lan_ports drop constraint if exists lan_ports_port_no_check;
alter table public.lan_ports add constraint lan_ports_port_no_check check (port_no between 1 and 12);

-- ───────────────────────────────────────────────────────────────
-- 5) ผลตรวจประจำเทอมซ้ำ (REVIEW M5): 1 เครื่อง × 1 เทอม × 1 อุปกรณ์ ต้องมีแถวเดียว
--    ตอนนี้ซ้ำ 4 ชุด (CP9524 C1, C2 เทอม 1/2569) เกิน 12 แถว → เก็บแถวล่าสุดของแต่ละชุด
-- ───────────────────────────────────────────────────────────────
delete from public.equipment_inspections e
using (
  select id, row_number() over (
    partition by station_id, term, equipment_type order by inspected_at desc, id desc
  ) as rn
  from public.equipment_inspections
) ranked
where e.id = ranked.id and ranked.rn > 1;

alter table public.equipment_inspections
  drop constraint if exists equipment_inspections_station_term_type_key;
alter table public.equipment_inspections
  add constraint equipment_inspections_station_term_type_key unique (station_id, term, equipment_type);
