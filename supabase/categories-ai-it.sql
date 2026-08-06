-- =============================================================
-- 분류 재구성 — AI·IT 도서 / 교육 교재 사이트에 맞게
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
--
-- 안전 장치:
--  * 기존 분류를 지우기 전에 도서를 새 분류로 먼저 옮깁니다.
--  * 도서가 아직 남아 있는 분류는 삭제하지 않습니다(외래키 오류 방지).
--  * 여러 번 실행해도 결과가 같습니다.
-- =============================================================

-- -------------------------------------------------------------
-- 1. 새 분류 추가 (같은 이름이 있으면 건너뜀)
-- -------------------------------------------------------------

insert into public.categories (name, sort_order)
select v.name, v.sort_order
from (values
  ('AI · 머신러닝',        1),
  ('개발 · 프로그래밍',     2),
  ('데이터 · 분석',        3),
  ('클라우드 · 보안',       4),
  ('교육 교재 · 실습',      5),
  ('IT 일반 · 디지털 전환',  6)
) as v(name, sort_order)
where not exists (
  select 1 from public.categories c where c.name = v.name
);

-- 이미 있던 이름이라면 순서만 맞춰 준다
update public.categories set sort_order = 1 where name = 'AI · 머신러닝';
update public.categories set sort_order = 2 where name = '개발 · 프로그래밍';
update public.categories set sort_order = 3 where name = '데이터 · 분석';
update public.categories set sort_order = 4 where name = '클라우드 · 보안';
update public.categories set sort_order = 5 where name = '교육 교재 · 실습';
update public.categories set sort_order = 6 where name = 'IT 일반 · 디지털 전환';

-- -------------------------------------------------------------
-- 2. 기존 도서를 새 분류로 옮긴다
--    아래는 기본 배치이며, 마음에 들지 않으면 /admin 이 아니라
--    각 도서의 '기본정보' 탭에서 분류를 바꾸면 됩니다.
-- -------------------------------------------------------------

-- 프로그래밍 → AI · 머신러닝 (기존 도서가 모두 AI 주제)
update public.books
set category_id = (select id from public.categories where name = 'AI · 머신러닝')
where category_id = (select id from public.categories where name = '프로그래밍');

-- 디자인 → 개발 · 프로그래밍
update public.books
set category_id = (select id from public.categories where name = '개발 · 프로그래밍')
where category_id = (select id from public.categories where name = '디자인');

-- 업무 매뉴얼 → 교육 교재 · 실습
update public.books
set category_id = (select id from public.categories where name = '교육 교재 · 실습')
where category_id = (select id from public.categories where name = '업무 매뉴얼');

-- 일반 → IT 일반 · 디지털 전환
update public.books
set category_id = (select id from public.categories where name = 'IT 일반 · 디지털 전환')
where category_id = (select id from public.categories where name = '일반');

-- 데이터 성격의 문서는 '데이터 · 분석'으로 따로 옮긴다
update public.books
set category_id = (select id from public.categories where name = '데이터 · 분석')
where title ilike '%공공데이터%';

-- -------------------------------------------------------------
-- 3. 비어 있는 옛 분류 정리
--    도서가 하나라도 남아 있으면 지우지 않는다.
-- -------------------------------------------------------------

delete from public.categories c
where c.name in ('프로그래밍', '디자인', '업무 매뉴얼', '일반')
  and not exists (select 1 from public.books b where b.category_id = c.id);

-- -------------------------------------------------------------
-- 4. 결과 확인
-- -------------------------------------------------------------

select c.sort_order, c.name, count(b.id) as 도서수
from public.categories c
left join public.books b on b.category_id = c.id
group by c.id, c.sort_order, c.name
order by c.sort_order;
