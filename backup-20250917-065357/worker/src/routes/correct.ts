import { Hono } from 'hono'
import type { Env } from '../index'
import type { BatchCorrectionResponse, CorrectionSegment } from '../types'
// import { correctTextsWithFallback } from '../services/router' // Using batching service instead
import { enqueueForCorrection } from '../services/batching'
import { getCachedText, setResponseCache } from '../utils/cache'

export const correct = new Hono<{ Bindings: Env }>()

// POST /api/correct/batch
correct.post('/api/correct/batch', async (c) => {
  try {
    const body = (await c.req.json().catch(() => null)) as unknown

    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid payload: expected { segments: [...] }' }, 400)
    }

    const request = body as Record<string, unknown>
    if (!Array.isArray(request.segments)) {
      return c.json({ error: 'Invalid payload: expected { segments: [...] }' }, 400)
    }

    const segments: CorrectionSegment[] = request.segments
      .filter(
        (s): s is Record<string, unknown> =>
          s !== null &&
          typeof s === 'object' &&
          typeof (s as Record<string, unknown>).audioHash === 'string' &&
          typeof (s as Record<string, unknown>).text === 'string'
      )
      .map((s) => ({
        audioHash: String(s.audioHash),
        text: String(s.text),
        mode: s.mode === 'enhanced' ? 'enhanced' : 'quick',
        glossary: Array.isArray(s.glossary) ? (s.glossary as string[]) : undefined,
      }))

    if (!segments.length) return c.json({ error: 'No valid segments' }, 400)

    // Cache-first per segment
    const cachedResults: { index: number; corrected: string; provider: string }[] = []
    const toProcess: { index: number; seg: CorrectionSegment }[] = []
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]
      const hit = await getCachedText(
        { COMMUNITY_CACHE: c.env.COMMUNITY_CACHE, RESPONSE_CACHE: c.env.RESPONSE_CACHE },
        seg.audioHash,
        seg.mode,
        seg.glossary
      )
      if (hit?.text) {
        cachedResults.push({ index: i, corrected: hit.text, provider: hit.provider })
      } else {
        toProcess.push({ index: i, seg })
      }
    }

    let provider = 'cache'
    const out: string[] = []
    if (toProcess.length) {
      // Use aggregator to allow cross-request batching (≤5 items or 700ms)
      const promises = toProcess.map(({ seg }) =>
        enqueueForCorrection(c.env, seg.mode, seg.text, seg.audioHash, seg.glossary)
      )
      const correctedTexts = await Promise.all(promises)
      provider = 'router' // provider could be mixed; we return 'mixed' later if any cache exists
      for (let j = 0; j < toProcess.length; j++) {
        const idx = toProcess[j].index
        const seg = toProcess[j].seg
        const corrected = correctedTexts[j] ?? seg.text
        out[idx] = corrected
        await setResponseCache(
          { RESPONSE_CACHE: c.env.RESPONSE_CACHE },
          seg.audioHash,
          seg.mode,
          corrected,
          seg.glossary
        )
      }
    }

    // Merge cached
    for (const it of cachedResults) {
      out[it.index] = it.corrected
    }

    const results = out.map((text, i) => ({
      audioHash: segments[i].audioHash,
      corrected: text ?? segments[i].text,
      confidence: segments[i].mode === 'enhanced' ? 0.85 : 0.8,
      provider:
        out[i] === segments[i].text
          ? provider
          : (cachedResults.find((r) => r.index === i)?.provider ?? provider),
      cached: Boolean(cachedResults.find((r) => r.index === i)),
    }))

    const resp: BatchCorrectionResponse = {
      provider: toProcess.length && cachedResults.length ? 'mixed' : provider,
      results,
    }
    console.log('[correct] response', { provider: resp.provider, count: results.length })
    return c.json(resp)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'UNKNOWN'
    return c.json({ error: message }, 500)
  }
})
