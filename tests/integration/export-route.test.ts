import { describe, expect, it } from 'vitest'
import app, { type Env } from '@worker/index'

const kvFromRecord = (records: Record<string, any> = {}): KVNamespace => ({
  async get(key: string, type?: 'text' | 'json' | 'stream') {
    if (!(key in records)) return null
    const value = records[key]
    if (type === 'json') return value
    if (typeof value === 'string') return value
    return JSON.stringify(value)
  },
  async put(key: string, value: string) {
    records[key] = value
  },
  async delete(key: string) {
    delete records[key]
  },
  async list() {
    return { keys: Object.keys(records).map((name) => ({ name })), list_complete: true }
  },
}) as unknown as KVNamespace

const createEnv = (jobId: string, jobData?: any): Env => ({
  COMMUNITY_CACHE: kvFromRecord(),
  RESPONSE_CACHE: kvFromRecord(),
  QUOTA_COUNTERS: kvFromRecord(),
  JOB_STATE: kvFromRecord(jobData ? { [`JOB_STATE:${jobId}`]: jobData } : {}),
  R2_BUCKET: {} as any,
  DB: {} as any,
  AI: {} as any,
  GROQ_API_KEY: 'stub',
  HF_API_TOKEN: 'stub',
  APP_SECRET: 'test-secret',
  TURNSTILE_SECRET: 'test-turnstile',
})

describe('GET /api/export/:id', () => {
  it('returns SRT export with merged monotonic segments', async () => {
    const jobId = 'job-123'
    const env = createEnv(jobId, {
      chunks: [
        { index: 0, startTime: 0, endTime: 29.4, transcription: { final: 'halo dunia' } },
        { index: 1, startTime: 29.9, endTime: 60.1, transcription: { final: 'ini baris kedua' } },
        { index: 2, startTime: 60.05, endTime: 89.6, transcription: { final: 'baris ketiga' } },
      ],
      status: 'done',
    })

    const response = await app.fetch(
      new Request(`https://test.dev/api/export/${jobId}.srt`),
      env
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/x-subrip')
    const body = await response.text()
    const entries = body.trim().split('\n\n')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toContain('halo dunia')
    expect(entries[0]).toContain('ini baris kedua')
    const timestamps = entries.map((entry) => entry.split('\n')[1]?.split(' --> '))
    const endTimes = timestamps.map(([, end]) => end)
    expect(endTimes[0]).toBe('00:01:00,100')
    expect(timestamps.every((pair) => pair && pair.length === 2)).toBe(true)
  })

  it('rejects unsupported format', async () => {
    const response = await app.fetch(
      new Request('https://test.dev/api/export/demo.docx'),
      createEnv('demo')
    )
    expect(response.status).toBe(400)
  })

  it('returns 404 when job is missing', async () => {
    const response = await app.fetch(
      new Request('https://test.dev/api/export/ghost.srt'),
      createEnv('ghost')
    )
    expect(response.status).toBe(404)
  })
})
