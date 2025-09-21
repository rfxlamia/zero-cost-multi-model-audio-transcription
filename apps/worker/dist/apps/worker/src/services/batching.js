import { correctTextsWithFallback } from './router';
import { recordProviderLatency } from './metrics';
const MAX_BATCH = 5;
const DEFAULT_FLUSH_MS = 700;
const QUICK_FLUSH_MS = 250;
const MAX_PENDING_PER_QUEUE = 20;
const MAX_TOTAL_PENDING = 100;
let totalPending = 0;
const queues = new Map(); // key: mode|glossarySignature
const keyOf = (mode, glossary) => {
    const g = glossary && glossary.length
        ? [...glossary]
            .map((s) => s.trim())
            .filter(Boolean)
            .sort()
            .join('|')
        : '';
    return `${mode}|${g}`;
};
async function flushQueue(key, env) {
    const q = queues.get(key);
    if (!q || q.items.length === 0)
        return;
    // Take up to MAX_BATCH
    const batch = q.items.splice(0, MAX_BATCH);
    totalPending = Math.max(0, totalPending - batch.length);
    if (q.timer) {
        globalThis.clearTimeout(q.timer);
        q.timer = null;
    }
    const flushDelay = q.flushMs;
    try {
        const mode = key.split('|')[0];
        const glossarySig = key.slice(key.indexOf('|') + 1);
        const glossary = glossarySig ? glossarySig.split('|') : undefined;
        const texts = batch.map((b) => b.text);
        const started = Date.now();
        const { texts: out, provider } = await correctTextsWithFallback(env, texts, mode, glossary);
        const elapsed = Date.now() - started;
        if (provider && provider !== 'none') {
            try {
                await recordProviderLatency(env, provider, elapsed);
            }
            catch {
                // ignore telemetry errors
            }
        }
        for (let i = 0; i < batch.length; i++)
            batch[i].resolve(out[i] ?? texts[i]);
    }
    catch (e) {
        for (const it of batch)
            it.reject(e);
    }
    if (q.items.length > 0) {
        q.timer = setTimeout(() => flushQueue(key, env), flushDelay);
    }
}
export function enqueueForCorrection(env, mode, text, audioHash, glossary) {
    return new Promise((resolve, reject) => {
        const key = keyOf(mode, glossary);
        let q = queues.get(key);
        const baseFlush = typeof env?.BATCH_FLUSH_MS === 'number' ? Number(env.BATCH_FLUSH_MS) : DEFAULT_FLUSH_MS;
        const quickFlush = typeof env?.BATCH_FLUSH_QUICK_MS === 'number'
            ? Number(env.BATCH_FLUSH_QUICK_MS)
            : QUICK_FLUSH_MS;
        const flushMs = mode === 'quick' ? quickFlush : baseFlush;
        if (!q) {
            q = { items: [], timer: null, flushMs };
            queues.set(key, q);
        }
        else if (q.flushMs !== flushMs) {
            q.flushMs = flushMs;
        }
        if (q.items.length >= MAX_PENDING_PER_QUEUE || totalPending >= MAX_TOTAL_PENDING) {
            reject(new Error('queue_overloaded'));
            return;
        }
        q.items.push({ text, audioHash, resolve, reject });
        totalPending += 1;
        if (q.items.length >= MAX_BATCH) {
            // flush immediately
            // no await; background
            flushQueue(key, env);
            return;
        }
        // start timer if not exists
        if (!q.timer) {
            q.timer = setTimeout(() => flushQueue(key, env), q.flushMs);
        }
    });
}
export function getQueueStats() {
    const out = [];
    let total = 0;
    queues.forEach((q, key) => {
        const count = Array.isArray(q?.items) ? q.items.length : 0;
        total += count;
        out.push({ key, count });
    });
    return { totalItems: total, queues: out };
}
export function __resetQueuesForTest() {
    queues.clear();
    totalPending = 0;
}
