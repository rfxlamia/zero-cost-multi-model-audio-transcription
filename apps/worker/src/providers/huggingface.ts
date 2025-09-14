import { buildIndonesianCorrectionPrompt, wrapBatchPrompt } from '../prompts'
import type { ProviderCallOptions } from '../types'
import { providerSemaphore } from '../utils/semaphore'

// Default to a light text2text model; can be overridden later via env/model selection
const DEFAULT_MODEL = 'google/flan-t5-base'

export async function hfCorrectBatch(
  env: { HF_API_TOKEN?: string },
  texts: string[],
  opts: ProviderCallOptions
) {
  if (!env.HF_API_TOKEN) throw new Error('HF_API_TOKEN not set')
  const model = DEFAULT_MODEL
  const system = buildIndonesianCorrectionPrompt(opts.glossary)
  const prompt = wrapBatchPrompt(system, texts)

  await providerSemaphore.acquire()
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
    })
    if (!res.ok) throw new Error(`HF error ${res.status}`)
    const data: any = await res.json()
    // HF may return array with generated_text or a single object
    let text = ''
    if (Array.isArray(data) && data[0]?.generated_text) text = data[0].generated_text
    else if (data?.generated_text) text = data.generated_text
    else if (data?.[0]?.summary_text) text = data[0].summary_text
    else text = typeof data === 'string' ? data : ''
    const lines = text
      .split('\n')
      .map((l: string) => l.replace(/^\d+\)\s*/, '').trim())
      .filter((l: string) => l.length > 0)
    return lines.length ? lines : [text.trim()]
  } finally {
    providerSemaphore.release()
  }
}

