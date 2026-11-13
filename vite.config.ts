import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { codexApi } from './server/codex'
import { jobsApi } from './server/jobs'

export default defineConfig({
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  plugins: [
    react(),
    {
      name: 'local-codex-api',
      configureServer(server) { server.middlewares.use(codexApi); server.middlewares.use(jobsApi) },
      configurePreviewServer(server) { server.middlewares.use(codexApi); server.middlewares.use(jobsApi) },
    },
  ],
})
