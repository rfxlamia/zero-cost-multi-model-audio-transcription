type KV = KVNamespace

const dayKey = () => {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${dd}`
}

const metricsKey = (kind: 'success' | 'failure', provider: string, day: string) => `METRICS:${kind}:${provider}:day:${day}`

async function readCount(env: { QUOTA_COUNTERS: KV }, key: string) {
  const raw = await env.QUOTA_COUNTERS.get(key, 'json')
  return raw && typeof (raw as any).used === 'number' ? (raw as any).used : 0
}

export async function incProviderSuccess(env: { QUOTA_COUNTERS: KV }, provider: string, delta = 1) {
  const k = metricsKey('success', provider, dayKey())
  const used = await readCount(env, k)
  await env.QUOTA_COUNTERS.put(k, JSON.stringify({ used: used + delta }), { expirationTtl: 3 * 24 * 60 * 60 })
}

export async function incProviderFailure(env: { QUOTA_COUNTERS: KV }, provider: string, delta = 1) {
  const k = metricsKey('failure', provider, dayKey())
  const used = await readCount(env, k)
  await env.QUOTA_COUNTERS.put(k, JSON.stringify({ used: used + delta }), { expirationTtl: 3 * 24 * 60 * 60 })
}

export async function getProviderDailyMetrics(env: { QUOTA_COUNTERS: KV }, provider: string) {
  const day = dayKey()
  const success = await readCount(env, metricsKey('success', provider, day))
  const failure = await readCount(env, metricsKey('failure', provider, day))
  const total = success + failure
  const successRate = total > 0 ? success / total : 1
  return { day, success, failure, successRate }
}

