/**
 * POST /api/r2-upload-url — Cloudflare R2 업로드용 서명 URL 발급.
 *
 * PDF 도서와 본문 이미지가 같은 버킷을 쓴다(kind로 구분).
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
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { AwsClient } from 'aws4fetch'

/** 서명 URL 유효 시간 — 큰 파일 업로드를 감안해 넉넉히 */
const SIGNED_URL_TTL_SEC = 60 * 30

/** 올릴 수 있는 종류별 규칙. R2 자체 제한은 훨씬 크지만 실수 방지용으로 둔다 */
/** site_settings.upload_max_mb를 못 읽을 때 쓰는 값 (마이그레이션 전 등) */
const DEFAULT_UPLOAD_MAX_MB = 50
/** 관리자가 설정할 수 있는 절대 상한 — DB 제약(1~500)과 맞춘다 */
const UPLOAD_MAX_MB_CEILING = 500

const KINDS = {
  pdf: {
    folder: 'pdf',
    // 실제 상한은 site_settings.upload_max_mb가 결정한다 (아래에서 덮어씀)
    maxBytes: DEFAULT_UPLOAD_MAX_MB * 1024 * 1024,
    types: { 'application/pdf': 'pdf' } as Record<string, string>,
    // 확장자로도 판정한다 (브라우저가 Content-Type을 비워 보내는 경우가 있다)
    exts: { pdf: 'pdf' } as Record<string, string>,
    /** R2에 저장할 Content-Type — 직접 열었을 때 제대로 보이도록 서버가 정한다 */
    storeAs: { pdf: 'application/pdf' } as Record<string, string>,
    reject: 'PDF 파일만 올릴 수 있습니다.',
  },
  /** 단일 파일 도서 — 완성된 HTML 또는 마크다운 한 개 */
  single: {
    folder: 'single',
    maxBytes: DEFAULT_UPLOAD_MAX_MB * 1024 * 1024,
    types: {
      'text/html': 'html',
      'application/xhtml+xml': 'html',
      'text/markdown': 'md',
      'text/x-markdown': 'md',
    } as Record<string, string>,
    // .md는 OS에 따라 Content-Type이 비거나 application/octet-stream으로 온다.
    // 확장자가 더 믿을 만하므로 이쪽을 먼저 본다.
    exts: { html: 'html', htm: 'html', xhtml: 'html', md: 'md', markdown: 'md' } as Record<
      string,
      string
    >,
    storeAs: {
      html: 'text/html; charset=utf-8',
      md: 'text/markdown; charset=utf-8',
    } as Record<string, string>,
    reject: 'HTML(.html) 또는 마크다운(.md) 파일만 올릴 수 있습니다.',
  },
  image: {
    folder: 'images',
    maxBytes: 10 * 1024 * 1024,
    // SVG는 제외한다 — 공개 버킷이라 URL을 직접 열면 스크립트가 실행될 수 있다
    types: {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/avif': 'avif',
    } as Record<string, string>,
    exts: {
      png: 'png',
      jpg: 'jpg',
      jpeg: 'jpg',
      gif: 'gif',
      webp: 'webp',
      avif: 'avif',
    } as Record<string, string>,
    storeAs: {
      png: 'image/png',
      jpg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      avif: 'image/avif',
    } as Record<string, string>,
    reject: 'PNG, JPG, GIF, WebP, AVIF 이미지만 올릴 수 있습니다.',
  },
  /** 프로젝트 게시판 제출물 — 이미지·동영상·문서·압축파일 등 */
  project: {
    folder: 'project',
    maxBytes: DEFAULT_UPLOAD_MAX_MB * 1024 * 1024,
    types: {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
      'application/pdf': 'pdf',
      'application/zip': 'zip',
      'text/plain': 'txt',
    } as Record<string, string>,
    exts: {
      png: 'png',
      jpg: 'jpg',
      jpeg: 'jpg',
      gif: 'gif',
      webp: 'webp',
      avif: 'avif',
      mp4: 'mp4',
      webm: 'webm',
      mov: 'mov',
      pdf: 'pdf',
      zip: 'zip',
      txt: 'txt',
      doc: 'doc',
      docx: 'docx',
      ppt: 'ppt',
      pptx: 'pptx',
      xls: 'xls',
      xlsx: 'xlsx',
      hwp: 'hwp',
    } as Record<string, string>,
    storeAs: {
      png: 'image/png',
      jpg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      avif: 'image/avif',
      mp4: 'video/mp4',
      webm: 'video/webm',
      mov: 'video/quicktime',
      pdf: 'application/pdf',
      zip: 'application/zip',
      txt: 'text/plain; charset=utf-8',
    } as Record<string, string>,
    reject: '이미지, 동영상(mp4·webm·mov) 또는 문서·압축 파일만 올릴 수 있습니다.',
  },
} as const

type Kind = keyof typeof KINDS

/** 관리자 상한(upload_max_mb)을 따르는 종류 — 이미지는 고정 한도를 쓴다 */
const ADMIN_LIMITED: Kind[] = ['pdf', 'single', 'project']

/**
 * 확장자 → Content-Type 순으로 판정한다.
 * 마크다운처럼 브라우저가 형식을 못 알아보는 파일이 있어 확장자를 우선한다.
 */
function resolveExt(kind: Kind, contentType: string, fileName: string): string | null {
  const rule = KINDS[kind]
  const dotted = /\.([a-zA-Z0-9]+)$/.exec(fileName)
  const byExt = dotted ? (rule.exts as Record<string, string>)[dotted[1].toLowerCase()] : undefined
  if (byExt) return byExt
  // Content-Type에 붙는 '; charset=utf-8' 같은 파라미터는 떼고 본다
  const bare = contentType.split(';')[0].trim().toLowerCase()
  return (rule.types as Record<string, string>)[bare] ?? null
}

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

/**
 * 파일 이름에서 키에 쓸 수 있는 부분만 남긴다.
 * 한글·공백·특수문자는 R2 키로도 URL로도 다루기 번거로우니 떨어낸다.
 * 이름은 '알아보기 위한 꼬리표'일 뿐이고, 중복 방지는 아래 UUID가 담당한다.
 */
function safeSlug(name: string): string {
  const base = name.replace(/\.[^.]+$/, '')
  const ascii = base
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/\.+/g, '.') // '..' 같은 연속 점 제거 (경로 이동으로 읽힐 여지를 없앤다)
    .replace(/-+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '')
    .slice(0, 40)
  // 한글만 있는 이름 등은 전부 걸러져 빈 문자열이 될 수 있다
  return /[a-zA-Z0-9]/.test(ascii) ? ascii : 'file'
}

/**
 * 절대 겹치지 않는 키를 만든다.
 *   {userId}/{kind}/{resourceId}/{날짜}-{uuid}-{이름}.{확장자}
 *
 * 같은 사람이 같은 파일을 같은 밀리초에 여러 번 올려도 uuid가 달라 덮어쓰이지 않는다.
 * (R2는 같은 키로 PUT하면 조용히 덮어쓰므로 이 보장이 중요하다)
 */
export function buildKey(
  userId: string,
  kind: Kind,
  resourceId: string,
  fileName: string,
  ext: string,
) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${userId}/${KINDS[kind].folder}/${resourceId}/${stamp}-${randomUUID()}-${safeSlug(fileName)}.${ext}`
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
        '파일 업로드가 서버에 설정되지 않았습니다. 환경변수 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_BASE_URL을 등록하세요.',
    })
    return
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ error: '서버에 Supabase 환경변수가 없습니다.' })
    return
  }

  const body =
    req.body && typeof req.body === 'object'
      ? (req.body as Record<string, unknown>)
      : await readJsonBody(req)

  // kind를 안 보내면 예전 클라이언트로 보고 pdf로 취급한다
  const kindRaw = typeof body.kind === 'string' ? body.kind : 'pdf'
  if (!(kindRaw in KINDS)) {
    res.status(400).json({ error: '알 수 없는 업로드 종류입니다.' })
    return
  }
  const kind = kindRaw as Kind
  const rule = KINDS[kind]

  const bookId = typeof body.bookId === 'string' ? body.bookId : ''
  const resourceId = typeof body.resourceId === 'string' ? body.resourceId : ''
  // project 종류는 bookId 대신 resourceId(=projectId)를 쓴다. 나머지는 기존처럼 bookId.
  const targetId = kind === 'project' ? resourceId : bookId
  const fileName = typeof body.fileName === 'string' ? body.fileName : 'file'
  const contentType = typeof body.contentType === 'string' ? body.contentType : ''
  const size = typeof body.size === 'number' ? body.size : 0

  if (!targetId) {
    res.status(400).json({ error: kind === 'project' ? '프로젝트 정보가 없습니다.' : '도서 정보가 없습니다.' })
    return
  }
  const ext = resolveExt(kind, contentType, fileName)
  if (!ext) {
    res.status(400).json({ error: rule.reject })
    return
  }
  if (size <= 0) {
    res.status(400).json({ error: '파일 크기가 올바르지 않습니다.' })
    return
  }
  // 이미지는 고정 한도라 여기서 바로 거른다.
  // PDF·단일 파일은 관리자 설정을 읽어야 해서 로그인 확인 뒤로 미룬다.
  if (!ADMIN_LIMITED.includes(kind) && size > rule.maxBytes) {
    res.status(400).json({
      error: `파일이 너무 큽니다. ${Math.round(rule.maxBytes / 1024 / 1024)}MB 이하만 올릴 수 있습니다.`,
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

  // --- 자료 접근 권한 확인 -------------------------------------------------
  // project: 해당 프로젝트를 볼 수 있는 사람(그룹리더/그룹원/관리자)인지는
  // projects_select RLS 정책이 이미 그대로 판별해 준다 — 조회되면 권한이 있는 것.
  // 그 외(pdf/single/image): 내가 만든 도서인지 확인 (남의 도서에 파일을 붙이지 못하게)
  if (kind === 'project') {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', targetId)
      .maybeSingle()

    if (projectError) {
      res.status(500).json({ error: `프로젝트를 확인하지 못했습니다: ${projectError.message}` })
      return
    }
    if (!project) {
      res.status(403).json({ error: '이 프로젝트에 파일을 올릴 권한이 없습니다.' })
      return
    }
  } else {
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('id, owner_id')
      .eq('id', targetId)
      .maybeSingle()

    if (bookError) {
      res.status(500).json({ error: `도서를 확인하지 못했습니다: ${bookError.message}` })
      return
    }
    if (!book || (book as { owner_id?: string }).owner_id !== user.id) {
      res.status(403).json({ error: '내가 만든 도서에만 파일을 올릴 수 있습니다.' })
      return
    }
  }

  // --- 크기 제한 확인 (PDF · HTML · MD 공통) -------------------------------
  // 상한은 관리자가 정한다(site_settings.upload_max_mb).
  // 화면에서도 미리 걸러 주지만 그건 우회할 수 있으므로 최종 판단은 여기서 한다.
  if (ADMIN_LIMITED.includes(kind)) {
    let limitMb = DEFAULT_UPLOAD_MAX_MB
    // upload-limits.sql 실행 전 배포본에서도 죽지 않도록 컬럼을 지정하지 않고 전체를 읽는다
    // (없는 컬럼을 select하면 PostgREST가 42703으로 실패한다)
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    const row = settings as { upload_max_mb?: number; pdf_max_mb?: number } | null
    const raw = row?.upload_max_mb ?? row?.pdf_max_mb
    if (typeof raw === 'number' && raw > 0) {
      limitMb = Math.min(raw, UPLOAD_MAX_MB_CEILING)
    }
    if (size > limitMb * 1024 * 1024) {
      res.status(400).json({
        error: `파일이 너무 큽니다. ${limitMb}MB 이하만 올릴 수 있습니다.`,
      })
      return
    }
  }

  // --- 서명 URL 발급 -----------------------------------------------------
  const key = buildKey(user.id, kind, targetId, fileName, ext)
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
      // 브라우저가 PUT할 때 쓸 Content-Type. 서명은 쿼리스트링 방식이라 헤더가
      // 서명에 포함되지 않으므로, 형식이 애매한 파일(.md 등)도 서버가 정해 줄 수 있다.
      contentType: (rule.storeAs as Record<string, string>)[ext] ?? 'application/octet-stream',
      expiresIn: SIGNED_URL_TTL_SEC,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `업로드 주소를 만들지 못했습니다: ${message}` })
  }
}
