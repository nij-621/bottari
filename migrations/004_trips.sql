-- Bottari 004_trips.sql — 여행 단위 + 준비 체크리스트 (2026-11-22, v1.4)
-- 003 다음에 실행. 여러 번 실행해도 안전함.
-- 여행 = 이름 · 장소 · 날짜 · 같이 가는 사람 · (어느 여행 안에) · 준비 체크리스트.
-- 살 것·후보와는 장소로 이어짐 (여행 장소 = 항목 장소면 여행 화면에 개수가 보임).

create table if not exists public.bt_trips (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  place       text,                                   -- 한국 · 일본 · 후쿠오카 …
  start_date  date not null,
  end_date    date not null,
  people      text[] not null default '{}',           -- 'MK' · 'KM' · 그 밖의 이름
  parent_id   uuid references public.bt_trips(id),    -- 한국 휴가 안의 일본 여행
  note        text,
  created_by  text not null default public.bt_my_code() check (created_by in ('MK', 'KM')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  check (end_date >= start_date)
);

create table if not exists public.bt_checks (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.bt_trips(id),
  text        text not null check (length(trim(text)) > 0),
  done        boolean not null default false,
  done_by     text check (done_by in ('MK', 'KM')),
  done_at     timestamptz,
  sort        int not null default 100,
  created_by  text not null default public.bt_my_code() check (created_by in ('MK', 'KM')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists bt_checks_trip on public.bt_checks (trip_id) where deleted_at is null;

drop trigger if exists bt_trips_touch on public.bt_trips;
create trigger bt_trips_touch before update on public.bt_trips for each row execute function public.bt_touch();
drop trigger if exists bt_checks_touch on public.bt_checks;
create trigger bt_checks_touch before update on public.bt_checks for each row execute function public.bt_touch();

alter table public.bt_trips  enable row level security;
alter table public.bt_checks enable row level security;
do $$
declare t text;
begin
  foreach t in array array['bt_trips', 'bt_checks'] loop
    execute format('drop policy if exists %I_sel on public.%I', t, t);
    execute format('create policy %I_sel on public.%I for select to authenticated using (public.is_member())', t, t);
    execute format('drop policy if exists %I_ins on public.%I', t, t);
    execute format('create policy %I_ins on public.%I for insert to authenticated with check (public.is_member())', t, t);
    execute format('drop policy if exists %I_upd on public.%I', t, t);
    execute format('create policy %I_upd on public.%I for update to authenticated using (public.is_member()) with check (public.is_member())', t, t);
  end loop;
end $$;
grant select, insert, update on public.bt_trips, public.bt_checks to authenticated;
revoke all on public.bt_trips, public.bt_checks from anon;

do $$
declare t text;
begin
  foreach t in array array['bt_trips', 'bt_checks'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============================================================
-- 이번 겨울: 한국 12/18 – 1/6, 그 안에 일본 12/21 – 12/23 (같이 가는 사람은 앱에서 정함)
-- ============================================================
insert into public.bt_trips (id, name, place, start_date, end_date, people, parent_id, created_by) values
  ('b0000000-0000-4000-8000-000000000001', '겨울 한국', '한국', '2026-12-18', '2027-01-06', '{MK,KM}', null, 'MK'),
  ('b0000000-0000-4000-8000-000000000002', '일본',     '일본', '2026-12-21', '2026-12-23', '{}',      'b0000000-0000-4000-8000-000000000001', 'MK')
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from public.bt_checks where trip_id = 'b0000000-0000-4000-8000-000000000001') then
    insert into public.bt_checks (trip_id, text, sort, created_by) values
      ('b0000000-0000-4000-8000-000000000001', '항공권', 1, 'MK'),
      ('b0000000-0000-4000-8000-000000000001', '공항 가는 길', 2, 'MK'),
      ('b0000000-0000-4000-8000-000000000001', '한국 유심·로밍', 3, 'MK'),
      ('b0000000-0000-4000-8000-000000000001', '원화 현금', 4, 'MK'),
      ('b0000000-0000-4000-8000-000000000001', '선물 다 샀나', 5, 'MK'),
      ('b0000000-0000-4000-8000-000000000001', '집 비우기 (우편·화분·난방)', 6, 'MK'),
      ('b0000000-0000-4000-8000-000000000001', '짐 무게 확인 (갈 때·올 때)', 7, 'MK');
  end if;
  if not exists (select 1 from public.bt_checks where trip_id = 'b0000000-0000-4000-8000-000000000002') then
    insert into public.bt_checks (trip_id, text, sort, created_by) values
      ('b0000000-0000-4000-8000-000000000002', '항공권', 1, 'MK'),
      ('b0000000-0000-4000-8000-000000000002', '숙소', 2, 'MK'),
      ('b0000000-0000-4000-8000-000000000002', '엔화 환전', 3, 'MK'),
      ('b0000000-0000-4000-8000-000000000002', '비짓재팬 웹 등록', 4, 'MK'),
      ('b0000000-0000-4000-8000-000000000002', '포켓와이파이·eSIM', 5, 'MK'),
      ('b0000000-0000-4000-8000-000000000002', '여행자 보험', 6, 'MK'),
      ('b0000000-0000-4000-8000-000000000002', '공항 ↔ 시내 교통', 7, 'MK');
  end if;
end $$;
