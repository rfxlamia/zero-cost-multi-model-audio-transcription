import { providerSemaphore } from '../utils/semaphore'
import { incProviderFailure, incProviderSuccess, recordProviderLatency } from '../services/metrics'

type EnvShape = {
  SUMOPOD_API_KEY?: string
  SUMOPOD_BASE_URL?: string
  QUOTA_COUNTERS: KVNamespace
}

export type SumopodOptions = {
  language?: string
  responseFormat?: 'text' | 'verbose_json'
  model?: string
  timeoutMs?: number
  contentType?: string
}

function toBlob(input: Blob | ArrayBuffer | Uint8Array, contentType: string): Blob {
  if (input instanceof Blob) return input
  if (input instanceof Uint8Array) return new Blob([input], { type: contentType })
  return new Blob([new Uint8Array(input)], { type: contentType })
}

export async function sumopodTranscribe(
  env: EnvShape,
  input: Blob | ArrayBuffer | Uint8Array,
  opts: SumopodOptions = {}
): Promise<string> {
  if (!env.SUMOPOD_API_KEY) throw new Error('SUMOPOD_API_KEY not set')
  const base = env.SUMOPOD_BASE_URL || 'https://ai.sumopod.com'
  const url = `${base.replace(/\/$/, '')}/v1/audio/transcriptions`
  const language = opts.language || 'id'
  const model = opts.model || 'whisper-1'
  const responseFormat = opts.responseFormat || 'text'
  const contentType = opts.contentType || 'audio/webm'

  const blob = toBlob(input, contentType)
  const fd = new FormData()
  fd.append('file', blob, 'audio.webm')
  fd.append('model', model)
  fd.append('language', language)
  fd.append('response_format', responseFormat)

  const controller = new AbortController()
  const timer = opts.timeoutMs ? setTimeout(() => controller.abort(), opts.timeoutMs) : null

  await providerSemaphore.acquire()
  const started = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SUMOPOD_API_KEY}`,
      },
      body: fd,
      signal: controller.signal,
    })
    const latency = Date.now() - started
    await recordProviderLatency(env, 'sumopod', latency)
    if (!res.ok) {
      await incProviderFailure(env, 'sumopod', 1)
      throw new Error(`SumoPod error ${res.status}`)
    }
    await incProviderSuccess(env, 'sumopod', 1)
    if (responseFormat === 'text') {
      return await res.text()
    }
    const data = (await res.json().catch(() => null)) as { text?: unknown } | null
    const text = typeof data?.text === 'string' ? data!.text : JSON.stringify(data)
    return text
  } finally {
    if (timer) clearTimeout(timer)
    providerSemaphore.release()
  }
}

