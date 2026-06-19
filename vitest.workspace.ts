import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    test: {
      name: 'main',
      environment: 'node',
      include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts']
    }
  },
  {
    test: {
      name: 'renderer',
      environment: 'jsdom',
      include: ['src/renderer/**/*.test.ts', 'src/renderer/**/*.test.tsx'],
      setupFiles: ['./src/renderer/test-setup.ts']
    }
  }
])
