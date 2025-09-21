import { describe, it, expect, vi } from 'vitest';
vi.mock('../services/batching', () => ({
    enqueueForCorrection: vi.fn(async (_env, mode, text) => {
        return mode === 'quick' ? `Q:${text}` : `E:${text}`;
    }),
}));
import { stream } from './stream';
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
describe('SSE schema', () => {
    it('emits status, raw, quick, enhanced, done events', async () => {
        const id = 'job-sse-1';
        const JOB_STATE = createKV({
            [`JOB_STATE:${id}`]: {
                id,
                chunks: [
                    { audioHash: 'a', transcription: { raw: 'hello' } },
                    { audioHash: 'b', transcription: { raw: 'world' } },
                ],
            },
        });
        const env = {
            COMMUNITY_CACHE: createKV(),
            RESPONSE_CACHE: createKV(),
            QUOTA_COUNTERS: createKV(),
            JOB_STATE,
            R2_BUCKET: {},
            DB: {},
            AI: {},
        };
        const res = await stream.request(`/api/transcribe/${id}/stream`, {}, env);
        expect(res.status).toBe(200);
        const txt = await res.text();
        expect(txt).toContain('event: status');
        expect(txt).toContain('event: raw');
        expect(txt).toContain('event: quick');
        expect(txt).toContain('event: enhanced');
        expect(txt).toContain('event: done');
    });
});
