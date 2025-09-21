export async function sha256Hex(input) {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
export const kvCommunityKey = (audioHash) => `COMMUNITY_CACHE:${audioHash}`;
export const kvResponseKey = (signature) => `RESPONSE_CACHE:${signature}`;
export async function buildSignature(audioHash, mode, glossary) {
    const g = glossary && glossary.length
        ? [...glossary]
            .map((s) => s.trim())
            .filter(Boolean)
            .sort()
            .join('|')
        : '';
    const base = `${audioHash}|${mode}|${g}`;
    return sha256Hex(base);
}
export async function getCachedText(env, audioHash, mode, glossary) {
    // Community cache first
    const community = await env.COMMUNITY_CACHE.get(kvCommunityKey(audioHash), 'json');
    if (community && typeof community.text === 'string') {
        return { text: community.text, provider: 'community' };
    }
    // Response cache (mode specific)
    const sig = await buildSignature(audioHash, mode, glossary);
    const cached = await env.RESPONSE_CACHE.get(kvResponseKey(sig));
    if (cached)
        return { text: cached, provider: 'cache' };
    return null;
}
export async function setResponseCache(env, audioHash, mode, text, glossary, ttlDays = 7) {
    const sig = await buildSignature(audioHash, mode, glossary);
    await env.RESPONSE_CACHE.put(kvResponseKey(sig), text, {
        expirationTtl: ttlDays * 24 * 60 * 60,
    });
}
