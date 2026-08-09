-- =============================================================
-- 본문 이미지용 Storage 'content' 버킷 + 정책
-- Supabase SQL Editor에서 전체를 한 번에 실행하세요.
--
-- 표지(covers)와 버킷을 나눈 이유:
--  * 표지는 도서당 1장, 본문 이미지는 여러 장이라 수명 관리가 다르다
--  * 나중에 용량을 볼 때 표지/본문을 구분해서 볼 수 있다
-- =============================================================

-- 공개 버킷 생성 (이미 있으면 무시)
insert into storage.buckets (id, name, public)
values ('content', 'content', true)
on conflict (id) do nothing;

-- 누구나 조회 가능 (공개 도서 본문에 들어가는 이미지)
drop policy if exists "content_public_read" on storage.objects;
create policy "content_public_read" on storage.objects
  for select
  using (bucket_id = 'content');

-- 업로드/수정/삭제는 자기 폴더({user_id}/...)에만 가능
drop policy if exists "content_owner_insert" on storage.objects;
create policy "content_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'content'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "content_owner_update" on storage.objects;
create policy "content_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'content'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "content_owner_delete" on storage.objects;
create policy "content_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'content'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
