import { Hono } from 'hono'
import type { Env } from '../index'

export const exp = new Hono<{ Bindings: Env }>()

const CHUNK_SECONDS = 30 // fallback if not present in job state

type JobChunk = any

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

function toSrtTime(sec: number) {
  const ms = Math.floor((sec % 1) * 1000)
  const s = Math.floor(sec) % 60
  const m = Math.floor(sec / 60) % 60
  const h = Math.floor(sec / 3600)
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, '0')}`
}

function toVttTime(sec: number) {
  const ms = Math.floor((sec % 1) * 1000)
  const s = Math.floor(sec) % 60
  const m = Math.floor(sec / 60) % 60
  const h = Math.floor(sec / 3600)
  return `${pad(h)}:${pad(m)}:${pad(s)}.${String(ms).padStart(3, '0')}`
}

function pickFinalText(ch: JobChunk): string {
  // Support both old and new shapes
  if (ch?.transcription) {
    return (
      ch.transcription.final ??
      ch.transcription.enhanced ??
      ch.transcription.quick ??
      ch.transcription.raw ??
      ''
    )
  }
  return ch?.final ?? ch?.enhanced ?? ch?.quick ?? ch?.raw ?? ''
}

function ensureNumber(v: any, fallback: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function deriveSegments(job: any) {
  const chunks: JobChunk[] = Array.isArray(job?.chunks) ? job.chunks : []
  const segs = chunks.map((ch: JobChunk, i: number) => {
    const start = ensureNumber(ch?.startTime, i * CHUNK_SECONDS)
    const end = ensureNumber(ch?.endTime, start + CHUNK_SECONDS)
    const text = String(pickFinalText(ch) || '')
    return { index: i, start, end, text }
  })
  return segs
}

function buildTxt(segs: { index: number; start: number; end: number; text: string }[]) {
  return segs.map((s) => s.text).join('\n')
}

function buildSrt(segs: { index: number; start: number; end: number; text: string }[]) {
  return segs
    .map((s, i) => `${i + 1}\n${toSrtTime(s.start)} --> ${toSrtTime(s.end)}\n${s.text}\n`)
    .join('\n')
}

function buildVtt(segs: { index: number; start: number; end: number; text: string }[]) {
  const header = 'WEBVTT\n\n'
  const body = segs.map((s) => `${toVttTime(s.start)} --> ${toVttTime(s.end)}\n${s.text}\n`).join('\n')
  return header + body
}

// GET /api/export/:id.:ext where ext in txt|srt|vtt|json
exp.get('/api/export/:file', async (c) => {
  const file = c.req.param('file') || ''
  const parts = file.split('.')
  const ext = (parts.pop() || '').toLowerCase()
  const id = parts.join('.')
  if (!['txt', 'srt', 'vtt', 'json'].includes(ext)) return c.text('Unsupported format', 400)

  const raw = await c.env.JOB_STATE.get(`JOB_STATE:${id}`, 'json')
  if (!raw || typeof raw !== 'object') return c.json({ error: 'Job not found' }, 404)
  const job: any = raw
  const segs = deriveSegments(job)
  if (!segs.length) return c.json({ error: 'No chunks to export' }, 400)

  const filename = `${id}.${ext}`
  if (ext === 'json') {
    const out = {
      id,
      createdAt: job?.createdAt ?? null,
      status: job?.status ?? null,
      segments: segs,
    }
    return c.newResponse(JSON.stringify(out, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  let content = ''
  let type = 'text/plain; charset=utf-8'
  if (ext === 'txt') {
    content = buildTxt(segs)
    type = 'text/plain; charset=utf-8'
  } else if (ext === 'srt') {
    content = buildSrt(segs)
    type = 'application/x-subrip; charset=utf-8'
  } else if (ext === 'vtt') {
    content = buildVtt(segs)
    type = 'text/vtt; charset=utf-8'
  }

  return c.newResponse(content, {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})
