import { type CorrectionMode } from '../types'

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const kvCommunityKey = (audioHash: string) => `COMMUNITY_CACHE:${audioHash}`
export const kvResponseKey = (signature: string) => `RESPONSE_CACHE:${signature}`

export async function buildSignature(audioHash: string, mode: CorrectionMode, glossary?: string[]) {
  const g =
    glossary && glossary.length
      ? [...glossary]
          .map((s) => s.trim())
          .filter(Boolean)
          .sort()
          .join('|')
      : ''
  const base = `${audioHash}|${mode}|${g}`
  return sha256Hex(base)
}

export async function getCachedText(
  env: { COMMUNITY_CACHE: KVNamespace; RESPONSE_CACHE: KVNamespace },
  audioHash: string,
  mode: CorrectionMode,
  glossary?: string[]
) {
  // Community cache first
  const community = await env.COMMUNITY_CACHE.get(kvCommunityKey(audioHash), 'json')
  if (community && typeof (community as any).text === 'string') {
    return { text: (community as any).text as string, provider: 'community' }
  }
  // Response cache (mode specific)
  const sig = await buildSignature(audioHash, mode, glossary)
  const cached = await env.RESPONSE_CACHE.get(kvResponseKey(sig))
  if (cached) return { text: cached, provider: 'cache' }
  return null
}

export async function setResponseCache(
  env: { RESPONSE_CACHE: KVNamespace },
  audioHash: string,
  mode: CorrectionMode,
  text: string,
  glossary?: string[],
  ttlDays = 7
) {
  const sig = await buildSignature(audioHash, mode, glossary)
  await env.RESPONSE_CACHE.put(kvResponseKey(sig), text, {
    expirationTtl: ttlDays * 24 * 60 * 60,
  })
}
