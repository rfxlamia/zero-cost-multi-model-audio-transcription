/// <reference types="@cloudflare/workers-types" />

import { Hono } from 'hono'
import { health } from './routes/health'
import { correct } from './routes/correct'
import { quotas } from './routes/quotas'
import { community } from './routes/community'
import { transcribe } from './routes/transcribe'
import { stream } from './routes/stream'
import { exp } from './routes/export'
import { metrics } from './routes/metrics'
import { transformers as transformersRoute } from './routes/transformers'
import { cors } from 'hono/cors'

export type Env = {
  COMMUNITY_CACHE: KVNamespace
  RESPONSE_CACHE: KVNamespace
  QUOTA_COUNTERS: KVNamespace
  JOB_STATE: KVNamespace
  R2_BUCKET: R2Bucket
  DB: D1Database
  AI: Ai // Cloudflare AI binding type
  GROQ_API_KEY?: string
  HF_API_TOKEN?: string
  ORIGIN_WHITELIST?: string
  LOG_LEVEL?: string
  DISABLE_GROQ?: string | boolean
  DISABLE_HF?: string | boolean
  DISABLE_TRANSFORMERS?: string | boolean
}

const app = new Hono<{ Bindings: Env }>()

// CORS based on ORIGIN_WHITELIST (comma-separated)
app.use('/api/*', async (c, next) => {
  const allow = (c.env.ORIGIN_WHITELIST || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const handler = cors({ origin: allow.length ? allow : '*' })
  return handler(c, next)
})

app.get('/', (c) => c.text('TranscriptorAI Worker orchestrator'))

// Mount routes
app.route('/', health)
app.route('/', correct)
app.route('/', quotas)
app.route('/', community)
app.route('/', transcribe)
app.route('/', stream)
app.route('/', exp)
app.route('/', metrics)
app.route('/', transformersRoute)

app.onError((err, c) => {
  console.error(err)
  return c.text('Internal Server Error', 500)
})

export default app
