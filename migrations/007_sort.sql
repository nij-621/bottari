-- Bottari 007_sort.sql — 끌어서 순서 바꾸기 (2026-11-22, v1.8)
-- 006 다음에 실행. 여러 번 실행해도 안전함.
-- sort = 묶음 안 순서 (작을수록 위). 비어 있으면 적은 순서대로.

alter table public.bt_items add column if not exists sort double precision;

notify pgrst, 'reload schema';
