import { Hono } from 'hono'
import type { Env } from '../index'
import { sumopodTranscribe } from '../providers/sumopod'
import { kvSemaphore } from '../utils/semaphore'

interface JobChunk {
  index: number
  audioHash?: string
  startTime?: number
  endTime?: number
  transcription?: {
    raw?: string
    final?: string
    confidence?: number
  }
}

interface JobState {
  id: string
  status: string
  updatedAt: string
  chunks: JobChunk[]
}

export const asr = new Hono<{ Bindings: Env }>()

// POST /api/transcribe/:id/asr/sumopod
// Accepts multipart/form-data { file, language?, index?, startTime?, endTime?, audioHash? }
// Calls SumoPod whisper-1 and persists RAW transcript into JOB_STATE
asr.post('/api/transcribe/:id/asr/sumopod', async (c) => {
  const disabled = c.env.DISABLE_SUMOPOD === '1' || c.env.DISABLE_SUMOPOD === true
  if (disabled) return c.json({ error: 'sumopod_disabled' }, 503)
  if (!c.env.SUMOPOD_API_KEY) return c.json({ error: 'missing_api_key' }, 503)

  const id = c.req.param('id')
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return c.json({ error: 'invalid_form' }, 400)
  }

  const file = form.get('file')
  if (!(file instanceof Blob)) return c.json({ error: 'missing_file' }, 400)
  const language = typeof form.get('language') === 'string' ? String(form.get('language')) : 'id'
  const indexRaw = form.get('index')
  const index = typeof indexRaw === 'string' && /^\d+$/.test(indexRaw) ? Number(indexRaw) : undefined
  const startTime = (() => {
    const v = form.get('startTime')
    const n = typeof v === 'string' ? Number(v) : NaN
    return Number.isFinite(n) ? n : undefined
  })()
  const endTime = (() => {
    const v = form.get('endTime')
    const n = typeof v === 'string' ? Number(v) : NaN
    return Number.isFinite(n) ? n : undefined
  })()
  const audioHash = typeof form.get('audioHash') === 'string' ? String(form.get('audioHash')) : undefined

  try {
    const text = await sumopodTranscribe(c.env, file, {
      language,
      responseFormat: 'text',
      contentType: file.type || 'audio/webm',
      timeoutMs: 60_000,
    })

    const key = `JOB_STATE:${id}`
    const raw = await c.env.JOB_STATE.get(key, 'json')
    const job = (raw && typeof raw === 'object' ? (raw as Partial<JobState>) : ({} as Partial<JobState>))
    job.id = id
    job.status = 'transcribing'
    job.updatedAt = new Date().toISOString()
    job.chunks = Array.isArray(job.chunks) ? job.chunks : []
    const nextIndex = typeof index === 'number' ? index : job.chunks.length
    const prev = job.chunks[nextIndex] as JobChunk | undefined
    const target: JobChunk = prev && typeof prev === 'object' ? prev : { index: nextIndex }
    target.index = nextIndex
    target.audioHash = audioHash || target.audioHash || `job:${id}:idx:${nextIndex}`
    target.startTime = startTime
    target.endTime = endTime
    target.transcription = target.transcription || {}
    target.transcription.raw = String(text)
    target.transcription.final = String(text)
    target.transcription.confidence = 0.7

    await kvSemaphore.acquire()
    try {
      job.chunks[nextIndex] = target
      await c.env.JOB_STATE.put(key, JSON.stringify(job), { expirationTtl: 7 * 24 * 60 * 60 })
    } finally {
      kvSemaphore.release()
    }

    return c.json({ ok: true, text, provider: 'sumopod', index: nextIndex })
  } catch (e) {
    const msg = (e as any)?.message || 'sumopod_error'
    return c.json({ error: msg }, 502)
  }
})

// Lightweight endpoint to test SumoPod connectivity without persisting
// POST /api/asr/sumopod
asr.post('/api/asr/sumopod', async (c) => {
  const disabled = c.env.DISABLE_SUMOPOD === '1' || c.env.DISABLE_SUMOPOD === true
  if (disabled) return c.json({ error: 'sumopod_disabled' }, 503)
  if (!c.env.SUMOPOD_API_KEY) return c.json({ error: 'missing_api_key' }, 503)
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return c.json({ error: 'invalid_form' }, 400)
  }
  const file = form.get('file')
  if (!(file instanceof Blob)) return c.json({ error: 'missing_file' }, 400)
  const language = typeof form.get('language') === 'string' ? String(form.get('language')) : 'id'
  try {
    const text = await sumopodTranscribe(c.env, file, {
      language,
      responseFormat: 'text',
      contentType: file.type || 'audio/webm',
      timeoutMs: 60_000,
    })
    return c.json({ ok: true, text, provider: 'sumopod' })
  } catch (e) {
    const msg = (e as any)?.message || 'sumopod_error'
    return c.json({ error: msg }, 502)
  }
})
