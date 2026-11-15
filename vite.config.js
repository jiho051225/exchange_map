import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import 'dotenv/config'
import { planMiddleware } from './server/plan.js'
import { placeSearchMiddleware } from './server/places.js'

export default defineConfig({
  plugins: [react(), {
    name: 'local-plan-api',
    configureServer(server) {
      server.middlewares.use('/api/plan', planMiddleware)
      server.middlewares.use('/api/places', placeSearchMiddleware)
    },
  }],
})
