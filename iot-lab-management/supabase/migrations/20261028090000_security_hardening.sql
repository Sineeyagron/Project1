-- =====================================================================
-- ปิดช่องโหว่จากการรีวิวความปลอดภัย (28 ต.ค. 2569)
-- 1. เปลี่ยน role ได้ทางเดียวคือ set_user_role — เดิม admin แก้คอลัมน์ role ตรงผ่าน API ได้
--    (ข้ามด่าน "เปลี่ยนสิทธิ์ตัวเองไม่ได้ / ต้องเหลือ admin ≥ 1" และไม่มีแจ้งเตือน)
--    · ในแอป (มี auth.uid()) ต้องผ่าน set_user_role ที่ตั้ง app.role_change ไว้ก่อน update
--    · SQL ใน Dashboard / service role (ไม่มี auth.uid()) ยังแก้ได้ ไว้กู้ระบบตอนไม่มี admin เหลือ
--    · สร้างโปรไฟล์ใหม่จากแอป = role 'user' เสมอ (รวม admin)
-- 2. set_user_role: บันทึกว่าใครเปลี่ยน (ท้ายข้อความแจ้งเตือน) · กัน p_role ว่าง · ล็อกแถว admin ตามลำดับเดียวกัน (กัน deadlock)
-- 3. push_subscriptions: เพิ่มได้ทาง save_push_subscription เท่านั้น + รับเฉพาะโฮสต์ของบริการ push จริง
--    (เดิมเพิ่มแถวตรงได้ ข้ามการเช็ก → Edge Function send-push ยิงไปที่ URL ไหนก็ได้)
-- =====================================================================

-- 1. ด่าน role ใน trigger เดิม (ส่วนที่เหลือเหมือนเดิมทุกอย่าง)
create or replace function public.profiles_protect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.role := 'user';
    elsif new.role is distinct from old.role
          and coalesce(current_setting('app.role_change', true), '') <> '1' then
      raise exception 'เปลี่ยนสิทธิ์ได้ที่หน้าจัดการผู้ใช้เท่านั้น';
    end if;
  end if;

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

-- 2. set_user_role
create or replace function public.set_user_role(p_user uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old   text;
  v_by    text;
  v_title text;
  v_body  text;
begin
  if not public.is_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบ (admin) เท่านั้น';
  end if;
  if p_role is null or p_role not in ('user', 'ta', 'admin') then
    raise exception 'สิทธิ์ไม่ถูกต้อง';
  end if;
  if p_user is null or p_user = auth.uid() then
    raise exception 'เปลี่ยนสิทธิ์ของตัวเองไม่ได้';
  end if;

  -- ล็อกแถว admin ทั้งหมดก่อน (เรียงตาม id ทุกครั้ง) → admin 2 คนถอดกันพร้อมกันไม่ deadlock และนับจำนวนได้ถูก
  perform 1 from public.profiles where role = 'admin' order by id for update;
  if not public.is_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบ (admin) เท่านั้น';
  end if;

  select role into v_old from public.profiles where id = p_user for update;
  if not found then
    raise exception 'ไม่พบผู้ใช้นี้';
  end if;
  if v_old = p_role then
    return v_old;
  end if;
  if v_old = 'admin' and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน';
  end if;

  perform set_config('app.role_change', '1', true);
  update public.profiles set role = p_role where id = p_user;
  perform set_config('app.role_change', '', true);

  select coalesce(nullif(btrim(full_name), ''), email, 'ผู้ดูแลระบบ') into v_by
  from public.profiles where id = auth.uid();

  if p_role = 'admin' then
    v_title := 'คุณได้รับสิทธิ์ผู้ดูแลระบบ';
    v_body  := 'จัดการอุปกรณ์ ตั้งค่าระบบ ระบบห้องคอม และสิทธิ์ผู้ใช้ได้ — กดแจ้งเตือนนี้เพื่อเปิดหน้าผู้ดูแล';
  elsif p_role = 'ta' then
    v_title := case when v_old = 'admin' then 'สิทธิ์ของคุณเปลี่ยนเป็น TA' else 'คุณได้รับสิทธิ์ TA' end;
    v_body  := 'อนุมัติคำขอยืม/คืน ตรวจสภาพ ดูรายงาน และพิมพ์ป้าย QR ได้ — กดแจ้งเตือนนี้เพื่อเปิดเมนู TA';
  else
    v_title := case when v_old = 'admin' then 'สิทธิ์ผู้ดูแลระบบของคุณถูกยกเลิก' else 'สิทธิ์ TA ของคุณถูกยกเลิก' end;
    v_body  := 'บัญชีกลับเป็นผู้ใช้ทั่วไป';
  end if;

  perform public._notify(p_user, 'role_changed', v_title, v_body || ' (โดย ' || coalesce(v_by, 'ผู้ดูแลระบบ') || ')', null, null, null);
  return p_role;
end;
$$;

revoke execute on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;

-- 3. push_subscriptions
drop policy if exists push_subs_insert_own on public.push_subscriptions;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;
  -- เฉพาะบริการ push ของเบราว์เซอร์: Chrome/Android (FCM), Firefox, Safari/iPhone, Edge/Windows
  if p_endpoint is null or length(p_endpoint) > 1000
     or p_endpoint !~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
     or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'ข้อมูลการสมัครแจ้งเตือนไม่ถูกต้อง';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;
