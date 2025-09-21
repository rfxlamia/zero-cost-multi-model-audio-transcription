import { beforeEach, describe, expect, it, vi } from 'vitest'
import app, { type Env } from '@worker/index'
import { enqueueForCorrection } from '@worker/services/batching'

vi.mock('@worker/services/batching', async () => {
  const actual = await vi.importActual<typeof import('@worker/services/batching')>(
    '@worker/services/batching'
  )
  return {
    ...actual,
    enqueueForCorrection: vi.fn(),
  }
})

const createKvSpy = () => {
  const store = new Map<string, any>()
  const puts: { key: string; value: string }[] = []
  const namespace = {
    async get(key: string, type?: 'text' | 'json' | 'stream') {
      if (!store.has(key)) return null
      const value = store.get(key)
      if (type === 'json') return value
      return typeof value === 'string' ? value : JSON.stringify(value)
    },
    async put(key: string, value: string) {
      puts.push({ key, value })
      store.set(key, value)
    },
    async delete(key: string) {
      store.delete(key)
    },
    async list() {
      return { keys: Array.from(store.keys()).map((name) => ({ name })), list_complete: true }
    },
  }
  return { namespace: namespace as unknown as KVNamespace, puts, store }
}

const createEnv = (): { env: Env; spies: { response: ReturnType<typeof createKvSpy> } } => {
  const response = createKvSpy()
  const stubKv = createKvSpy()
  const env: Env = {
    COMMUNITY_CACHE: stubKv.namespace,
    RESPONSE_CACHE: response.namespace,
    QUOTA_COUNTERS: stubKv.namespace,
    JOB_STATE: stubKv.namespace,
    R2_BUCKET: {} as any,
    DB: {} as any,
    AI: {} as any,
    GROQ_API_KEY: 'stub-groq',
    HF_API_TOKEN: 'stub-hf',
    APP_SECRET: 'test-secret',
    TURNSTILE_SECRET: 'test-turnstile',
  }
  return { env, spies: { response } }
}

const enqueueMock = vi.mocked(enqueueForCorrection)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/correct/batch faithfulness guard', () => {
  it('accepts corrections that stay faithful and caches result', async () => {
    enqueueMock.mockResolvedValueOnce(
      'hari ini kita belajar jaringan saraf tiruan yang sangat canggih sekali mentor'
    )

    const { env, spies } = createEnv()

    const response = await app.fetch(
      new Request('https://test.dev/api/correct/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          segments: [
            {
              audioHash: 'hash-1',
              text: 'hari ini kita belajar jaringan saraf tiruan yang sangat canggih sekali',
              mode: 'quick',
            },
          ],
        }),
      }),
      env
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.provider).toBe('router')
    expect(payload.results[0].corrected).toContain('mentor')
    expect(payload.results[0].faithfulness.accepted).toBe(true)
    expect(payload.results[0].faithfulness.score).toBeGreaterThan(0.88)
    expect(spies.response.puts).toHaveLength(1)
  })

  it('falls back to original text when hallucination detected', async () => {
    enqueueMock.mockResolvedValueOnce(
      'hasil rapat menyebutkan anggaran baru siap cair kemudian pemerintah rahasia mendanai proyek misil eksperimental super cepat tanpa sepengetahuan publik'
    )

    const { env, spies } = createEnv()

    const response = await app.fetch(
      new Request('https://test.dev/api/correct/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          segments: [
            {
              audioHash: 'hash-2',
              text: 'hasil rapat menyebutkan anggaran baru siap cair untuk program pendidikan nasional',
              mode: 'enhanced',
            },
          ],
        }),
      }),
      env
    )

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.results[0].corrected).toBe(
      'hasil rapat menyebutkan anggaran baru siap cair untuk program pendidikan nasional'
    )
    expect(payload.results[0].faithfulness.accepted).toBe(false)
    expect(payload.results[0].faithfulness.novelPhrases[0]).toContain('pemerintah rahasia')
    expect(payload.results[0].confidence).toBeLessThan(0.85)
    expect(spies.response.puts).toHaveLength(0)
  })
})
