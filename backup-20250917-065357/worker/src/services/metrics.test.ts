import { describe, it, expect } from 'vitest'
import { recordProviderLatency, getProviderLatency } from './metrics'

function createKV(initial: Record<string, any> = {}) {
  const store = new Map<string, any>(Object.entries(initial))
  return {
    get: async (key: string, type?: 'json' | 'text') => {
      const v = store.get(key)
      // eslint-disable-next-line eqeqeq
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
  } as unknown as KVNamespace
}

describe('metrics latency recorder', () => {
  it('aggregates latency stats per provider', async () => {
    const kv = createKV()
    const env: any = { QUOTA_COUNTERS: kv }
    await recordProviderLatency(env, 'groq', 100)
    await recordProviderLatency(env, 'groq', 200)
    const latency = await getProviderLatency(env, 'groq')
    expect(latency.count).toBe(2)
    expect(latency.minMs).toBe(100)
    expect(latency.maxMs).toBe(200)
    expect(latency.averageMs).toBeCloseTo(150, 5)
  })
})
