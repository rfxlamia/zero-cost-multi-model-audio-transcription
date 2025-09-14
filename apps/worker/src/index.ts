import { Hono } from 'hono'
import { health } from './routes/health'
import { correct } from './routes/correct'

export type Env = {
  COMMUNITY_CACHE: KVNamespace
  RESPONSE_CACHE: KVNamespace
  QUOTA_COUNTERS: KVNamespace
  JOB_STATE: KVNamespace
  R2_BUCKET: R2Bucket
  DB: D1Database
  AI: any
  GROQ_API_KEY?: string
  HF_API_TOKEN?: string
  ORIGIN_WHITELIST?: string
  LOG_LEVEL?: string
  DISABLE_GROQ?: string | boolean
  DISABLE_HF?: string | boolean
}

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => c.text('TranscriptorAI Worker orchestrator'))

// Mount routes
app.route('/', health)
app.route('/', correct)

app.onError((err, c) => {
  console.error(err)
  return c.text('Internal Server Error', 500)
})

export default app
