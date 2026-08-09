-- =============================================================
-- 도서 구성 방식에 'pdf' 추가 — PDF 한 개를 그대로 도서로
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- (single-file.sql 실행 이후에 실행해야 합니다)
--
-- PDF 파일 자체는 Supabase가 아니라 Cloudflare R2에 올라갑니다.
-- (R2는 전송량이 무료라 반복 열람이 많은 교재에 유리)
-- 여기에는 그 공개 URL과 파일 정보만 저장합니다.
-- =============================================================

-- -------------------------------------------------------------
-- 1. source_mode 체크 제약에 'pdf' 허용
--    single-file.sql이 만든 익명 제약 이름은 books_source_mode_check
-- -------------------------------------------------------------

alter table public.books drop constraint if exists books_source_mode_check;

alter table public.books
  add constraint books_source_mode_check
  check (source_mode in ('menu', 'single', 'pdf'));

-- -------------------------------------------------------------
-- 2. PDF 정보 컬럼
-- -------------------------------------------------------------

-- R2 공개 URL (뷰어가 이 주소를 iframe으로 연다)
alter table public.books add column if not exists pdf_url text;
-- 원본 파일 이름 (다운로드 버튼 표시용)
alter table public.books add column if not exists pdf_name text;
-- 바이트 단위 크기 (편집 화면에 표시)
alter table public.books add column if not exists pdf_size bigint;

-- -------------------------------------------------------------
-- 3. 확인
-- -------------------------------------------------------------

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'books'
  and column_name in ('source_mode', 'pdf_url', 'pdf_name', 'pdf_size')
order by column_name;
