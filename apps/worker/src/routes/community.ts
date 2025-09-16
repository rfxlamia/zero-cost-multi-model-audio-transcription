import { Hono } from 'hono'
import type { Env } from '../index'
import { kvCommunityKey } from '../utils/cache'
// import type { CommunitySubmission, CommunityData } from '../types/api-responses' // Types available if needed

export const community = new Hono<{ Bindings: Env }>()

// POST /api/community/submit
// Body: { audioHash: string, text: string, corrections?: string, contributor?: string }
community.post('/api/community/submit', async (c) => {
  try {
    const body = (await c.req.json().catch(() => null)) as unknown

    // Type validation
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid payload' }, 400)
    }

    const submission = body as Record<string, unknown>
    if (typeof submission.audioHash !== 'string' || typeof submission.text !== 'string') {
      return c.json({ error: 'Invalid payload' }, 400)
    }

    const doc = {
      text: String(submission.text),
      corrections: typeof submission.corrections === 'string' ? submission.corrections : '',
      contributor: typeof submission.contributor === 'string' ? submission.contributor : 'anon',
      upvotes: 0,
      provider: 'community',
      createdAt: new Date().toISOString(),
    }

    await c.env.COMMUNITY_CACHE.put(kvCommunityKey(submission.audioHash), JSON.stringify(doc), {
      // Keep aligned with RESPONSE cache TTL policy
      expirationTtl: 7 * 24 * 60 * 60,
    })
    return c.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'UNKNOWN'
    return c.json({ error: message }, 500)
  }
})

// POST /api/community/upvote
// Body: { audioHash: string }
community.post('/api/community/upvote', async (c) => {
  try {
    const body = (await c.req.json().catch(() => null)) as unknown

    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid payload' }, 400)
    }

    const request = body as Record<string, unknown>
    if (typeof request.audioHash !== 'string') {
      return c.json({ error: 'Invalid payload' }, 400)
    }

    const key = kvCommunityKey(request.audioHash)
    const raw = await c.env.COMMUNITY_CACHE.get(key, 'json')
    const doc = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const upvotes = typeof doc.upvotes === 'number' ? doc.upvotes + 1 : 1
    const next = { ...doc, upvotes }

    await c.env.COMMUNITY_CACHE.put(key, JSON.stringify(next), {
      expirationTtl: 7 * 24 * 60 * 60,
    })
    return c.json({ ok: true, upvotes })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'UNKNOWN'
    return c.json({ error: message }, 500)
  }
})
