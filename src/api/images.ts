import { supabase } from '../lib/supabase'
import type { ContentFormat } from '../types/database'

/**
 * 본문에 넣을 이미지 업로드.
 * 표지(covers)와 버킷을 나눠 'content'에 넣는다 (supabase/content-images.sql).
 */

const BUCKET = 'content'
const MAX_SIZE_MB = 10

/**
 * 허용 형식. SVG는 제외한다 — 공개 버킷이라 URL을 직접 열면 스크립트가 실행될 수 있다.
 * (표지는 sanitizeSvg로 정제하지만 본문 이미지는 그 경로를 타지 않는다)
 */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

export function imageUploadErrorMessage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `${file.name}: PNG, JPG, GIF, WebP, AVIF 이미지만 올릴 수 있습니다.`
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `${file.name}: 이미지는 ${MAX_SIZE_MB}MB 이하만 올릴 수 있습니다.`
  }
  return null
}

/** Storage에 올리고 공개 URL 반환. 경로 = {userId}/{bookId}/{timestamp}-{rand}.{ext} */
export async function uploadContentImage(bookId: string, file: File): Promise<string> {
  const invalid = imageUploadErrorMessage(file)
  if (invalid) throw new Error(invalid)

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('로그인이 필요합니다.')

  const ext = EXT_BY_TYPE[file.type] ?? 'png'
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `${userData.user.id}/${bookId}/${Date.now()}-${rand}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type })
  if (error) {
    if (/bucket/i.test(error.message)) {
      throw new Error(
        '이미지 저장소가 준비되지 않았습니다. supabase/content-images.sql을 SQL Editor에서 실행하세요.',
      )
    }
    throw error
  }

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** 편집기에 삽입할 마크업. 폭은 넘치지 않게 제한한다 */
export function imageMarkup(url: string, alt: string, format: ContentFormat): string {
  const safeAlt = alt.replace(/"/g, '').replace(/[[\]]/g, '')
  return format === 'markdown'
    ? `![${safeAlt}](${url})`
    : `<img src="${url}" alt="${safeAlt}" style="max-width:100%;height:auto;">`
}
