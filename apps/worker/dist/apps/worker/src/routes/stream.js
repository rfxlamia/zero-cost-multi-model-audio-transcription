import { Hono } from 'hono';
import { enqueueForCorrection } from '../services/batching';
import { kvSemaphore } from '../utils/semaphore';
const MAX_JOBSTATE_WRITES = 320;
const WRITE_BATCH_THRESHOLD = 4;
const WRITE_INTERVAL_MS = 500;
export const stream = new Hono();
// GET /api/transcribe/:id/stream
// Streams minimal SSE events following the agreed shape
stream.get('/api/transcribe/:id/stream', async (c) => {
    const id = c.req.param('id');
    const headers = new Headers({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    const encoder = new TextEncoder();
    const toEvent = (type, data) => `event: ${type}\n` + `data: ${JSON.stringify(data)}\n\n`;
    const stream = new ReadableStream({
        start: async (controller) => {
            let heartbeatTimer = null;
            const enqueueHeartbeat = () => {
                if (heartbeatTimer)
                    clearTimeout(heartbeatTimer);
                heartbeatTimer = setTimeout(() => {
                    controller.enqueue(encoder.encode(toEvent('heartbeat', { jobId: id, ts: new Date().toISOString() })));
                    enqueueHeartbeat();
                }, 15000);
            };
            const send = (type, data) => {
                controller.enqueue(encoder.encode(toEvent(type, data)));
                enqueueHeartbeat();
            };
            let kvWrites = 0;
            try {
                send('status', { jobId: id, status: 'transcribing' });
                const key = `JOB_STATE:${id}`;
                const raw = await c.env.JOB_STATE.get(key, 'json');
                const job = (raw && typeof raw === 'object' ? raw : {});
                job.id = id;
                job.status = 'transcribing';
                job.chunks = Array.isArray(job.chunks) ? job.chunks : [];
                let dirty = true;
                let dirtyCount = 1;
                let budgetWarned = false;
                let lastPersist = Date.now();
                const markDirty = () => {
                    dirty = true;
                    dirtyCount++;
                };
                const persistState = async (force = false) => {
                    if (!dirty)
                        return;
                    if (!force) {
                        if (kvWrites >= MAX_JOBSTATE_WRITES) {
                            if (!budgetWarned) {
                                console.warn('[sse] JOB_STATE write budget hit', { jobId: id, kvWrites });
                                budgetWarned = true;
                            }
                            dirty = false;
                            return;
                        }
                        const elapsed = Date.now() - lastPersist;
                        if (dirtyCount < WRITE_BATCH_THRESHOLD && elapsed < WRITE_INTERVAL_MS)
                            return;
                    }
                    await kvSemaphore.acquire();
                    try {
                        job.updatedAt = new Date().toISOString();
                        await c.env.JOB_STATE.put(key, JSON.stringify(job), {
                            expirationTtl: 7 * 24 * 60 * 60,
                        });
                        kvWrites++;
                        dirty = false;
                        dirtyCount = 0;
                        lastPersist = Date.now();
                    }
                    finally {
                        kvSemaphore.release();
                    }
                };
                await persistState(true);
                const total = job.chunks.length;
                send('status', { jobId: id, totalChunks: total });
                // 1) Emit RAW
                let rawDone = 0;
                for (let i = 0; i < job.chunks.length; i++) {
                    const ch = job.chunks[i];
                    const rawText = ch?.transcription?.raw ?? ch?.raw;
                    if (rawText)
                        send('raw', {
                            chunkIndex: i,
                            text: String(rawText),
                            provider: 'asr',
                            confidence: 0.7,
                            tsRange: null,
                        });
                    rawDone++;
                    send('progress', { stage: 'raw', completed: rawDone, total });
                }
                // 2) QUICK corrections (batched via enqueue)
                const quickBatch = [];
                let quickDone = 0;
                const FLUSH_COUNT = 10;
                for (let i = 0; i < job.chunks.length; i++) {
                    const ch = job.chunks[i];
                    const rawText = ch?.transcription?.raw ?? ch?.raw;
                    const audioHash = ch?.audioHash;
                    if (!rawText || !audioHash)
                        continue;
                    const p = enqueueForCorrection(c.env, 'quick', String(rawText), String(audioHash))
                        .then(async (q) => {
                        const target = (job.chunks[i] = job.chunks[i] || { index: i });
                        target.transcription = target.transcription || {};
                        target.transcription.quick = q;
                        target.transcription.final = q;
                        markDirty();
                        await persistState(false);
                        send('quick', { chunkIndex: i, text: q, provider: 'router', confidence: 0.8 });
                        quickDone++;
                        send('progress', { stage: 'quick', completed: quickDone, total });
                    })
                        .catch((e) => {
                        console.warn('[sse] quick correction failed', e);
                    });
                    quickBatch.push(p);
                    if (quickBatch.length >= FLUSH_COUNT) {
                        await Promise.allSettled(quickBatch.splice(0, quickBatch.length));
                    }
                }
                if (quickBatch.length)
                    await Promise.allSettled(quickBatch);
                await persistState(true);
                // 3) ENHANCED corrections
                const enhancedBatch = [];
                let enhancedDone = 0;
                for (let i = 0; i < job.chunks.length; i++) {
                    const ch = job.chunks[i];
                    const baseText = ch?.transcription?.quick ?? ch?.transcription?.raw ?? ch?.raw;
                    const audioHash = ch?.audioHash;
                    if (!baseText || !audioHash)
                        continue;
                    const p = enqueueForCorrection(c.env, 'enhanced', String(baseText), String(audioHash))
                        .then(async (eText) => {
                        const target = (job.chunks[i] = job.chunks[i] || { index: i });
                        target.transcription = target.transcription || {};
                        target.transcription.enhanced = eText;
                        target.transcription.final = eText;
                        markDirty();
                        await persistState(false);
                        send('enhanced', { chunkIndex: i, text: eText, provider: 'router', confidence: 0.85 });
                        enhancedDone++;
                        send('progress', { stage: 'enhanced', completed: enhancedDone, total });
                    })
                        .catch((e) => {
                        console.warn('[sse] enhanced correction failed', e);
                    });
                    enhancedBatch.push(p);
                    if (enhancedBatch.length >= FLUSH_COUNT) {
                        await Promise.allSettled(enhancedBatch.splice(0, enhancedBatch.length));
                    }
                }
                if (enhancedBatch.length)
                    await Promise.allSettled(enhancedBatch);
                job.status = 'done';
                markDirty();
                await persistState(true);
                send('done', { jobId: id });
                console.info('[sse] job stream completed', { jobId: id, kvWrites });
            }
            catch (e) {
                send('sse-error', { message: e?.message || 'SSE error' });
            }
            finally {
                if (heartbeatTimer) {
                    clearTimeout(heartbeatTimer);
                    heartbeatTimer = null;
                }
                controller.close();
            }
        },
    });
    return new Response(stream, { headers });
});
