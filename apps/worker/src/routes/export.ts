import { Hono } from 'hono'
import type { Env } from '../index'
import {
  EXPORT_DEFAULTS,
  getExportSegments,
  segmentsToSrt,
  segmentsToTxt,
  segmentsToVtt,
  type ExportChunkLike,
} from '@transcriptorai/shared/utils'

export const exp = new Hono<{ Bindings: Env }>()

const SUPPORTED_FORMATS = new Set(['txt', 'srt', 'vtt', 'json'])

const buildAttachmentHeaders = (filename: string, contentType: string) => ({
  'Content-Type': contentType,
  'Content-Disposition': `attachment; filename="${filename}"`,
})

const deriveSegments = (job: { chunks?: ExportChunkLike[] }) =>
  getExportSegments(job, {
    chunkSeconds: EXPORT_DEFAULTS.CHUNK_SECONDS,
    toleranceSeconds: EXPORT_DEFAULTS.TOLERANCE_SECONDS,
    mergeThresholdSeconds: EXPORT_DEFAULTS.MERGE_THRESHOLD_SECONDS,
    minDurationSeconds: EXPORT_DEFAULTS.MIN_SEGMENT_DURATION_SECONDS,
  })

// GET /api/export/:id.:ext where ext in txt|srt|vtt|json
exp.get('/api/export/:file', async (c) => {
  const file = c.req.param('file') || ''
  const parts = file.split('.')
  const ext = (parts.pop() || '').toLowerCase()
  const id = parts.join('.')
  if (!SUPPORTED_FORMATS.has(ext)) return c.text('Unsupported format', 400)

  const raw = await c.env.JOB_STATE.get(`JOB_STATE:${id}`, 'json')
  if (!raw || typeof raw !== 'object') return c.json({ error: 'Job not found' }, 404)
  const job = raw as { chunks?: ExportChunkLike[]; createdAt?: string; status?: string }
  const segments = deriveSegments(job)
  if (!segments.length) return c.json({ error: 'No chunks to export' }, 400)

  const filename = `${id}.${ext}`
  if (ext === 'json') {
    const body = JSON.stringify(
      {
        id,
        createdAt: job?.createdAt ?? null,
        status: job?.status ?? null,
        segments,
      },
      null,
      2
    )
    return c.newResponse(body, {
      headers: buildAttachmentHeaders(filename, 'application/json; charset=utf-8'),
    })
  }

  if (ext === 'txt') {
    const content = segmentsToTxt(segments)
    return c.newResponse(content, {
      headers: buildAttachmentHeaders(filename, 'text/plain; charset=utf-8'),
    })
  }

  if (ext === 'srt') {
    const content = segmentsToSrt(segments)
    return c.newResponse(content, {
      headers: buildAttachmentHeaders(filename, 'application/x-subrip; charset=utf-8'),
    })
  }

  const content = segmentsToVtt(segments)
  return c.newResponse(content, {
    headers: buildAttachmentHeaders(filename, 'text/vtt; charset=utf-8'),
  })
})
