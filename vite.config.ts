import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
})
