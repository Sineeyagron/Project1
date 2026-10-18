-- เทสกติกายืม-คืน (RPC ใน supabase/migrations) — ไม่แตะข้อมูลจริง
-- วิธีรัน: วางทั้งไฟล์ใน Supabase Dashboard → SQL Editor → Run
--   ผ่านทั้งหมด = ขึ้น error "ALL TESTS PASSED (n)"  ← ตั้งใจให้เป็น error เพื่อย้อนกลับ (rollback) ทุกอย่าง
--   มีข้อพัง   = ขึ้น error "FAIL [ชื่อเทส] ..." บอกว่าข้อไหนผิด
-- ทุกอย่างอยู่ใน transaction เดียวแล้วย้อนกลับ: ผู้ใช้/อุปกรณ์/รูป/คำขอ/แจ้งเตือน/คิว push ที่สร้างระหว่างเทสหายหมด
-- สวมบทผู้ใช้ด้วย request.jwt.claims (auth.uid()) — RPC เป็น security definer จึงทำงานเหมือนเรียกจากแอป
-- แก้กติกาใน RPC เมื่อไร รันไฟล์นี้ซ้ำทุกครั้ง

create or replace function pg_temp.act_as(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when p_uid is null then '' else json_build_object('sub', p_uid, 'role', 'authenticated')::text end, true);
$$;

-- คำสั่งนี้ต้อง error และข้อความต้องมีคำที่คาดไว้
create or replace function pg_temp.expect_fail(p_name text, p_sql text, p_contains text) returns void language plpgsql as $$
declare v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null then
    raise exception 'FAIL [%] ควร error แต่ผ่าน', p_name;
  end if;
  if position(p_contains in v_msg) = 0 then
    raise exception 'FAIL [%] error ผิดข้อความ: "%" (คาด "%")', p_name, v_msg, p_contains;
  end if;
end;
$$;

create or replace function pg_temp.check(p_name text, p_ok boolean, p_detail text default '') returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'FAIL [%] %', p_name, p_detail;
  end if;
end;
$$;

-- รูปหลักฐาน (แถวใน storage.objects ของ bucket borrow-photos ใต้โฟลเดอร์ผู้ใช้)
create or replace function pg_temp.photo(p_uid uuid, p_name text) returns text language plpgsql as $$
declare v_path text := p_uid::text || '/zz-test-' || p_name || '.jpg';
begin
  insert into storage.objects (bucket_id, name) values ('borrow-photos', v_path);
  return v_path;
end;
$$;

do $$
declare
  s1 uuid := gen_random_uuid();  -- นักศึกษา 1
  s2 uuid := gen_random_uuid();  -- นักศึกษา 2
  ta uuid := gen_random_uuid();  -- TA
  it1 uuid; it2 uuid; it3 uuid;
  rq uuid; rq2 uuid; rq3 uuid; rec uuid; pk uuid; pk2 uuid;
  v_status text; v_due date; v_due2 date;
  n int := 0;  -- จำนวนข้อที่ผ่าน
begin
  -- ===== เตรียมข้อมูล =====
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (s1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-test-s1@example.com', '{}', now(), now()),
         (s2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-test-s2@example.com', '{}', now(), now()),
         (ta, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-test-ta@example.com', '{}', now(), now());
  perform pg_temp.act_as(null);
  update public.profiles set role = 'ta' where id = ta;
  update public.profiles set student_id = '000000001-1' where id = s1;
  update public.profiles set student_id = '000000002-2' where id = s2;

  -- ค่าตั้งให้แน่นอน ไม่ขึ้นกับค่าจริงในระบบ (ย้อนกลับตอนจบ)
  update public.app_settings set value = '3' where key = 'max_active_borrows';
  update public.app_settings set value = '[3, 5, 7, 14]' where key = 'borrow_day_options';
  update public.app_settings set value = '30' where key = 'request_expiry_minutes';

  -- อุปกรณ์รุ่นทดสอบ 3 ชิ้น (trigger ออกรหัส/บาร์โค้ด/ห้องให้เอง)
  insert into public.items (name, status) values ('ZZTESTMODEL', 'available') returning id into it1;
  insert into public.items (name, status) values ('ZZTESTMODEL', 'available') returning id into it2;
  insert into public.items (name, status) values ('ZZTESTMODEL', 'available') returning id into it3;
  perform pg_temp.check('เตรียม: ผู้ใช้ทดสอบมีโปรไฟล์', (select count(*) from public.profiles where id in (s1, s2, ta)) = 3);
  perform pg_temp.check('เตรียม: อุปกรณ์ได้รหัสอัตโนมัติ', (select count(*) from public.items where id in (it1, it2, it3) and item_code is not null and barcode is not null) = 3);
  n := n + 2;

  -- ===== 1. ขอยืม: หลักฐาน + ตัวเลือกวัน =====
  perform pg_temp.act_as(s1);
  perform pg_temp.expect_fail('ยืมไม่มีรูป', format('select public.request_borrow(%L, 3, ''good'', null, null)', it1), 'ถ่ายรูป');
  perform pg_temp.expect_fail('ยืมด้วยรูปในโฟลเดอร์คนอื่น', format('select public.request_borrow(%L, 3, ''good'', null, %L)', it1, pg_temp.photo(s2, 'other')), 'ถ่ายรูป');
  perform pg_temp.expect_fail('ไม่ได้เลือกสภาพ', format('select public.request_borrow(%L, 3, null, null, %L)', it1, pg_temp.photo(s1, 'nocond')), 'สภาพ');
  perform pg_temp.expect_fail('แจ้งชำรุดไม่บอกรายละเอียด', format('select public.request_borrow(%L, 3, ''damaged'', '' '', %L)', it1, pg_temp.photo(s1, 'dmg')), 'รายละเอียด');
  perform pg_temp.expect_fail('จำนวนวันไม่อยู่ในตัวเลือก', format('select public.request_borrow(%L, 2, ''good'', null, %L)', it1, pg_temp.photo(s1, 'days')), 'จำนวนวัน');
  n := n + 5;

  rq := public.request_borrow(it1, 3, 'good', null, pg_temp.photo(s1, 'b1'));
  perform pg_temp.check('ยืมสำเร็จ → ของถูกจอง', (select status from public.items where id = it1) = 'reserved');
  perform pg_temp.check('ยืมสำเร็จ → คำขอรออนุมัติ', (select status from public.borrow_requests where id = rq) = 'pending');
  perform pg_temp.check('ยืมสำเร็จ → นับโควตา 1', public._active_borrow_count(s1) = 1);
  perform pg_temp.check('ยืมสำเร็จ → มีเวลาหมดอายุ ~30 นาที',
    (select expires_at between now() + interval '29 minutes' and now() + interval '31 minutes' from public.borrow_requests where id = rq));
  n := n + 4;
  perform pg_temp.expect_fail('ใช้รูปซ้ำ', format('select public.request_borrow(%L, 3, ''good'', null, %L)', it2, s1::text || '/zz-test-b1.jpg'), 'รูปนี้ถูกใช้ไปแล้ว');
  perform pg_temp.expect_fail('ยืมของที่ถูกจองแล้ว', format('select public.request_borrow(%L, 3, ''good'', null, %L)', it1, pg_temp.photo(s1, 'b1x')), 'ยืมไม่ได้ตอนนี้');
  n := n + 2;

  -- ===== 2. ตัดสินคำขอ =====
  perform pg_temp.expect_fail('นักศึกษาอนุมัติไม่ได้', format('select public.decide_request(%L, true)', rq), 'เฉพาะผู้ดูแล');
  perform pg_temp.act_as(ta);
  perform pg_temp.expect_fail('ปฏิเสธต้องมีเหตุผล', format('select public.decide_request(%L, false, '' '')', rq), 'เหตุผล');
  n := n + 2;
  perform public.decide_request(rq, true);
  select status, due_date, id into v_status, v_due, rec from public.borrow_records where borrow_request_id = rq;
  perform pg_temp.check('อนุมัติ → มีรายการยืม', v_status = 'borrowed', coalesce(v_status, 'ไม่มีรายการ'));
  perform pg_temp.check('อนุมัติ → กำหนดคืน = วันนี้ + 3', v_due = public._bkk_today() + 3, coalesce(v_due::text, '-'));
  perform pg_temp.check('อนุมัติ → ของสถานะถูกยืม', (select status from public.items where id = it1) = 'borrowed');
  perform pg_temp.check('อนุมัติ → แจ้งเตือนผู้ยืม', exists (select 1 from public.notifications where user_id = s1 and type = 'approved'));
  perform pg_temp.check('อนุมัติ → บันทึกผู้อนุมัติ', (select decided_by from public.borrow_requests where id = rq) = ta);
  n := n + 5;
  perform pg_temp.expect_fail('อนุมัติซ้ำ (อีกคนจัดการไปแล้ว)', format('select public.decide_request(%L, true)', rq), 'อนุมัติคำขอนี้ไปแล้ว');
  n := n + 1;

  -- TA ขอยืมเอง → ตัดสินคำขอของตัวเองไม่ได้ทั้งอนุมัติและปฏิเสธ
  rq2 := public.request_borrow(it2, 3, 'good', null, pg_temp.photo(ta, 'tb'));
  perform pg_temp.expect_fail('TA อนุมัติคำขอตัวเองไม่ได้', format('select public.decide_request(%L, true)', rq2), 'ของตัวเอง');
  perform pg_temp.expect_fail('TA ปฏิเสธคำขอตัวเองไม่ได้', format('select public.decide_request(%L, false, ''x'')', rq2), 'ของตัวเอง');
  n := n + 2;
  -- TA ยกเลิกคำขอตัวเองได้ → ของกลับมาว่าง
  perform public.cancel_request(rq2);
  perform pg_temp.check('ยกเลิกคำขอ → ของกลับมาว่าง', (select status from public.items where id = it2) = 'available');
  perform pg_temp.check('ยกเลิกคำขอ → สถานะ cancelled', (select status from public.borrow_requests where id = rq2) = 'cancelled');
  n := n + 2;
  perform pg_temp.act_as(s2);
  perform pg_temp.expect_fail('ยกเลิกคำขอของคนอื่นไม่ได้', format('select public.cancel_request(%L)', rq), 'ไม่พบคำขอ');
  n := n + 1;

  -- ===== 3. ยืมต่อ =====
  perform pg_temp.act_as(s1);
  rq3 := public.request_renew(it1, 3);
  perform pg_temp.expect_fail('มีคำขอค้างอยู่แล้ว ขอคืนไม่ได้', format('select public.request_return(%L, ''good'', null, %L)', it1, pg_temp.photo(s1, 'r0')), 'รอดำเนินการอยู่แล้ว');
  n := n + 1;
  perform pg_temp.act_as(ta);
  perform public.decide_request(rq3, true);
  select due_date into v_due2 from public.borrow_records where id = rec;
  perform pg_temp.check('ยืมต่อ → กำหนดคืนเลื่อน 3 วัน', v_due2 = v_due + 3, v_due2::text);
  perform pg_temp.check('ยืมต่อ → นับครั้ง', (select renew_count from public.borrow_records where id = rec) = 1);
  n := n + 2;
  perform pg_temp.act_as(s1);
  perform pg_temp.expect_fail('ยืมต่อได้ครั้งเดียว', format('select public.request_renew(%L, 3)', it1), 'ครั้งเดียว');
  perform pg_temp.act_as(null);
  update public.borrow_records set renew_count = 0, due_date = public._bkk_today() - 1 where id = rec;
  perform pg_temp.act_as(s1);
  perform pg_temp.expect_fail('เกินกำหนดแล้วยืมต่อไม่ได้', format('select public.request_renew(%L, 3)', it1), 'เกินกำหนด');
  n := n + 2;

  -- ===== 4. คืน =====
  perform pg_temp.act_as(s2);
  perform pg_temp.expect_fail('คืนของที่ไม่ได้ยืม', format('select public.request_return(%L, ''good'', null, %L)', it1, pg_temp.photo(s2, 'r1')), 'ไม่ได้ยืม');
  perform pg_temp.act_as(s1);
  rq := public.request_return(it1, 'damaged', 'ขาหัก', pg_temp.photo(s1, 'r2'));
  perform pg_temp.check('ขอคืน → รายการรอตรวจคืน', (select status from public.borrow_records where id = rec) = 'pending_return');
  n := n + 2;
  perform pg_temp.act_as(ta);
  perform pg_temp.expect_fail('อนุมัติคืนต้องเลือกผลตรวจ', format('select public.decide_request(%L, true)', rq), 'ผลตรวจสภาพ');
  perform pg_temp.expect_fail('ค่าเสียหายติดลบไม่ได้', format('select public.decide_request(%L, true, ''x'', ''damaged'', -5)', rq), 'ติดลบ');
  perform public.decide_request(rq, true, 'ขาหัก 1 ขา', 'damaged', 50);
  perform pg_temp.check('คืนชำรุด → รายการคืนแล้ว', (select status from public.borrow_records where id = rec) = 'returned');
  perform pg_temp.check('คืนชำรุด → ค่าเสียหายบันทึก', (select damage_cost from public.borrow_records where id = rec) = 50);
  perform pg_temp.check('คืนชำรุด → ของเข้าซ่อม', (select status from public.items where id = it1) = 'repair');
  perform pg_temp.check('คืนแล้ว → โควตาว่าง', public._active_borrow_count(s1) = 0);
  n := n + 6;

  -- ===== 5. หมดเวลา: ยืมหมดอายุ / คืนอัตโนมัติ =====
  perform pg_temp.act_as(s2);
  rq := public.request_borrow(it2, 5, 'good', null, pg_temp.photo(s2, 'e1'));
  perform pg_temp.act_as(null);
  update public.borrow_requests set expires_at = now() - interval '1 minute' where id = rq;
  perform public.expire_requests();
  perform pg_temp.check('ไม่มีคนตอบ → คำขอยืมหมดอายุ', (select status from public.borrow_requests where id = rq) = 'expired');
  perform pg_temp.check('หมดอายุ → ของกลับมาว่าง', (select status from public.items where id = it2) = 'available');
  n := n + 2;

  -- ===== 6. โควตา =====
  perform pg_temp.act_as(null);
  update public.app_settings set value = '1' where key = 'max_active_borrows';
  perform pg_temp.act_as(s2);
  rq := public.request_borrow(it2, 3, 'good', null, pg_temp.photo(s2, 'q1'));
  perform pg_temp.expect_fail('เกินโควตา (คำขอรออนุมัติก็นับ)', format('select public.request_borrow(%L, 3, ''good'', null, %L)', it3, pg_temp.photo(s2, 'q2')), 'สูงสุด');
  perform pg_temp.expect_fail('เกินโควตา (นัดรับก็นับ)', 'select public.request_pickup(''ZZTESTMODEL'', 3, null)', 'สูงสุด');
  perform public.cancel_request(rq);
  perform pg_temp.act_as(null);
  update public.app_settings set value = '3' where key = 'max_active_borrows';
  n := n + 2;

  -- ===== 7. นัดรับ: กันของตั้งแต่ส่งคำขอ =====
  -- ตอนนี้ว่าง 2 ชิ้น (it2, it3) — it1 อยู่ระหว่างซ่อม
  perform pg_temp.check('นัดรับ: ว่างเริ่มต้น 2', public._pickup_free('zztestmodel') = 2, public._pickup_free('zztestmodel')::text);
  perform pg_temp.act_as(s1);
  pk := public.request_pickup('ZZTESTMODEL', 3, 'ขอรับบ่าย');
  perform pg_temp.expect_fail('ขอนัดรับรุ่นเดิมซ้ำ', 'select public.request_pickup(''ZZTESTMODEL'', 3, null)', 'อยู่แล้ว');
  perform pg_temp.act_as(s2);
  pk2 := public.request_pickup('ZZTESTMODEL', 3, null);
  perform pg_temp.check('นัดรับ 2 คำขอ → ว่างเหลือ 0', public._pickup_free('zztestmodel') = 0);
  n := n + 3;
  perform pg_temp.act_as(ta);
  perform public.cancel_pickup(pk2, false);
  perform pg_temp.act_as(null);
  update public.profiles set role = 'user' where id = ta;  -- ให้ TA เป็นนักศึกษาชั่วคราว เพื่อเทสการกันของ
  perform pg_temp.act_as(ta);
  rq := public.request_borrow(it2, 3, 'good', null, pg_temp.photo(ta, 'h1'));  -- เหลือว่าง 1 (กันไว้ 1) → ยืมได้ 1
  perform pg_temp.expect_fail('ชิ้นที่เหลือถูกกันไว้ให้คนขอนัดรับ', format('select public.request_borrow(%L, 3, ''good'', null, %L)', it3, pg_temp.photo(ta, 'h2')), 'ถูกกันไว้');
  perform public.cancel_request(rq);
  perform pg_temp.act_as(null);
  update public.profiles set role = 'ta' where id = ta;
  n := n + 1;

  perform pg_temp.act_as(s1);
  perform pg_temp.expect_fail('นักศึกษานัดเวลาเองไม่ได้', format('select public.schedule_pickup(%L, now() + interval ''1 hour'')', pk), 'เฉพาะผู้ดูแล');
  perform pg_temp.act_as(ta);
  perform pg_temp.expect_fail('นัดย้อนหลังไม่ได้', format('select public.schedule_pickup(%L, now() - interval ''1 hour'')', pk), 'ย้อนหลัง');
  perform pg_temp.expect_fail('นัดเกิน 14 วันไม่ได้', format('select public.schedule_pickup(%L, now() + interval ''15 days'')', pk), '14 วัน');
  perform public.schedule_pickup(pk, now() + interval '1 hour');
  perform pg_temp.check('นัดเวลาแล้ว → scheduled', (select status from public.pickup_requests where id = pk) = 'scheduled');
  perform pg_temp.check('นัดเวลาแล้ว → แจ้งเตือนผู้ขอ', exists (select 1 from public.notifications where user_id = s1 and type = 'pickup_scheduled'));
  n := n + 5;
  perform pg_temp.act_as(s1);
  perform pg_temp.expect_fail('มีนัดรับรุ่นนี้ ต้องกดยืนยันรับตามนัด', format('select public.request_borrow(%L, 3, ''good'', null, %L)', it3, pg_temp.photo(s1, 'pk1')), 'ยืนยันรับของตามนัด');
  n := n + 1;

  raise exception 'ALL TESTS PASSED (%)', n;
end;
$$;
