-- =============================================================
-- 그룹 관리: 그룹리더 권한 + 그룹 + 그룹원
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- (profiles.sql, admin.sql, admin-members.sql 실행 이후에 실행해야 합니다)
-- =============================================================

-- -------------------------------------------------------------
-- 1. 그룹리더 플래그 + 판별 함수 (is_admin()과 동일한 형태)
-- -------------------------------------------------------------

alter table public.profiles
  add column if not exists is_group_leader boolean not null default false;

create or replace function public.is_group_leader()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_group_leader from public.profiles where id = auth.uid()),
    false
  );
$$;

-- -------------------------------------------------------------
-- 2. 그룹리더 지정/해제 함수 (set_user_admin()과 동일한 형태)
--    관리자만 호출 가능 — 함수 내부에서 직접 확인한다.
-- -------------------------------------------------------------

create or replace function public.set_user_group_leader(target_id uuid, make_leader boolean)
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

  update public.profiles set is_group_leader = make_leader where id = target_id;
end;
$$;

revoke execute on function public.set_user_group_leader(uuid, boolean) from public;
grant execute on function public.set_user_group_leader(uuid, boolean) to authenticated;

-- -------------------------------------------------------------
-- 3. 테이블
-- -------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  leader_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index groups_leader_id_idx on public.groups(leader_id);
create index group_members_group_id_idx on public.group_members(group_id);
create index group_members_user_id_idx on public.group_members(user_id);

-- -------------------------------------------------------------
-- 4. 본인 그룹 소속을 통째로 교체하는 함수
--    회원가입 직후(트리거) 및 '내 정보 수정' 화면에서 함께 쓴다.
--    최대 3개, 존재하는 그룹만 인정한다.
-- -------------------------------------------------------------

create or replace function public.set_my_groups(group_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  valid_ids uuid[];
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select coalesce(array_agg(g.id), '{}')
  into valid_ids
  from public.groups g
  where g.id = any(group_ids);

  if array_length(valid_ids, 1) > 3 then
    raise exception '그룹은 최대 3개까지 선택할 수 있습니다.';
  end if;

  delete from public.group_members where user_id = auth.uid();

  if valid_ids is not null and array_length(valid_ids, 1) > 0 then
    insert into public.group_members (group_id, user_id)
    select id, auth.uid() from unnest(valid_ids) as id;
  end if;
end;
$$;

revoke execute on function public.set_my_groups(uuid[]) from public;
grant execute on function public.set_my_groups(uuid[]) to authenticated;

-- -------------------------------------------------------------
-- 5. 가입 트리거 교체 — 메타데이터의 group_ids(최대 3개)를
--    프로필 생성 직후 함께 반영한다.
--    이메일 인증이 켜져 있어도 이 트리거는 auth.users insert 시점에
--    항상 실행되므로, 세션이 없는 가입 단계에서도 그룹이 반영된다.
-- -------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_ids uuid[];
  valid_ids uuid[];
begin
  insert into public.profiles (id, nickname, is_admin)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
      split_part(new.email, '@', 1)
    ),
    not exists (select 1 from public.profiles)
  );

  begin
    select coalesce(array_agg((value)::uuid), '{}')
    into requested_ids
    from jsonb_array_elements_text(coalesce(new.raw_user_meta_data -> 'group_ids', '[]'::jsonb)) as value;
  exception when others then
    requested_ids := '{}';
  end;

  if array_length(requested_ids, 1) > 0 then
    select coalesce(array_agg(g.id), '{}')
    into valid_ids
    from public.groups g
    where g.id = any(requested_ids)
    limit 3;

    if array_length(valid_ids, 1) > 0 then
      insert into public.group_members (group_id, user_id)
      select id, new.id from unnest(valid_ids[1:3]) as id
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

-- -------------------------------------------------------------
-- 6. RLS
-- -------------------------------------------------------------

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- groups: 누구나 조회 가능 (회원가입 화면에서 목록을 보여줘야 함)
create policy "groups_select_all"
  on public.groups for select
  using (true);

create policy "groups_insert"
  on public.groups for insert
  with check (leader_id = auth.uid() and public.is_group_leader());

create policy "groups_update"
  on public.groups for update
  using (leader_id = auth.uid() or public.is_admin())
  with check (leader_id = auth.uid() or public.is_admin());

create policy "groups_delete"
  on public.groups for delete
  using (leader_id = auth.uid() or public.is_admin());

-- group_members: 본인 행 또는 해당 그룹의 리더 또는 관리자만 조회
create policy "group_members_select"
  on public.group_members for select
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.leader_id = auth.uid()
    )
  );

-- insert는 트리거(security definer)와 set_my_groups() 함수를 통해서만 이뤄진다.
-- 클라이언트가 직접 insert하지 못하도록 정책을 두지 않는다.

create policy "group_members_delete"
  on public.group_members for delete
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.leader_id = auth.uid()
    )
  );
