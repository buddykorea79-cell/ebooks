-- =============================================================
-- 그룹리더 프로젝트 게시판 (프로젝트 제출 및 취합)
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
-- (groups.sql 실행 이후에 실행해야 합니다)
--
-- 제출된 이미지/동영상/파일 본체는 Cloudflare R2에 저장되고,
-- 여기에는 그 공개 URL과 파일 정보만 저장합니다.
-- =============================================================

-- -------------------------------------------------------------
-- 1. 테이블
-- -------------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text,
  image_url text,
  video_url text,
  link_url text,
  link_title text,
  link_description text,
  link_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_post_files (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.project_posts(id) on delete cascade,
  url text not null,
  name text not null,
  size bigint,
  created_at timestamptz not null default now()
);

create index if not exists projects_group_id_idx on public.projects(group_id);
create index if not exists project_posts_project_id_idx on public.project_posts(project_id);
create index if not exists project_post_files_post_id_idx on public.project_post_files(post_id);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists project_posts_set_updated_at on public.project_posts;
create trigger project_posts_set_updated_at
  before update on public.project_posts
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- 2. RLS
-- -------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.project_posts enable row level security;
alter table public.project_post_files enable row level security;

-- projects: 해당 그룹의 리더이거나 그룹원이거나 관리자만 조회
drop policy if exists "projects_select" on public.projects;
create policy "projects_select"
  on public.projects for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.leader_id = auth.uid()
    )
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = projects.group_id and gm.user_id = auth.uid()
    )
  );

drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert"
  on public.projects for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.groups g
      where g.id = group_id and g.leader_id = auth.uid()
    )
  );

drop policy if exists "projects_update" on public.projects;
create policy "projects_update"
  on public.projects for update
  using (
    public.is_admin()
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.leader_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.leader_id = auth.uid()
    )
  );

drop policy if exists "projects_delete" on public.projects;
create policy "projects_delete"
  on public.projects for delete
  using (
    public.is_admin()
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.leader_id = auth.uid()
    )
  );

-- project_posts: 해당 그룹의 리더 또는 그룹원 모두 조회/작성 가능
drop policy if exists "project_posts_select" on public.project_posts;
create policy "project_posts_select"
  on public.project_posts for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.projects p
      join public.groups g on g.id = p.group_id
      where p.id = project_id and g.leader_id = auth.uid()
    )
    or exists (
      select 1 from public.projects p
      join public.group_members gm on gm.group_id = p.group_id
      where p.id = project_posts.project_id and gm.user_id = auth.uid()
    )
  );

drop policy if exists "project_posts_insert" on public.project_posts;
create policy "project_posts_insert"
  on public.project_posts for insert
  with check (
    author_id = auth.uid()
    and (
      exists (
        select 1 from public.projects p
        join public.groups g on g.id = p.group_id
        where p.id = project_id and g.leader_id = auth.uid()
      )
      or exists (
        select 1 from public.projects p
        join public.group_members gm on gm.group_id = p.group_id
        where p.id = project_id and gm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "project_posts_update" on public.project_posts;
create policy "project_posts_update"
  on public.project_posts for update
  using (
    author_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.projects p
      join public.groups g on g.id = p.group_id
      where p.id = project_id and g.leader_id = auth.uid()
    )
  )
  with check (
    author_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.projects p
      join public.groups g on g.id = p.group_id
      where p.id = project_id and g.leader_id = auth.uid()
    )
  );

drop policy if exists "project_posts_delete" on public.project_posts;
create policy "project_posts_delete"
  on public.project_posts for delete
  using (
    author_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.projects p
      join public.groups g on g.id = p.group_id
      where p.id = project_id and g.leader_id = auth.uid()
    )
  );

-- project_post_files: project_posts와 동일한 규칙 (post를 조인해서 확인)
drop policy if exists "project_post_files_select" on public.project_post_files;
create policy "project_post_files_select"
  on public.project_post_files for select
  using (
    exists (
      select 1 from public.project_posts pp
      where pp.id = post_id and (
        public.is_admin()
        or pp.author_id = auth.uid()
        or exists (
          select 1 from public.projects p
          join public.groups g on g.id = p.group_id
          where p.id = pp.project_id and g.leader_id = auth.uid()
        )
        or exists (
          select 1 from public.projects p
          join public.group_members gm on gm.group_id = p.group_id
          where p.id = pp.project_id and gm.user_id = auth.uid()
        )
      )
    )
  );

drop policy if exists "project_post_files_insert" on public.project_post_files;
create policy "project_post_files_insert"
  on public.project_post_files for insert
  with check (
    exists (
      select 1 from public.project_posts pp
      where pp.id = post_id and pp.author_id = auth.uid()
    )
  );

drop policy if exists "project_post_files_delete" on public.project_post_files;
create policy "project_post_files_delete"
  on public.project_post_files for delete
  using (
    exists (
      select 1 from public.project_posts pp
      where pp.id = post_id and (
        pp.author_id = auth.uid()
        or public.is_admin()
        or exists (
          select 1 from public.projects p
          join public.groups g on g.id = p.group_id
          where p.id = pp.project_id and g.leader_id = auth.uid()
        )
      )
    )
  );

-- -------------------------------------------------------------
-- 3. 확인
-- -------------------------------------------------------------

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('projects', 'project_posts', 'project_post_files')
order by table_name;
