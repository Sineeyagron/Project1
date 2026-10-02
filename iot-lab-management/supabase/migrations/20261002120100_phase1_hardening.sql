-- เฟส 1 (ต่อ): ปิดช่องที่ Supabase security advisor แจ้งหลังรัน phase1_items
-- trigger function ไม่ควรถูกเรียกผ่าน /rest/v1/rpc
revoke execute on function public.items_before_insert() from public, anon, authenticated;
revoke execute on function public.items_before_update() from public, anon, authenticated;

-- ฟังก์ชันต้องกำหนด search_path ให้ชัด
alter function public.format_item_no(int) set search_path = public;
