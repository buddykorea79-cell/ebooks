-- =============================================================
-- AI 작성 도우미 (BizRouter 연동)
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- (profiles.sql, admin.sql, admin-members.sql 실행 이후에 실행해야 합니다)
--
-- 관리자가 회원별로 AI 기능 사용 여부를 지정하고, 실제 호출은 서버
-- 프록시(api/ai.ts)가 profiles.ai_enabled를 확인한 뒤에만 수행합니다.
-- =============================================================

-- -------------------------------------------------------------
-- 1. 회원별 AI 사용 허용 플래그
--    기본값 false — 관리자가 명시적으로 켜 준 회원만 사용할 수 있다.
-- -------------------------------------------------------------

alter table public.profiles
  add column if not exists ai_enabled boolean not null default false;

-- -------------------------------------------------------------
-- 2. 권한 상승 차단 (admin-members.sql과 동일, 재실행해도 안전)
--    회원은 자기 '닉네임'만 수정할 수 있어야 한다. 이 GRANT가 없으면
--    회원이 자기 행의 ai_enabled를 직접 true로 바꿀 수 있다.
-- -------------------------------------------------------------

revoke update on public.profiles from anon, authenticated;
grant update (nickname) on public.profiles to authenticated;

-- -------------------------------------------------------------
-- 3. AI 사용 허용/차단 함수
--    security definer라 2번의 컬럼 제한을 우회하지만,
--    호출자가 관리자인지 함수 안에서 직접 확인한다.
-- -------------------------------------------------------------

create or replace function public.set_user_ai_enabled(target_id uuid, enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 AI 기능 사용 권한을 변경할 수 있습니다.';
  end if;

  if not exists (select 1 from public.profiles where id = target_id) then
    raise exception '대상 회원을 찾을 수 없습니다.';
  end if;

  update public.profiles set ai_enabled = enabled where id = target_id;
end;
$$;

revoke execute on function public.set_user_ai_enabled(uuid, boolean) from public;
grant execute on function public.set_user_ai_enabled(uuid, boolean) to authenticated;

-- -------------------------------------------------------------
-- 4. 사용량 로그
--    BizRouter가 응답 usage.cost로 요청별 원화 비용을 알려주므로
--    그대로 적재해 둔다. 관리자가 누가 얼마나 썼는지 확인하는 용도.
-- -------------------------------------------------------------

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  action text not null,
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  -- BizRouter usage.cost (KRW). 제공되지 않으면 0
  cost numeric(12, 4) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_id_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

-- 기록은 본인 것만 남길 수 있다 (서버 프록시가 사용자 토큰으로 insert)
drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_insert_own"
  on public.ai_usage for insert
  with check (auth.uid() = user_id);

-- 조회는 본인 것 + 관리자는 전체
drop policy if exists "ai_usage_select_own_or_admin" on public.ai_usage;
create policy "ai_usage_select_own_or_admin"
  on public.ai_usage for select
  using (auth.uid() = user_id or public.is_admin());

-- -------------------------------------------------------------
-- 5. 회원별 사용량 요약 뷰
--    security_invoker = true 라서 위 select 정책이 그대로 적용된다.
--    (관리자는 전체, 일반 회원은 자기 행만 보인다)
-- -------------------------------------------------------------

drop view if exists public.ai_usage_summary;
create view public.ai_usage_summary with (security_invoker = true) as
select
  user_id,
  count(*)::integer                     as request_count,
  coalesce(sum(cost), 0)::numeric       as total_cost,
  max(created_at)                       as last_used_at
from public.ai_usage
group by user_id;

grant select on public.ai_usage_summary to authenticated;
