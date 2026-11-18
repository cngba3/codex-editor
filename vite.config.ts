import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { codexApi } from './server/codex'
import { jobsApi } from './server/jobs'

export default defineConfig({
  // Keep this app independent from PostCSS configs in parent directories.
  css: { postcss: { plugins: [] } },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  plugins: [
    react(),
    {
      name: 'local-codex-and-jobs-api',
      configureServer(server) { server.middlewares.use(codexApi); server.middlewares.use(jobsApi) },
      configurePreviewServer(server) { server.middlewares.use(codexApi); server.middlewares.use(jobsApi) },
    },
  ],
})
