-- =====================================================================
-- อาจารย์/บุคลากร มข. (@kku.ac.th) + ตั้งผู้ดูแลระบบ (admin) ในแอป
-- 1. สวิตช์ "รับเฉพาะอีเมล มข.": allowed_email_domain เก็บได้หลายโดเมนคั่นด้วย , ("kkumail.com,kku.ac.th")
--    ค่าเดิมโดเมนเดียว ("kkumail.com") / ว่าง ("") ยังใช้ได้เหมือนเดิม
-- 2. set_user_role: admin ตั้งได้ทั้ง user / ta / admin (เดิมได้แค่ user ↔ ta)
--    - @kku.ac.th เป็นอีเมลบุคลากรทุกคณะ → เข้าครั้งแรกเป็น user เสมอ admin ต้องตั้งสิทธิ์ให้เอง (ไม่ให้สิทธิ์ตามโดเมนอัตโนมัติ)
--    - เปลี่ยนสิทธิ์ตัวเองไม่ได้ / ต้องเหลือ admin อย่างน้อย 1 คน
-- =====================================================================

create or replace function public.hook_restrict_signup_domain(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email   text := lower(coalesce(event -> 'user' ->> 'email', ''));
  v_setting text := lower(coalesce((select value #>> '{}' from public.app_settings where key = 'allowed_email_domain'), ''));
  v_domains text[];
begin
  select coalesce(array_agg(d), '{}') into v_domains
  from (select btrim(x) as d from unnest(string_to_array(v_setting, ',')) as x) t
  where d <> '';

  if cardinality(v_domains) = 0 or split_part(v_email, '@', 2) = any (v_domains) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', format('สมัครได้เฉพาะอีเมล มข. (%s)', (select string_agg('@' || d, ', ') from unnest(v_domains) as d))
    )
  );
end;
$$;

revoke execute on function public.hook_restrict_signup_domain(jsonb) from public, anon, authenticated;
grant execute on function public.hook_restrict_signup_domain(jsonb) to supabase_auth_admin;

create or replace function public.set_user_role(p_user uuid, p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old   text;
  v_title text;
  v_body  text;
begin
  if not public.is_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบ (admin) เท่านั้น';
  end if;
  if p_role not in ('user', 'ta', 'admin') then
    raise exception 'สิทธิ์ไม่ถูกต้อง';
  end if;
  if p_user = auth.uid() then
    raise exception 'เปลี่ยนสิทธิ์ของตัวเองไม่ได้';
  end if;

  select role into v_old from public.profiles where id = p_user for update;
  if not found then
    raise exception 'ไม่พบผู้ใช้นี้';
  end if;
  if v_old = p_role then
    return v_old;
  end if;

  -- ถอด admin: ล็อกแถว admin ทั้งหมดกันสองคนถอดกันพร้อมกัน แล้วต้องเหลืออย่างน้อย 1 คน
  if v_old = 'admin' then
    perform 1 from public.profiles where role = 'admin' for update;
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน';
    end if;
  end if;

  update public.profiles set role = p_role where id = p_user;

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

  perform public._notify(p_user, 'role_changed', v_title, v_body, null, null, null);
  return p_role;
end;
$$;

revoke execute on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;
