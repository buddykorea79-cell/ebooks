import { supabase } from '../lib/supabase'

/**
 * PDF 업로드 — 파일은 Cloudflare R2로 직접 간다.
 *
 * 서버(api/r2-upload-url.ts)는 서명 URL만 만들어 준다. Vercel 서버리스 함수는
 * 요청 본문이 4.5MB로 제한돼 있어 큰 PDF를 통과시킬 수 없기 때문이다.
 */

export interface PdfUploadResult {
  url: string
  name: string
  size: number
}

interface SignedUpload {
  uploadUrl: string
  publicUrl: string
  error?: string
}

const ENDPOINT_MISSING =
  'PDF 업로드 엔드포인트(/api/r2-upload-url)를 찾을 수 없습니다. 개발 중이라면 `npm run dev`로 실행했는지, 배포본이라면 Vercel 배포가 끝났는지 확인하세요.'

/** R2에 직접 PUT. 진행률을 받기 위해 fetch 대신 XHR을 쓴다 */
function putToR2(uploadUrl: string, file: File, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl, true)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`R2 업로드에 실패했습니다 (HTTP ${xhr.status}). ${xhr.responseText.slice(0, 200)}`))
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

export async function uploadBookPdf(
  bookId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<PdfUploadResult> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.')

  const response = await fetch('/api/r2-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      bookId,
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

  await putToR2(payload.uploadUrl, file, onProgress)

  return { url: payload.publicUrl, name: file.name, size: file.size }
}

/** 바이트를 읽기 쉬운 단위로 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
