import { supabase } from '../lib/supabase'

const BUCKET = 'covers'
const MAX_SIZE_MB = 5

/** Storage에 올리고 공개 URL 반환. 경로 = {userId}/{bookId}-{timestamp}.{ext} */
async function uploadToBucket(bookId: string, body: Blob, ext: string): Promise<string> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('로그인이 필요합니다.')

  // 타임스탬프를 붙여 교체 시 브라우저/CDN 캐시가 남지 않게 한다
  const path = `${userData.user.id}/${bookId}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { cacheControl: '3600', upsert: false, contentType: body.type })
  if (error) throw error

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/** 표지 이미지 파일을 Storage에 올리고 공개 URL을 반환 */
export async function uploadCover(bookId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.')
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`이미지는 ${MAX_SIZE_MB}MB 이하만 업로드할 수 있습니다.`)
  }

  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  return uploadToBucket(bookId, file, ext)
}

// ---------------------------------------------------------------
// SVG 코드 직접 입력
// ---------------------------------------------------------------

/** 통째로 제거할 요소 — 스크립트 실행이나 HTML 삽입 통로 */
const FORBIDDEN_ELEMENTS = new Set(['script', 'foreignobject', 'iframe', 'embed', 'object'])

function isSafeLink(value: string): boolean {
  const v = value.trim().toLowerCase()
  // 문서 내부 참조(#id)와 인라인 이미지만 허용
  return v.startsWith('#') || v.startsWith('data:image/')
}

/**
 * 붙여넣은 SVG 코드를 검증·정제한다.
 *
 * 표지는 <img>로만 렌더링해서 스크립트가 실행되지 않지만, Storage 공개 URL을
 * 브라우저에서 직접 열면 실행될 수 있으므로 업로드 전에 위험 요소를 제거한다.
 */
export function sanitizeSvg(code: string): string {
  const doc = new DOMParser().parseFromString(code, 'image/svg+xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('SVG 코드를 해석할 수 없습니다. 태그가 올바르게 닫혔는지 확인하세요.')
  }
  const root = doc.documentElement
  if (!root || root.localName.toLowerCase() !== 'svg') {
    throw new Error('<svg> 태그로 시작하는 코드를 붙여넣으세요.')
  }

  for (const el of Array.from(doc.querySelectorAll('*'))) {
    if (FORBIDDEN_ELEMENTS.has(el.localName.toLowerCase())) {
      el.remove()
      continue
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value
      // onload 등 이벤트 핸들러
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name)
        continue
      }
      // javascript: 및 외부 리소스 참조
      if ((name === 'href' || name.endsWith(':href') || name === 'src') && !isSafeLink(value)) {
        el.removeAttribute(attr.name)
        continue
      }
      if (value.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attr.name)
      }
    }
  }

  if (!root.getAttribute('xmlns')) {
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  }
  return new XMLSerializer().serializeToString(root)
}

/** 정제한 SVG를 미리보기용 data URI로 변환 */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** SVG 코드를 .svg 파일로 Storage에 올리고 공개 URL을 반환 */
export async function uploadCoverSvg(bookId: string, code: string): Promise<string> {
  const clean = sanitizeSvg(code)
  const blob = new Blob([clean], { type: 'image/svg+xml' })
  if (blob.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`SVG 코드는 ${MAX_SIZE_MB}MB 이하만 사용할 수 있습니다.`)
  }
  return uploadToBucket(bookId, blob, 'svg')
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
