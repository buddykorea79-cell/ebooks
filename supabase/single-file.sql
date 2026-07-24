-- =============================================================
-- 도서 구성 방식: 메뉴 구성(menu) / 단일 파일 업로드(single)
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- (schema.sql 실행 이후라면 언제든 실행 가능)
-- =============================================================

alter table public.books
  add column if not exists source_mode text not null default 'menu'
  check (source_mode in ('menu', 'single'));

-- 단일 파일 모드의 원문 (HTML 또는 마크다운 — content_format이 결정)
alter table public.books
  add column if not exists single_content text;
