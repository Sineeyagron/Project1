-- =====================================================================
-- แยกกล่องคำขอ กับ กระดิ่งแจ้งเตือน (ฝั่งผู้ดูแล)
-- - คำขอยืม/คืน/ยืมต่อ อยู่ในกล่องคำขออย่างเดียว ไม่สร้างแจ้งเตือนให้ผู้ดูแลแล้ว
-- - กระดิ่งผู้ดูแลเหลือเรื่องทั่วไป: ประกัน/อายุ, เกินกำหนดคืน, คืนอัตโนมัติ
-- แก้ที่ตัวช่วย _notify_staff ตัวเดียว (RPC request_borrow/request_return/request_renew ไม่ต้องแตะ)
-- =====================================================================

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
    and p_type not in ('request_borrow', 'request_return', 'request_renew');
$$;

revoke execute on function public._notify_staff(text, text, text, text, uuid, uuid) from public, anon, authenticated;

-- ล้างแจ้งเตือนคำขอเก่าที่ค้างในกระดิ่ง (คำขอจริงยังอยู่ครบในตาราง borrow_requests)
delete from public.notifications
where type in ('request_borrow', 'request_return', 'request_renew');
