-- =====================================================================
-- ความปลอดภัย: เปิด RLS ทุกตาราง + policy ตามบทบาท
-- ดู TODO_for_claudecode.md ข้อ 1 และ PLAN_ระบบยืมของ.md เฟส 0
--
-- หลัก: ฐานข้อมูลเป็นคนตัดสินสิทธิ์ (แอปเช็กแค่เพื่อ UX)
--   ผู้ใช้ทั่วไป  = อ่านข้อมูลสาธารณะ + ข้อมูลของตัวเอง
--   admin        = อ่าน/เขียนทุกอย่าง
--   ยังไม่ล็อกอิน = เข้าถึงไม่ได้เลย
-- เฟส 4 จะเพิ่มบทบาท 'ta' (แก้ is_admin / เพิ่ม is_staff)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. ฟังก์ชันเดิมที่ advisor เตือน: ปิดไม่ให้เรียกผ่าน /rest/v1/rpc
--    (trigger / event trigger ยังทำงานตามปกติ)
-- ---------------------------------------------------------------------
alter function public.handle_new_user() set search_path = public;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 1. profiles: กันผู้ใช้ตั้ง role / email ของตัวเอง
-- ---------------------------------------------------------------------
update public.profiles set role = 'user' where role is null or role = '';
alter table public.profiles alter column role set default 'user';
alter table public.profiles alter column role set not null;
alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'admin'));

-- ผู้ใช้ทั่วไปเปลี่ยน role / email / id ไม่ได้ ส่วน admin และงานฝั่งเซิร์ฟเวอร์
-- (trigger ตอนสมัคร, SQL editor: ไม่มี JWT → auth.uid() เป็น null) เปลี่ยนได้
create or replace function public.profiles_protect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role  := 'user';
    new.email := coalesce(auth.jwt() ->> 'email', new.email);
  else
    new.id    := old.id;
    new.role  := old.role;
    new.email := old.email;
  end if;
  return new;
end;
$$;

revoke execute on function public.profiles_protect() from public, anon, authenticated;

create trigger profiles_protect
  before insert or update on public.profiles
  for each row execute function public.profiles_protect();

-- ---------------------------------------------------------------------
-- 2. วันคืนของที่ถูกยืม สำหรับหน้าอุปกรณ์ของนักศึกษา
--    คืนแค่ ชิ้นไหน + คืนวันไหน ไม่บอกว่าใครยืม
-- ---------------------------------------------------------------------
create or replace function public.item_active_loans()
returns table (item_id uuid, due_date date)
language sql
stable
security definer
set search_path = public
as $$
  select br.item_id, br.due_date
  from public.borrow_records br
  where br.status in ('borrowed', 'pending_return')
    and br.item_id is not null;
$$;

revoke execute on function public.item_active_loans() from public, anon;
grant execute on function public.item_active_loans() to authenticated;

-- ---------------------------------------------------------------------
-- 3. เปิด RLS
-- ---------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.items                 enable row level security;
alter table public.borrow_records        enable row level security;
alter table public.notifications         enable row level security;
alter table public.item_inspections      enable row level security;
alter table public.computer_stations     enable row level security;
alter table public.lan_ports             enable row level security;
alter table public.station_equipment     enable row level security;
alter table public.equipment_inspections enable row level security;
alter table public.repair_records        enable row level security;
alter table public.room_bookings         enable row level security;

-- ---------------------------------------------------------------------
-- 4. Policy
--    (select public.is_admin()) = เรียกครั้งเดียวต่อคำสั่ง ไม่ใช่ทุกแถว
-- ---------------------------------------------------------------------

-- profiles: เห็นของตัวเอง, admin เห็นทั้งหมด (ค้นอีเมลตอนสแกนยืม, ประวัติ)
create policy "profiles: อ่านของตัวเอง หรือ admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: สร้างของตัวเอง" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: แก้ของตัวเอง หรือ admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: admin ลบ" on public.profiles
  for delete to authenticated
  using ((select public.is_admin()));

-- items: ทุกคนที่ล็อกอินดูได้ (หน้าอุปกรณ์), admin แก้
create policy "items: อ่านได้ทุกคนที่ล็อกอิน" on public.items
  for select to authenticated using (true);
create policy "items: admin แก้" on public.items
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- borrow_records: เห็นของตัวเอง, admin ทั้งหมด / เขียนได้เฉพาะ admin
-- (เฟส 3 นักศึกษาส่งคำขอผ่าน RPC ไม่ได้เขียนตารางนี้ตรง ๆ)
create policy "borrow_records: อ่านของตัวเอง หรือ admin" on public.borrow_records
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "borrow_records: admin แก้" on public.borrow_records
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- notifications: เห็น/กดอ่านของตัวเอง, admin ส่งให้คนอื่น
create policy "notifications: อ่านของตัวเอง หรือ admin" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "notifications: กดอ่านของตัวเอง" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "notifications: admin แก้" on public.notifications
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ระบบห้อง: ผู้ใช้ดูได้ (home, roommap, lanstatus), admin แก้ — พฤติกรรมเหมือนเดิม
create policy "computer_stations: อ่านได้ทุกคนที่ล็อกอิน" on public.computer_stations
  for select to authenticated using (true);
create policy "computer_stations: admin แก้" on public.computer_stations
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "lan_ports: อ่านได้ทุกคนที่ล็อกอิน" on public.lan_ports
  for select to authenticated using (true);
create policy "lan_ports: admin แก้" on public.lan_ports
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "station_equipment: อ่านได้ทุกคนที่ล็อกอิน" on public.station_equipment
  for select to authenticated using (true);
create policy "station_equipment: admin แก้" on public.station_equipment
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ใช้เฉพาะหน้า admin
create policy "item_inspections: admin เท่านั้น" on public.item_inspections
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "equipment_inspections: admin เท่านั้น" on public.equipment_inspections
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "repair_records: admin เท่านั้น" on public.repair_records
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- room_bookings เลิกใช้แล้ว
create policy "room_bookings: admin เท่านั้น" on public.room_bookings
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 5. Storage
--    item-images: อ่านได้ทุกคน (bucket public), อัปโหลด/แก้/ลบ เฉพาะ admin
--    signatures: เลิกอัปโหลดแล้ว (เก็บ SVG ใน borrow_records) ปิดการเขียน
-- ---------------------------------------------------------------------
drop policy if exists "allow authenticated upload 1h6xdx7_0" on storage.objects;
drop policy if exists "allow insert 1h6xdx7_0" on storage.objects;
drop policy if exists "allow insert item-images" on storage.objects;
drop policy if exists "allow update item-images" on storage.objects;

create policy "item-images: admin อัปโหลด" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-images' and (select public.is_admin()));
create policy "item-images: admin แก้" on storage.objects
  for update to authenticated
  using (bucket_id = 'item-images' and (select public.is_admin()))
  with check (bucket_id = 'item-images' and (select public.is_admin()));
create policy "item-images: admin ลบ" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-images' and (select public.is_admin()));
