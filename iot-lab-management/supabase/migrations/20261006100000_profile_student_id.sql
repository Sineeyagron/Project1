-- โปรไฟล์นักศึกษา: ชื่อ + รูป (จาก Google) + รหัสนักศึกษา
-- เหตุผล: ผู้ดูแล/อาจารย์เห็นแค่อีเมล ต้องไปหาเองว่าเป็นใคร รหัสอะไร
--   full_name / avatar_url = คัดลอกจากบัญชี Google (auth.users metadata) อัตโนมัติ — นักศึกษาแก้เองไม่ได้
--   student_id = นักศึกษากรอกเองครั้งเดียว (ตั้งได้ตอนยังว่างเท่านั้น) / แก้ภายหลัง = admin

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists student_id text;

-- รูปแบบรหัส นศ. มข. 9 หลัก-1 หลัก (เช่น 653380123-4) / ห้ามซ้ำ
alter table public.profiles drop constraint if exists profiles_student_id_format;
alter table public.profiles add constraint profiles_student_id_format
  check (student_id is null or student_id ~ '^[0-9]{9}-[0-9]$');
create unique index if not exists profiles_student_id_key on public.profiles (student_id) where student_id is not null;

-- ชื่อ/รูปจาก metadata ของ Google (หรือชื่อที่กรอกตอนสมัครด้วยอีเมล)
create or replace function public._profile_meta_name(meta jsonb)
returns text language sql immutable as $$
  select nullif(btrim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), '')
$$;
create or replace function public._profile_meta_avatar(meta jsonb)
returns text language sql immutable as $$
  select nullif(btrim(coalesce(meta ->> 'avatar_url', meta ->> 'picture', '')), '')
$$;

-- สมัครใหม่: สร้าง profile พร้อมชื่อ/รูป
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.profiles (id, role, email, full_name, avatar_url)
  values (new.id, 'user', new.email,
          public._profile_meta_name(new.raw_user_meta_data),
          public._profile_meta_avatar(new.raw_user_meta_data));
  return new;
end;
$$;

-- ล็อกอิน Google ทุกครั้ง metadata อัปเดต → ชื่อ/รูปใน profile ตามให้
create or replace function public._profile_sync_from_auth()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform set_config('app.profile_sync', '1', true);
  update public.profiles
     set full_name  = coalesce(public._profile_meta_name(new.raw_user_meta_data), full_name),
         avatar_url = coalesce(public._profile_meta_avatar(new.raw_user_meta_data), avatar_url)
   where id = new.id;
  perform set_config('app.profile_sync', '', true);
  return new;
end;
$$;
drop trigger if exists on_auth_user_meta_updated on auth.users;
create trigger on_auth_user_meta_updated
  after update of raw_user_meta_data on auth.users
  for each row
  when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function public._profile_sync_from_auth();

-- กันแก้: เดิมกัน role/email → เพิ่ม ชื่อ/รูป (มาจาก Google เท่านั้น) + รหัส นศ. ตั้งได้ครั้งเดียว
create or replace function public.profiles_protect()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or public.is_admin() or current_setting('app.profile_sync', true) = '1' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role  := 'user';
    new.email := coalesce(auth.jwt() ->> 'email', new.email);
  else
    new.id         := old.id;
    new.role       := old.role;
    new.email      := coalesce(nullif(old.email, ''), auth.jwt() ->> 'email');
    new.full_name  := old.full_name;
    new.avatar_url := old.avatar_url;
    if old.student_id is not null and new.student_id is distinct from old.student_id then
      raise exception 'แก้รหัสนักศึกษาเองไม่ได้ ติดต่อผู้ดูแลเพื่อแก้ไข';
    end if;
  end if;
  return new;
end;
$$;

-- เติมชื่อ/รูปให้บัญชีที่มีอยู่แล้ว
update public.profiles p
   set full_name  = coalesce(public._profile_meta_name(u.raw_user_meta_data), p.full_name),
       avatar_url = coalesce(public._profile_meta_avatar(u.raw_user_meta_data), p.avatar_url)
  from auth.users u
 where u.id = p.id;
