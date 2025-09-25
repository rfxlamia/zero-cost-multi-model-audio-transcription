import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const sharedRoot = fileURLToPath(new URL('../../packages/shared', import.meta.url))
const workerSrc = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@transcriptorai/shared': sharedRoot,
      '@worker': workerSrc,
    },
  },
  test: {
    include: [
      'src/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      '../../tests/**/*.{test,spec}.?(c|m)[jt]s?(x)',
    ],
    env: {
      NODE_ENV: 'test',
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1,
      },
    },
  },
})
