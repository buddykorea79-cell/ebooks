import { supabase } from '../lib/supabase'
import type { ContentFormat } from '../types/database'

/**
 * AI 작성 도우미 호출부.
 * BizRouter API 키는 서버(api/ai.ts)에만 있으므로 여기서는 우리 서버의
 * /api/ai 만 부르고, 로그인 토큰을 실어 보내 권한 검사를 받게 한다.
 */

export type AiAction = 'draft' | 'continue' | 'rewrite' | 'expand' | 'shorten' | 'custom'

export interface AiActionMeta {
  value: AiAction
  label: string
  hint: string
  /** 지시문 입력이 반드시 필요한지 */
  requiresInstruction: boolean
  /** 편집기에 본문이 있어야 하는지 */
  requiresContent: boolean
  placeholder: string
}

export const AI_ACTION_LIST: AiActionMeta[] = [
  {
    value: 'draft',
    label: '새로 작성',
    hint: '지시문만 보고 이 꼭지의 본문을 처음부터 씁니다.',
    requiresInstruction: true,
    requiresContent: false,
    placeholder: '예) 초보자에게 설치 과정을 단계별로 설명하고, 각 단계마다 주의할 점을 덧붙여 줘',
  },
  {
    value: 'continue',
    label: '이어서 쓰기',
    hint: '지금 본문 뒤에 이어질 내용을 씁니다.',
    requiresInstruction: false,
    requiresContent: true,
    placeholder: '예) 다음은 문제 해결 방법을 다뤄 줘 (비워 두면 흐름에 맞게 이어 씁니다)',
  },
  {
    value: 'rewrite',
    label: '다듬기',
    hint: '내용은 그대로 두고 문장과 흐름만 매끄럽게 고칩니다.',
    requiresInstruction: false,
    requiresContent: true,
    placeholder: '예) 좀 더 친근한 말투로 (비워 둬도 됩니다)',
  },
  {
    value: 'expand',
    label: '자세히',
    hint: '설명과 예시를 보태 더 자세하게 늘립니다.',
    requiresInstruction: false,
    requiresContent: true,
    placeholder: '예) 실제 사용 예시를 두 개 추가해 줘 (비워 둬도 됩니다)',
  },
  {
    value: 'shorten',
    label: '요약',
    hint: '핵심만 남기고 군더더기를 덜어냅니다.',
    requiresInstruction: false,
    requiresContent: true,
    placeholder: '예) 절반 분량으로 줄여 줘 (비워 둬도 됩니다)',
  },
  {
    value: 'custom',
    label: '직접 지시',
    hint: '원하는 작업을 직접 적으면 그대로 수행합니다.',
    requiresInstruction: true,
    requiresContent: true,
    placeholder: '예) 표로 정리하고, 각 항목에 예상 소요 시간을 추가해 줘',
  },
]

export interface AiRequest {
  action: AiAction
  format: ContentFormat
  bookId: string
  bookTitle: string
  sectionTitle: string
  instruction: string
  content: string
}

export interface AiUsage {
  prompt_tokens: number
  completion_tokens: number
  /** BizRouter가 계산한 이 요청의 원화 비용 */
  cost: number
}

export interface AiResponse {
  content: string
  model: string
  /** 출력 길이 제한에 걸려 중간에 끊겼는지 */
  truncated: boolean
  usage: AiUsage
}

const ENDPOINT_MISSING =
  'AI 엔드포인트(/api/ai)를 찾을 수 없습니다. 개발 중이라면 `npm run dev`로 실행했는지, 배포본이라면 Vercel 배포가 끝났는지 확인하세요.'

export async function requestAiContent(req: AiRequest): Promise<AiResponse> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    throw new Error('로그인이 필요합니다. 다시 로그인해 주세요.')
  }

  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(req),
  })

  // 엔드포인트가 없으면 SPA의 index.html이 돌아오므로 JSON 파싱이 실패한다
  const raw = await response.text()
  let payload: Partial<AiResponse> & { error?: string }
  try {
    payload = JSON.parse(raw) as Partial<AiResponse> & { error?: string }
  } catch {
    throw new Error(
      response.ok ? ENDPOINT_MISSING : `AI 요청이 실패했습니다 (HTTP ${response.status}).`,
    )
  }

  if (!response.ok) {
    throw new Error(payload.error || `AI 요청이 실패했습니다 (HTTP ${response.status}).`)
  }
  if (!payload.content) {
    throw new Error('AI가 빈 응답을 반환했습니다. 다시 시도해 주세요.')
  }

  return {
    content: payload.content,
    model: payload.model ?? '',
    truncated: payload.truncated === true,
    usage: payload.usage ?? { prompt_tokens: 0, completion_tokens: 0, cost: 0 },
  }
}
