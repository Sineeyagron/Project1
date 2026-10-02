-- แก้บั๊ก: profiles.email ว่าง (บัญชีเก่าก่อนมี trigger handle_new_user)
-- ทำให้แจ้งเตือน/กล่องคำขอ/สแกนดูสถานะ แสดงผู้ยืมเป็น "-"

-- 1. เติมอีเมลจากระบบล็อกอินให้แถวที่ว่าง
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

-- 2. กันเกิดซ้ำ: ผู้ใช้แก้อีเมลตัวเองไม่ได้ (เหมือนเดิม) แต่ถ้ายังว่างอยู่ให้เติมจากบัญชีที่ล็อกอิน
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
    new.email := coalesce(nullif(old.email, ''), auth.jwt() ->> 'email');
  end if;
  return new;
end;
$$;
