import { Hono } from 'hono'
import type { Env } from '../index'

type KV = KVNamespace

const dayKey = () => {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${dd}`
}

const quotaKey = (provider: string, day: string) => `QUOTA_COUNTERS:${provider}:day:${day}`

export const quotas = new Hono<{ Bindings: Env }>()

// GET /api/quotas
quotas.get('/api/quotas', async (c) => {
  const providers = ['groq', 'huggingface', 'together', 'cohere', 'workersAI']
  const day = dayKey()
  const minute = (() => {
    const d = new Date()
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const hh = String(d.getUTCHours()).padStart(2, '0')
    const mm = String(d.getUTCMinutes()).padStart(2, '0')
    return `${y}${m}${dd}${hh}${mm}`
  })()

  const out: Record<string, any> = {}
  for (const p of providers) {
    const dayRaw = await c.env.QUOTA_COUNTERS.get(`QUOTA_COUNTERS:${p}:day:${day}`, 'json')
    const minRaw = await c.env.QUOTA_COUNTERS.get(`QUOTA_COUNTERS:${p}:minute:${minute}`, 'json')
    out[p] = {
      day: dayRaw && typeof dayRaw === 'object' ? dayRaw : { used: 0, limit: null, resetAt: null },
      minute: minRaw && typeof minRaw === 'object' ? minRaw : { used: 0, limit: null, resetAt: null },
    }
  }
  return c.json({ day, minute, quotas: out })
})
