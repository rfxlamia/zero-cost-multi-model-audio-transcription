import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../providers/groq', () => ({
    groqCorrectBatch: vi.fn(async () => {
        throw new Error('Groq down');
    }),
}));
vi.mock('../providers/huggingface', () => ({
    huggingfaceCorrectBatch: vi.fn(async (_env, texts) => texts.map((t) => `HF:${t}`)),
}));
import { correctTextsWithFallback } from './router';
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
describe('router fallback', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });
    it('returns none when all providers disabled or missing keys', async () => {
        const env = {
            QUOTA_COUNTERS: createKV(),
            DISABLE_GROQ: '1',
            DISABLE_HF: '1',
            GROQ_API_KEY: undefined,
            HF_API_TOKEN: undefined,
        };
        const { provider, texts } = await correctTextsWithFallback(env, ['a', 'b'], 'quick');
        expect(provider).toBe('none');
        expect(texts).toEqual(['a', 'b']);
    });
    it('falls back to HF when Groq fails', async () => {
        const kv = createKV();
        const env = {
            QUOTA_COUNTERS: kv,
            GROQ_API_KEY: 'x',
            HF_API_TOKEN: 'y',
        };
        const { provider, texts } = await correctTextsWithFallback(env, ['hello'], 'quick');
        expect(provider).toBe('huggingface');
        expect(texts[0]).toBe('HF:hello');
        const d = dayKey();
        const hfDoc = await kv.get(`QUOTA_COUNTERS:huggingface:day:${d}`, 'json');
        expect(hfDoc?.used).toBeGreaterThanOrEqual(1);
    });
    it('skips provider near limit (preemptive switch)', async () => {
        const d = dayKey();
        const kv = createKV({ [`QUOTA_COUNTERS:groq:day:${d}`]: { used: 14400, limit: 14400 } });
        const env = {
            QUOTA_COUNTERS: kv,
            GROQ_API_KEY: 'x',
            HF_API_TOKEN: 'y',
        };
        const { provider } = await correctTextsWithFallback(env, ['z'], 'quick');
        expect(provider).toBe('huggingface');
    });
    it('returns none when quotas exhausted across providers', async () => {
        const d = dayKey();
        const kv = createKV({
            [`QUOTA_COUNTERS:groq:day:${d}`]: { used: 14400, limit: 14400 },
            [`QUOTA_COUNTERS:huggingface:day:${d}`]: { used: 1000, limit: 1000 },
        });
        const env = {
            QUOTA_COUNTERS: kv,
            GROQ_API_KEY: 'x',
            HF_API_TOKEN: 'y',
        };
        const res = await correctTextsWithFallback(env, ['foo', 'bar'], 'quick');
        expect(res.provider).toBe('none');
        expect(res.texts).toEqual(['foo', 'bar']);
    });
});
