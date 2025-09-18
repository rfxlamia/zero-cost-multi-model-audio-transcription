// apps/worker/src/routes/health.ts
import { Hono } from 'hono'
export const health = new Hono()
health.get('/api/health', async (c) => {
  try {
    const env = c.env
    // KV ping
    await env.COMMUNITY_CACHE.put('health:ts', Date.now().toString(), { expirationTtl: 60 })
    const ts = await env.COMMUNITY_CACHE.get('health:ts')
    // R2 ping (head tidak dikenai biaya)
    const list = await env.R2_BUCKET.list({ limit: 1 })
    // D1 ping
    const { results } = await env.DB.prepare('select 1 as ok').all()
    return c.json({
      ok: true,
      kv: Boolean(ts),
      r2: list.objects.length >= 0,
      d1: results?.[0]?.ok === 1,
    })
  } catch (e) {
    console.error('[health]', { error: e?.message })
    return c.json({ ok: false, error: e?.message ?? 'UNKNOWN' }, 500)
  }
})
