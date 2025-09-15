import { Hono } from 'hono'
import type { Env } from '../index'
import { kvCommunityKey } from '../utils/cache'

export const community = new Hono<{ Bindings: Env }>()

// POST /api/community/submit
// Body: { audioHash: string, text: string, corrections?: string, contributor?: string }
community.post('/api/community/submit', async (c) => {
  try {
    const body = await c.req.json().catch(() => null)
    if (!body || typeof body.audioHash !== 'string' || typeof body.text !== 'string') {
      return c.json({ error: 'Invalid payload' }, 400)
    }
    const doc = {
      text: String(body.text),
      corrections: typeof body.corrections === 'string' ? body.corrections : '',
      contributor: typeof body.contributor === 'string' ? body.contributor : 'anon',
      upvotes: 0,
      provider: 'community',
      createdAt: new Date().toISOString(),
    }
    await c.env.COMMUNITY_CACHE.put(kvCommunityKey(body.audioHash), JSON.stringify(doc), {
      // Keep aligned with RESPONSE cache TTL policy
      expirationTtl: 7 * 24 * 60 * 60,
    })
    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ error: e?.message ?? 'UNKNOWN' }, 500)
  }
})

// POST /api/community/upvote
// Body: { audioHash: string }
community.post('/api/community/upvote', async (c) => {
  try {
    const body = await c.req.json().catch(() => null)
    if (!body || typeof body.audioHash !== 'string') return c.json({ error: 'Invalid payload' }, 400)
    const key = kvCommunityKey(body.audioHash)
    const raw = await c.env.COMMUNITY_CACHE.get(key, 'json')
    const doc = (raw && typeof raw === 'object' ? raw : {}) as any
    const upvotes = typeof doc.upvotes === 'number' ? doc.upvotes + 1 : 1
    const next = { ...doc, upvotes }
    await c.env.COMMUNITY_CACHE.put(key, JSON.stringify(next), {
      expirationTtl: 7 * 24 * 60 * 60,
    })
    return c.json({ ok: true, upvotes })
  } catch (e: any) {
    return c.json({ error: e?.message ?? 'UNKNOWN' }, 500)
  }
})

