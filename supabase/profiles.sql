-- =============================================================
-- 닉네임용 profiles 테이블 + 가입 시 자동 생성 트리거
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- =============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 닉네임은 공개 정보 (홈에서 작성자 표시)
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

-- 본인 것만 수정 가능 (insert는 아래 트리거가 담당)
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 가입 시 auth 메타데이터의 nickname으로 프로필 자동 생성.
-- 닉네임이 없으면 이메일 @ 앞부분을 사용 (기존 가입자 대비)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 기존 가입자 백필 (닉네임 = 이메일 @ 앞부분)
insert into public.profiles (id, nickname)
select
  id,
  coalesce(nullif(trim(raw_user_meta_data ->> 'nickname'), ''), split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;
