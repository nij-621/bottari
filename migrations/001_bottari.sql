-- Bottari 001_bottari.sql
-- Pairfolio와 같은 Supabase 프로젝트(SQL Editor)에서 전체를 붙여넣고 Run.
-- household_members · is_member()는 Pairfolio 001_init.sql의 것을 그대로 씀.
-- 여러 번 실행해도 안전함 (if not exists / 첫 데이터는 테이블이 비어 있을 때만).

-- ============================================================
-- 1. 내 구성원 코드 (MK/KM) — 누가 적었는지 기본값
-- ============================================================
create or replace function public.bt_my_code()
returns text
language sql stable security definer
set search_path = public
as $$
  select member_code from public.household_members
  where lower(email) = lower(coalesce(auth.jwt()->>'email', ''));
$$;

-- ============================================================
-- 2. 항목: 살 것(buy) + 후보(cand)
-- ============================================================
create table if not exists public.bt_items (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('buy', 'cand')),
  text        text not null check (length(trim(text)) > 0),
  qty         int check (qty is null or qty > 0),
  note        text,
  link        text,
  place       text,                                   -- 후보: 서울·과천·일본… / 살 것: 한국·일본 (null = 미분류)
  cat         text check (cat is null or cat in ('할 것', '먹을 것', '예약', '사람', '해지', '부모님')),
  status      text not null default 'todo' check (status in ('todo', 'ord', 'got', 'done')),
                                                      -- 살 것: todo → ord(주문함) → got(받음) / 후보: todo → done(잡음·함)
  ordered_by  text check (ordered_by in ('MK', 'KM')),
  ship_to     text check (ship_to in ('MK', 'KM')),   -- 어느 본가로 (MK = 민경네, KM = 규문네)
  eta         text,                                   -- 도착 예정, 자유 형식 ("12/12", "블프")
  scheduled   text,                                   -- 후보: 잡은 날, 자유 형식 ("12/20")
  created_by  text not null default public.bt_my_code() check (created_by in ('MK', 'KM')),
  done_by     text check (done_by in ('MK', 'KM')),
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz                             -- 지우기 = 표시만 (Pairfolio처럼 DELETE 권한 없음)
);
create index if not exists bt_items_live on public.bt_items (kind, created_at) where deleted_at is null;

create or replace function public.bt_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists bt_items_touch on public.bt_items;
create trigger bt_items_touch before update on public.bt_items
  for each row execute function public.bt_touch();

-- ============================================================
-- 3. 설정 (다음 출발 등, 두 사람 공유)
-- ============================================================
create table if not exists public.bt_settings (
  key   text primary key,
  value jsonb not null
);

-- ============================================================
-- 4. RLS — 가족 구성원만, 물리 DELETE 불가
-- ============================================================
alter table public.bt_items    enable row level security;
alter table public.bt_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bt_items', 'bt_settings'] loop
    execute format('drop policy if exists %I_sel on public.%I', t, t);
    execute format('create policy %I_sel on public.%I for select to authenticated using (public.is_member())', t, t);
    execute format('drop policy if exists %I_ins on public.%I', t, t);
    execute format('create policy %I_ins on public.%I for insert to authenticated with check (public.is_member())', t, t);
    execute format('drop policy if exists %I_upd on public.%I', t, t);
    execute format('create policy %I_upd on public.%I for update to authenticated using (public.is_member()) with check (public.is_member())', t, t);
  end loop;
end $$;

grant select, insert, update on public.bt_items, public.bt_settings to authenticated;
grant execute on function public.bt_my_code() to authenticated;
revoke all on public.bt_items, public.bt_settings from anon;

-- ============================================================
-- 5. 실시간 — 상대가 적으면 바로 뜨게
-- ============================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bt_items') then
    alter publication supabase_realtime add table public.bt_items;
  end if;
end $$;

-- ============================================================
-- 6. 첫 데이터 — 민경 메모 "2026 12" (테이블이 비어 있을 때만)
-- ============================================================
insert into public.bt_settings (key, value) values
  ('trip', '{"name": "12월 한국", "date": "2026-12-18"}')
on conflict (key) do nothing;

do $$
begin
  if not exists (select 1 from public.bt_items) then
    insert into public.bt_items (kind, text, qty, note, link, place, cat, created_by, created_at) values
      ('cand', 'gjdong.vercel.app/crowd',  null, null, 'http://gjdong.vercel.app/crowd', null, null, 'MK', now() - interval '60 min'),
      ('cand', '과천 리프트',               null, null, null, '과천', '할 것', 'MK', now() - interval '59 min'),
      ('cand', '카리나 눈썹문신',            null, null, null, null,   '예약', 'MK', now() - interval '58 min'),
      ('cand', '잠실 피부과?',              null, null, null, '서울', '예약', 'MK', now() - interval '57 min'),
      ('cand', '수안보 유원제 온천호텔',      null, null, 'https://blog.naver.com/xxo_chive/224305196137', '충주', '할 것', 'MK', now() - interval '56 min'),
      ('cand', '국립중앙박물관',             null, null, null, '서울', '할 것', 'MK', now() - interval '55 min'),
      ('cand', '종찬 집들이',               null, null, null, null,   '사람', 'MK', now() - interval '54 min'),

      ('buy', '포켓와이파이',               null, '한국·일본', null, '한국', null, 'MK', now() - interval '50 min'),
      ('buy', '핸드폰케이스',               null, null, null, '한국', null, 'MK', now() - interval '49 min'),
      ('buy', '생리대',                    null, null, null, '한국', null, 'MK', now() - interval '48 min'),
      ('buy', '무화과 쇼콜라티, 바닐라 허니티', null, null, null, '한국', null, 'MK', now() - interval '47 min'),
      ('buy', '킬리안 플라워 오브 이모탈리티', null, '텍스리펀', null, '한국', null, 'MK', now() - interval '46 min'),
      ('buy', '돈모 브러시',                null, '코트용', null, '한국', null, 'MK', now() - interval '45 min'),
      ('buy', '사골곰탕',                  null, '꼭 고기 사진이 있어야 함, 식육', null, '한국', null, 'MK', now() - interval '44 min'),
      ('buy', '안온 레인보우 도트 누빔잠옷',   null, null, null, '한국', null, 'MK', now() - interval '43 min'),
      ('buy', '다다름소잉 밭 온열 안대',      null, null, null, '한국', null, 'MK', now() - interval '42 min'),
      ('buy', '양말',                      null, 'Doobalro', null, '한국', null, 'MK', now() - interval '41 min'),
      ('buy', '탄소매트 버니글로우',          null, null, null, '한국', null, 'MK', now() - interval '40 min'),
      ('buy', '보라앤드 행운거북이',          null, null, null, '한국', null, 'MK', now() - interval '39 min'),
      ('buy', '메디큐브 에이지알 부스터프로',  2,    null, null, '한국', null, 'MK', now() - interval '38 min'),
      ('buy', 'LG 프라엘 써마샷 얼티밋',      null, null, null, '한국', null, 'MK', now() - interval '37 min'),
      ('buy', '토리든 다이브인 저분자 세럼',   null, null, null, '한국', null, 'MK', now() - interval '36 min'),
      ('buy', '아워아워스 수제과자세트',       null, null, null, '한국', null, 'MK', now() - interval '35 min'),
      ('buy', '고매당 달토끼',              null, null, null, '한국', null, 'MK', now() - interval '34 min'),
      ('buy', '라뜰리에 토끼바람떡',          null, null, null, '한국', null, 'MK', now() - interval '33 min'),
      ('buy', '오르조 보리차',              null, null, null, '한국', null, 'MK', now() - interval '32 min'),
      ('buy', '데켓오발',                  null, null, null, '한국', null, 'MK', now() - interval '31 min'),
      ('buy', '버선',                      null, '집에서 신는', null, '한국', null, 'MK', now() - interval '30 min'),
      ('buy', '새미네부엌 백숙 삼계탕 육수',   null, null, null, '한국', null, 'MK', now() - interval '29 min'),
      ('buy', '베이글',                    null, null, null, '한국', null, 'MK', now() - interval '28 min'),
      ('buy', '라면기 그릇',                null, null, null, '한국', null, 'MK', now() - interval '27 min'),
      ('buy', '슬링백, 힐',                 null, null, null, '한국', null, 'MK', now() - interval '26 min'),
      ('buy', '청정원 짬뽕밥 양념',           null, null, null, '한국', null, 'MK', now() - interval '25 min'),
      ('buy', '딸기 크림치즈',              2,    null, null, '한국', null, 'MK', now() - interval '24 min'),
      ('buy', '샴푸',                      null, null, null, '한국', null, 'MK', now() - interval '23 min');
  end if;
end $$;
