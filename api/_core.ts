/**
 * BizRouter(https://bizrouter.ai) Chat Completions 연동 코어.
 *
 * 브라우저에서 직접 호출하면 API 키가 번들에 노출되므로, 호출은 반드시
 * 서버에서만 한다. 운영은 Vercel 서버리스 함수(api/ai.ts), 로컬 개발은
 * vite.config.ts의 dev 미들웨어가 이 파일을 똑같이 호출한다.
 * 그래서 여기서는 Node/Vercel 객체를 다루지 않고 순수 값만 주고받는다.
 *
 * 문서: https://bizrouter.ai/docs/chat-completions , https://bizrouter.ai/docs/errors
 */
import { createClient } from '@supabase/supabase-js'

const BIZROUTER_ENDPOINT = 'https://api.bizrouter.ai/v1/chat/completions'

/** 사용자가 요청하는 작업 종류 */
export const AI_ACTIONS = ['draft', 'continue', 'rewrite', 'expand', 'shorten', 'custom'] as const
export type AiAction = (typeof AI_ACTIONS)[number]

/** 현재 본문을 참고해야 하는 작업 (본문이 비어 있으면 거절). 클라이언트 AI_ACTION_LIST와 같아야 한다 */
const ACTIONS_NEEDING_CONTENT: AiAction[] = ['continue', 'rewrite', 'expand', 'shorten', 'custom']
/** 지시문이 반드시 필요한 작업 */
const ACTIONS_NEEDING_INSTRUCTION: AiAction[] = ['draft', 'custom']

const MAX_CONTENT_CHARS = 40_000
const MAX_INSTRUCTION_CHARS = 2_000
const MAX_OUTPUT_TOKENS = 4_000
/** Vercel 함수 제한(vercel.json maxDuration=60)보다 먼저 끊어 에러 메시지를 남긴다 */
const REQUEST_TIMEOUT_MS = 55_000

export interface AiEnv {
  bizrouterApiKey: string
  /** 기본 openai/gpt-5.6-luna. BIZROUTER_MODEL로 교체 가능 */
  model: string
  /** GPT-5 계열 reasoning_effort. 'off'면 아예 보내지 않는다 */
  reasoningEffort: string
  supabaseUrl: string
  supabaseAnonKey: string
}

export interface AiRequestBody {
  action?: unknown
  format?: unknown
  bookId?: unknown
  bookTitle?: unknown
  sectionTitle?: unknown
  instruction?: unknown
  content?: unknown
}

export interface AiResult {
  status: number
  json: Record<string, unknown>
}

/** 실패 응답을 한 곳에서 만든다 (클라이언트는 error 문자열만 읽는다) */
function fail(status: number, error: string, extra?: Record<string, unknown>): AiResult {
  return { status, json: { error, ...extra } }
}

// ---------------------------------------------------------------
// 프롬프트 구성
// ---------------------------------------------------------------

/**
 * 출력 형식 규칙. 뷰어가 HTML 조각 또는 마크다운 본문을 그대로 렌더링하므로
 * 문서 껍데기(<html> 등)나 코드펜스가 섞이면 안 된다.
 */
function formatRules(format: 'html' | 'markdown'): string {
  if (format === 'markdown') {
    return [
      '- 출력은 마크다운 본문만 씁니다.',
      '- 전체를 ``` 코드펜스로 감싸지 마세요. (본문 안의 예제 코드 블록은 사용해도 됩니다)',
      '- 문서 제목은 이미 메뉴 이름으로 표시되므로, 최상위 제목은 `##`부터 시작합니다.',
      '- 표, 목록, 인용 등 마크다운 문법을 적극적으로 활용합니다.',
    ].join('\n')
  }
  return [
    '- 출력은 <body> 안에 그대로 붙여 넣을 수 있는 HTML 조각만 씁니다.',
    '- <!DOCTYPE>, <html>, <head>, <body> 태그는 쓰지 않습니다.',
    '- 전체를 ``` 코드펜스로 감싸지 마세요.',
    '- 문서 제목은 이미 메뉴 이름으로 표시되므로, 제목은 <h2>, <h3>부터 사용합니다.',
    '- 스타일은 문서 전체 CSS가 따로 있으므로 style 속성은 꼭 필요할 때만 씁니다.',
    '- <script> 태그는 사용하지 않습니다.',
  ].join('\n')
}

function buildSystemPrompt(format: 'html' | 'markdown'): string {
  return [
    '당신은 전자책·가이드·매뉴얼 본문을 쓰는 한국어 전문 편집자입니다.',
    '독자가 바로 이해할 수 있도록 정확하고 자연스러운 한국어로 씁니다.',
    '',
    '출력 규칙:',
    formatRules(format),
    '- 인사말, 설명, "다음은 ~입니다" 같은 머리말 없이 본문만 출력합니다.',
    '- 사실이 확실하지 않은 내용은 단정하지 말고, 확인이 필요하다고 적습니다.',
  ].join('\n')
}

/** 긴 본문은 잘라서 보낸다. 이어쓰기는 끝부분이, 나머지는 앞부분이 중요하다. */
function clampContent(content: string, action: AiAction): { text: string; truncated: boolean } {
  if (content.length <= MAX_CONTENT_CHARS) return { text: content, truncated: false }
  const text =
    action === 'continue'
      ? content.slice(content.length - MAX_CONTENT_CHARS)
      : content.slice(0, MAX_CONTENT_CHARS)
  return { text, truncated: true }
}

interface PromptInput {
  action: AiAction
  bookTitle: string
  sectionTitle: string
  instruction: string
  content: string
}

function buildUserPrompt(input: PromptInput): string {
  const { action, bookTitle, sectionTitle, instruction } = input
  const { text: content, truncated } = clampContent(input.content, action)

  const context: string[] = []
  if (bookTitle) context.push(`문서 제목: ${bookTitle}`)
  if (sectionTitle) context.push(`이 꼭지의 제목: ${sectionTitle}`)

  const task: string[] = []
  switch (action) {
    case 'draft':
      task.push('아래 요청에 맞춰 이 꼭지의 본문을 새로 작성해 주세요.')
      task.push(`\n[요청]\n${instruction}`)
      break
    case 'continue':
      task.push('아래 본문에 이어질 내용을 계속 써 주세요.')
      task.push('이미 있는 문장은 다시 출력하지 말고, 이어질 부분만 출력합니다.')
      if (instruction) task.push(`\n[추가 지시]\n${instruction}`)
      break
    case 'rewrite':
      task.push('아래 본문을 더 읽기 쉽고 매끄럽게 다듬어 주세요.')
      task.push('내용과 구조는 유지하고, 문장 표현과 흐름만 개선합니다.')
      if (instruction) task.push(`\n[추가 지시]\n${instruction}`)
      break
    case 'expand':
      task.push('아래 본문을 더 자세하게 확장해 주세요.')
      task.push('설명, 예시, 필요한 절을 보태되 기존 내용과 어긋나지 않게 합니다.')
      if (instruction) task.push(`\n[추가 지시]\n${instruction}`)
      break
    case 'shorten':
      task.push('아래 본문을 핵심만 남겨 간결하게 줄여 주세요.')
      task.push('중요한 정보는 빠뜨리지 않되 중복과 군더더기를 덜어냅니다.')
      if (instruction) task.push(`\n[추가 지시]\n${instruction}`)
      break
    case 'custom':
      task.push('아래 본문에 대해 다음 요청을 수행하고, 수정된 본문 전체를 출력해 주세요.')
      task.push(`\n[요청]\n${instruction}`)
      break
  }

  const parts = [context.join('\n'), task.join('\n')].filter(Boolean)
  // '새로 작성'은 처음부터 쓰는 작업이라 기존 본문을 보내지 않는다
  // (보내면 모델이 그대로 옮겨 적는 쪽으로 흐른다)
  if (content && action !== 'draft') {
    parts.push(
      `${truncated ? '[현재 본문 — 길어서 일부만 전달됨]' : '[현재 본문]'}\n${content}`,
    )
  }
  return parts.join('\n\n')
}

// ---------------------------------------------------------------
// 응답 후처리
// ---------------------------------------------------------------

/** 모델이 결과 전체를 코드펜스로 감싸는 경우가 있어 벗겨낸다 */
function stripOuterCodeFence(text: string): string {
  const trimmed = text.trim()
  const match = /^```[\w-]*\r?\n([\s\S]*?)\r?\n?```$/.exec(trimmed)
  return match ? match[1].trim() : trimmed
}

/** BizRouter 오류 코드 → 사용자에게 보여줄 한국어 안내 */
const ERROR_MESSAGES: Record<string, string> = {
  invalid_api_key: 'BizRouter API 키가 유효하지 않습니다. 서버의 BIZROUTER_API_KEY 환경변수를 확인하세요.',
  bad_request: 'AI 요청 형식이 올바르지 않습니다. 지시문을 줄이거나 다시 시도해 보세요.',
  forbidden_content: '조직의 콘텐츠 정책에 걸려 차단된 요청입니다. 내용을 수정해 주세요.',
  model_blacklisted: '이 모델은 조직에서 차단되어 있습니다. 관리자에게 문의하세요.',
  api_key_model_not_allowed: 'API 키에 이 모델을 사용할 권한이 없습니다. BizRouter에서 키 설정을 확인하세요.',
  api_key_ip_not_allowed: '호출 IP가 API 키의 허용 목록에 없습니다. BizRouter에서 IP 설정을 확인하세요.',
  prepaid_credit_exhausted: 'BizRouter 선불 크레딧이 모두 소진되었습니다. 충전 후 다시 시도하세요.',
  prepaid_credit_temporarily_reserved: '처리 중인 요청이 크레딧을 점유하고 있습니다. 잠시 후 다시 시도하세요.',
  credit_limit_exceeded: 'BizRouter 조직 사용 한도를 초과했습니다.',
  api_key_credit_limit_exceeded: 'BizRouter API 키의 사용 한도를 초과했습니다.',
  model_not_found: '모델을 찾을 수 없습니다. BIZROUTER_MODEL 값이 올바른지 확인하세요.',
  rate_limit_exceeded: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
  provider_error: 'AI 제공사 쪽 오류로 실패했습니다. 잠시 후 다시 시도해 주세요.',
  service_unavailable: 'BizRouter가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해 주세요.',
}

interface BizRouterError {
  code?: string
  message?: string
}

/** BizRouter 오류 / Provider passthrough 오류 어느 쪽이든 안전하게 읽는다 */
function readError(payload: unknown): BizRouterError {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const err = (payload as { error: unknown }).error
    if (err && typeof err === 'object') {
      const o = err as Record<string, unknown>
      return {
        code: typeof o.code === 'string' ? o.code : undefined,
        message: typeof o.message === 'string' ? o.message : undefined,
      }
    }
    if (typeof err === 'string') return { message: err }
  }
  return {}
}

// ---------------------------------------------------------------
// BizRouter 호출
// ---------------------------------------------------------------

interface BizRouterOutcome {
  ok: boolean
  status: number
  payload: unknown
}

async function callBizRouter(
  env: AiEnv,
  messages: { role: string; content: string }[],
  requestId: string,
  withReasoning: boolean,
): Promise<BizRouterOutcome> {
  const body: Record<string, unknown> = {
    model: env.model,
    messages,
    temperature: 0.7,
    max_tokens: MAX_OUTPUT_TOKENS,
  }
  // GPT-5 계열 전용 파라미터. 모델이 거부하면 호출부가 이 값을 빼고 한 번 더 시도한다.
  if (withReasoning && env.reasoningEffort !== 'off') {
    body.reasoning_effort = env.reasoningEffort
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(BIZROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.bizrouterApiKey}`,
        'Content-Type': 'application/json',
        // 사용량 로그 대조용 (idempotency key가 아님)
        'X-BizRouter-Client-Request-Id': requestId,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const raw = await response.text()
    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = { error: { message: raw.slice(0, 500) } }
    }
    return { ok: response.ok, status: response.status, payload }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------
// 진입점
// ---------------------------------------------------------------

/**
 * 요청 1건을 처리한다.
 * @param body   클라이언트가 보낸 JSON (검증 전)
 * @param token  Supabase 액세스 토큰 (Authorization: Bearer …)
 */
export async function runAi(body: AiRequestBody, token: string, env: AiEnv): Promise<AiResult> {
  // --- 0. 서버 설정 확인 -------------------------------------------------
  if (!env.bizrouterApiKey) {
    return fail(500, 'AI 기능이 서버에 설정되지 않았습니다. 환경변수 BIZROUTER_API_KEY를 등록하세요.')
  }
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    return fail(500, '서버에 Supabase 환경변수가 없습니다. VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 확인하세요.')
  }

  // --- 1. 요청 검증 ------------------------------------------------------
  const action = String(body.action ?? '') as AiAction
  if (!AI_ACTIONS.includes(action)) {
    return fail(400, '알 수 없는 작업입니다.')
  }
  const format = body.format === 'markdown' ? 'markdown' : 'html'
  const instruction = String(body.instruction ?? '').trim().slice(0, MAX_INSTRUCTION_CHARS)
  const content = typeof body.content === 'string' ? body.content : ''
  const bookTitle = String(body.bookTitle ?? '').trim().slice(0, 200)
  const sectionTitle = String(body.sectionTitle ?? '').trim().slice(0, 200)
  const bookId = typeof body.bookId === 'string' && body.bookId ? body.bookId : null

  if (ACTIONS_NEEDING_INSTRUCTION.includes(action) && !instruction) {
    return fail(400, '무엇을 써야 할지 지시문을 입력해 주세요.')
  }
  if (ACTIONS_NEEDING_CONTENT.includes(action) && !content.trim()) {
    return fail(400, '현재 본문이 비어 있어 이 작업을 할 수 없습니다. 먼저 내용을 입력하거나 "새로 작성"을 사용하세요.')
  }

  // --- 2. 로그인 확인 ----------------------------------------------------
  if (!token) {
    return fail(401, '로그인이 필요합니다.')
  }
  // 사용자 토큰을 그대로 실어 보내 이후 조회·기록이 그 사용자 권한(RLS)으로 수행되게 한다
  const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  const user = userData?.user
  if (userError || !user) {
    return fail(401, '로그인 정보가 만료되었습니다. 다시 로그인해 주세요.')
  }

  // --- 3. 회원별 AI 사용 권한 확인 (여기서 막지 않으면 API를 직접 두드릴 수 있다) ---
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('ai_enabled')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    const msg = profileError.message ?? ''
    if (msg.includes('ai_enabled')) {
      return fail(500, 'AI 기능이 아직 설치되지 않았습니다. supabase/ai-assist.sql을 SQL Editor에서 실행하세요.')
    }
    return fail(500, `사용 권한을 확인하지 못했습니다: ${msg}`)
  }
  if (!profile || (profile as { ai_enabled?: boolean }).ai_enabled !== true) {
    return fail(403, 'AI 작성 기능 사용 권한이 없습니다. 관리자에게 사용 허용을 요청하세요.')
  }

  // --- 4. BizRouter 호출 -------------------------------------------------
  const messages = [
    { role: 'system', content: buildSystemPrompt(format) },
    {
      role: 'user',
      content: buildUserPrompt({ action, bookTitle, sectionTitle, instruction, content }),
    },
  ]
  const requestId = `librospace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  let outcome: BizRouterOutcome
  try {
    outcome = await callBizRouter(env, messages, requestId, true)
    // 모델이 reasoning_effort를 받지 않는 경우가 있어 그 값만 빼고 한 번 더 시도한다
    if (!outcome.ok && outcome.status === 400) {
      const message = readError(outcome.payload).message ?? ''
      if (/reasoning/i.test(message)) {
        outcome = await callBizRouter(env, messages, requestId, false)
      }
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return fail(
      504,
      aborted
        ? '응답이 너무 오래 걸려 중단했습니다. 지시문을 짧게 하거나 본문을 나눠서 다시 시도해 주세요.'
        : `AI 서버에 연결하지 못했습니다: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!outcome.ok) {
    const { code, message } = readError(outcome.payload)
    const friendly =
      (code && ERROR_MESSAGES[code]) ??
      `AI 요청이 실패했습니다 (HTTP ${outcome.status}${code ? `, ${code}` : ''}).${message ? ` ${message}` : ''}`
    return fail(outcome.status >= 500 ? 502 : outcome.status, friendly)
  }

  // --- 5. 결과 추출 ------------------------------------------------------
  const payload = outcome.payload as {
    model?: string
    choices?: { message?: { content?: unknown }; finish_reason?: string }[]
    usage?: Record<string, unknown>
  }
  const choice = payload.choices?.[0]
  const rawContent = choice?.message?.content
  const text = typeof rawContent === 'string' ? stripOuterCodeFence(rawContent) : ''
  if (!text) {
    return fail(502, 'AI가 빈 응답을 반환했습니다. 잠시 후 다시 시도해 주세요.')
  }

  const usage = payload.usage ?? {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  const promptTokens = num(usage.prompt_tokens)
  const completionTokens = num(usage.completion_tokens)
  const cost = num(usage.cost)
  const usedModel = typeof payload.model === 'string' ? payload.model : env.model

  // --- 6. 사용량 기록 (실패해도 결과는 그대로 돌려준다) ---------------------
  try {
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      book_id: bookId,
      action,
      model: usedModel,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cost,
    })
  } catch {
    // ai-assist.sql 미실행 등 — 기록 실패가 작성 기능을 막아서는 안 된다
  }

  return {
    status: 200,
    json: {
      content: text,
      model: usedModel,
      // 본문이 잘렸으면 finish_reason이 'length' — 화면에서 안내한다
      truncated: choice?.finish_reason === 'length',
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        cost,
      },
    },
  }
}

// ---------------------------------------------------------------
// Node 요청 도우미 (Vercel 함수와 dev 미들웨어가 함께 쓴다)
// ---------------------------------------------------------------

interface ReadableLike {
  on(event: 'data', cb: (chunk: { toString(encoding?: string): string }) => void): unknown
  on(event: 'end', cb: () => void): unknown
  on(event: 'error', cb: (err: Error) => void): unknown
}

/** 요청 본문을 JSON으로 읽는다. 본문이 없거나 깨졌으면 빈 객체 */
export function readJsonBody(req: ReadableLike): Promise<AiRequestBody> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk.toString()
    })
    req.on('error', () => resolve({}))
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as AiRequestBody) : {})
      } catch {
        resolve({})
      }
    })
  })
}

/** Authorization 헤더에서 Bearer 토큰만 꺼낸다 */
export function bearerToken(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header
  if (!value) return ''
  const match = /^Bearer\s+(.+)$/i.exec(value.trim())
  return match ? match[1].trim() : ''
}

/** process.env에서 필요한 값만 모은다 (Supabase 값은 VITE_ 접두사도 허용) */
export function envFrom(source: Record<string, string | undefined>): AiEnv {
  return {
    bizrouterApiKey: source.BIZROUTER_API_KEY ?? '',
    model: source.BIZROUTER_MODEL || 'openai/gpt-5.6-luna',
    reasoningEffort: source.BIZROUTER_REASONING_EFFORT || 'low',
    supabaseUrl: source.SUPABASE_URL || source.VITE_SUPABASE_URL || '',
    supabaseAnonKey: source.SUPABASE_ANON_KEY || source.VITE_SUPABASE_ANON_KEY || '',
  }
}
