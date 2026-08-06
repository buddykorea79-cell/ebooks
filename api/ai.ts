/**
 * POST /api/ai — Vercel 서버리스 함수.
 *
 * BizRouter API 키는 이 서버 쪽에서만 읽는다(BIZROUTER_API_KEY).
 * 실제 처리는 _core.ts의 runAi가 담당하며, 로컬 dev에서는
 * vite.config.ts의 미들웨어가 같은 함수를 호출한다.
 *
 * 파일명이 _로 시작하는 _core.ts는 Vercel이 라우트로 만들지 않는다.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { bearerToken, envFrom, readJsonBody, runAi } from './_core'

type VercelRequest = IncomingMessage & { body?: unknown }
type VercelResponse = ServerResponse & {
  status(code: number): VercelResponse
  json(body: unknown): void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'POST만 지원합니다.' })
    return
  }

  // Vercel은 application/json 본문을 미리 파싱해 두지만, 못 받은 경우 직접 읽는다
  const body =
    req.body && typeof req.body === 'object' ? req.body : await readJsonBody(req)

  try {
    const result = await runAi(body, bearerToken(req.headers.authorization), envFrom(process.env))
    res.status(result.status).json(result.json)
  } catch (err) {
    // 예상치 못한 예외도 반드시 JSON으로 (클라이언트가 error 필드만 읽는다)
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `AI 요청 처리 중 오류가 발생했습니다: ${message}` })
  }
}
