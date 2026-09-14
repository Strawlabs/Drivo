import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

// In ESM modules, __dirname doesn't exist — we recreate it from import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // host: true — listen on the LAN, not just localhost, so a phone on the
  // same Wi-Fi can open this dev server directly.
  server: {
    host: true,
  },
  // Vitest reads this same config (shares the "@" alias above) rather than
  // needing its own vitest.config.js. Pure-logic unit tests only for now
  // (src/lib/*.test.js) — no jsdom/browser environment needed yet, so the
  // default Node environment is fine and faster.
  test: {
    globals: true,
  },
})
