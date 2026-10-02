import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { apiPlugin } from './server/index.mjs'

export default defineConfig({
  plugins: [react(), apiPlugin()],
})
