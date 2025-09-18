import { Hono } from 'hono'
import {
  CHUNK_DURATION_SECONDS,
  MAX_AUDIO_DURATION_MINUTES,
  MAX_FILE_SIZE_MB,
} from '@transcriptorai/shared/constants'
import type { Env } from '../index'
import { verifyTurnstileToken } from '../utils/turnstile'

export const transcribe = new Hono<{ Bindings: Env }>()

// POST /api/transcribe/start
// Initializes a job state in KV and returns jobId
transcribe.post('/api/transcribe/start', async (c) => {
  const payload = (await c.req.json().catch(() => null)) as {
    sizeBytes?: number
    durationSeconds?: number
    source?: string
    turnstileToken?: string
  } | null

  const requestToken =
    (typeof payload?.turnstileToken === 'string' && payload.turnstileToken) ||
    c.req.header('cf-turnstile-token') ||
    undefined
  if (c.env.TURNSTILE_SECRET) {
    if (!requestToken) {
      return c.json({ error: 'turnstile_required' }, 403)
    }
    const remoteIp = c.req.header('cf-connecting-ip') || undefined
    const verification = await verifyTurnstileToken(c.env.TURNSTILE_SECRET, requestToken, remoteIp)
    if (!verification.success) {
      console.warn('[turnstile] verification failed', { errors: verification.errors })
      return c.json({ error: 'turnstile_failed', codes: verification.errors }, 403)
    }
  }

  const sizeBytes =
    typeof payload?.sizeBytes === 'number' && payload.sizeBytes > 0 ? payload.sizeBytes : null
  const durationSeconds =
    typeof payload?.durationSeconds === 'number' && payload.durationSeconds > 0
      ? payload.durationSeconds
      : null
  const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024
  const maxDurationSeconds = MAX_AUDIO_DURATION_MINUTES * 60

  if (sizeBytes && sizeBytes > maxBytes) {
    return c.json(
      {
        error: 'file_too_large',
        limitBytes: maxBytes,
      },
      413
    )
  }

  if (durationSeconds && durationSeconds > maxDurationSeconds) {
    return c.json(
      {
        error: 'duration_too_long',
        limitSeconds: maxDurationSeconds,
      },
      413
    )
  }

  const id = crypto.randomUUID()
  const now = new Date()
  const job = {
    id,
    userId: c.get('anonUserId') ?? 'anonymous',
    status: 'uploading',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    chunks: [] as any[],
    meta: {
      sizeBytes,
      durationSeconds,
      source: payload?.source ?? 'unknown',
    },
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
    return c.json({ error: 'invalid_payload' }, 400)
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
  const duration = typeof start === 'number' && typeof end === 'number' ? end - start : null
  if (duration && duration > CHUNK_DURATION_SECONDS + 1) {
    return c.json(
      {
        error: 'chunk_duration_exceeded',
        limitSeconds: CHUNK_DURATION_SECONDS,
      },
      400
    )
  }
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
