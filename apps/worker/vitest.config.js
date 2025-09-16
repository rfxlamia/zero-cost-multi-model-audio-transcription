import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const sharedRoot = fileURLToPath(new URL('../../packages/shared', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@transcriptorai/shared': sharedRoot,
    },
  },
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1,
      },
    },
  },
})
