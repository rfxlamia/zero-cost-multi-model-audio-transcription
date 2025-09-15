import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../providers/groq', () => ({
  groqCorrectBatch: vi.fn(async () => {
    throw new Error('Groq down')
  }),
}))

vi.mock('../providers/huggingface', () => ({
  hfCorrectBatch: vi.fn(async (_env: any, texts: string[]) => texts.map((t) => `HF:${t}`)),
}))

import { correctTextsWithFallback } from './router'

function createKV(initial: Record<string, any> = {}) {
  const store = new Map<string, any>(Object.entries(initial))
  return {
    get: async (key: string, type?: 'json' | 'text') => {
      const v = store.get(key)
      if (v == null) return null
      if (type === 'json') return v
      return typeof v === 'string' ? v : JSON.stringify(v)
    },
    put: async (key: string, value: string) => {
      try {
        store.set(key, JSON.parse(value))
      } catch {
        store.set(key, value)
      }
    },
    delete: async (key: string) => store.delete(key),
    _dump: () => store,
  } as unknown as KVNamespace
}

function dayKey() {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${dd}`
}

describe('router fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns none when all providers disabled or missing keys', async () => {
    const env: any = {
      QUOTA_COUNTERS: createKV(),
      DISABLE_GROQ: '1',
      DISABLE_HF: '1',
      GROQ_API_KEY: undefined,
      HF_API_TOKEN: undefined,
    }
    const { provider, texts } = await correctTextsWithFallback(env, ['a', 'b'], 'quick')
    expect(provider).toBe('none')
    expect(texts).toEqual(['a', 'b'])
  })

  it('falls back to HF when Groq fails', async () => {
    const kv = createKV()
    const env: any = {
      QUOTA_COUNTERS: kv,
      GROQ_API_KEY: 'x',
      HF_API_TOKEN: 'y',
    }
    const { provider, texts } = await correctTextsWithFallback(env, ['hello'], 'quick')
    expect(provider).toBe('huggingface')
    expect(texts[0]).toBe('HF:hello')
    const d = dayKey()
    const hfDoc = await kv.get(`QUOTA_COUNTERS:huggingface:day:${d}`, 'json')
    expect((hfDoc as any)?.used).toBeGreaterThanOrEqual(1)
  })

  it('skips provider near limit (preemptive switch)', async () => {
    const d = dayKey()
    const kv = createKV({ [`QUOTA_COUNTERS:groq:day:${d}`]: { used: 14400, limit: 14400 } })
    const env: any = {
      QUOTA_COUNTERS: kv,
      GROQ_API_KEY: 'x',
      HF_API_TOKEN: 'y',
    }
    const { provider } = await correctTextsWithFallback(env, ['z'], 'quick')
    expect(provider).toBe('huggingface')
  })
})

