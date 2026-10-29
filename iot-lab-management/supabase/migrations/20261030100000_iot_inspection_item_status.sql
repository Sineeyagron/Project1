-- ผลตรวจสภาพ IoT → สถานะอุปกรณ์ (เดิมบันทึกแค่ผลตรวจ ของที่ตรวจว่าเสียยังยืมได้)
-- ชำรุด/เสีย: ว่าง → ซ่อมบำรุง · ปกติ: ซ่อมบำรุง → ว่าง · ของที่ถูกยืม/จอง/จำหน่าย ไม่แตะ
-- security definer: TA บันทึกผลตรวจได้แต่แก้ตาราง items เองไม่ได้

create or replace function public._iot_inspection_sync_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.condition in ('damaged', 'missing') then
    update public.items set status = 'repair' where id = new.item_id and status = 'available';
  elsif new.condition = 'good' then
    update public.items set status = 'available' where id = new.item_id and status = 'repair';
  end if;
  return new;
end;
$$;

revoke execute on function public._iot_inspection_sync_item() from public, anon, authenticated;

drop trigger if exists item_inspections_sync_item on public.item_inspections;
create trigger item_inspections_sync_item
  after insert or update of condition on public.item_inspections
  for each row execute function public._iot_inspection_sync_item();
