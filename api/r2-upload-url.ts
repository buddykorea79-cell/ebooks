/**
 * POST /api/r2-upload-url — Cloudflare R2 업로드용 서명 URL 발급.
 *
 * 파일 자체는 이 함수를 거치지 않는다. Vercel 서버리스 함수는 요청 본문이
 * 4.5MB로 제한돼 있어 수십 MB짜리 PDF가 통과하지 못하기 때문이다.
 * 여기서는 몇 KB짜리 서명 URL만 만들어 주고, 실제 전송은
 * 브라우저 → R2로 직접 간다.
 *
 * ⚠️ 이 파일에 상대 경로 import를 추가하지 말 것. package.json이 "type": "module"이라
 *    Vercel에서 ESM으로 실행되는데, Node ESM은 확장자 없는 상대 import를 해석하지 못해
 *    모듈 로드 단계에서 FUNCTION_INVOCATION_FAILED로 죽는다.
 *    (그래서 api/ai.ts의 인증 검사 코드가 여기 일부 중복된다)
 */
import { createClient } from '@supabase/supabase-js'
import { AwsClient } from 'aws4fetch'

/** 서명 URL 유효 시간 — 큰 파일 업로드를 감안해 넉넉히 */
const SIGNED_URL_TTL_SEC = 60 * 30
/** 허용 최대 크기 (R2 자체 제한은 훨씬 크지만 실수 방지용) */
const MAX_PDF_BYTES = 300 * 1024 * 1024

interface VercelRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  on(event: 'data', cb: (chunk: { toString(encoding?: string): string }) => void): unknown
  on(event: 'end', cb: () => void): unknown
  on(event: 'error', cb: (err: Error) => void): unknown
}

interface VercelResponse {
  setHeader(name: string, value: string): void
  status(code: number): VercelResponse
  json(body: unknown): void
}

function readJsonBody(req: VercelRequest): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk.toString()
    })
    req.on('error', () => resolve({}))
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function bearerToken(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header
  if (!value) return ''
  const match = /^Bearer\s+(.+)$/i.exec(value.trim())
  return match ? match[1].trim() : ''
}

/** 파일 이름을 키로 쓸 수 있게 정리 (한글·공백·특수문자 제거) */
function safeSlug(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  const ascii = base.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  return ascii.slice(0, 40) || 'file'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'POST만 지원합니다.' })
    return
  }

  const env = process.env
  const accountId = env.R2_ACCOUNT_ID ?? ''
  const accessKeyId = env.R2_ACCESS_KEY_ID ?? ''
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY ?? ''
  const bucket = env.R2_BUCKET ?? ''
  const publicBase = (env.R2_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '')
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
    res.status(500).json({
      error:
        'PDF 업로드가 서버에 설정되지 않았습니다. 환경변수 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_BASE_URL을 등록하세요.',
    })
    return
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ error: '서버에 Supabase 환경변수가 없습니다.' })
    return
  }

  const body = req.body && typeof req.body === 'object'
    ? (req.body as Record<string, unknown>)
    : await readJsonBody(req)

  const bookId = typeof body.bookId === 'string' ? body.bookId : ''
  const fileName = typeof body.fileName === 'string' ? body.fileName : 'document.pdf'
  const contentType = typeof body.contentType === 'string' ? body.contentType : ''
  const size = typeof body.size === 'number' ? body.size : 0

  if (!bookId) {
    res.status(400).json({ error: '도서 정보가 없습니다.' })
    return
  }
  if (contentType !== 'application/pdf') {
    res.status(400).json({ error: 'PDF 파일만 올릴 수 있습니다.' })
    return
  }
  if (size <= 0 || size > MAX_PDF_BYTES) {
    res.status(400).json({
      error: `파일 크기가 올바르지 않습니다. ${Math.round(MAX_PDF_BYTES / 1024 / 1024)}MB 이하만 올릴 수 있습니다.`,
    })
    return
  }

  // --- 로그인 확인 -------------------------------------------------------
  const token = bearerToken(req.headers.authorization)
  if (!token) {
    res.status(401).json({ error: '로그인이 필요합니다.' })
    return
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (userError || !user) {
    res.status(401).json({ error: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' })
    return
  }

  // --- 내 도서인지 확인 (남의 도서에 파일을 붙이지 못하게) -------------------
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('id, owner_id')
    .eq('id', bookId)
    .maybeSingle()

  if (bookError) {
    res.status(500).json({ error: `도서를 확인하지 못했습니다: ${bookError.message}` })
    return
  }
  if (!book || (book as { owner_id?: string }).owner_id !== user.id) {
    res.status(403).json({ error: '내가 만든 도서에만 파일을 올릴 수 있습니다.' })
    return
  }

  // --- 서명 URL 발급 -----------------------------------------------------
  const key = `${user.id}/${bookId}/${Date.now()}-${safeSlug(fileName)}.pdf`
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`

  try {
    const client = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: 's3',
      region: 'auto',
    })

    // X-Amz-Expires는 반드시 쿼리스트링에 넣는다.
    // 헤더로 넘기면 만료 시간이 무시되고(기본 86400), 게다가 SignedHeaders에 섞여
    // 브라우저가 보내지 않는 헤더를 요구하게 되어 PUT이 403으로 실패한다.
    const signUrl = new URL(endpoint)
    signUrl.searchParams.set('X-Amz-Expires', String(SIGNED_URL_TTL_SEC))

    const signed = await client.sign(new Request(signUrl, { method: 'PUT' }), {
      aws: { signQuery: true },
    })

    res.status(200).json({
      uploadUrl: signed.url,
      publicUrl: `${publicBase}/${key}`,
      key,
      expiresIn: SIGNED_URL_TTL_SEC,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `업로드 주소를 만들지 못했습니다: ${message}` })
  }
}
