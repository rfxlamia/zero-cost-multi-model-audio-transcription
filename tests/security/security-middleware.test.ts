import { describe, expect, it, vi } from 'vitest'

vi.mock('@transcriptorai/shared/constants', () => ({
  RATE_LIMITS: {
    IP: {
      HOUR_WINDOW_SEC: 60,
      HOUR_MAX: 1,
      DAY_WINDOW_SEC: 60,
      DAY_MAX: 1,
    },
    USER: {
      HOUR_WINDOW_SEC: 60,
      HOUR_MAX: 1,
      DAY_WINDOW_SEC: 60,
      DAY_MAX: 1,
    },
  },
}))

import { Hono } from 'hono'
import { securityMiddleware } from '@worker/middleware/security'
import type { Env } from '@worker/index'

const createKv = () => {
  const store = new Map<string, string>()
  return {
    namespace: {
      async get(key: string, type?: 'text' | 'json') {
        const value = store.get(key)
        if (value === undefined) return null
        if (type === 'json') {
          try {
            return JSON.parse(value)
          } catch {
            return value
          }
        }
        return value
      },
      async put(key: string, value: string) {
        store.set(key, value)
      },
      async delete(key: string) {
        store.delete(key)
      },
      async list() {
        return { keys: Array.from(store.keys()).map((name) => ({ name })), list_complete: true }
      },
    } as unknown as KVNamespace,
    store,
  }
}

const createEnv = () => {
  const kv = createKv()
  const env: Env = {
    COMMUNITY_CACHE: kv.namespace,
    RESPONSE_CACHE: kv.namespace,
    QUOTA_COUNTERS: kv.namespace,
    JOB_STATE: kv.namespace,
    R2_BUCKET: {
      async list() {
        return { objects: [] }
      },
    } as any,
    DB: {
      prepare() {
        return {
          all: async () => ({ results: [{ ok: 1 }] }),
        }
      },
    } as any,
    AI: {} as any,
    APP_SECRET: 'test-secret',
    GROQ_API_KEY: 'stub',
    HF_API_TOKEN: 'stub',
    TURNSTILE_SECRET: 'stub',
  }
  return { env, kv }
}

describe('securityMiddleware', () => {
  it('applies security headers and allows initial request', async () => {
    const { env } = createEnv()
    const app = new Hono<{ Bindings: Env }>()
    app.use('*', securityMiddleware)
    app.get('/secure', (c) => c.text('ok'))

    const res = await app.fetch(
      new Request('https://test.dev/secure', {
        headers: { 'cf-connecting-ip': '1.1.1.1' },
      }),
      env
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'")
    expect(res.headers.get('Set-Cookie')).toContain('__trans_uid=')
  })

  it('blocks subsequent request when rate limit exceeded', async () => {
    const { env } = createEnv()
    const app = new Hono<{ Bindings: Env }>()
    app.use('*', securityMiddleware)
    app.get('/secure', (c) => c.text('ok'))

    const first = await app.fetch(
      new Request('https://test.dev/secure', {
        headers: { 'cf-connecting-ip': '9.9.9.9' },
      }),
      env
    )
    expect(first.status).toBe(200)

    const second = await app.fetch(
      new Request('https://test.dev/secure', {
        headers: { 'cf-connecting-ip': '9.9.9.9' },
      }),
      env
    )
    expect(second.status).toBe(429)
    const body = await second.json()
    expect(body.error).toBe('rate_limit_exceeded')
  })

  it('skips global rate limit for metrics endpoint', async () => {
    const { env } = createEnv()
    const app = new Hono<{ Bindings: Env }>()
    app.use('*', securityMiddleware)
    app.get('/api/metrics', (c) => c.text('metrics'))

    const first = await app.fetch(
      new Request('https://test.dev/api/metrics?fresh=1', {
        headers: { 'cf-connecting-ip': '5.5.5.5' },
      }),
      env
    )
    expect(first.status).toBe(200)

    const second = await app.fetch(
      new Request('https://test.dev/api/metrics?fresh=1', {
        headers: { 'cf-connecting-ip': '5.5.5.5' },
      }),
      env
    )

    expect(second.status).toBe(200)
  })
})
