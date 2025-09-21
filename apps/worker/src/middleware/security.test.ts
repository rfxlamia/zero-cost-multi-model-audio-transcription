import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { securityMiddleware } from './security'
import type { MockEnv } from '../types/test-helpers'
import type { Env } from '../index'
import type { KVNamespace as CloudflareKVNamespace } from '@cloudflare/workers-types'

type KvValue = Record<string, unknown> | string | null

function createKV(initial: Record<string, KvValue> = {}) {
  const store = new Map<string, KvValue>(Object.entries(initial))
  return {
    async get(key: string, typeOrOptions?: any) {
      const value = store.get(key)
      if (value === undefined || value === null) return null
      if (typeOrOptions === 'json' || typeOrOptions?.type === 'json') {
        if (typeof value === 'string') {
          try {
            return JSON.parse(value)
          } catch {
            return value
          }
        }
        return value
      }
      const payload = typeof value === 'string' ? value : JSON.stringify(value)
      if (typeOrOptions === 'arrayBuffer') {
        return new TextEncoder().encode(payload).buffer
      }
      if (typeOrOptions === 'stream') {
        const encoder = new TextEncoder()
        return new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(payload))
            controller.close()
          },
        })
      }
      return payload
    },
    async put(key: string, value: any) {
      if (value instanceof ArrayBuffer) {
        const decoded = new TextDecoder().decode(new Uint8Array(value))
        try {
          store.set(key, JSON.parse(decoded))
          return
        } catch {
          store.set(key, decoded)
          return
        }
      }
      if (typeof value === 'string') {
        try {
          store.set(key, JSON.parse(value))
        } catch {
          store.set(key, value)
        }
        return
      }
      store.set(key, value)
    },
    async delete(key: string) {
      store.delete(key)
    },
    async list() {
      return {
        keys: Array.from(store.keys()).map((name) => ({ name })),
        list_complete: true,
      }
    },
  } as unknown as CloudflareKVNamespace
}

describe('securityMiddleware', () => {
  const mockEnv = (): MockEnv => ({
    COMMUNITY_CACHE: createKV(),
    RESPONSE_CACHE: createKV(),
    QUOTA_COUNTERS: createKV(),
    JOB_STATE: createKV(),
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
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin')
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
    expect(limited.headers.get('content-security-policy')).toContain('connect-src')
  })
})
