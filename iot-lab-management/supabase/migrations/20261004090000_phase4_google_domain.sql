-- =====================================================================
-- เฟส 4.2: ล็อกอิน Google + สวิตช์ "รับเฉพาะอีเมล @kkumail.com" (ตรวจฝั่งเซิร์ฟเวอร์)
-- ช่วงพัฒนา: ปิดไว้ (allowed_email_domain = "") ทุกบัญชีใช้ได้ / ตอน Final Project: เปิดในหน้าตั้งค่าระบบ + เปิด Hook
-- ใช้ Supabase Auth Hook "Before User Created": ทุกการสมัครใหม่ (Google / อีเมล+รหัสผ่าน) ผ่านฟังก์ชันนี้ก่อน
-- - บัญชีที่มีอยู่แล้ว (รวม admin @gmail/@hotmail) ไม่โดน — ตรวจแค่ตอนสร้างบัญชีใหม่
-- - โดเมนตั้งใน app_settings.allowed_email_domain (ว่าง = รับทุกโดเมน ไว้ใช้ช่วงทดสอบ)
-- ⚠️ ต้องไปเปิด Hook เองใน Dashboard → Authentication → Hooks → Before User Created → เลือกฟังก์ชันนี้
-- =====================================================================

insert into public.app_settings (key, value)
values ('allowed_email_domain', '""'::jsonb)
on conflict (key) do nothing;

create or replace function public.hook_restrict_signup_domain(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text := lower(coalesce(event -> 'user' ->> 'email', ''));
  v_domain text := lower(coalesce((select value #>> '{}' from public.app_settings where key = 'allowed_email_domain'), ''));
begin
  if v_domain = '' or v_email like '%@' || v_domain then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', format('สมัครได้เฉพาะอีเมล @%s (มหาวิทยาลัยขอนแก่น)', v_domain)
    )
  );
end;
$$;

-- เรียกได้เฉพาะระบบ Auth ของ Supabase
revoke execute on function public.hook_restrict_signup_domain(jsonb) from public, anon, authenticated;
grant execute on function public.hook_restrict_signup_domain(jsonb) to supabase_auth_admin;
