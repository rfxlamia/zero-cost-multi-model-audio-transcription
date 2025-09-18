const DEFAULT_LIMITS = {
  groq: 14400, // per day
  huggingface: 1000,
}
const dayKey = () => {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${dd}`
}
const quotaKey = (provider, day) => `QUOTA_COUNTERS:${provider}:day:${day}`
export async function hasQuota(env, provider, need = 1) {
  const day = dayKey()
  const raw = await env.QUOTA_COUNTERS.get(quotaKey(provider, day), 'json')
  const limit = DEFAULT_LIMITS[provider]
  const used = raw && typeof raw.used === 'number' ? raw.used : 0
  return used + need <= limit
}
export async function preemptiveSwitch(env, provider, threshold = 0.9) {
  const day = dayKey()
  const raw = await env.QUOTA_COUNTERS.get(quotaKey(provider, day), 'json')
  const limit = DEFAULT_LIMITS[provider]
  const used = raw && typeof raw.used === 'number' ? raw.used : 0
  return used / limit >= threshold
}
export async function incQuota(env, provider, delta = 1) {
  const day = dayKey()
  const key = quotaKey(provider, day)
  const limit = DEFAULT_LIMITS[provider]
  const raw = await env.QUOTA_COUNTERS.get(key, 'json')
  const used = raw && typeof raw.used === 'number' ? raw.used : 0
  const doc = {
    used: used + delta,
    limit,
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
  await env.QUOTA_COUNTERS.put(key, JSON.stringify(doc), { expirationTtl: 2 * 24 * 60 * 60 })
}
