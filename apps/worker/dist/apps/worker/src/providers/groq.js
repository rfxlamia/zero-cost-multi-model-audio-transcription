import { buildIndonesianCorrectionPrompt, wrapBatchPrompt } from '../prompts';
import { providerSemaphore } from '../utils/semaphore';
// import type { GroqChatCompletionResponse } from '../types/api-responses' // Type used internally by isGroqResponse
import { isGroqResponse } from '../types/api-responses';
const QUICK_MODEL = 'llama-3.1-8b-instant';
const ENHANCED_MODEL = 'llama-3.1-70b-versatile';
export async function groqCorrectBatch(env, texts, opts) {
    if (!env.GROQ_API_KEY)
        throw new Error('GROQ_API_KEY not set');
    const model = opts.mode === 'quick' ? QUICK_MODEL : ENHANCED_MODEL;
    const system = buildIndonesianCorrectionPrompt(opts.glossary);
    const prompt = wrapBatchPrompt(system, texts);
    await providerSemaphore.acquire();
    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: prompt },
                ],
                temperature: 0.2,
                max_tokens: 512,
            }),
        });
        if (!res.ok)
            throw new Error(`Groq error ${res.status}`);
        const data = await res.json();
        if (!isGroqResponse(data)) {
            throw new Error('Invalid response format from Groq API');
        }
        const content = data.choices?.[0]?.message?.content ?? '';
        // Expect N lines corresponding to batch
        const lines = content
            .split('\n')
            .map((l) => l.replace(/^\d+\)\s*/, '').trim())
            .filter((l) => l.length > 0);
        return lines.length ? lines : [content.trim()];
    }
    finally {
        providerSemaphore.release();
    }
}
