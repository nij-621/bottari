-- Bottari 006_bring.sql — 받아 올 것 (2026-11-22, v1.6)
-- 005 다음에 실행. 여러 번 실행해도 안전함.
-- 받아 올 것(bring): 어머님 반찬처럼 한국에서 받아서 들고 오는 것. 살 것 탭 맨 아래에 묶임.
-- ship_to = 어느 본가에서 받는지 (MK = 민경네, KM = 규문네). 상태: todo(받을 것) → got(챙김, 줄 그음).

alter table public.bt_items drop constraint if exists bt_items_kind_check;
alter table public.bt_items add constraint bt_items_kind_check check (kind in ('buy', 'cand', 'gift', 'ref', 'bring'));
