import { Hono } from 'hono'
import type { Env } from '../index'

export const transcribe = new Hono<{ Bindings: Env }>()

// POST /api/transcribe/start
// Initializes a job state in KV and returns jobId
transcribe.post('/api/transcribe/start', async (c) => {
  const id = crypto.randomUUID()
  const now = new Date()
  const job = {
    id,
    status: 'uploading',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    chunks: [] as any[],
  }
  await c.env.JOB_STATE.put(`JOB_STATE:${id}`, JSON.stringify(job), {
    expirationTtl: 7 * 24 * 60 * 60,
  })
  return c.json({ id, status: job.status })
})

// POST /api/transcribe/:id/chunk (placeholder)
// Accepts metadata for a chunk and updates job state; real audio upload should use R2 signed upload in production
transcribe.post('/api/transcribe/:id/chunk', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body.audioHash !== 'string' || typeof body.text !== 'string') {
    return c.json({ error: 'Invalid payload' }, 400)
  }
  const key = `JOB_STATE:${id}`
  const raw = await c.env.JOB_STATE.get(key, 'json')
  const job = (raw && typeof raw === 'object' ? raw : {}) as any
  job.id = id
  job.status = 'transcribing'
  job.updatedAt = new Date().toISOString()
  job.chunks = Array.isArray(job.chunks) ? job.chunks : []
  const nextIndex =
    typeof body.index === 'number' && Number.isFinite(body.index) ? body.index : job.chunks.length
  const start = typeof body.startTime === 'number' ? body.startTime : undefined
  const end = typeof body.endTime === 'number' ? body.endTime : undefined
  const chunk = {
    index: nextIndex,
    audioHash: body.audioHash,
    startTime: start,
    endTime: end,
    transcription: {
      raw: String(body.text),
      final: String(body.text),
    },
  }
  job.chunks[nextIndex] = chunk
  await c.env.JOB_STATE.put(key, JSON.stringify(job), { expirationTtl: 7 * 24 * 60 * 60 })
  return c.json({ ok: true, count: job.chunks.length })
})
