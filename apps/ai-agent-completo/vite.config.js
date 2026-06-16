import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const buildId = process.env.BUILD_ID || '2026-06-01-n'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
