import { hfCorrectBatch } from '../providers/huggingface';
import { groqCorrectBatch } from '../providers/groq';
import { hasQuota, incQuota, preemptiveSwitch } from './quota';
import { optimizeBatch } from '../utils/text';
const PROVIDER_ORDER = ['groq', 'huggingface'];
export async function correctTextsWithFallback(env, texts, mode, glossary) {
    const opts = { mode, glossary };
    for (const p of PROVIDER_ORDER) {
        // Skip if no key available
        if ((env.DISABLE_GROQ === '1' || env.DISABLE_GROQ === true) && p === 'groq')
            continue;
        if ((env.DISABLE_HF === '1' || env.DISABLE_HF === true) && p === 'huggingface')
            continue;
        if (p === 'groq' && !env.GROQ_API_KEY)
            continue;
        if (p === 'huggingface' && !env.HF_API_TOKEN)
            continue;
        const haveQuota = await hasQuota(env, p, texts.length);
        const shouldSwitch = await preemptiveSwitch(env, p);
        if (!haveQuota || shouldSwitch)
            continue;
        try {
            const prepped = optimizeBatch(texts, mode);
            console.log('[router] trying provider', p, { count: prepped.length, mode });
            const out = p === 'groq'
                ? await groqCorrectBatch(env, prepped, opts)
                : await hfCorrectBatch(env, prepped, opts);
            await incQuota(env, p, texts.length);
            console.log('[router] using provider', p);
            return { provider: p, texts: out };
        }
        catch (e) {
            console.warn('[router] provider failed', p, e?.message || e);
            // try next provider
            continue;
        }
    }
    // If all fail, return inputs as-is
    console.warn('[router] all providers unavailable, returning original texts');
    return { provider: 'none', texts };
}
