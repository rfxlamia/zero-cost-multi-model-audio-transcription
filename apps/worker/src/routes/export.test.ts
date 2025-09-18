import { describe, it, expect } from 'vitest'
import { exp } from './export'
import app from '../index'
import type { Env } from '../index'

type KvValue = Record<string, unknown> | string | null

function createKV(initial: Record<string, KvValue> = {}) {
  const store = new Map<string, KvValue>(Object.entries(initial))
  return {
    get: async (key: string, type?: 'json' | 'text' | 'arrayBuffer' | 'stream') => {
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
    delete: async (key: string) => {
      store.delete(key)
    },
  } as unknown as KVNamespace
}

type Transcript = {
  raw?: string
  quick?: string
  enhanced?: string
  final?: string
}

type JobChunk = {
  startTime?: number
  endTime?: number
  transcription?: Transcript
}

type JobState = {
  id: string
  createdAt?: string
  status?: string
  chunks: JobChunk[]
}

type JobStateMap = Record<string, JobState>

function makeEnv(overrides: Partial<Env> = {}, jobMap: JobStateMap = {}): Env {
  const nullKV = createKV()
  return {
    COMMUNITY_CACHE: nullKV,
    RESPONSE_CACHE: nullKV,
    QUOTA_COUNTERS: nullKV,
    JOB_STATE: createKV(jobMap),
    R2_BUCKET: {} as never,
    DB: {} as never,
    AI: {} as never,
    GROQ_API_KEY: undefined,
    HF_API_TOKEN: undefined,
    ORIGIN_WHITELIST: 'http://localhost:3000',
    LOG_LEVEL: 'info',
    DISABLE_GROQ: undefined,
    DISABLE_HF: undefined,
    ...(overrides as Partial<Env>),
  } as Env
}

describe('export route', () => {
  it('exports SRT with provided timestamps and final text', async () => {
    const id = 'job-1'
    const job = {
      id,
      createdAt: '2025-09-14T00:00:00Z',
      status: 'done',
      chunks: [
        {
          startTime: 0,
          endTime: 30,
          transcription: { raw: 'r0', quick: 'q0', enhanced: 'e0', final: 'e0' },
        },
        {
          startTime: 30,
          endTime: 60,
          transcription: { raw: 'r1', quick: 'q1', enhanced: 'e1', final: 'e1' },
        },
      ],
    }
    const env = makeEnv({}, { [`JOB_STATE:${id}`]: job })
    const res = await exp.request(`/api/export/${id}.srt`, {}, env)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/x-subrip; charset=utf-8')
    expect(res.headers.get('content-disposition')).toContain(`filename="${id}.srt"`)
    const body = await res.text()
    expect(body).toContain('1\n00:00:00,000 --> 00:00:30,000\n')
    expect(body).toContain('e0')
    expect(body).toContain('2\n00:00:30,000 --> 00:01:00,000\n')
    expect(body).toContain('e1')
  })

  it('exports VTT with header and merges tight gaps', async () => {
    const id = 'job-2'
    const job = {
      id,
      chunks: [
        { startTime: 0, endTime: 29.8, transcription: { final: 'hello there' } },
        { startTime: 30.05, endTime: 59.7, transcription: { final: 'general kenobi' } },
      ],
    }
    const env = makeEnv({}, { [`JOB_STATE:${id}`]: job })
    const res = await exp.request(`/api/export/${id}.vtt`, {}, env)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/vtt; charset=utf-8')
    const body = await res.text()
    expect(body.startsWith('WEBVTT')).toBe(true)
    expect(body.match(/--> /g)?.length).toBe(1) // merged because gap <= tolerance
    expect(body).toContain('00:00:00.000 --> 00:00:59.700')
    expect(body).toContain('hello there')
    expect(body).toContain('general kenobi')
  })

  it('falls back to derived timestamps when not present', async () => {
    const id = 'job-3'
    const job = {
      id,
      chunks: [{ transcription: { final: 'A' } }, { transcription: { final: 'B' } }],
    }
    const env = makeEnv({}, { [`JOB_STATE:${id}`]: job })
    const res = await exp.request(`/api/export/${id}.srt`, {}, env)
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('00:00:00,000 --> 00:00:30,000')
    expect(body).toContain('A')
    expect(body).toContain('00:00:30,000 --> 00:01:00,000')
    expect(body).toContain('B')
  })

  it('returns json payload with metadata and segments', async () => {
    const id = 'job-4'
    const job = {
      id,
      createdAt: '2025-09-14T00:00:00Z',
      status: 'enhancing',
      chunks: [{ startTime: 0, endTime: 30.1, transcription: { final: 'foo' } }],
    }
    const env = makeEnv({}, { [`JOB_STATE:${id}`]: job })
    const res = await exp.request(`/api/export/${id}.json`, {}, env)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8')
    const body = (await res.json()) as any
    expect(body.id).toBe(id)
    expect(body.status).toBe('enhancing')
    expect(body.segments.length).toBe(1)
    expect(body.segments[0].start).toBeLessThanOrEqual(0.5)
    expect(body.segments[0].end).toBeGreaterThan(29)
  })

  it('returns 404 for missing job', async () => {
    const env = makeEnv()
    const res = await exp.request(`/api/export/unknown.txt`, {}, env)
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid extension', async () => {
    const env = makeEnv()
    const res = await exp.request(`/api/export/whatever.pdf`, {}, env)
    expect(res.status).toBe(400)
    const text = await res.text()
    expect(text).toContain('Unsupported format')
  })

  it('returns 400 when ext is absent (trailing dot)', async () => {
    const env = makeEnv()
    const res = await exp.request(`/api/export/job123.`, {}, env)
    expect(res.status).toBe(400)
  })
})

describe('regression - root route', () => {
  it('serves orchestrator root text', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    const txt = await res.text()
    expect(txt).toContain('TranscriptorAI Worker orchestrator')
  })
})
