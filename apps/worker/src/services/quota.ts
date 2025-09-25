type KV = KVNamespace

const DEFAULT_DAILY_LIMITS: Record<string, number | undefined> = {
  groq: 14400,
  huggingface: 1000,
  cohere: 3000,
}

const DEFAULT_MINUTE_LIMITS: Record<string, number | undefined> = {
  groq: 30,
  cohere: 100,
}

const dayKey = () => {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${dd}`
}

const minuteKey = () => {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  return `${y}${m}${dd}${hh}${mm}`
}

const dayQuotaKey = (provider: string, day: string) => `QUOTA_COUNTERS:${provider}:day:${day}`
const minuteQuotaKey = (provider: string, minute: string) =>
  `QUOTA_COUNTERS:${provider}:minute:${minute}`

async function readCounter(env: { QUOTA_COUNTERS: KV }, key: string) {
  let raw: unknown = null
  try {
    raw = await env.QUOTA_COUNTERS.get(key, 'json')
  } catch (error) {
    console.warn('[quota] kv read failed', { key, error: (error as Error).message })
  }
  const used = raw && typeof (raw as any).used === 'number' ? (raw as any).used : 0
  const limit = raw && typeof (raw as any).limit === 'number' ? (raw as any).limit : undefined
  const resetAt = raw && typeof (raw as any).resetAt === 'string' ? (raw as any).resetAt : undefined
  return { used, limit, resetAt }
}

async function writeCounter(
  env: { QUOTA_COUNTERS: KV },
  key: string,
  used: number,
  limit?: number,
  ttlSeconds = 2 * 24 * 60 * 60
) {
  const doc: any = {
    used,
    limit: limit ?? null,
    resetAt: new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate() + 1,
        0,
        0,
        0
      )
    ).toISOString(),
  }
  try {
    await env.QUOTA_COUNTERS.put(key, JSON.stringify(doc), { expirationTtl: ttlSeconds })
  } catch (error) {
    console.warn('[quota] kv write skipped', { key, error: (error as Error).message })
  }
}

export async function hasQuota(
  env: { QUOTA_COUNTERS: KV },
  provider: keyof typeof DEFAULT_DAILY_LIMITS,
  need = 1
) {
  const dKey = dayKey()
  const mKey = minuteKey()
  const dayLimit = (DEFAULT_DAILY_LIMITS as any)[provider]
  const minuteLimit = (DEFAULT_MINUTE_LIMITS as any)[provider]

  if (dayLimit) {
    const { used } = await readCounter(env, dayQuotaKey(provider, dKey))
    if (used + need > dayLimit) return false
  }
  if (minuteLimit) {
    const { used } = await readCounter(env, minuteQuotaKey(provider, mKey))
    if (used + need > minuteLimit) return false
  }
  return true
}

export async function preemptiveSwitch(
  env: { QUOTA_COUNTERS: KV },
  provider: keyof typeof DEFAULT_DAILY_LIMITS,
  threshold = 0.9
) {
  const dKey = dayKey()
  const dayLimit = (DEFAULT_DAILY_LIMITS as any)[provider]
  if (!dayLimit) return false
  const { used } = await readCounter(env, dayQuotaKey(provider, dKey))
  return used / dayLimit >= threshold
}

export async function incQuota(
  env: { QUOTA_COUNTERS: KV },
  provider: keyof typeof DEFAULT_DAILY_LIMITS,
  delta = 1
) {
  const dKey = dayKey()
  const mKey = minuteKey()
  const dayLimit = (DEFAULT_DAILY_LIMITS as any)[provider]
  const minuteLimit = (DEFAULT_MINUTE_LIMITS as any)[provider]

  if (dayLimit) {
    const dayK = dayQuotaKey(provider, dKey)
    const { used } = await readCounter(env, dayK)
    await writeCounter(env, dayK, used + delta, dayLimit)
  }
  if (minuteLimit) {
    const minK = minuteQuotaKey(provider, mKey)
    const { used } = await readCounter(env, minK)
    // keep minute entries short-lived (e.g., 10 minutes TTL)
    await writeCounter(env, minK, used + delta, minuteLimit, 10 * 60)
  }
}
