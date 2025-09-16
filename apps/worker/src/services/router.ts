import { huggingfaceCorrectBatch } from '../providers/huggingface'
import { groqCorrectBatch } from '../providers/groq'
import { hasQuota, incQuota, preemptiveSwitch } from './quota'
import { incProviderFailure, incProviderSuccess } from './metrics'
import { optimizeBatch } from '../utils/text'
import type { CorrectionMode, ProviderName } from '../types'

const PROVIDER_ORDER: ProviderName[] = ['groq', 'huggingface']

export async function correctTextsWithFallback(
  env: any,
  texts: string[],
  mode: CorrectionMode,
  glossary?: string[]
) {
  const opts = { mode, glossary }
  for (const p of PROVIDER_ORDER) {
    // Skip if no key available
    if ((env.DISABLE_GROQ === '1' || env.DISABLE_GROQ === true) && p === 'groq') continue
    if ((env.DISABLE_HF === '1' || env.DISABLE_HF === true) && p === 'huggingface') continue
    if (p === 'groq' && !env.GROQ_API_KEY) continue
    if (p === 'huggingface' && !env.HF_API_TOKEN) continue

    const haveQuota = await hasQuota(env, p as any, texts.length)
    const shouldSwitch = await preemptiveSwitch(env, p as any)
    if (!haveQuota || shouldSwitch) continue
    try {
      const prepped = optimizeBatch(texts, mode)
      console.log('[router] trying provider', p, { count: prepped.length, mode })
      const out =
        p === 'groq'
          ? await groqCorrectBatch(env, prepped, opts)
          : await huggingfaceCorrectBatch(env, prepped, opts)
      await incQuota(env, p as any, texts.length)
      await incProviderSuccess(env, p, texts.length)
      console.log('[router] using provider', p)
      return { provider: p, texts: out }
    } catch (e) {
      console.warn('[router] provider failed', p, (e as any)?.message || e)
      await incProviderFailure(env, p, texts.length)
      // try next provider
      continue
    }
  }
  // If all fail, return inputs as-is
  console.warn('[router] all providers unavailable, returning original texts')
  return { provider: 'none', texts }
}
