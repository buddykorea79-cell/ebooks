-- =============================================================
-- 관리자 기능 + 유형(book_types) 테이블화 + 추천 기능
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- (schema.sql, profiles.sql 실행 이후에 실행해야 합니다)
-- =============================================================

-- -------------------------------------------------------------
-- 1. 관리자 플래그 + 판별 함수
-- -------------------------------------------------------------

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- RLS 정책에서 재귀 없이 쓸 수 있도록 security definer 함수로 판별
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- 최초 관리자 지정 (이메일은 필요에 따라 수정하세요)
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'buddykorea79@gmail.com');

-- -------------------------------------------------------------
-- 2. 유형(book_types) 테이블화
--    기존에는 books.type이 'book'|'guide'|'manual' check 제약이었음
-- -------------------------------------------------------------

create table public.book_types (
  id text primary key,          -- 영문 슬러그 (예: book)
  name text not null,           -- 표시 이름 (예: 도서)
  sort_order int not null default 0
);

insert into public.book_types (id, name, sort_order) values
  ('book', '도서', 1),
  ('guide', '가이드', 2),
  ('manual', '매뉴얼', 3);

-- 기존 check 제약 제거 후 FK로 교체 (id 변경 시 books.type도 함께 갱신)
alter table public.books drop constraint if exists books_type_check;
alter table public.books
  add constraint books_type_fkey
  foreign key (type) references public.book_types(id)
  on update cascade on delete restrict;

alter table public.book_types enable row level security;

create policy "book_types_select_all"
  on public.book_types for select
  using (true);

create policy "book_types_admin_insert"
  on public.book_types for insert
  with check (public.is_admin());

create policy "book_types_admin_update"
  on public.book_types for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "book_types_admin_delete"
  on public.book_types for delete
  using (public.is_admin());

-- -------------------------------------------------------------
-- 3. 분류(categories) 관리자 쓰기 정책
--    (기존에는 select만 허용, SQL로 직접 관리했음)
-- -------------------------------------------------------------

create policy "categories_admin_insert"
  on public.categories for insert
  with check (public.is_admin());

create policy "categories_admin_update"
  on public.categories for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "categories_admin_delete"
  on public.categories for delete
  using (public.is_admin());

-- -------------------------------------------------------------
-- 4. 사이트 설정 (추천 기능 켜기/끄기)
-- -------------------------------------------------------------

create table public.site_settings (
  id int primary key default 1 check (id = 1),  -- 단일 행만 허용
  recommend_enabled boolean not null default true
);

insert into public.site_settings (id) values (1);

alter table public.site_settings enable row level security;

create policy "site_settings_select_all"
  on public.site_settings for select
  using (true);

create policy "site_settings_admin_update"
  on public.site_settings for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "site_settings_admin_insert"
  on public.site_settings for insert
  with check (public.is_admin());

-- -------------------------------------------------------------
-- 5. 도서 추천 (회원 1인당 도서별 1회)
-- -------------------------------------------------------------

create table public.book_recommendations (
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

create index book_recommendations_book_id_idx on public.book_recommendations(book_id);

alter table public.book_recommendations enable row level security;

-- 추천 수는 누구나 볼 수 있음
create policy "book_recommendations_select_all"
  on public.book_recommendations for select
  using (true);

-- 로그인한 회원이 본인 명의로만 추천/취소
create policy "book_recommendations_insert_own"
  on public.book_recommendations for insert to authenticated
  with check (user_id = auth.uid());

create policy "book_recommendations_delete_own"
  on public.book_recommendations for delete to authenticated
  using (user_id = auth.uid());
