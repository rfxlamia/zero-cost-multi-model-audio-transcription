import { describe, it, expect } from 'vitest';
import { recordProviderLatency, getProviderLatency } from './metrics';
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
    };
}
describe('metrics latency recorder', () => {
    it('aggregates latency stats per provider', async () => {
        const kv = createKV();
        const env = { QUOTA_COUNTERS: kv };
        await recordProviderLatency(env, 'groq', 100);
        await recordProviderLatency(env, 'groq', 200);
        const latency = await getProviderLatency(env, 'groq');
        expect(latency.count).toBe(2);
        expect(latency.minMs).toBe(100);
        expect(latency.maxMs).toBe(200);
        expect(latency.averageMs).toBeCloseTo(150, 5);
    });
});
