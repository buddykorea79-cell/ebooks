import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 배포 경로: https://<user>.github.io/ebooks/
export default defineConfig({
  base: '/ebooks/',
  plugins: [react(), tailwindcss()],
})
