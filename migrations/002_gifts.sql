-- Bottari 002_gifts.sql — 선물 탭 (2026-11-22)
-- 001_bottari.sql 다음에 실행. 여러 번 실행해도 안전함.
-- 선물(gift): 오스트리아에서 사서 한국에 들고 가는 것. 받는 사람(recipient)별로 묶음, 비우면 "나눠 줄 것".
-- 상태: todo(살 것) → got(샀음 · 캐리어) → done(줌). ordered_by = 산 사람, done_by = 준 표시를 한 사람.

alter table public.bt_items drop constraint if exists bt_items_kind_check;
alter table public.bt_items add constraint bt_items_kind_check check (kind in ('buy', 'cand', 'gift'));

alter table public.bt_items add column if not exists recipient text;
