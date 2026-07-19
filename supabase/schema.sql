-- =============================================================
-- 도서·가이드·매뉴얼 등록 플랫폼 스키마
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- =============================================================

-- -------------------------------------------------------------
-- 1. 테이블
-- -------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id),
  owner_id uuid not null references auth.users(id) default auth.uid(),
  type text not null check (type in ('book', 'guide', 'manual')),
  title text not null,
  description text,
  cover_url text,
  custom_css text,
  css_apply_to_content boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.book_menus (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  parent_id uuid references public.book_menus(id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  html_content text,
  updated_at timestamptz not null default now()
);

create index book_menus_book_id_idx on public.book_menus(book_id);
create index books_category_id_idx on public.books(category_id);
create index books_owner_id_idx on public.books(owner_id);

-- -------------------------------------------------------------
-- 2. updated_at 자동 갱신 트리거
-- -------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

create trigger book_menus_set_updated_at
  before update on public.book_menus
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 3. RLS(Row Level Security)
-- -------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.books enable row level security;
alter table public.book_menus enable row level security;

-- categories: 누구나 조회 가능, 쓰기 정책 없음(관리자가 SQL로 직접 관리)
create policy "categories_select_all"
  on public.categories for select
  using (true);

-- books: 공개된 것 또는 내 것만 조회
create policy "books_select"
  on public.books for select
  using (is_published or owner_id = auth.uid());

create policy "books_insert"
  on public.books for insert
  with check (owner_id = auth.uid());

create policy "books_update"
  on public.books for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "books_delete"
  on public.books for delete
  using (owner_id = auth.uid());

-- book_menus: 소속 도서의 규칙을 그대로 따름
create policy "book_menus_select"
  on public.book_menus for select
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id
        and (b.is_published or b.owner_id = auth.uid())
    )
  );

create policy "book_menus_insert"
  on public.book_menus for insert
  with check (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.owner_id = auth.uid()
    )
  );

create policy "book_menus_update"
  on public.book_menus for update
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.owner_id = auth.uid()
    )
  );

create policy "book_menus_delete"
  on public.book_menus for delete
  using (
    exists (
      select 1 from public.books b
      where b.id = book_id and b.owner_id = auth.uid()
    )
  );

-- -------------------------------------------------------------
-- 4. 초기 분류 seed (이름은 원하는 대로 수정하세요)
-- -------------------------------------------------------------

insert into public.categories (name, sort_order) values
  ('프로그래밍', 1),
  ('디자인', 2),
  ('업무 매뉴얼', 3),
  ('일반', 4);
