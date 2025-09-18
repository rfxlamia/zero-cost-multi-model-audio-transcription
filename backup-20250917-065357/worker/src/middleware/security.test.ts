import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { securityMiddleware } from './security'
import type { Env } from '../index'

function createKV(initial: Record<string, any> = {}) {
  const store = new Map<string, any>(Object.entries(initial))
  return {
    get: async (key: string, type?: 'json' | 'text') => {
      const value = store.get(key)
      // eslint-disable-next-line eqeqeq
      if (value == null) return null
      if (type === 'json') return value
      return typeof value === 'string' ? value : JSON.stringify(value)
    },
    put: async (key: string, value: string) => {
      try {
        store.set(key, JSON.parse(value))
      } catch {
        store.set(key, value)
      }
    },
    delete: async (key: string) => {
      store.delete(key)
    },
  } as unknown as KVNamespace
}

describe('securityMiddleware', () => {
  const mockEnv = (): Env => ({
    COMMUNITY_CACHE: createKV(),
    RESPONSE_CACHE: createKV(),
    QUOTA_COUNTERS: createKV(),
    JOB_STATE: createKV(),
    R2_BUCKET: {} as any,
    DB: {} as any,
    AI: {} as any,
    APP_SECRET: 'test-secret',
  })

  it('sets anon cookie and allows initial request', async () => {
    const app = new Hono<{ Bindings: Env }>()
    app.use('/api/*', securityMiddleware)
    app.get('/api/ping', (c) => c.json({ ok: true }))

    const env = mockEnv()
    const res = await app.request(
      '/api/ping',
      {
        headers: {
          'cf-connecting-ip': '1.1.1.1',
        },
      },
      env
    )

    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie as string).toContain('__trans_uid')
  })

  it('applies per-user rate limiting', async () => {
    const app = new Hono<{ Bindings: Env }>()
    app.use('/api/*', securityMiddleware)
    app.get('/api/ping', (c) => c.json({ ok: true }))

    const env = mockEnv()
    let cookie = ''
    // initial request to capture cookie
    const first = await app.request(
      '/api/ping',
      {
        headers: {
          'cf-connecting-ip': '2.2.2.2',
        },
      },
      env
    )
    cookie = (first.headers.get('set-cookie') || '').split(';')[0]
    expect(first.status).toBe(200)
    expect(cookie).toContain('__trans_uid')

    // Hit user hourly limit (30 requests configured)
    for (let i = 0; i < 29; i++) {
      const ok = await app.request(
        '/api/ping',
        {
          headers: {
            cookie,
            'cf-connecting-ip': '2.2.2.2',
          },
        },
        env
      )
      expect(ok.status).toBe(200)
    }

    const limited = await app.request(
      '/api/ping',
      {
        headers: {
          cookie,
          'cf-connecting-ip': '2.2.2.2',
        },
      },
      env
    )

    expect(limited.status).toBe(429)
  })
})
