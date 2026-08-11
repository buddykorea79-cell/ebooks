-- =============================================================
-- 사이트 설정 추가 — PDF 업로드 크기 제한 + EduTalk 주소
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- (admin.sql 실행 이후에 실행해야 합니다)
-- =============================================================

-- -------------------------------------------------------------
-- 1. 한 번에 올릴 수 있는 PDF 최대 크기 (MB)
--    관리자 화면에서 바꿀 수 있고, 서버가 이 값으로 업로드를 막는다.
-- -------------------------------------------------------------

alter table public.site_settings
  add column if not exists pdf_max_mb integer not null default 50;

-- 터무니없는 값이 들어가지 않게 (R2 자체 한도와 무관하게 운영 상한을 둔다)
alter table public.site_settings drop constraint if exists site_settings_pdf_max_mb_check;
alter table public.site_settings
  add constraint site_settings_pdf_max_mb_check
  check (pdf_max_mb between 1 and 500);

-- -------------------------------------------------------------
-- 2. EduTalk(교육생과 대화하기) 주소
--    EduTalk는 Socket.IO 상시 실행 서버라 이 사이트(Vercel)와 같이 배포할 수
--    없다. 별도로 배포한 주소를 여기에 넣으면 홈 화면에 버튼이 나타난다.
--    비어 있으면 버튼을 감춘다.
-- -------------------------------------------------------------

alter table public.site_settings
  add column if not exists edutalk_url text;

-- -------------------------------------------------------------
-- 3. 확인
-- -------------------------------------------------------------

select id, recommend_enabled, home_layout, pdf_max_mb, edutalk_url
from public.site_settings
where id = 1;
