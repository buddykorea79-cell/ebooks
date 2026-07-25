-- =============================================================
-- 홈 화면 도서 목록 구성 방식 (최신순 / 추천순 / 추천+최신 2단)
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- (admin.sql 실행 이후에 실행해야 합니다 — site_settings 테이블 필요)
-- =============================================================

alter table public.site_settings
  add column if not exists home_layout text not null default 'latest'
  check (home_layout in ('latest', 'recommended', 'both'));

-- 추천 도서 섹션에 표시할 개수 (both 레이아웃에서 사용)
alter table public.site_settings
  add column if not exists home_featured_count int not null default 8
  check (home_featured_count between 1 and 24);
