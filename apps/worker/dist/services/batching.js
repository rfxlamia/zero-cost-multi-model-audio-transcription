import { correctTextsWithFallback } from './router';
const MAX_BATCH = 5;
const FLUSH_MS = 700;
const queues = new Map(); // key: mode|glossarySignature
const keyOf = (mode, glossary) => {
    const g = glossary && glossary.length ? [...glossary].map((s) => s.trim()).filter(Boolean).sort().join('|') : '';
    return `${mode}|${g}`;
};
async function flushQueue(key, env) {
    const q = queues.get(key);
    if (!q || q.items.length === 0)
        return;
    // Take up to MAX_BATCH
    const batch = q.items.splice(0, MAX_BATCH);
    if (q.items.length === 0 && q.timer) {
        // clear timer when empty
        globalThis.clearTimeout(q.timer);
        q.timer = null;
    }
    try {
        const mode = key.split('|')[0];
        const glossarySig = key.slice(key.indexOf('|') + 1);
        const glossary = glossarySig ? glossarySig.split('|') : undefined;
        const texts = batch.map((b) => b.text);
        const { texts: out } = await correctTextsWithFallback(env, texts, mode, glossary);
        for (let i = 0; i < batch.length; i++)
            batch[i].resolve(out[i] ?? texts[i]);
    }
    catch (e) {
        for (const it of batch)
            it.reject(e);
    }
}
export function enqueueForCorrection(env, mode, text, audioHash, glossary) {
    return new Promise((resolve, reject) => {
        const key = keyOf(mode, glossary);
        let q = queues.get(key);
        if (!q) {
            q = { items: [], timer: null };
            queues.set(key, q);
        }
        q.items.push({ text, audioHash, resolve, reject });
        if (q.items.length >= MAX_BATCH) {
            // flush immediately
            // no await; background
            flushQueue(key, env);
            return;
        }
        // start timer if not exists
        if (!q.timer) {
            q.timer = setTimeout(() => flushQueue(key, env), FLUSH_MS);
        }
    });
}
