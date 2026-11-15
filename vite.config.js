import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import 'dotenv/config'
import { planMiddleware } from './server/plan.js'

export default defineConfig({
  plugins: [react(), {
    name: 'local-plan-api',
    configureServer(server) { server.middlewares.use('/api/plan', planMiddleware) },
  }],
})
