const DEFAULT_DAILY_LIMITS = {
    groq: 14400,
    huggingface: 1000,
    cohere: 3000,
};
const DEFAULT_MINUTE_LIMITS = {
    groq: 30,
    cohere: 100,
};
const dayKey = () => {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
};
const minuteKey = () => {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${y}${m}${dd}${hh}${mm}`;
};
const dayQuotaKey = (provider, day) => `QUOTA_COUNTERS:${provider}:day:${day}`;
const minuteQuotaKey = (provider, minute) => `QUOTA_COUNTERS:${provider}:minute:${minute}`;
async function readCounter(env, key) {
    const raw = await env.QUOTA_COUNTERS.get(key, 'json');
    const used = raw && typeof raw.used === 'number' ? raw.used : 0;
    const limit = raw && typeof raw.limit === 'number' ? raw.limit : undefined;
    const resetAt = raw && typeof raw.resetAt === 'string' ? raw.resetAt : undefined;
    return { used, limit, resetAt };
}
async function writeCounter(env, key, used, limit, ttlSeconds = 2 * 24 * 60 * 60) {
    const doc = {
        used,
        limit: limit ?? null,
        resetAt: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1, 0, 0, 0)).toISOString(),
    };
    await env.QUOTA_COUNTERS.put(key, JSON.stringify(doc), { expirationTtl: ttlSeconds });
}
export async function hasQuota(env, provider, need = 1) {
    const dKey = dayKey();
    const mKey = minuteKey();
    const dayLimit = DEFAULT_DAILY_LIMITS[provider];
    const minuteLimit = DEFAULT_MINUTE_LIMITS[provider];
    if (dayLimit) {
        const { used } = await readCounter(env, dayQuotaKey(provider, dKey));
        if (used + need > dayLimit)
            return false;
    }
    if (minuteLimit) {
        const { used } = await readCounter(env, minuteQuotaKey(provider, mKey));
        if (used + need > minuteLimit)
            return false;
    }
    return true;
}
export async function preemptiveSwitch(env, provider, threshold = 0.9) {
    const dKey = dayKey();
    const dayLimit = DEFAULT_DAILY_LIMITS[provider];
    if (!dayLimit)
        return false;
    const { used } = await readCounter(env, dayQuotaKey(provider, dKey));
    return used / dayLimit >= threshold;
}
export async function incQuota(env, provider, delta = 1) {
    const dKey = dayKey();
    const mKey = minuteKey();
    const dayLimit = DEFAULT_DAILY_LIMITS[provider];
    const minuteLimit = DEFAULT_MINUTE_LIMITS[provider];
    if (dayLimit) {
        const dayK = dayQuotaKey(provider, dKey);
        const { used } = await readCounter(env, dayK);
        await writeCounter(env, dayK, used + delta, dayLimit);
    }
    if (minuteLimit) {
        const minK = minuteQuotaKey(provider, mKey);
        const { used } = await readCounter(env, minK);
        // keep minute entries short-lived (e.g., 10 minutes TTL)
        await writeCounter(env, minK, used + delta, minuteLimit, 10 * 60);
    }
}
