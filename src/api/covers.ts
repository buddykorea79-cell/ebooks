import { supabase } from '../lib/supabase'

const BUCKET = 'covers'
const MAX_SIZE_MB = 5

/** 표지 이미지를 Storage에 올리고 공개 URL을 반환. 경로 = {userId}/{bookId}-{timestamp}.{ext} */
export async function uploadCover(bookId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.')
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`이미지는 ${MAX_SIZE_MB}MB 이하만 업로드할 수 있습니다.`)
  }

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('로그인이 필요합니다.')

  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  // 타임스탬프를 붙여 교체 시 브라우저/CDN 캐시가 남지 않게 한다
  const path = `${userData.user.id}/${bookId}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** 공개 URL로 Storage 파일 삭제. 실패는 무시해도 되는 정리 작업이므로 조용히 넘어간다 */
export async function removeCoverByUrl(url: string): Promise<void> {
  const marker = `/object/public/${BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return
  const path = decodeURIComponent(url.slice(idx + marker.length))
  try {
    await supabase.storage.from(BUCKET).remove([path])
  } catch {
    // 고아 파일이 남을 뿐 동작에는 영향 없음
  }
}
