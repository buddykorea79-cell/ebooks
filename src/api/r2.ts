import { supabase } from '../lib/supabase'

/**
 * Cloudflare R2 업로드 공용 경로.
 *
 * 서버(api/r2-upload-url.ts)는 서명 URL만 만들어 주고, 파일은 브라우저에서
 * R2로 직접 간다. Vercel 서버리스 함수는 요청 본문이 4.5MB로 제한돼 있어
 * 큰 파일을 통과시킬 수 없기 때문이다.
 */

export type UploadKind = 'pdf' | 'single' | 'image' | 'project'

interface SignedUpload {
  uploadUrl: string
  publicUrl: string
  key: string
  /** R2에 저장할 Content-Type (서버가 정해 준다) */
  contentType?: string
  error?: string
}

const ENDPOINT_MISSING =
  '업로드 엔드포인트(/api/r2-upload-url)를 찾을 수 없습니다. 개발 중이라면 `npm run dev`로 실행했는지, 배포본이라면 Vercel 배포가 끝났는지 확인하세요.'

/** 서명 URL 발급 요청. project 종류는 resourceId가 projectId를 가리킨다 */
async function requestUploadUrl(
  kind: UploadKind,
  resourceId: string,
  file: File,
): Promise<SignedUpload> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.')

  const response = await fetch('/api/r2-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      kind,
      ...(kind === 'project' ? { resourceId } : { bookId: resourceId }),
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    }),
  })

  // 엔드포인트가 없으면 SPA의 index.html이 돌아오므로 JSON 파싱이 실패한다
  const raw = await response.text()
  let payload: SignedUpload
  try {
    payload = JSON.parse(raw) as SignedUpload
  } catch {
    throw new Error(
      response.ok ? ENDPOINT_MISSING : `업로드 준비에 실패했습니다 (HTTP ${response.status}).`,
    )
  }
  if (!response.ok) {
    throw new Error(payload.error || `업로드 준비에 실패했습니다 (HTTP ${response.status}).`)
  }
  return payload
}

/** R2에 직접 PUT. 진행률을 받기 위해 fetch 대신 XHR을 쓴다 */
function putToR2(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl, true)
    xhr.setRequestHeader('Content-Type', contentType)
    // 키가 매번 달라 같은 주소가 다른 내용을 가리키는 일이 없으므로 길게 캐시해도 안전하다
    xhr.setRequestHeader('Cache-Control', 'public, max-age=31536000, immutable')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else
        reject(
          new Error(
            `R2 업로드에 실패했습니다 (HTTP ${xhr.status}). ${xhr.responseText.slice(0, 200)}`,
          ),
        )
    }
    xhr.onerror = () =>
      reject(
        new Error(
          'R2로 전송하지 못했습니다. 버킷의 CORS 설정에 이 사이트 주소가 등록되어 있는지 확인하세요.',
        ),
      )
    xhr.send(file)
  })
}

export interface UploadResult {
  url: string
  name: string
  size: number
}

/** 서명 URL을 받아 R2에 올리고 공개 URL을 돌려준다. project 종류는 resourceId가 projectId */
export async function uploadToR2(
  kind: UploadKind,
  resourceId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const signed = await requestUploadUrl(kind, resourceId, file)
  // 형식이 애매한 파일(.md는 브라우저가 빈 문자열로 주기도 한다)은 서버가 정한 값을 쓴다
  await putToR2(signed.uploadUrl, file, signed.contentType || file.type || 'application/octet-stream', onProgress)
  return { url: signed.publicUrl, name: file.name, size: file.size }
}

/**
 * R2에 올려 둔 텍스트 파일(HTML·MD)의 내용을 읽는다.
 *
 * 버킷 CORS의 AllowedMethods에 GET이 있어야 한다(.env.example 참고).
 * 없으면 브라우저가 응답을 막아 "불러오지 못했습니다"로 보인다.
 */
export async function fetchTextFromR2(url: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new Error(
      '파일을 불러오지 못했습니다. R2 버킷의 CORS 설정에 이 사이트 주소와 GET이 포함되어 있는지 확인하세요.',
    )
  }
  if (!response.ok) {
    throw new Error(`파일을 불러오지 못했습니다 (HTTP ${response.status}).`)
  }
  return await response.text()
}

/** 바이트를 읽기 쉬운 단위로 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
