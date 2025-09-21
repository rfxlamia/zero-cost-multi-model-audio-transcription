import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = dirname(fileURLToPath(import.meta.url))
const sharedRoot = resolve(rootDir, 'packages/shared')
const workerSrc = resolve(rootDir, 'apps/worker/src')
const honoDistRoot = resolve(rootDir, 'apps/worker/node_modules/hono/dist')

export default defineConfig({
  resolve: {
    alias: {
      '@transcriptorai/shared': sharedRoot,
      '@worker': workerSrc,
      hono: resolve(honoDistRoot, 'index.js'),
      'hono/cors': resolve(honoDistRoot, 'middleware/cors/index.js'),
      'hono/cookie': resolve(honoDistRoot, 'helper/cookie/index.js'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
      'apps/worker/src/**/*.test.ts',
      'packages/shared/src/**/*.test.ts',
    ],
    exclude: [
      'tests/e2e/**',
      '**/backup-*/**',
      'apps/web/.next/**',
      '**/.next/**',
      '**/node_modules/**',
    ],
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1,
      },
    },
    coverage: {
      reporter: ['text', 'lcov'],
    },
    setupFiles: ['tests/vitest.setup.ts'],
    server: {
      deps: {
        inline: ['hono'],
      },
    },
  },
})
