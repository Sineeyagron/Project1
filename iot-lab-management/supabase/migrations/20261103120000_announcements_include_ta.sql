-- ผู้รับประกาศ: เดิมเฉพาะนักศึกษา (role = 'user') → นักศึกษา + TA (TA ยืมของได้ด้วย)
-- admin ไม่ได้รับ (ดูจากประวัติในหน้า admin/announce + ทดสอบส่งหาตัวเองได้) · กลุ่ม "ยืมค้าง" = ทุกคนที่ยืมค้างเหมือนเดิม
-- TA เห็นในกระดิ่งโหมดนักศึกษา (for_staff = false · push พาไป /notifications?tab=1)
-- แก้ 4 ฟังก์ชันจาก 20261103090000_announcements.sql: role = 'user' → role in ('user', 'ta') ที่เหลือเหมือนเดิม

create or replace function public.send_new_items_announcement(p_test_user uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since timestamptz;
  v_names text[];
  v_total int;
  v_body  text;
  v_users uuid[];
begin
  if p_test_user is null and not public._announce_on('announce_new_items') then
    return 0;
  end if;

  if p_test_user is null then
    -- กันส่งซ้ำถ้า cron ยิงซ้ำ / เพิ่งเปิดสวิตช์ก็ไม่ย้อนเกิน 1 วัน
    v_since := greatest(
      now() - interval '1 day',
      coalesce((select max(created_at) from public.announcements
                where kind = 'new_items' and audience <> 'test'), '-infinity'::timestamptz)
    );
  else
    v_since := now() - interval '7 days';
  end if;

  select array_agg(m.label order by m.first_at, m.label), count(*)
  into v_names, v_total
  from (
    select min(i.name) as label, min(i.created_at) as first_at
    from public.items i
    group by public._item_model(i.item_prefix, i.name)
    having min(i.created_at) >= v_since
       and bool_or(i.status = 'available')
  ) m;

  if coalesce(v_total, 0) = 0 then
    return 0;
  end if;

  v_body := array_to_string(v_names[1:3], ', ')
    || case when v_total > 3 then format(' และอีก %s รุ่น', v_total - 3) else '' end
    || ' ยืมได้แล้ว แตะเพื่อดูอุปกรณ์';

  if p_test_user is not null then
    v_users := array[p_test_user];
  else
    select array_agg(id) into v_users from public.profiles where role in ('user', 'ta');
  end if;

  return public._announce_send('new_items', format('มีของใหม่ %s รุ่น', v_total), v_body,
    case when p_test_user is null then 'all' else 'test' end, null, v_users);
end;
$$;

create or replace function public.send_invite_announcement(p_test_user uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_free  int;
  v_users uuid[];
begin
  if p_test_user is null and not public._announce_on('announce_invite') then
    return 0;
  end if;

  select count(*) into v_free from public.items where status = 'available';
  if v_free = 0 then
    return 0;
  end if;

  if p_test_user is not null then
    v_users := array[p_test_user];
  else
    select array_agg(p.id) into v_users
    from public.profiles p
    where p.role in ('user', 'ta')
      and not exists (
        select 1 from public.borrow_records br
        where br.user_id = p.id
          and (br.borrow_date > now() - interval '30 days' or br.status in ('borrowed', 'pending_return'))
      )
      and not exists (
        select 1 from public.notifications n
        where n.user_id = p.id and n.type = 'announce_invite' and n.created_at > now() - interval '30 days'
      );
  end if;

  return public._announce_send('invite',
    format('มีอุปกรณ์ว่าง %s ชิ้น ลองยืมไหม?', v_free),
    'ยืมไปทำโปรเจกต์หรือฝึกเขียนโค้ดได้ สแกน QR ที่อุปกรณ์ หรือขอนัดรับผ่านแอปได้เลย',
    case when p_test_user is null then 'inactive' else 'test' end, null, v_users);
end;
$$;

create or replace function public.send_announcement(p_title text, p_body text, p_audience text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_body  text := btrim(coalesce(p_body, ''));
  v_users uuid[];
begin
  if not public.is_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบ';
  end if;
  if char_length(v_title) not between 1 and 80 then
    raise exception 'หัวข้อต้องยาว 1–80 ตัวอักษร';
  end if;
  if char_length(v_body) not between 1 and 300 then
    raise exception 'ข้อความต้องยาว 1–300 ตัวอักษร';
  end if;
  if p_audience is null or p_audience not in ('all', 'borrowing', 'test') then
    raise exception 'ไม่รู้จักกลุ่มผู้รับ';
  end if;
  -- กันกดส่งซ้ำ (เน็ตช้า/แตะสองที)
  if p_audience <> 'test' and exists (
    select 1 from public.announcements
    where kind = 'manual' and audience = p_audience and title = v_title and body = v_body
      and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'ส่งประกาศนี้ไปแล้วเมื่อสักครู่';
  end if;

  if p_audience = 'test' then
    v_users := array[auth.uid()];
  elsif p_audience = 'all' then
    select array_agg(id) into v_users from public.profiles where role in ('user', 'ta');
  else
    select array_agg(distinct user_id) into v_users
    from public.borrow_records where status in ('borrowed', 'pending_return');
  end if;

  return public._announce_send('manual', v_title, v_body, p_audience, auth.uid(), v_users);
end;
$$;

create or replace function public.announcement_audience_counts()
returns table (all_count int, borrowing_count int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบ';
  end if;
  return query select
    (select count(*)::int from public.profiles where role in ('user', 'ta')),
    (select count(distinct user_id)::int from public.borrow_records where status in ('borrowed', 'pending_return'));
end;
$$;

-- create or replace คงสิทธิ์เดิมไว้ (revoke/grant ใน migration ก่อนหน้า) ไม่ต้องตั้งซ้ำ
