import { buildIndonesianCorrectionPrompt, wrapBatchPrompt } from '../prompts';
import { providerSemaphore } from '../utils/semaphore';
const QUICK_MODEL = 'meta-llama/Llama-3.1-8B-Instruct';
const ENHANCED_MODEL = 'meta-llama/Llama-3.1-70B-Instruct';
export async function huggingfaceCorrectBatch(env, texts, opts) {
    if (!env.HF_API_TOKEN)
        throw new Error('HF_API_TOKEN not set');
    const model = opts.mode === 'quick' ? QUICK_MODEL : ENHANCED_MODEL;
    const system = buildIndonesianCorrectionPrompt(opts.glossary);
    const prompt = wrapBatchPrompt(system, texts);
    await providerSemaphore.acquire();
    try {
        const res = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.HF_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: { max_new_tokens: 256, temperature: 0.2 },
            }),
        });
        if (!res.ok)
            throw new Error(`HF error ${res.status}`);
        const data = await res.json();
        // HF may return array with generated_text or a single object
        let text = '';
        if (Array.isArray(data) && data.length > 0) {
            const firstItem = data[0];
            if (typeof firstItem?.generated_text === 'string') {
                text = firstItem.generated_text;
            }
            else if (typeof firstItem?.summary_text === 'string') {
                text = firstItem.summary_text;
            }
        }
        else if (typeof data === 'object' && data !== null) {
            const obj = data;
            if (typeof obj.generated_text === 'string') {
                text = obj.generated_text;
            }
        }
        else if (typeof data === 'string') {
            text = data;
        }
        const lines = text
            .split('\n')
            .map((l) => l.replace(/^\d+\)\s*/, '').trim())
            .filter((l) => l.length > 0);
        return lines.length ? lines : [text.trim()];
    }
    finally {
        providerSemaphore.release();
    }
}
