-- =============================================================
-- 도서별 본문 형식 (HTML / 마크다운)
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- (schema.sql 실행 이후라면 언제든 실행 가능)
-- =============================================================

alter table public.books
  add column if not exists content_format text not null default 'html'
  check (content_format in ('html', 'markdown'));
