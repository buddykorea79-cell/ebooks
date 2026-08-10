import type { ContentFormat } from '../types/database'
import { uploadToR2 } from './r2'

/**
 * 본문에 넣을 이미지 업로드.
 * PDF와 같은 Cloudflare R2 버킷을 쓴다(서버에서 kind로 폴더를 나눈다).
 * 파일 이름 중복은 서버가 키에 UUID를 붙여 막는다.
 */

const MAX_SIZE_MB = 10

/**
 * 허용 형식. SVG는 제외한다 — 공개 버킷이라 URL을 직접 열면 스크립트가 실행될 수 있다.
 * (서버도 같은 목록으로 한 번 더 막는다)
 */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']

/** 올리기 전에 브라우저에서 걸러 낸다. 문제가 없으면 null */
export function imageUploadErrorMessage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `${file.name}: PNG, JPG, GIF, WebP, AVIF 이미지만 올릴 수 있습니다.`
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `${file.name}: 이미지는 ${MAX_SIZE_MB}MB 이하만 올릴 수 있습니다.`
  }
  return null
}

/** R2에 올리고 공개 URL 반환 */
export async function uploadContentImage(bookId: string, file: File): Promise<string> {
  const invalid = imageUploadErrorMessage(file)
  if (invalid) throw new Error(invalid)

  const result = await uploadToR2('image', bookId, file)
  return result.url
}

/** 편집기에 삽입할 마크업. 폭은 넘치지 않게 제한한다 */
export function imageMarkup(url: string, alt: string, format: ContentFormat): string {
  const safeAlt = alt.replace(/"/g, '').replace(/[[\]]/g, '')
  return format === 'markdown'
    ? `![${safeAlt}](${url})`
    : `<img src="${url}" alt="${safeAlt}" style="max-width:100%;height:auto;">`
}
