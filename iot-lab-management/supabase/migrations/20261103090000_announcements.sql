-- ประกาศถึงนักศึกษา (หน้า admin/announce)
--   อัตโนมัติ: ของใหม่มาแล้ว (ทุกวัน 08:00) / ชวนมายืม (ทุกวันจันทร์ 08:00) — เปิด-ปิดที่ app_settings (ตั้งต้น = ปิด)
--   admin ส่งเอง: send_announcement (ทุกคน / คนที่ยืมค้าง / ทดสอบส่งหาตัวเอง)
-- ส่ง = แถวใน notifications (announcement_id ชี้กลับ) → กระดิ่ง + push ผ่าน trigger เดิม (notifications_push)
-- ผู้รับ = นักศึกษา (profiles.role = 'user') · for_staff ของ type ใหม่ = false อยู่แล้ว (อยู่ในกล่องของนักศึกษา)

-- 1) ประเภทแจ้งเตือนใหม่
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'borrow', 'return', 'request_borrow', 'request_return', 'request_renew', 'approved', 'declined', 'expired',
  'cancelled', 'auto_returned', 'renewed', 'due_soon', 'overdue', 'warranty_soon', 'warranty_expired',
  'age_warn', 'age_replace', 'role_changed', 'room_report', 'room_report_accepted', 'room_report_closed',
  'pickup_scheduled', 'pickup_declined', 'pickup_expired', 'pickup_cancelled', 'pickup_no_show',
  'announce_new_items', 'announce_invite', 'announce'
]));

-- 2) ประวัติการส่ง (อ่านได้เฉพาะ admin · เขียนผ่าน RPC เท่านั้น)
create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('new_items', 'invite', 'manual')),
  title       text not null,
  body        text not null,
  audience    text not null check (audience in ('all', 'borrowing', 'inactive', 'test')),
  sent_by     uuid references public.profiles (id) on delete set null,  -- null = ระบบส่งเอง
  recipients  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index announcements_created_idx on public.announcements (created_at desc);

alter table public.announcements enable row level security;
create policy "announcements: admin อ่านได้" on public.announcements
  for select to authenticated using (public.is_admin());

alter table public.notifications
  add column if not exists announcement_id uuid references public.announcements (id) on delete set null;
create index if not exists notifications_announcement_idx
  on public.notifications (announcement_id) where announcement_id is not null;

-- 3) สวิตช์อัตโนมัติ (policy เดิมของ app_settings: ล็อกอินอ่านได้ / admin แก้ได้) — ตั้งต้นปิด เปิดเองหลังทดสอบ
insert into public.app_settings (key, value) values
  ('announce_new_items', 'false'::jsonb),
  ('announce_invite', 'false'::jsonb)
on conflict (key) do nothing;

create or replace function public._announce_on(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select value = 'true'::jsonb from public.app_settings where key = p_key), false);
$$;

-- 4) ส่งจริง: บันทึกประวัติ + แจ้งเตือนทีละคน (ไม่มีผู้รับ = ไม่บันทึก)
create or replace function public._announce_send(
  p_kind text, p_title text, p_body text, p_audience text, p_sent_by uuid, p_users uuid[]
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_n  int;
begin
  if coalesce(cardinality(p_users), 0) = 0 then
    return 0;
  end if;
  insert into public.announcements (kind, title, body, audience, sent_by)
  values (p_kind, p_title, p_body, p_audience, p_sent_by)
  returning id into v_id;

  insert into public.notifications (user_id, type, title, body, announcement_id)
  select distinct u,
    case p_kind when 'new_items' then 'announce_new_items' when 'invite' then 'announce_invite' else 'announce' end,
    p_title, p_body, v_id
  from unnest(p_users) as u;
  get diagnostics v_n = row_count;

  update public.announcements set recipients = v_n where id = v_id;
  return v_n;
end;
$$;

-- 5) ของใหม่มาแล้ว: รุ่นที่ชิ้นแรกเข้าระบบหลังรอบก่อน (ไม่เกิน 1 วัน) และมีชิ้นว่างให้ยืม → ข้อความเดียวรวมทุกรุ่น
--    p_test_user = ส่งหาคนนี้คนเดียว (ไม่สนสวิตช์ · ย้อนดู 7 วัน · ไม่นับเป็นรอบจริง)
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
    select array_agg(id) into v_users from public.profiles where role = 'user';
  end if;

  return public._announce_send('new_items', format('มีของใหม่ %s รุ่น', v_total), v_body,
    case when p_test_user is null then 'all' else 'test' end, null, v_users);
end;
$$;

-- 6) ชวนมายืม: นศ. ที่ไม่ได้ยืมมา 30 วัน (รวมคนที่ไม่เคยยืม) และไม่มีของค้าง · คนเดียวกันไม่เกิน 1 ครั้ง/30 วัน
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
    where p.role = 'user'
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

-- 7) admin: ทดสอบประกาศอัตโนมัติ (ส่งหาตัวเองคนเดียว) — 0 = ตอนนี้ไม่มีอะไรให้ส่ง
create or replace function public.test_auto_announcement(p_kind text)
returns int
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบ';
  end if;
  if p_kind = 'new_items' then
    return public.send_new_items_announcement(auth.uid());
  elsif p_kind = 'invite' then
    return public.send_invite_announcement(auth.uid());
  end if;
  raise exception 'ไม่รู้จักประเภทประกาศ';
end;
$$;

-- 8) admin ส่งเอง: all = นศ. ทุกคน / borrowing = คนที่ยังยืมของค้าง / test = ตัวเอง
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
    select array_agg(id) into v_users from public.profiles where role = 'user';
  else
    select array_agg(distinct user_id) into v_users
    from public.borrow_records where status in ('borrowed', 'pending_return');
  end if;

  return public._announce_send('manual', v_title, v_body, p_audience, auth.uid(), v_users);
end;
$$;

-- 9) admin: จำนวนผู้รับของแต่ละกลุ่ม (ขึ้นบนตัวเลือก "ส่งถึง")
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
    (select count(*)::int from public.profiles where role = 'user'),
    (select count(distinct user_id)::int from public.borrow_records where status in ('borrowed', 'pending_return'));
end;
$$;

-- 10) admin: ประวัติการส่ง + ยอดอ่าน
create or replace function public.announcement_history(p_limit int default 30)
returns table (
  id uuid, kind text, title text, body text, audience text,
  sender text, recipients int, read_count int, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบ';
  end if;
  return query
  select a.id, a.kind, a.title, a.body, a.audience,
    coalesce(nullif(btrim(p.full_name), ''), p.email),
    a.recipients,
    (select count(*)::int from public.notifications n where n.announcement_id = a.id and n.read),
    a.created_at
  from public.announcements a
  left join public.profiles p on p.id = a.sent_by
  order by a.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;

revoke execute on function public._announce_on(text) from public, anon, authenticated;
revoke execute on function public._announce_send(text, text, text, text, uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.send_new_items_announcement(uuid) from public, anon, authenticated;
revoke execute on function public.send_invite_announcement(uuid) from public, anon, authenticated;
revoke execute on function public.test_auto_announcement(text) from public, anon;
revoke execute on function public.send_announcement(text, text, text) from public, anon;
revoke execute on function public.announcement_audience_counts() from public, anon;
revoke execute on function public.announcement_history(int) from public, anon;
grant execute on function public.test_auto_announcement(text) to authenticated;
grant execute on function public.send_announcement(text, text, text) to authenticated;
grant execute on function public.announcement_audience_counts() to authenticated;
grant execute on function public.announcement_history(int) to authenticated;

-- 11) ตั้งเวลา (ไทย = UTC+7): ของใหม่ทุกวัน 08:00 / ชวนมายืมวันจันทร์ 08:00
select cron.schedule('announce-new-items', '0 1 * * *', $$select public.send_new_items_announcement()$$);
select cron.schedule('announce-invite', '0 1 * * 1', $$select public.send_invite_announcement()$$);
