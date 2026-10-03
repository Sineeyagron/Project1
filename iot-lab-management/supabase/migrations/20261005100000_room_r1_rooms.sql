-- ระบบห้อง R1: ตารางห้อง (rooms) + ผูก FK + ปิดใช้งานเครื่อง + ตัด repair_records.item_id
-- ระบบห้องคอม แยกจากระบบยืม-คืนเด็ดขาด — ห้ามใช้ร่วมกับ borrow_locations

-- ───────────────────────────────────────────────────────────────
-- 1) ตารางห้อง — id = รหัสห้อง (เช่น CP9524) ให้ room_id เดิมเป็น FK ได้ทันที
--    แก้รหัสห้อง → เครื่อง/LAN เปลี่ยนตาม (on update cascade)
--    ห้องที่มีเครื่อง/LAN ลบไม่ได้ (on delete restrict) → ใช้ "ปิดห้อง" (active=false)
-- ───────────────────────────────────────────────────────────────
create table if not exists public.rooms (
  id text primary key check (id ~ '^[A-Z0-9-]{2,20}$'),
  building text not null default '',
  floor text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ensure_rls เปิด RLS ให้อัตโนมัติ → ต้องมี policy ในไฟล์นี้
alter table public.rooms enable row level security;
drop policy if exists "rooms: อ่านได้ทุกคนที่ล็อกอิน" on public.rooms;
create policy "rooms: อ่านได้ทุกคนที่ล็อกอิน" on public.rooms
  for select to authenticated using (true);
-- เพิ่ม/แก้/ปิด/ลบห้อง = admin เท่านั้น (TA ทำไม่ได้ ตามแผนข้อ 1.4)
drop policy if exists "rooms: admin แก้" on public.rooms;
create policy "rooms: admin แก้" on public.rooms
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ห้องเดิม 2 ห้อง (อาคาร/ชั้น เดิมเขียนตายตัวใน home.tsx)
insert into public.rooms (id, building, floor, sort_order) values
  ('CP9524', 'อาคารคอมพิวเตอร์', '5', 1),
  ('SC9604', 'อาคารวิทยาศาสตร์', '6', 2)
on conflict (id) do nothing;
-- กันพลาด: room_id อื่นที่มีในข้อมูล (ตอนนี้ไม่มี)
insert into public.rooms (id, sort_order)
select distinct room_id, 99 from (
  select room_id from public.computer_stations union select room_id from public.lan_ports
) r
on conflict (id) do nothing;

alter table public.computer_stations drop constraint if exists computer_stations_room_id_fkey;
alter table public.computer_stations
  add constraint computer_stations_room_id_fkey foreign key (room_id)
  references public.rooms(id) on update cascade on delete restrict;

alter table public.lan_ports drop constraint if exists lan_ports_room_id_fkey;
alter table public.lan_ports
  add constraint lan_ports_room_id_fkey foreign key (room_id)
  references public.rooms(id) on update cascade on delete restrict;

-- ───────────────────────────────────────────────────────────────
-- 2) ปิดใช้งานเครื่อง (REVIEW M6): เครื่องที่มีประวัติตรวจ/ซ่อม ห้ามลบ ให้ปิดแทน
--    เครื่องที่ปิด = ไม่ขึ้นในผังห้อง/สถิติ แต่ประวัติยังผูกกับเครื่องอยู่
-- ───────────────────────────────────────────────────────────────
alter table public.computer_stations add column if not exists active boolean not null default true;

-- ───────────────────────────────────────────────────────────────
-- 3) งานซ่อมใช้กับเครื่องคอมของระบบห้องอย่างเดียว (แผนข้อ 1.6)
--    item_id ไม่มีแถวไหนใช้ (ตรวจแล้ว 0 แถว) — อุปกรณ์ IoT ใช้ items.status = 'repair' ของระบบยืม
-- ───────────────────────────────────────────────────────────────
alter table public.repair_records drop column if exists item_id;
