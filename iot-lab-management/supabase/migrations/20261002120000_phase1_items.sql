-- =====================================================================
-- เฟส 1: ฐานข้อมูลอุปกรณ์ (ระบบยืมของ)
-- ดูแผน: PLAN_ระบบยืมของ.md ข้อ 2.1-2.3, 2.7 และเฟส 1
--
-- หมายเหตุ: โปรเจกต์นี้มี event trigger `ensure_rls` ที่เปิด RLS ให้ตารางใหม่
-- ใน public อัตโนมัติ ตารางใหม่ทุกตารางในไฟล์นี้จึงต้องมี policy ในไฟล์เดียวกัน
-- ไม่งั้นแอปจะอ่านไม่ได้
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. ตัวช่วยเช็กสิทธิ์ (ใช้ใน policy)
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 1. หมวดหมู่ (Admin เพิ่ม/แก้เองได้) แทนค่าที่ฮาร์ดโค้ดใน items.tsx/equipment.tsx
-- ---------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index categories_name_key on public.categories (lower(name));

alter table public.categories enable row level security;
create policy "categories: อ่านได้ทุกคนที่ล็อกอิน" on public.categories
  for select to authenticated using (true);
create policy "categories: admin แก้ได้" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.categories (name, sort_order) values
  ('Microcontroller', 1),
  ('Sensor', 2),
  ('Module', 3),
  ('อื่นๆ', 99);

-- ---------------------------------------------------------------------
-- 2. ห้องยืมของ (แยกจากระบบห้องคอม computer_stations เด็ดขาด)
--    ตอนนี้มีห้องเดียว ของทุกชิ้นเข้าห้องนี้ ยังไม่มี UI เลือกห้อง
-- ---------------------------------------------------------------------
create table public.borrow_locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index borrow_locations_name_key on public.borrow_locations (lower(name));

alter table public.borrow_locations enable row level security;
create policy "borrow_locations: อ่านได้ทุกคนที่ล็อกอิน" on public.borrow_locations
  for select to authenticated using (true);
create policy "borrow_locations: admin แก้ได้" on public.borrow_locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.borrow_locations (name) values ('IoT Lab');

-- ห้องเริ่มต้น = ห้องที่เปิดใช้และสร้างก่อนสุด
create or replace function public.default_borrow_location()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.borrow_locations
  where active
  order by created_at, id
  limit 1;
$$;

revoke execute on function public.default_borrow_location() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. ค่าตั้งระบบที่ Admin ปรับได้
-- ---------------------------------------------------------------------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.app_settings enable row level security;
create policy "app_settings: อ่านได้ทุกคนที่ล็อกอิน" on public.app_settings
  for select to authenticated using (true);
create policy "app_settings: admin แก้ได้" on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.app_settings (key, value) values
  ('request_expiry_minutes', '30'),  -- คำขอยืม/คืนหมดอายุ (เฟส 3)
  ('age_warn_years',         '3'),   -- อายุอุปกรณ์ที่เริ่มเตือน (เฟส 2)
  ('age_replace_years',      '4');   -- อายุที่ควรซื้อทดแทน (เฟส 2)

-- ---------------------------------------------------------------------
-- 4. ตัวนับรหัสเรียก แยกต่อชื่อ เลขไม่ถูกใช้ซ้ำแม้ลบของไปแล้ว
--    แอปเข้าถึงตรงไม่ได้ (RLS เปิด ไม่มี policy) ใช้ผ่าน trigger เท่านั้น
-- ---------------------------------------------------------------------
create table public.item_code_counters (
  prefix_key      text primary key,          -- ตัวพิมพ์เล็ก ใช้เทียบชื่อ
  display_prefix  text not null,             -- ตัวสะกดของครั้งแรก
  last_no         int  not null default 0,
  updated_at      timestamptz not null default now()
);

alter table public.item_code_counters enable row level security;

-- ---------------------------------------------------------------------
-- 5. คอลัมน์ใหม่ใน items
-- ---------------------------------------------------------------------
alter table public.items
  add column item_prefix          text,
  add column item_no              int,
  add column item_code            text,
  add column short_name           text,
  add column manufacturer_serial  text,
  add column warranty_expires_at  date,
  add column retired_at           timestamptz,
  add column retire_reason        text,
  add column category_id          uuid references public.categories (id) on delete set null,
  add column location_id          uuid references public.borrow_locations (id);

-- ค่าเริ่มต้นเดิมเป็น 'borrowed' (ผิด) ของใหม่ต้องเริ่มที่ 'available'
alter table public.items alter column status set default 'available';

-- สถานะที่ใช้ได้ (เฟส 3 จะเพิ่มสถานะของคำขอยืม/คืน)
alter table public.items
  add constraint items_status_check
  check (status in ('available', 'borrowed', 'repair', 'retired'));

-- ---------------------------------------------------------------------
-- 6. ฟังก์ชันสร้างรหัส
-- ---------------------------------------------------------------------

-- จองเลขถัดไปของชื่อนี้ (atomic: แถวตัวนับถูกล็อกจนจบ transaction)
create or replace function public.alloc_item_code(
  p_name text,
  p_short_name text,
  out o_prefix text,
  out o_no int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text;
begin
  -- ใช้ชื่อย่อถ้ามี ตัดช่องว่าง/สัญลักษณ์ ("ESP32 DevKit" -> "ESP32DevKit")
  v_clean := regexp_replace(
    coalesce(nullif(btrim(p_short_name), ''), btrim(p_name), ''),
    '[[:space:][:punct:]]', '', 'g'
  );
  if v_clean = '' then
    v_clean := 'Item';
  end if;

  insert into public.item_code_counters as c (prefix_key, display_prefix, last_no)
  values (lower(v_clean), v_clean, 1)
  on conflict (prefix_key) do update
    set last_no = c.last_no + 1,
        updated_at = now()
  returning c.display_prefix, c.last_no into o_prefix, o_no;
end;
$$;

revoke execute on function public.alloc_item_code(text, text) from public, anon, authenticated;

-- 1 -> "001", 999 -> "999", 1000 -> "1000"
create or replace function public.format_item_no(p_no int)
returns text
language sql
immutable
as $$
  select case when p_no < 1000 then lpad(p_no::text, 3, '0') else p_no::text end;
$$;

-- รหัสสแกน 4 ตัว แบบเดียวกับ qrgen.tsx (ตัวอักษร+ตัวเลข ไม่มี I O 0 1)
create or replace function public.gen_item_barcode()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..4 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    if v_code ~ '[A-Z]' and v_code ~ '[0-9]'
       and not exists (select 1 from public.items where barcode = v_code) then
      return v_code;
    end if;
  end loop;
end;
$$;

revoke execute on function public.gen_item_barcode() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Trigger: ของใหม่ทุกชิ้นได้รหัสเรียก + รหัสสแกน + ห้อง อัตโนมัติ
--    ทุกช่องทางที่เพิ่มของ (ฟอร์ม, CSV ในเฟส 2) ได้รหัสแบบเดียวกัน
-- ---------------------------------------------------------------------
create or replace function public.items_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- รหัสเรียกออกโดยระบบเท่านั้น ไม่รับค่าจากแอป
  select * into r from public.alloc_item_code(new.name, new.short_name);
  new.item_prefix := r.o_prefix;
  new.item_no     := r.o_no;
  new.item_code   := r.o_prefix || ' ' || public.format_item_no(r.o_no);

  if new.barcode is null or btrim(new.barcode) = '' then
    new.barcode := public.gen_item_barcode();
  end if;

  if new.location_id is null then
    new.location_id := public.default_borrow_location();
  end if;

  return new;
end;
$$;

create trigger items_before_insert
  before insert on public.items
  for each row execute function public.items_before_insert();

-- แก้ชื่อของแล้วรหัสเดิมไม่เปลี่ยน: ล็อกรหัสเรียกและห้องหลังถูกตั้งแล้ว
create or replace function public.items_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.item_code is not null then
    new.item_prefix := old.item_prefix;
    new.item_no     := old.item_no;
    new.item_code   := old.item_code;
  end if;
  -- ย้ายของระหว่างห้องไม่ได้ (แผนข้อ 2.7)
  if old.location_id is not null then
    new.location_id := old.location_id;
  end if;
  return new;
end;
$$;

create trigger items_before_update
  before update on public.items
  for each row execute function public.items_before_update();

-- ---------------------------------------------------------------------
-- 8. เติมข้อมูลให้ของเดิม (เรียงตามวันที่เพิ่มเข้าระบบ)
-- ---------------------------------------------------------------------
update public.items
set location_id = public.default_borrow_location()
where location_id is null;

do $$
declare
  it record;
  r  record;
begin
  for it in
    select id, name, short_name from public.items
    where item_code is null
    order by created_at, id
  loop
    select * into r from public.alloc_item_code(it.name, it.short_name);
    update public.items
    set item_prefix = r.o_prefix,
        item_no     = r.o_no,
        item_code   = r.o_prefix || ' ' || public.format_item_no(r.o_no)
    where id = it.id;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. บังคับหลังเติมข้อมูลครบ
-- ---------------------------------------------------------------------
alter table public.items
  alter column item_code   set not null,
  alter column location_id set not null;

create unique index items_item_code_key on public.items (item_code);
create unique index items_barcode_key on public.items (barcode)
  where barcode is not null and barcode <> '';
create index items_location_id_idx on public.items (location_id);
create index items_category_id_idx on public.items (category_id);
