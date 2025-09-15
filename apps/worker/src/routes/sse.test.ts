import { describe, it, expect, vi } from 'vitest'

vi.mock('../services/batching', () => ({
  enqueueForCorrection: vi.fn(async (_env: any, mode: 'quick' | 'enhanced', text: string) => {
    return mode === 'quick' ? `Q:${text}` : `E:${text}`
  }),
}))

import { stream } from './stream'

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
  } as unknown as KVNamespace
}

describe('SSE schema', () => {
  it('emits status, raw, quick, enhanced, done events', async () => {
    const id = 'job-sse-1'
    const JOB_STATE = createKV({
      [`JOB_STATE:${id}`]: {
        id,
        chunks: [
          { audioHash: 'a', transcription: { raw: 'hello' } },
          { audioHash: 'b', transcription: { raw: 'world' } },
        ],
      },
    })
    const env: any = {
      COMMUNITY_CACHE: createKV(),
      RESPONSE_CACHE: createKV(),
      QUOTA_COUNTERS: createKV(),
      JOB_STATE,
      R2_BUCKET: {} as any,
      DB: {} as any,
      AI: {} as any,
    }
    const res = await stream.request(`/api/transcribe/${id}/stream`, {}, env)
    expect(res.status).toBe(200)
    const txt = await res.text()
    expect(txt).toContain('event: status')
    expect(txt).toContain('event: raw')
    expect(txt).toContain('event: quick')
    expect(txt).toContain('event: enhanced')
    expect(txt).toContain('event: done')
  })
})

