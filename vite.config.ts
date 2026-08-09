import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { bearerToken, envFrom, readJsonBody, runAi } from './api/ai'
import r2UploadUrlHandler from './api/r2-upload-url'

/**
 * 로컬 개발용 API 엔드포인트.
 * 운영에서는 api/*.ts의 default export가 Vercel 서버리스 함수로 실행되지만
 * `vite`만 띄우면 그 함수들이 없으므로 dev 서버에 직접 붙여 준다.
 * 같은 파일의 코드를 호출하므로 로컬과 운영의 동작이 갈리지 않는다.
 */
function devApiEndpoints(env: Record<string, string>): Plugin {
  return {
    name: 'librospace-dev-api',
    apply: 'serve',
    configureServer(server) {
      // api/r2-upload-url.ts는 process.env를 직접 읽는다(운영에서 Vercel이 채워 줌).
      // dev에서는 .env에서 읽은 값을 넣어 준다. 이미 있는 값은 덮어쓰지 않는다.
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

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

      // Vercel 함수 시그니처(res.status().json())를 Connect 응답에 맞춰 준다
      server.middlewares.use('/api/r2-upload-url', async (req, res) => {
        const shim = Object.assign(res, {
          status(code: number) {
            res.statusCode = code
            return shim
          },
          json(body: unknown) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify(body))
          },
        })
        try {
          await r2UploadUrlHandler(req as never, shim as never)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          shim.status(500).json({ error: `업로드 준비 중 오류가 발생했습니다: ${message}` })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // 접두사 ''로 읽어 VITE_ 가 아닌 BIZROUTER_API_KEY, R2_* 까지 .env에서 가져온다.
  // 이 값들은 dev 미들웨어(서버 쪽)에서만 쓰이고 클라이언트 번들에는 들어가지 않는다.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss(), devApiEndpoints(env)],
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
