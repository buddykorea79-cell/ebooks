/**
 * POST /api/og-preview — URL 미리보기(OG 메타태그) 조회.
 *
 * 프로젝트 게시판에 URL을 제출하면 그 페이지의 og:title/og:description/og:image를
 * 가져와 미리보기 카드로 보여준다. 브라우저에서 직접 fetch하면 대상 사이트의 CORS
 * 정책에 막히므로 서버를 거친다.
 *
 * 로그인한 사용자만 호출할 수 있고(익명 오픈 프록시가 되지 않도록), 사설망/루프백
 * 주소로는 요청을 보내지 않는다(SSRF 방지 — 특히 클라우드 메타데이터 엔드포인트).
 *
 * ⚠️ 이 파일에 상대 경로 import를 추가하지 말 것. package.json이 "type": "module"이라
 *    Vercel에서 ESM으로 실행되는데, Node ESM은 확장자 없는 상대 import를 해석하지 못해
 *    모듈 로드 단계에서 FUNCTION_INVOCATION_FAILED로 죽는다.
 *    (그래서 api/ai.ts, api/r2-upload-url.ts의 인증 검사 코드가 여기 일부 중복된다)
 */
import { createClient } from '@supabase/supabase-js'
import { lookup } from 'node:dns/promises'
import { isIPv4, isIPv6 } from 'node:net'

const FETCH_TIMEOUT_MS = 5_000
/** 이 바이트 수만큼만 읽고 중단한다 — <head>만 읽으면 충분하고, 거대한 응답으로부터도 보호한다 */
const MAX_RESPONSE_BYTES = 500 * 1024

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

/** IPv4 문자열이 사설/루프백/링크로컬 등 공인망이 아닌 대역인지 */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true
  const [a, b] = parts
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10.0.0.0/8
  if (a === 127) return true // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true // 169.254.0.0/16 (link-local, 클라우드 메타데이터 포함)
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 (carrier-grade NAT)
  if (a >= 224) return true // 멀티캐스트/예약 대역
  return false
}

/** IPv6 문자열이 사설/루프백/링크로컬 등인지 (IPv4-mapped 주소는 내부 IPv4로 판정) */
function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1') return true // loopback
  if (lower === '::') return true
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
    return true // fe80::/10 link-local
  }
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true // fc00::/7 unique local
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower)
  if (mapped) return isPrivateIpv4(mapped[1])
  return false
}

function isPrivateIp(ip: string, family: number): boolean {
  return family === 4 ? isPrivateIpv4(ip) : isPrivateIpv6(ip)
}

interface UrlCheckResult {
  ok: boolean
  error?: string
}

/** URL 형식 + 프로토콜 + DNS 조회 결과(사설 IP 여부)까지 확인한다 */
async function checkUrlSafety(rawUrl: string): Promise<UrlCheckResult> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, error: '올바른 URL 형식이 아닙니다.' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'http 또는 https 주소만 사용할 수 있습니다.' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: '이 형식의 URL은 사용할 수 없습니다.' }
  }

  let addresses: { address: string; family: number }[]
  try {
    addresses = await lookup(parsed.hostname, { all: true })
  } catch {
    return { ok: false, error: '주소를 찾을 수 없습니다.' }
  }
  if (addresses.length === 0) {
    return { ok: false, error: '주소를 찾을 수 없습니다.' }
  }
  for (const { address, family } of addresses) {
    const fam = family || (isIPv4(address) ? 4 : isIPv6(address) ? 6 : 4)
    if (isPrivateIp(address, fam)) {
      return { ok: false, error: '이 주소는 미리볼 수 없습니다.' }
    }
  }
  return { ok: true }
}

/** 응답 본문을 MAX_RESPONSE_BYTES까지만 읽는다 (그 이상은 <head> 파싱에 필요 없다) */
async function readCappedText(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return await response.text()

  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      total += value.byteLength
      if (total >= MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {})
        break
      }
    }
  }
  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)), Math.min(total, MAX_RESPONSE_BYTES))
  return buffer.toString('utf-8')
}

interface OgPreview {
  title: string | null
  description: string | null
  image: string | null
  url: string
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/** <head> 텍스트에서 og:* 메타태그와 <title>을 정규식으로 뽑는다 */
function extractOgTags(html: string, pageUrl: string): OgPreview {
  const headMatch = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html)
  const head = headMatch ? headMatch[1] : html.slice(0, MAX_RESPONSE_BYTES)

  function metaContent(property: string): string | null {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["'][^>]*>`,
      'i',
    )
    const reversed = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["'][^>]*>`,
      'i',
    )
    const m = re.exec(head) ?? reversed.exec(head)
    return m ? decodeEntities(m[1]).trim() : null
  }

  const title = metaContent('og:title') ?? /<title[^>]*>([^<]*)<\/title>/i.exec(head)?.[1]?.trim() ?? null
  const description = metaContent('og:description') ?? metaContent('description')
  let image = metaContent('og:image')
  if (image) {
    try {
      image = new URL(image, pageUrl).toString()
    } catch {
      image = null
    }
  }

  return {
    title: title ? decodeEntities(title) : null,
    description,
    image,
    url: pageUrl,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'POST만 지원합니다.' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ error: '서버에 Supabase 환경변수가 없습니다.' })
    return
  }

  // --- 로그인 확인 (익명 오픈 프록시가 되지 않도록) -------------------------
  const token = bearerToken(req.headers.authorization)
  if (!token) {
    res.status(401).json({ error: '로그인이 필요합니다.' })
    return
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    res.status(401).json({ error: '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.' })
    return
  }

  const body =
    req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : await readJsonBody(req)
  const rawUrl = typeof body.url === 'string' ? body.url.trim() : ''
  if (!rawUrl) {
    res.status(400).json({ error: 'URL을 입력하세요.' })
    return
  }

  const safety = await checkUrlSafety(rawUrl)
  if (!safety.ok) {
    res.status(400).json({ error: safety.error })
    return
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(rawUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // 일부 사이트는 UA가 없으면 og 태그가 없는 최소 응답을 준다
        'User-Agent': 'Mozilla/5.0 (compatible; LibrospaceLinkPreview/1.0)',
      },
    })
    if (!response.ok) {
      res.status(400).json({ error: `페이지를 불러오지 못했습니다 (HTTP ${response.status}).` })
      return
    }
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      res.status(400).json({ error: 'HTML 페이지만 미리볼 수 있습니다.' })
      return
    }
    const html = await readCappedText(response)
    const preview = extractOgTags(html, response.url || rawUrl)
    res.status(200).json(preview)
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    res.status(aborted ? 504 : 500).json({
      error: aborted
        ? '페이지 응답이 너무 오래 걸려 중단했습니다.'
        : `미리보기를 가져오지 못했습니다: ${err instanceof Error ? err.message : String(err)}`,
    })
  } finally {
    clearTimeout(timer)
  }
}
