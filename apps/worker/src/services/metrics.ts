type KV = KVNamespace

interface MetricsData {
  used?: number
}

interface LatencyData {
  sum?: number
  count?: number
  min?: number
  max?: number
}

const dayKey = (): string => {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${dd}`
}

const metricsKey = (
  kind: 'success' | 'failure' | 'latency',
  provider: string,
  day: string
): string => `METRICS:${kind}:${provider}:day:${day}`

async function readJson<T extends Record<string, unknown> | null>(
  env: { QUOTA_COUNTERS: KV },
  key: string
): Promise<T | null> {
  try {
    return (await env.QUOTA_COUNTERS.get(key, 'json')) as T | null
  } catch (error) {
    console.warn('[metrics] kv read failed', { key, error: (error as Error).message })
    return null
  }
}

async function writeJson(
  env: { QUOTA_COUNTERS: KV },
  key: string,
  value: Record<string, unknown>,
  options: Parameters<KV['put']>[2]
) {
  try {
    await env.QUOTA_COUNTERS.put(key, JSON.stringify(value), options)
  } catch (error) {
    console.warn('[metrics] kv write skipped', { key, error: (error as Error).message })
  }
}

async function readCount(env: { QUOTA_COUNTERS: KV }, key: string): Promise<number> {
  const raw = await readJson<MetricsData | null>(env, key)
  return raw && typeof raw.used === 'number' ? raw.used : 0
}

export async function incProviderSuccess(
  env: { QUOTA_COUNTERS: KV },
  provider: string,
  delta = 1
): Promise<void> {
  const k = metricsKey('success', provider, dayKey())
  const used = await readCount(env, k)
  await writeJson(env, k, { used: used + delta }, { expirationTtl: 3 * 24 * 60 * 60 })
}

export async function incProviderFailure(
  env: { QUOTA_COUNTERS: KV },
  provider: string,
  delta = 1
): Promise<void> {
  const k = metricsKey('failure', provider, dayKey())
  const used = await readCount(env, k)
  await writeJson(env, k, { used: used + delta }, { expirationTtl: 3 * 24 * 60 * 60 })
}

export async function getProviderDailyMetrics(
  env: { QUOTA_COUNTERS: KV },
  provider: string
): Promise<{ day: string; success: number; failure: number; successRate: number }> {
  const day = dayKey()
  const success = await readCount(env, metricsKey('success', provider, day))
  const failure = await readCount(env, metricsKey('failure', provider, day))
  const total = success + failure
  const successRate = total > 0 ? success / total : 1
  return { day, success, failure, successRate }
}

export async function recordProviderLatency(
  env: { QUOTA_COUNTERS: KV },
  provider: string,
  ms: number
): Promise<void> {
  const k = metricsKey('latency', provider, dayKey())
  const raw = await readJson<LatencyData | null>(env, k)
  const sum = typeof raw?.sum === 'number' ? raw.sum : 0
  const count = typeof raw?.count === 'number' ? raw.count : 0
  const min = typeof raw?.min === 'number' ? raw.min : ms
  const max = typeof raw?.max === 'number' ? raw.max : ms
  const next = {
    sum: sum + ms,
    count: count + 1,
    min: Math.min(min, ms),
    max: Math.max(max, ms),
  }
  await writeJson(env, k, next, { expirationTtl: 3 * 24 * 60 * 60 })
}

export async function getProviderLatency(
  env: { QUOTA_COUNTERS: KV },
  provider: string
): Promise<{ averageMs: number; count: number; minMs: number; maxMs: number }> {
  const k = metricsKey('latency', provider, dayKey())
  const raw = await readJson<LatencyData | null>(env, k)
  const sum = typeof raw?.sum === 'number' ? raw.sum : 0
  const count = typeof raw?.count === 'number' ? raw.count : 0
  const average = count > 0 ? sum / count : 0
  const min = typeof raw?.min === 'number' ? raw.min : 0
  const max = typeof raw?.max === 'number' ? raw.max : 0
  return { averageMs: average, count, minMs: min, maxMs: max }
}
