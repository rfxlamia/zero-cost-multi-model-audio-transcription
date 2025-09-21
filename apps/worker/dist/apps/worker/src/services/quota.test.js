import { describe, it, expect } from 'vitest';
import { hasQuota, incQuota, preemptiveSwitch } from './quota';
function createKV(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        get: async (key, type) => {
            const v = store.get(key);
            // eslint-disable-next-line eqeqeq
            if (v == null)
                return null;
            if (type === 'json')
                return v;
            return typeof v === 'string' ? v : JSON.stringify(v);
        },
        put: async (key, value) => {
            try {
                store.set(key, JSON.parse(value));
            }
            catch {
                store.set(key, value);
            }
        },
        delete: async (key) => store.delete(key),
        _dump: () => store,
    };
}
function dayKey() {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${y}${m}${dd}`;
}
function minuteKey() {
    const d = new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${y}${m}${dd}${hh}${mm}`;
}
describe('quota counters', () => {
    it('denies when daily limit exceeded and increments counters', async () => {
        const d = dayKey();
        const kv = createKV({ [`QUOTA_COUNTERS:huggingface:day:${d}`]: { used: 999, limit: 1000 } });
        const env = { QUOTA_COUNTERS: kv };
        expect(await hasQuota(env, 'huggingface', 2)).toBe(false);
        expect(await hasQuota(env, 'huggingface', 1)).toBe(true);
        await incQuota(env, 'huggingface', 1);
        const doc = await kv.get(`QUOTA_COUNTERS:huggingface:day:${d}`, 'json');
        expect(doc?.used).toBe(1000);
        expect(await preemptiveSwitch(env, 'huggingface', 0.9)).toBe(true);
    });
    it('applies minute limit for groq', async () => {
        const d = dayKey();
        const m = minuteKey();
        const kv = createKV({
            [`QUOTA_COUNTERS:groq:day:${d}`]: { used: 10, limit: 14400 },
            [`QUOTA_COUNTERS:groq:minute:${m}`]: { used: 29, limit: 30 },
        });
        const env = { QUOTA_COUNTERS: kv };
        expect(await hasQuota(env, 'groq', 2)).toBe(false);
        expect(await hasQuota(env, 'groq', 1)).toBe(true);
        await incQuota(env, 'groq', 1);
        const minDoc = await kv.get(`QUOTA_COUNTERS:groq:minute:${m}`, 'json');
        expect(minDoc?.used).toBe(30);
    });
});
