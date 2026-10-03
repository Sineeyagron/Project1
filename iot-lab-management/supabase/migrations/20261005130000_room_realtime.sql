-- ระบบห้อง: อัปเดตสด (REVIEW M12) — สถานะเครื่อง/LAN/เช็กลิสต์ เปลี่ยน → ส่งสัญญาณช่อง "room"
-- แยกจากระบบยืม-คืน: ใช้ช่องของตัวเอง (ไม่ใช้ช่อง staff / user:<id> ของระบบยืม) ไม่แก้ฟังก์ชัน/policy เดิม
-- สัญญาณบอกแค่ "ห้องไหนเปลี่ยน" — หน้าโหลดข้อมูลเองผ่าน RLS ตามปกติ

create or replace function public._room_broadcast_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_room text;
begin
  if tg_table_name = 'station_equipment' then
    select room_id into v_room from public.computer_stations where id = (v_row ->> 'station_id')::uuid;
  else
    v_room := v_row ->> 'room_id';
  end if;
  -- realtime.send ล้มเงียบเองถ้า Realtime ไม่พร้อม ไม่ทำให้การบันทึกพัง
  perform realtime.send(jsonb_build_object('room_id', v_room, 'table', tg_table_name), 'room_status', 'room', true);
  return null;
end $$;

drop trigger if exists computer_stations_broadcast on public.computer_stations;
create trigger computer_stations_broadcast after insert or update or delete on public.computer_stations
  for each row execute function public._room_broadcast_change();
drop trigger if exists lan_ports_broadcast on public.lan_ports;
create trigger lan_ports_broadcast after insert or update or delete on public.lan_ports
  for each row execute function public._room_broadcast_change();
drop trigger if exists station_equipment_broadcast on public.station_equipment;
create trigger station_equipment_broadcast after update on public.station_equipment
  for each row execute function public._room_broadcast_change();

-- ทุกคนที่ล็อกอินฟังช่อง "room" ได้ (สถานะห้องเป็นข้อมูลที่นักศึกษาอ่านได้อยู่แล้ว)
-- เพิ่ม policy ใหม่ ไม่แก้ policy ช่อง user:/staff เดิม
drop policy if exists "realtime: ช่องห้องคอม (ทุกคนที่ล็อกอิน)" on realtime.messages;
create policy "realtime: ช่องห้องคอม (ทุกคนที่ล็อกอิน)" on realtime.messages
  for select to authenticated using ((select realtime.topic()) = 'room');
