-- =============================================================
-- 회원 관리: 최초 가입자 자동 관리자 + 관리자가 회원에게 권한 부여
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- (profiles.sql, admin.sql 실행 이후에 실행해야 합니다)
--
-- ※ 이 스크립트는 보안 취약점도 함께 막습니다. admin.sql이 profiles에
--   is_admin 컬럼을 추가했는데, profiles_update_own 정책은 '행 전체' 수정을
--   허용하므로 회원이 자기 행의 is_admin을 true로 바꿀 수 있었습니다.
--   아래 3번에서 컬럼 단위 권한으로 차단합니다.
-- =============================================================

-- -------------------------------------------------------------
-- 1. 최초 가입자를 자동으로 관리자로 지정 (가입 트리거 교체)
-- -------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname, is_admin)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
      split_part(new.email, '@', 1)
    ),
    -- 아직 회원이 한 명도 없으면 이 사람이 최초 가입자 → 관리자
    not exists (select 1 from public.profiles)
  );
  return new;
end;
$$;

-- -------------------------------------------------------------
-- 2. 기존 데이터 백필
--    관리자가 한 명도 없으면 가장 먼저 가입한 회원을 관리자로
-- -------------------------------------------------------------

update public.profiles
set is_admin = true
where id = (select id from public.profiles order by created_at asc, id asc limit 1)
  and not exists (select 1 from public.profiles where is_admin);

-- -------------------------------------------------------------
-- 3. 권한 상승 차단 (중요)
--    회원은 자기 '닉네임'만 수정할 수 있고 is_admin은 건드릴 수 없다.
--    RLS 정책은 행 단위라 컬럼 단위 GRANT로 제한한다.
-- -------------------------------------------------------------

revoke update on public.profiles from anon, authenticated;
grant update (nickname) on public.profiles to authenticated;

-- -------------------------------------------------------------
-- 4. 관리자 지정/해제 함수
--    security definer라 3번의 컬럼 제한을 우회하지만,
--    호출자가 관리자인지 함수 안에서 직접 확인한다.
-- -------------------------------------------------------------

create or replace function public.set_user_admin(target_id uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 회원 권한을 변경할 수 있습니다.';
  end if;

  if not exists (select 1 from public.profiles where id = target_id) then
    raise exception '대상 회원을 찾을 수 없습니다.';
  end if;

  -- 실수로 스스로 권한을 잃고 잠기는 것을 방지 (다른 관리자가 해제해 줄 수 있음)
  if not make_admin and target_id = auth.uid() then
    raise exception '자기 자신의 관리자 권한은 해제할 수 없습니다.';
  end if;

  update public.profiles set is_admin = make_admin where id = target_id;
end;
$$;

revoke execute on function public.set_user_admin(uuid, boolean) from public;
grant execute on function public.set_user_admin(uuid, boolean) to authenticated;
