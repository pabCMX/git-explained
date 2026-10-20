import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  server: { port: 3417 },
  // Prerender every page to static HTML, so the site can be hosted on any static host.
  plugins: [tanstackStart({ prerender: { enabled: true, crawlLinks: true, failOnError: true } }), react(), tailwindcss()],
})
