-- =============================================================
-- 업로드 일원화 — HTML · MD · PDF 를 모두 Cloudflare R2 로, 한도도 하나로
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- (site-settings-extra.sql 실행 이후에 실행해야 합니다)
--
-- 바뀌는 점
--   1) 업로드 상한을 site_settings.upload_max_mb 하나로 통합 (기본 50MB)
--   2) 단일 파일(HTML·MD)도 PDF처럼 R2에 올리고, DB에는 주소만 저장
--      (예전에는 파일 내용을 books.single_content 텍스트로 넣었습니다)
-- =============================================================

-- -------------------------------------------------------------
-- 1. 통합 업로드 상한 (MB) — HTML · MD · PDF 공통, 기본 50
-- -------------------------------------------------------------

alter table public.site_settings
  add column if not exists upload_max_mb integer not null default 50;

-- 이미 pdf_max_mb를 조정해 두었다면 그 값을 그대로 이어받는다
-- (컬럼이 없을 수도 있으므로 동적 실행)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'site_settings'
      and column_name = 'pdf_max_mb'
  ) then
    execute 'update public.site_settings
             set upload_max_mb = pdf_max_mb
             where pdf_max_mb is not null and upload_max_mb = 50';
  end if;
end $$;

-- 터무니없는 값이 들어가지 않게 (운영 상한)
alter table public.site_settings drop constraint if exists site_settings_upload_max_mb_check;
alter table public.site_settings
  add constraint site_settings_upload_max_mb_check
  check (upload_max_mb between 1 and 500);

-- -------------------------------------------------------------
-- 2. 단일 파일(HTML·MD)의 R2 주소
--
--    PDF의 pdf_url / pdf_name / pdf_size 와 같은 구조다.
--    파일 본체는 Cloudflare R2에 있고 DB에는 주소·이름·크기만 둔다.
-- -------------------------------------------------------------

alter table public.books add column if not exists single_url  text;
alter table public.books add column if not exists single_name text;
alter table public.books add column if not exists single_size bigint;

-- books.single_content 는 지우지 않는다.
-- 예전에 텍스트로 올려 둔 도서가 그대로 열리도록 뷰어가 예비로 읽는다.
-- (새로 올리는 파일은 R2로 가고 single_content 는 비워진다)

-- -------------------------------------------------------------
-- 3. 이전 버전에서 만들었던 크기 검사 트리거 제거
--
--    단일 파일이 DB에 저장되던 시절의 장치다. 이제 파일은 R2로 가고
--    크기는 서명 URL을 발급하는 서버(api/r2-upload-url.ts)가 확인한다.
--    (이 스크립트의 이전 버전을 실행하지 않았다면 아무 일도 일어나지 않는다)
-- -------------------------------------------------------------

drop trigger if exists books_single_content_size on public.books;
drop function if exists public.enforce_single_content_size();

-- -------------------------------------------------------------
-- 4. 확인
--    (컬럼 구성은 앞선 마이그레이션 실행 여부에 따라 다르므로 전체를 본다)
-- -------------------------------------------------------------

select * from public.site_settings where id = 1;
