import type { KVNamespace } from '@cloudflare/workers-types'
import type { Env } from '../index'

export interface MockEnv extends Partial<Env> {
  QUOTA_COUNTERS: KVNamespace
  COMMUNITY_CACHE?: KVNamespace
  RESPONSE_CACHE?: KVNamespace
  JOB_STATE?: KVNamespace
  APP_SECRET: string
  BATCH_FLUSH_MS?: string
  BATCH_FLUSH_QUICK_MS?: string
}

export type MockRequest = Request & {
  headers: Headers
}
