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

  const providers = ['groq', 'huggingface', 'together', 'cohere'] as const
  type ProviderStats = {
    enabled: boolean
    nearLimit: boolean
    daily: { day: string; success: number; failure: number; successRate: number }
    latency: { averageMs: number; count: number; minMs: number; maxMs: number }
  }
  const stats: Record<string, ProviderStats> = {}
  for (const p of providers) {
    const fallbackDaily = { day: '', success: 0, failure: 0, successRate: 1 }
    const fallbackLatency = { averageMs: 0, count: 0, minMs: 0, maxMs: 0 }
    let daily = fallbackDaily
    let latency = fallbackLatency
    let nearLimit = false
    try {
      daily = await getProviderDailyMetrics({ QUOTA_COUNTERS: c.env.QUOTA_COUNTERS }, p)
    } catch (error) {
      console.warn('[metrics] daily lookup failed', {
        provider: p,
        error: (error as Error).message,
      })
    }
    try {
      latency = await getProviderLatency({ QUOTA_COUNTERS: c.env.QUOTA_COUNTERS }, p)
    } catch (error) {
      console.warn('[metrics] latency lookup failed', {
        provider: p,
        error: (error as Error).message,
      })
    }
    if (p === 'groq' || p === 'huggingface' || p === 'cohere') {
      try {
        nearLimit = await preemptiveSwitch({ QUOTA_COUNTERS: c.env.QUOTA_COUNTERS }, p)
      } catch (error) {
        console.warn('[metrics] near-limit check failed', {
          provider: p,
          error: (error as Error).message,
        })
        nearLimit = false
      }
    }
    const enabled =
      (p === 'groq' &&
        !!c.env.GROQ_API_KEY &&
        !(c.env.DISABLE_GROQ === '1' || c.env.DISABLE_GROQ === true)) ||
      (p === 'huggingface' &&
        !!c.env.HF_API_TOKEN &&
        !(c.env.DISABLE_HF === '1' || c.env.DISABLE_HF === true)) ||
      (p === 'together' && !!c.env.TOGETHER_API_KEY) ||
      (p === 'cohere' && !!c.env.COHERE_API_KEY)
    stats[p] = { enabled, nearLimit, daily, latency }
  }

  const semaphores = {
    providerConcurrency: providerSemaphore.getLimit(),
    kvConcurrency: kvSemaphore.getLimit(),
  }

  const queue = getQueueStats()
  const result = { providers: stats, queue, semaphores }
  metricsCache = { data: result, timestamp: now }
  return c.json(result)
})
