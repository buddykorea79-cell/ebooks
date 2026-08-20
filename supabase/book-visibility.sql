-- =============================================================
-- 도서 공개 범위: 공개 / 비공개 / 그룹공개
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- (schema.sql, groups.sql 실행 이후에 실행해야 합니다)
-- =============================================================

-- -------------------------------------------------------------
-- 1. 컬럼 추가
-- -------------------------------------------------------------

alter table public.books
  add column if not exists visibility text not null default 'private'
  check (visibility in ('public', 'private', 'group'));

alter table public.books
  add column if not exists group_id uuid references public.groups(id) on delete set null;

-- -------------------------------------------------------------
-- 2. 백필 — 기존 is_published 값을 그대로 반영
-- -------------------------------------------------------------

update public.books set visibility = case when is_published then 'public' else 'private' end;

-- -------------------------------------------------------------
-- 3. is_published ↔ visibility 동기화 트리거
--    기존의 is_published 기반 코드(검색, 배지 등)가 계속 정확하게
--    동작하도록, visibility가 바뀔 때마다 is_published를 함께 맞춘다.
-- -------------------------------------------------------------

create or replace function public.sync_book_published()
returns trigger
language plpgsql
as $$
begin
  new.is_published := (new.visibility = 'public');
  return new;
end;
$$;

drop trigger if exists books_sync_published on public.books;
create trigger books_sync_published
  before insert or update of visibility on public.books
  for each row execute function public.sync_book_published();

-- -------------------------------------------------------------
-- 4. 열람 가능 여부 판별 함수
-- -------------------------------------------------------------

create or replace function public.can_view_book(target_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.books b
    where b.id = target_id
      and (
        b.visibility = 'public'
        or b.owner_id = auth.uid()
        or public.is_admin()
        or (
          b.visibility = 'group'
          and b.group_id is not null
          and exists (
            select 1 from public.group_members gm
            where gm.group_id = b.group_id and gm.user_id = auth.uid()
          )
        )
      )
  );
$$;

-- -------------------------------------------------------------
-- 5. RLS 정책 교체
-- -------------------------------------------------------------

drop policy if exists "books_select" on public.books;
create policy "books_select"
  on public.books for select
  using (public.can_view_book(id));

drop policy if exists "book_menus_select" on public.book_menus;
create policy "book_menus_select"
  on public.book_menus for select
  using (public.can_view_book(book_id));

-- -------------------------------------------------------------
-- 6. 확인
-- -------------------------------------------------------------

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'books'
  and column_name in ('visibility', 'group_id')
order by column_name;
