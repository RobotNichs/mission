import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { apiPlugin } from './server/index.mjs'
import { pwaPlugin } from './server/pwaBuild.mjs'

export default defineConfig({
  plugins: [react(), apiPlugin(), pwaPlugin()],
})
