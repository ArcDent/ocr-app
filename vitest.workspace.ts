import { defineWorkspace } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineWorkspace([
  {
    test: {
      name: 'main',
      environment: 'node',
      globals: true,
      include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts'],
    },
  },
  {
    plugins: [react()],
    resolve: {
      alias: { '@': resolve(__dirname, 'src/renderer/src') },
    },
    test: {
      name: 'renderer',
      environment: 'jsdom',
      globals: true,
      include: ['src/renderer/**/*.test.ts', 'src/renderer/**/*.test.tsx'],
      setupFiles: ['./src/renderer/test-setup.ts'],
      css: false,
    },
  },
])
