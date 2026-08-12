-- =============================================================
-- EduTalk 강사 프로필 테이블
-- LibroSpace와 같은 Supabase 프로젝트의 SQL Editor에서 실행하세요.
--
-- 계정(auth.users)은 LibroSpace와 공용이고, 이 테이블은 "그 계정이 EduTalk
-- 강사로 승인됐는지"만 관리합니다. EduTalk 서버가 service role key로 접근합니다.
-- =============================================================

create table if not exists public.instructor_profiles (
  user_id     uuid    primary key,
  email       text    unique not null,
  name        text    not null,
  status      text    not null default 'pending',
  created_at  bigint  not null,
  approved_at bigint
);

-- 상태값 제한 (이미 만들어 둔 테이블에도 적용된다)
alter table public.instructor_profiles
  drop constraint if exists instructor_profiles_status_check;
alter table public.instructor_profiles
  add constraint instructor_profiles_status_check
  check (status in ('pending', 'approved', 'rejected'));

-- -------------------------------------------------------------
-- RLS — 반드시 켜야 합니다.
--
-- ⚠️ Supabase는 public 스키마의 테이블을 anon/authenticated 롤에 그대로
--    노출합니다. RLS가 꺼져 있으면 anon key(브라우저에 공개되는 값)를 아는
--    누구나 자기 status를 'approved'로 바꿔 관리자 승인 절차를 건너뛸 수
--    있습니다.
--
-- EduTalk 서버는 service role key로 접근해 RLS를 우회하므로,
-- 아래처럼 "본인 행 읽기"만 열어 두어도 서버 동작에는 영향이 없습니다.
-- -------------------------------------------------------------

alter table public.instructor_profiles enable row level security;

drop policy if exists "instructor_profiles_select_own" on public.instructor_profiles;
create policy "instructor_profiles_select_own"
  on public.instructor_profiles for select to authenticated
  using (user_id = auth.uid());

-- (insert/update/delete 정책 없음 = 브라우저에서는 쓰기 불가.
--  등록·승인·삭제는 EduTalk 서버만 할 수 있습니다)

-- -------------------------------------------------------------
-- 확인
-- -------------------------------------------------------------

select user_id, email, name, status,
       to_timestamp(created_at / 1000) as created,
       to_timestamp(approved_at / 1000) as approved
from public.instructor_profiles
order by created_at;
