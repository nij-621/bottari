-- Bottari 005_refs.sql — 참고 탭 (2026-11-22, v1.5)
-- 004 다음에 실행. 여러 번 실행해도 안전함.
-- 참고(ref): 할 일이 아니라 필요할 때 다시 여는 것 (텍스리펀 방법, 서울 인파레이더 …). 줄 안 그음, 계속 남김.
-- topic = 주제(자유 입력) — 참고 탭은 주제별로 묶음.

alter table public.bt_items drop constraint if exists bt_items_kind_check;
alter table public.bt_items add constraint bt_items_kind_check check (kind in ('buy', 'cand', 'gift', 'ref'));

alter table public.bt_items add column if not exists topic text;

-- 후보 미분류에 있던 인파레이더 링크 → 참고
update public.bt_items
set kind = 'ref', text = '서울 인파레이더', topic = '외출·교통', place = null, cat = null, status = 'todo'
where kind = 'cand' and link = 'http://gjdong.vercel.app/crowd' and deleted_at is null;
