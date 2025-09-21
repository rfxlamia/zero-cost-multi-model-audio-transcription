const dayKey = () => {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
};
const metricsKey = (kind, provider, day) => `METRICS:${kind}:${provider}:day:${day}`;
async function readCount(env, key) {
    const raw = (await env.QUOTA_COUNTERS.get(key, 'json'));
    return raw && typeof raw.used === 'number' ? raw.used : 0;
}
export async function incProviderSuccess(env, provider, delta = 1) {
    const k = metricsKey('success', provider, dayKey());
    const used = await readCount(env, k);
    await env.QUOTA_COUNTERS.put(k, JSON.stringify({ used: used + delta }), {
        expirationTtl: 3 * 24 * 60 * 60,
    });
}
export async function incProviderFailure(env, provider, delta = 1) {
    const k = metricsKey('failure', provider, dayKey());
    const used = await readCount(env, k);
    await env.QUOTA_COUNTERS.put(k, JSON.stringify({ used: used + delta }), {
        expirationTtl: 3 * 24 * 60 * 60,
    });
}
export async function getProviderDailyMetrics(env, provider) {
    const day = dayKey();
    const success = await readCount(env, metricsKey('success', provider, day));
    const failure = await readCount(env, metricsKey('failure', provider, day));
    const total = success + failure;
    const successRate = total > 0 ? success / total : 1;
    return { day, success, failure, successRate };
}
export async function recordProviderLatency(env, provider, ms) {
    const k = metricsKey('latency', provider, dayKey());
    const raw = (await env.QUOTA_COUNTERS.get(k, 'json'));
    const sum = typeof raw?.sum === 'number' ? raw.sum : 0;
    const count = typeof raw?.count === 'number' ? raw.count : 0;
    const min = typeof raw?.min === 'number' ? raw.min : ms;
    const max = typeof raw?.max === 'number' ? raw.max : ms;
    const next = {
        sum: sum + ms,
        count: count + 1,
        min: Math.min(min, ms),
        max: Math.max(max, ms),
    };
    await env.QUOTA_COUNTERS.put(k, JSON.stringify(next), { expirationTtl: 3 * 24 * 60 * 60 });
}
export async function getProviderLatency(env, provider) {
    const k = metricsKey('latency', provider, dayKey());
    const raw = (await env.QUOTA_COUNTERS.get(k, 'json'));
    const sum = typeof raw?.sum === 'number' ? raw.sum : 0;
    const count = typeof raw?.count === 'number' ? raw.count : 0;
    const average = count > 0 ? sum / count : 0;
    const min = typeof raw?.min === 'number' ? raw.min : 0;
    const max = typeof raw?.max === 'number' ? raw.max : 0;
    return { averageMs: average, count, minMs: min, maxMs: max };
}
