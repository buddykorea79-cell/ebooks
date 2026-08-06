import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { bearerToken, envFrom, readJsonBody, runAi } from './api/_core'

/**
 * 로컬 개발용 /api/ai 엔드포인트.
 * 운영에서는 Vercel 서버리스 함수(api/ai.ts)가 같은 일을 하지만
 * `vite`만 띄우면 그 함수가 없으므로 dev 서버에 직접 붙여 준다.
 * 두 경로 모두 api/_core.ts의 runAi를 호출하므로 동작이 갈리지 않는다.
 */
function aiDevEndpoint(env: Record<string, string>): Plugin {
  return {
    name: 'librospace-ai-dev-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/ai', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        const send = (status: number, json: unknown) => {
          res.statusCode = status
          res.end(JSON.stringify(json))
        }

        if (req.method !== 'POST') {
          send(405, { error: 'POST만 지원합니다.' })
          return
        }
        try {
          const body = await readJsonBody(req)
          const result = await runAi(body, bearerToken(req.headers.authorization), envFrom(env))
          send(result.status, result.json)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          send(500, { error: `AI 요청 처리 중 오류가 발생했습니다: ${message}` })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // 접두사 ''로 읽어 VITE_ 가 아닌 BIZROUTER_API_KEY까지 .env에서 가져온다.
  // 이 값은 dev 미들웨어(서버 쪽)에서만 쓰이고 클라이언트 번들에는 들어가지 않는다.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss(), aiDevEndpoint(env)],
    build: {
      // CodeMirror 청크는 도서 편집 화면에서만 지연 로딩되므로 600kB까지 허용
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            codemirror: [
              '@uiw/react-codemirror',
              '@codemirror/lang-html',
              '@codemirror/lang-css',
            ],
          },
        },
      },
    },
  }
})
