-- =====================================================================
-- เฟส 3.1: โครงสร้างสำหรับนักศึกษาขอยืม/คืนเอง (กติกาอยู่ใน phase3_rpc)
-- ดูแผน: PLAN_ระบบยืมของ.md ข้อ 2.4, 2.6 และเฟส 3
--
-- หลัก: นักศึกษา "อ่าน" คำขอของตัวเองได้ แต่สร้าง/แก้ผ่าน RPC เท่านั้น
-- (ตาราง borrow_requests ไม่มี policy insert/update ให้ใครเลย)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. ผู้ดูแล (เฟส 4 จะเพิ่ม 'ta' ตรงนี้ที่เดียว)
-- ---------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin')
  );
$$;

revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- ---------------------------------------------------------------------
-- 1. ค่าตั้งระบบเพิ่มเติม
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value) values
  ('max_active_borrows', '3'),        -- ยืมพร้อมกันได้สูงสุดต่อคน (รวมที่รออนุมัติ)
  ('borrow_day_options', '[3, 5, 7]') -- ตัวเลือกจำนวนวันยืม/ยืมต่อ
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 2. items: สถานะ "ถูกกันไว้" ระหว่างรออนุมัติคำขอยืม
-- ---------------------------------------------------------------------
alter table public.items drop constraint items_status_check;
alter table public.items
  add constraint items_status_check
  check (status in ('available', 'reserved', 'borrowed', 'repair', 'retired'));

-- ---------------------------------------------------------------------
-- 3. คำขอยืม / คืน / ยืมต่อ
-- ---------------------------------------------------------------------
create table public.borrow_requests (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null check (kind in ('borrow', 'return', 'renew')),
  status            text not null default 'pending'
                    check (status in ('pending', 'approved', 'declined', 'expired', 'cancelled', 'auto_returned')),
  item_id           uuid references public.items (id) on delete set null,
  user_id           uuid not null references public.profiles (id) on delete cascade,
  borrow_record_id  uuid references public.borrow_records (id) on delete set null,
  location_id       uuid references public.borrow_locations (id),
  days              int check (days between 1 and 60),        -- ยืม / ยืมต่อ
  condition         text check (condition in ('good', 'damaged')),
  condition_note    text,
  photo_path        text,                                      -- borrow-photos/<user_id>/...
  created_at        timestamptz not null default now(),        -- ใช้ประทับเวลาบนรูป
  expires_at        timestamptz,
  decided_by        uuid references public.profiles (id) on delete set null,
  decided_at        timestamptz,
  decision_note     text
);

-- ของ 1 ชิ้นมีคำขอที่รออยู่ได้ทีละ 1 รายการ (กันแย่งกันยืม)
create unique index borrow_requests_one_pending_per_item
  on public.borrow_requests (item_id) where status = 'pending';
create index borrow_requests_pending_expiry
  on public.borrow_requests (expires_at) where status = 'pending';
create index borrow_requests_user
  on public.borrow_requests (user_id, created_at desc);

alter table public.borrow_requests enable row level security;
create policy "borrow_requests: อ่านของตัวเอง หรือ staff" on public.borrow_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

-- ---------------------------------------------------------------------
-- 4. borrow_records: หลักฐานตอนยืม/คืน + ผลตรวจสภาพ
-- ---------------------------------------------------------------------
alter table public.borrow_records
  add column borrow_request_id      uuid references public.borrow_requests (id) on delete set null,
  add column borrow_photo_path      text,
  add column borrow_condition       text check (borrow_condition in ('good', 'damaged')),
  add column borrow_condition_note  text,
  add column return_photo_path      text,
  add column return_condition       text check (return_condition in ('good', 'damaged')),
  add column return_condition_note  text,
  add column return_checked_by      uuid references public.profiles (id) on delete set null,
  add column return_checked_at      timestamptz,
  add column damage_cost            numeric(10, 2) check (damage_cost >= 0),
  add column damage_note            text,
  add column auto_returned          boolean not null default false,
  add column renew_count            int not null default 0,
  add column due_soon_notified_at   timestamptz,
  add column overdue_notified_at    timestamptz;

alter table public.borrow_records
  add constraint borrow_records_status_check
  check (status in ('borrowed', 'pending_return', 'returned'));

-- ---------------------------------------------------------------------
-- 5. notifications: ประเภทใหม่ + ลิงก์ไปคำขอ/ของ
-- ---------------------------------------------------------------------
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'borrow', 'return',                                   -- เดิม (Admin สแกนให้)
    'request_borrow', 'request_return', 'request_renew',  -- ถึง staff: มีคำขอใหม่
    'approved', 'declined', 'expired', 'cancelled',       -- ถึงผู้ขอ: ผลคำขอ
    'auto_returned', 'renewed',
    'due_soon', 'overdue'                                 -- เตือนกำหนดคืน
  ));

alter table public.notifications
  add column request_id uuid references public.borrow_requests (id) on delete set null,
  add column item_id    uuid references public.items (id) on delete set null;

-- ---------------------------------------------------------------------
-- 6. ที่เก็บรูปตอนยืม/คืน (ไม่สาธารณะ)
--    นักศึกษาอัปโหลดได้เฉพาะโฟลเดอร์ <user_id>/ ของตัวเอง แก้/ลบไม่ได้ (เป็นหลักฐาน)
--    ดูรูป: เจ้าของ หรือ staff (แอปขอ signed URL)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('borrow-photos', 'borrow-photos', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "borrow-photos: อัปโหลดลงโฟลเดอร์ตัวเอง" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'borrow-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "borrow-photos: เจ้าของ หรือ staff ดูได้" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'borrow-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_staff()))
  );
