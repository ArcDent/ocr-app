import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    projects: [
      {
        name: 'main',
        testMatch: ['src/main/**/__tests__/**/*.test.ts'],
      },
      {
        name: 'renderer',
        testMatch: ['src/renderer/**/__tests__/**/*.test.tsx', 'src/renderer/**/__tests__/**/*.test.ts'],
        environment: 'jsdom',
        setupFiles: ['src/renderer/test-setup.ts'],
      },
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
    },
  },
})
