// Simple smoke test for /api/correct/batch without network.
// It stubs KV namespaces and pre-populates cache so the route returns from cache.

import { correct } from '../dist/routes/correct.js'

class MemoryKV {
  store = new Map()
  async get(key, type) {
    const v = this.store.get(key)
    if (v == null) return null
    if (type === 'json') {
      try { return JSON.parse(v) } catch { return null }
    }
    return v
  }
  async put(key, value, _opts) { this.store.set(key, typeof value === 'string' ? value : JSON.stringify(value)) }
  async delete(key) { this.store.delete(key) }
}

const COMMUNITY_CACHE = new MemoryKV()
const RESPONSE_CACHE = new MemoryKV()

// Pre-populate cache entries for two audio hashes, both quick mode
const ah1 = 'hash-quick-1'
const ah2 = 'hash-quick-2'
await COMMUNITY_CACHE.put(`COMMUNITY_CACHE:${ah1}`, JSON.stringify({ text: 'ini hasil koreksi dari komunitas satu' }))
await RESPONSE_CACHE.put(`RESPONSE_CACHE:${ah2}:quick`, 'hasil koreksi cache bawaan dua')

const env = {
  COMMUNITY_CACHE,
  RESPONSE_CACHE,
  QUOTA_COUNTERS: new MemoryKV(),
  JOB_STATE: new MemoryKV(),
  R2_BUCKET: {},
  DB: {},
  AI: {},
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  HF_API_TOKEN: process.env.HF_API_TOKEN,
}

const segments = [
  { audioHash: ah1, text: 'teks mentah satu', mode: 'quick' },
  { audioHash: ah2, text: 'teks mentah dua', mode: 'quick' },
]

const req = new Request('http://localhost/api/correct/batch', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ segments }),
})

const res = await correct.request(req, undefined, env)
console.log('status', res.status)
const json = await res.json()
console.log(JSON.stringify(json, null, 2))
