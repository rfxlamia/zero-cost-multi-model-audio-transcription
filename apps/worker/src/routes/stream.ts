import { Hono } from 'hono'
import type { Env } from '../index'
import { enqueueForCorrection } from '../services/batching'
import { kvSemaphore } from '../utils/semaphore'

export const stream = new Hono<{ Bindings: Env }>()

// GET /api/transcribe/:id/stream
// Streams minimal SSE events following the agreed shape
stream.get('/api/transcribe/:id/stream', async (c) => {
  const id = c.req.param('id')
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const encoder = new TextEncoder()
  const toEvent = (type: string, data: any) => {
    return `event: ${type}\n` + `data: ${JSON.stringify(data)}\n\n`
  }

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const send = (type: string, data: any) => {
        controller.enqueue(encoder.encode(toEvent(type, data)))
      }
      try {
        send('status', { jobId: id, status: 'transcribing' })
        const key = `JOB_STATE:${id}`
        const raw = await c.env.JOB_STATE.get(key, 'json')
        const job = (raw && typeof raw === 'object' ? raw : {}) as any
        job.id = id
        job.chunks = Array.isArray(job.chunks) ? job.chunks : []
        const total = job.chunks.length
        send('status', { jobId: id, totalChunks: total })

        // 1) Emit RAW
        let rawDone = 0
        for (let i = 0; i < job.chunks.length; i++) {
          const ch = job.chunks[i]
          const rawText = ch?.transcription?.raw ?? ch?.raw
          if (rawText)
            send('raw', {
              chunkIndex: i,
              text: String(rawText),
              provider: 'asr',
              confidence: 0.7,
              tsRange: null,
            })
          rawDone++
          send('progress', { stage: 'raw', completed: rawDone, total })
        }

        // 2) QUICK corrections (batched via enqueue) with controlled KV writes
        const quickBatch: Promise<any>[] = []
        let quickDone = 0
        const FLUSH_COUNT = 10
        for (let i = 0; i < job.chunks.length; i++) {
          const ch = job.chunks[i]
          const rawText = ch?.transcription?.raw ?? ch?.raw
          const audioHash = ch?.audioHash
          if (!rawText || !audioHash) continue
          const p = enqueueForCorrection(c.env, 'quick', String(rawText), String(audioHash))
            .then(async (q) => {
              // update JOB_STATE with KV write cap
              await kvSemaphore.acquire()
              try {
                const stateRaw = await c.env.JOB_STATE.get(key, 'json')
                const state = (stateRaw && typeof stateRaw === 'object' ? stateRaw : {}) as any
                state.chunks = Array.isArray(state.chunks) ? state.chunks : []
                state.chunks[i] = state.chunks[i] || {}
                state.chunks[i].transcription = state.chunks[i].transcription || {}
                state.chunks[i].transcription.quick = q
                state.chunks[i].transcription.final = q
                state.updatedAt = new Date().toISOString()
                await c.env.JOB_STATE.put(key, JSON.stringify(state), {
                  expirationTtl: 7 * 24 * 60 * 60,
                })
              } finally {
                kvSemaphore.release()
              }
              send('quick', { chunkIndex: i, text: q, provider: 'router', confidence: 0.8 })
              quickDone++
              send('progress', { stage: 'quick', completed: quickDone, total })
            })
            .catch((e) => {
              console.warn('[sse] quick correction failed', e)
            })
          quickBatch.push(p)
          if (quickBatch.length >= FLUSH_COUNT) {
            await Promise.allSettled(quickBatch.splice(0, quickBatch.length))
          }
        }
        if (quickBatch.length) await Promise.allSettled(quickBatch)

        // 3) ENHANCED corrections
        const enhancedBatch: Promise<any>[] = []
        let enhancedDone = 0
        for (let i = 0; i < job.chunks.length; i++) {
          const ch = job.chunks[i]
          const baseText = ch?.transcription?.quick ?? ch?.transcription?.raw ?? ch?.raw
          const audioHash = ch?.audioHash
          if (!baseText || !audioHash) continue
          const p = enqueueForCorrection(c.env, 'enhanced', String(baseText), String(audioHash))
            .then(async (eText) => {
              await kvSemaphore.acquire()
              try {
                const stateRaw = await c.env.JOB_STATE.get(key, 'json')
                const state = (stateRaw && typeof stateRaw === 'object' ? stateRaw : {}) as any
                state.chunks = Array.isArray(state.chunks) ? state.chunks : []
                state.chunks[i] = state.chunks[i] || {}
                state.chunks[i].transcription = state.chunks[i].transcription || {}
                state.chunks[i].transcription.enhanced = eText
                state.chunks[i].transcription.final = eText
                state.updatedAt = new Date().toISOString()
                await c.env.JOB_STATE.put(key, JSON.stringify(state), {
                  expirationTtl: 7 * 24 * 60 * 60,
                })
              } finally {
                kvSemaphore.release()
              }
              send('enhanced', { chunkIndex: i, text: eText, provider: 'router', confidence: 0.85 })
              enhancedDone++
              send('progress', { stage: 'enhanced', completed: enhancedDone, total })
            })
            .catch((e) => {
              console.warn('[sse] enhanced correction failed', e)
            })
          enhancedBatch.push(p)
          if (enhancedBatch.length >= FLUSH_COUNT) {
            await Promise.allSettled(enhancedBatch.splice(0, enhancedBatch.length))
          }
        }
        if (enhancedBatch.length) await Promise.allSettled(enhancedBatch)

        send('done', { jobId: id })
      } catch (e) {
        send('error', { message: (e as any)?.message || 'SSE error' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers })
})
