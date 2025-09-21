import { Hono } from 'hono'
import type { Env } from '../index'
import { getProviderDailyMetrics, getProviderLatency } from '../services/metrics'
import { preemptiveSwitch } from '../services/quota'
import { providerSemaphore } from '../utils/semaphore'
import { kvSemaphore } from '../utils/semaphore'
import { getQueueStats as getBatchQueueStats } from '../services/batching'

export const metrics = new Hono<{ Bindings: Env }>()

// Simple in-memory rate limit (per-IP per window)
const rateLimit = new Map<string, number>()
function checkRateLimit(ip: string, windowMs = 1000, max = 10) {
  const now = Date.now()
  const key = `${ip}:${Math.floor(now / windowMs)}`
  const count = rateLimit.get(key) || 0
  if (count >= max) return false
  rateLimit.set(key, count + 1)
  return true
}

// Optional cache for metrics to reduce KV reads
let metricsCache: { data: any; timestamp: number } | null = null
const CACHE_TTL = 60_000 // 1 minute

// Minimal queue stats exported from batching module (reflects in-memory state)
const getQueueStats = getBatchQueueStats

metrics.get('/api/metrics', async (c) => {
  const fresh = c.req.query('fresh')
  // Rate limit
  const ip =
    c.req.header('cf-connecting-ip') ||
    (c.req.header('x-forwarded-for') || '').split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  if (!checkRateLimit(ip)) {
    return c.json({ error: 'Too Many Requests' }, 429)
  }

  // Cache check
  const now = Date.now()
  if (fresh === '1') {
    metricsCache = null
  } else if (metricsCache && now - metricsCache.timestamp < CACHE_TTL) {
    return c.json(metricsCache.data)
  }

  const providers = ['groq', 'huggingface', 'together', 'cohere']
  const stats: Record<string, any> = {}
  for (const p of providers) {
    const daily = await getProviderDailyMetrics({ QUOTA_COUNTERS: c.env.QUOTA_COUNTERS }, p)
    const latency = await getProviderLatency({ QUOTA_COUNTERS: c.env.QUOTA_COUNTERS }, p)
    const nearLimit = await preemptiveSwitch(
      { QUOTA_COUNTERS: c.env.QUOTA_COUNTERS } as any,
      p as any
    )
    const enabled =
      (p === 'groq' &&
        !!c.env.GROQ_API_KEY &&
        !(c.env.DISABLE_GROQ === '1' || c.env.DISABLE_GROQ === true)) ||
      (p === 'huggingface' &&
        !!c.env.HF_API_TOKEN &&
        !(c.env.DISABLE_HF === '1' || c.env.DISABLE_HF === true)) ||
      (p === 'together' && !!(c.env as any).TOGETHER_API_KEY) ||
      (p === 'cohere' && !!(c.env as any).COHERE_API_KEY)
    stats[p] = { enabled, nearLimit, daily, latency }
  }

  const semaphores = {
    providerConcurrency: (providerSemaphore as any)?.limit ?? 5,
    kvConcurrency: (kvSemaphore as any)?.limit ?? 5,
  }

  const queue = getQueueStats()
  const result = { providers: stats, queue, semaphores }
  metricsCache = { data: result, timestamp: now }
  return c.json(result)
})
