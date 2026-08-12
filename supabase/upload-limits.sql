-- =============================================================
-- 업로드 크기 제한 일원화 — HTML · MD · PDF 를 하나의 설정으로 관리
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- (site-settings-extra.sql 실행 이후에 실행해야 합니다)
--
-- 이전에는 PDF만 site_settings.pdf_max_mb로 제한하고 HTML·MD는 코드에
-- 5MB가 박혀 있었습니다. 이제 세 형식 모두 upload_max_mb 하나를 따릅니다.
-- =============================================================

-- -------------------------------------------------------------
-- 1. 통합 업로드 상한 (MB) — 기본 50
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
-- 2. HTML·MD 본문에도 같은 상한을 강제
--
--    PDF는 서명 URL을 발급하는 서버(api/r2-upload-url.ts)가 크기를 다시
--    확인하지만, HTML·MD는 브라우저가 books.single_content에 바로 쓴다.
--    화면 검사만으로는 우회할 수 있으므로 DB에서 최종 판단한다.
-- -------------------------------------------------------------

create or replace function public.enforce_single_content_size()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  limit_mb   integer;
  size_bytes integer;
begin
  if new.single_content is null then
    return new;
  end if;

  -- 내용이 그대로면 검사하지 않는다.
  -- (상한을 낮춘 뒤 기존 도서의 제목만 고치는 것까지 막지 않기 위함)
  if tg_op = 'UPDATE' and new.single_content is not distinct from old.single_content then
    return new;
  end if;

  select s.upload_max_mb into limit_mb from public.site_settings s where s.id = 1;
  if limit_mb is null then
    limit_mb := 50;
  end if;

  size_bytes := octet_length(new.single_content);
  if size_bytes > limit_mb * 1024 * 1024 then
    raise exception
      '업로드 한도를 초과했습니다 (% MB / 최대 % MB)',
      round(size_bytes / 1048576.0, 1), limit_mb
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists books_single_content_size on public.books;
create trigger books_single_content_size
  before insert or update on public.books
  for each row execute function public.enforce_single_content_size();

-- -------------------------------------------------------------
-- 3. 확인
--    (컬럼 구성은 앞선 마이그레이션 실행 여부에 따라 다르므로 전체를 본다)
-- -------------------------------------------------------------

select * from public.site_settings where id = 1;
