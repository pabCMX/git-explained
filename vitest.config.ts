import { defineConfig } from 'vitest/config'

// Kept apart from vite.config.ts, because the Start plugin needs the full app to load.
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } })
