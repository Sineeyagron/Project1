-- =====================================================================
-- เฟส 4.1: บทบาท TA (ผู้ช่วย Admin)
-- TA ทำได้: ดูสถานะ/ประวัติ/ผู้ยืม, อนุมัติ-ปฏิเสธคำขอยืม/คืน/ยืมต่อ, ตรวจสภาพ (ตอนคืน + ตรวจประจำเทอม),
--          ดูรายงานสต็อก, พิมพ์ป้าย QR, ได้แจ้งเตือนเกินกำหนด/คืนอัตโนมัติ
-- TA ทำไม่ได้: เพิ่ม/แก้/จำหน่ายของ, ประกัน, หมวดหมู่, ตั้งค่าระบบ, แต่งตั้ง TA, ระบบห้องคอม
--   → ตารางพวกนั้นยังเป็น is_admin() เหมือนเดิม ไม่ต้องแก้
-- Admin แต่งตั้ง/ถอด TA ผ่าน RPC set_user_role เท่านั้น (เปลี่ยนเป็น admin ในแอปไม่ได้)
-- =====================================================================

-- 1. role ใหม่
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['user', 'ta', 'admin']));

-- 2. TA นับเป็นผู้ดูแล (is_staff / _notify_staff / RLS ที่ใช้ is_staff ได้ TA ทันที)
create or replace function public._staff_roles()
returns text[]
language sql
immutable
set search_path = public
as $$ select array['admin', 'ta']::text[]; $$;

revoke execute on function public._staff_roles() from public, anon, authenticated;

-- 3. แจ้งเตือนประกัน/อายุ = งานของ admin (จัดการของ) ไม่ส่งให้ TA
create or replace function public._notify_staff(
  p_type text, p_title text, p_body text,
  p_item_name text, p_request uuid, p_item uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, title, body, item_name, request_id, item_id)
  select p.id, p_type, p_title, p_body, p_item_name, p_request, p_item
  from public.profiles p
  where p.role = any (public._staff_roles())
    -- คำขอใหม่ดูที่กล่องคำขอ ไม่ส่งเข้ากระดิ่ง
    and p_type not in ('request_borrow', 'request_return', 'request_renew')
    -- ประกัน/อายุอุปกรณ์ แจ้งเฉพาะ admin
    and (p.role = 'admin' or p_type not in ('warranty_soon', 'warranty_expired', 'age_warn', 'age_replace'));
$$;

revoke execute on function public._notify_staff(text, text, text, text, uuid, uuid) from public, anon, authenticated;

-- 4. TA อ่านได้: ประวัติยืมทั้งหมด + โปรไฟล์ (อีเมลผู้ยืม) — เขียนยังเป็น admin / RPC เหมือนเดิม
--    (ชื่อ policy ภาษาไทยถูกตัดที่ 63 ไบต์ → หาชื่อจริงจาก catalog)
do $$
declare
  r record;
begin
  for r in
    select c.relname, p.polname
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('borrow_records', 'profiles')
      and p.polcmd = 'r'
  loop
    execute format(
      'alter policy %I on public.%I using (%I = (select auth.uid()) or (select public.is_staff()))',
      r.polname, r.relname, case when r.relname = 'profiles' then 'id' else 'user_id' end
    );
  end loop;
end $$;

-- 5. ตรวจสภาพประจำเทอม (item_inspections): TA อ่าน/บันทึกได้ ลบได้เฉพาะ admin
drop policy "item_inspections: admin เท่านั้น" on public.item_inspections;
create policy "item_inspections: staff อ่าน" on public.item_inspections
  for select to authenticated using ((select public.is_staff()));
create policy "item_inspections: staff บันทึก" on public.item_inspections
  for insert to authenticated with check ((select public.is_staff()));
create policy "item_inspections: staff แก้" on public.item_inspections
  for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "item_inspections: admin ลบ" on public.item_inspections
  for delete to authenticated using ((select public.is_admin()));

-- 6. แจ้งเตือนเมื่อสิทธิ์เปลี่ยน
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'borrow', 'return', 'request_borrow', 'request_return', 'request_renew',
  'approved', 'declined', 'expired', 'cancelled', 'auto_returned', 'renewed',
  'due_soon', 'overdue',
  'warranty_soon', 'warranty_expired', 'age_warn', 'age_replace',
  'role_changed'
]));

-- 7. Admin แต่งตั้ง / ถอด TA
--    กันพลาด: เปลี่ยนสิทธิ์ตัวเองไม่ได้, แตะบัญชี admin ไม่ได้, ตั้งเป็น admin ผ่านแอปไม่ได้
create or replace function public.set_user_role(p_user uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old   text;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบ (admin) เท่านั้น';
  end if;
  if p_role not in ('user', 'ta') then
    raise exception 'ตั้งได้แค่ TA หรือผู้ใช้ทั่วไป';
  end if;
  if p_user = auth.uid() then
    raise exception 'เปลี่ยนสิทธิ์ของตัวเองไม่ได้';
  end if;

  select role, email into v_old, v_email from public.profiles where id = p_user for update;
  if not found then
    raise exception 'ไม่พบผู้ใช้นี้';
  end if;
  if v_old = 'admin' then
    raise exception 'เปลี่ยนสิทธิ์ผู้ดูแลระบบ (admin) ในแอปไม่ได้';
  end if;
  if v_old = p_role then
    return v_old;
  end if;

  update public.profiles set role = p_role where id = p_user;

  perform public._notify(
    p_user, 'role_changed',
    case when p_role = 'ta' then 'คุณได้รับสิทธิ์ TA' else 'สิทธิ์ TA ของคุณถูกยกเลิก' end,
    case when p_role = 'ta'
      then 'อนุมัติคำขอยืม/คืน ตรวจสภาพ ดูรายงาน และพิมพ์ป้าย QR ได้ — กดแจ้งเตือนนี้เพื่อเปิดเมนู TA'
      else 'บัญชีกลับเป็นผู้ใช้ทั่วไป' end,
    null, null, null
  );
  return p_role;
end;
$$;

revoke execute on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- 8. กันอนุมัติ/ปฏิเสธคำขอของตัวเอง (TA อาจเป็นนักศึกษาที่ยืมของด้วย)
--    admin ยังทำได้ (กรณีจำเป็น) / งานอัตโนมัติ (auth.uid() ว่าง) ไม่โดน
create or replace function public.borrow_requests_no_self_decide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending'
     and new.status in ('approved', 'declined')
     and auth.uid() is not null
     and new.user_id = auth.uid()
     and not public.is_admin() then
    raise exception 'อนุมัติหรือปฏิเสธคำขอของตัวเองไม่ได้ — ให้ผู้ดูแลคนอื่นตัดสิน';
  end if;
  return new;
end;
$$;

revoke execute on function public.borrow_requests_no_self_decide() from public, anon, authenticated;

create trigger borrow_requests_no_self_decide
  before update on public.borrow_requests
  for each row execute function public.borrow_requests_no_self_decide();
