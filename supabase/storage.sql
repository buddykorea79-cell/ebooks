-- =============================================================
-- 표지 이미지용 Storage 'covers' 버킷 + 정책
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요. (schema.sql과 별개)
-- =============================================================

-- 공개 버킷 생성 (이미 있으면 무시)
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

-- 누구나 표지 조회 가능
create policy "covers_public_read" on storage.objects
  for select
  using (bucket_id = 'covers');

-- 업로드/수정/삭제는 자기 폴더({user_id}/...)에만 가능
create policy "covers_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "covers_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "covers_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
