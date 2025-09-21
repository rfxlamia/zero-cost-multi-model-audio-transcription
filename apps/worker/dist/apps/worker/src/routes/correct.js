import { Hono } from 'hono';
// import { correctTextsWithFallback } from '../services/router' // Using batching service instead
import { enqueueForCorrection } from '../services/batching';
import { getCachedText, setResponseCache } from '../utils/cache';
import { evaluateFaithfulness } from '../utils/faithfulness';
export const correct = new Hono();
// POST /api/correct/batch
correct.post('/api/correct/batch', async (c) => {
    try {
        const body = (await c.req.json().catch(() => null));
        if (!body || typeof body !== 'object') {
            return c.json({ error: 'Invalid payload: expected { segments: [...] }' }, 400);
        }
        const request = body;
        if (!Array.isArray(request.segments)) {
            return c.json({ error: 'Invalid payload: expected { segments: [...] }' }, 400);
        }
        const segments = request.segments
            .filter((s) => s !== null &&
            typeof s === 'object' &&
            typeof s.audioHash === 'string' &&
            typeof s.text === 'string')
            .map((s) => ({
            audioHash: String(s.audioHash),
            text: String(s.text),
            mode: s.mode === 'enhanced' ? 'enhanced' : 'quick',
            glossary: Array.isArray(s.glossary) ? s.glossary : undefined,
        }));
        if (!segments.length)
            return c.json({ error: 'No valid segments' }, 400);
        // Cache-first per segment
        const cacheHits = new Map();
        const toProcess = [];
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const hit = await getCachedText({ COMMUNITY_CACHE: c.env.COMMUNITY_CACHE, RESPONSE_CACHE: c.env.RESPONSE_CACHE }, seg.audioHash, seg.mode, seg.glossary);
            if (hit?.text) {
                cacheHits.set(i, { text: hit.text, provider: hit.provider });
            }
            else {
                toProcess.push({ index: i, seg });
            }
        }
        let provider = 'cache';
        const routerOutputs = new Map();
        if (toProcess.length) {
            // Use aggregator to allow cross-request batching (≤5 items or 700ms)
            const promises = toProcess.map(({ seg }) => enqueueForCorrection(c.env, seg.mode, seg.text, seg.audioHash, seg.glossary)
                .then((text) => ({ ok: true, text, seg }))
                .catch((error) => ({ ok: false, error, seg })));
            const resolved = await Promise.all(promises);
            let overload = false;
            for (let j = 0; j < resolved.length; j++) {
                const result = resolved[j];
                const idx = toProcess[j].index;
                if (!result.ok) {
                    const message = result.error instanceof Error ? result.error.message : String(result.error);
                    if (message.includes('queue_overloaded')) {
                        overload = true;
                    }
                    else {
                        console.warn('[correct] segment failed', { audioHash: result.seg.audioHash, message });
                    }
                    continue;
                }
                routerOutputs.set(idx, result.text ?? result.seg.text);
            }
            if (routerOutputs.size)
                provider = 'router';
            if (overload && !routerOutputs.size) {
                return c.json({ error: 'queue_overloaded', retryAfterSeconds: 2 }, 429);
            }
        }
        const cacheWrites = [];
        const results = segments.map((seg, index) => {
            const cacheHit = cacheHits.get(index);
            const routed = routerOutputs.get(index);
            const candidate = cacheHit?.text ?? routed ?? seg.text;
            const report = evaluateFaithfulness(seg.text, candidate, {
                minSharedRatio: seg.mode === 'enhanced' ? 0.92 : 0.88,
            });
            let finalText = report.accepted ? candidate : seg.text;
            const cameFromRouter = routerOutputs.has(index);
            const cameFromCache = Boolean(cacheHit);
            if (report.accepted && cameFromRouter && !cameFromCache) {
                cacheWrites.push(setResponseCache({ RESPONSE_CACHE: c.env.RESPONSE_CACHE }, seg.audioHash, seg.mode, finalText, seg.glossary));
            }
            const confidenceBase = seg.mode === 'enhanced' ? 0.85 : 0.8;
            const confidence = report.accepted ? confidenceBase : Math.min(confidenceBase, 0.4);
            const providerLabel = cameFromCache
                ? cacheHit?.provider ?? 'cache'
                : cameFromRouter
                    ? provider
                    : provider;
            return {
                audioHash: seg.audioHash,
                corrected: finalText,
                confidence,
                provider: providerLabel,
                cached: report.accepted ? cameFromCache : false,
                faithfulness: report,
            };
        });
        if (cacheWrites.length) {
            await Promise.all(cacheWrites);
        }
        const resp = {
            provider: toProcess.length && cacheHits.size ? 'mixed' : provider,
            results,
        };
        console.log('[correct] response', { provider: resp.provider, count: results.length });
        return c.json(resp);
    }
    catch (e) {
        const message = e instanceof Error ? e.message : 'UNKNOWN';
        return c.json({ error: message }, 500);
    }
});
