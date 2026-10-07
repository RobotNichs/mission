import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { apiPlugin } from './server/index.mjs'
import { pwaPlugin } from './server/pwaBuild.mjs'
import { buildSecurityPlugin } from './server/buildSecurity.mjs'

export default defineConfig({
  publicDir: false, // PWA plugin emits only the explicitly approved public files.
  plugins: [react(), apiPlugin(), pwaPlugin(), buildSecurityPlugin()],
})
