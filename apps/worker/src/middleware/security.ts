import { getCookie, setCookie } from 'hono/cookie'
import type { Context, MiddlewareHandler } from 'hono'
import { RATE_LIMITS } from '@transcriptorai/shared/constants'
import type { Env } from '../index'
import { sha256Hex } from '../utils/cache'
import { logAnomaly, logSecurity } from '../utils/logging'
import type { RateLimitMeta, RateLimitScope } from '../types'

const COOKIE_NAME = '__trans_uid'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days

const REQUIRED_SECRETS: Array<keyof Env> = ['APP_SECRET']
const OPTIONAL_SECRETS: Array<keyof Env> = ['GROQ_API_KEY', 'HF_API_TOKEN', 'TURNSTILE_SECRET']

let secretsAudited = false

function auditSecrets(env: Env) {
  if (secretsAudited) return
  secretsAudited = true
  const missingRequired = REQUIRED_SECRETS.filter((key) => !env[key])
  if (missingRequired.length) {
    logAnomaly('missing_required_secret', { keys: missingRequired })
  }
  const missingOptional = OPTIONAL_SECRETS.filter((key) => !env[key])
  if (missingOptional.length) {
    logAnomaly('missing_optional_secret', { keys: missingOptional })
  }
  logSecurity('secrets_audited', {
    required: REQUIRED_SECRETS.length,
    optional: OPTIONAL_SECRETS.length,
  })
}

function parseOriginList(originList?: string | null) {
  if (!originList) return [] as string[]
  return originList
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

function applySecurityHeaders(c: Context<{ Bindings: Env }>) {
  const url = new URL(c.req.url)
  const originEntries = new Set<string>(["'self'"])
  for (const allowOrigin of parseOriginList(c.env.ORIGIN_WHITELIST)) {
    originEntries.add(allowOrigin)
  }
  const connectSrc = Array.from(originEntries).join(' ')
  const csp = [
    "default-src 'none'",
    `connect-src ${connectSrc}`,
    "img-src 'self' data:",
    "media-src 'self'",
    "font-src 'none'",
    "style-src 'none'",
    "script-src 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "worker-src 'self'",
  ].join('; ')
  c.header('Content-Security-Policy', csp)
  if (url.protocol === 'https:') {
    c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }
  c.header('Referrer-Policy', 'no-referrer')
  c.header('Permissions-Policy', 'microphone=(), camera=(), geolocation=()')
  c.header('Cross-Origin-Opener-Policy', 'same-origin')
  c.header('Cross-Origin-Embedder-Policy', 'require-corp')
  c.header('Cross-Origin-Resource-Policy', 'same-origin')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
}

function toBase64Url(bytes: ArrayBuffer) {
  const raw = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function signValue(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return toBase64Url(sig)
}

async function verifySignature(secret: string, value: string, signature: string) {
  try {
    const expected = await signValue(secret, value)
    return expected === signature
  } catch (error) {
    console.warn('[security] signature verification error', (error as Error).message)
    return false
  }
}

function isSecureRequest(url: string, forwardedProto?: string | null) {
  if (forwardedProto) {
    const proto = forwardedProto.split(',')[0]?.trim().toLowerCase()
    if (proto === 'https') return true
  }
  return new URL(url).protocol === 'https:'
}

type LimitConfig = {
  scope: RateLimitScope
  identifier: string
  windowSeconds: number
  max: number
}

type WindowState = {
  key: string
  scope: RateLimitScope
  nextCount: number
  limit: number
  resetAt: number
}

async function applyRateLimits(env: Env, configs: LimitConfig[]) {
  if (!configs.length) return { allowed: true as const, meta: [] as RateLimitMeta[] }

  const now = Date.now()
  const states: WindowState[] = []

  for (const cfg of configs) {
    const key = `RL:${cfg.scope}:${cfg.windowSeconds}:${cfg.identifier}`
    let raw: unknown = null
    try {
      raw = await env.QUOTA_COUNTERS.get(key, 'json')
    } catch (error) {
      console.warn('[rate-limit] kv read failed', { key, error: (error as Error).message })
    }
    let used = 0
    let resetAt = now + cfg.windowSeconds * 1000

    if (raw && typeof raw === 'object') {
      const doc = raw as { used?: number; resetAt?: string | number }
      if (typeof doc.used === 'number') used = doc.used
      if (typeof doc.resetAt === 'string') {
        const parsed = Date.parse(doc.resetAt)
        if (!Number.isNaN(parsed)) resetAt = parsed
      } else if (typeof doc.resetAt === 'number') {
        resetAt = doc.resetAt
      }
    }

    if (resetAt <= now) {
      used = 0
      resetAt = now + cfg.windowSeconds * 1000
    }

    const nextCount = used + 1
    if (nextCount > cfg.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000))
      const meta: RateLimitMeta = {
        scope: cfg.scope,
        limit: cfg.max,
        remaining: 0,
        resetAt: new Date(resetAt).toISOString(),
        retryAfterSeconds,
      }
      return { allowed: false as const, meta: [meta] }
    }

    states.push({ key, scope: cfg.scope, nextCount, limit: cfg.max, resetAt })
  }

  const metas: RateLimitMeta[] = []
  for (const state of states) {
    const ttlSeconds = Math.max(60, Math.ceil((state.resetAt - now) / 1000))
    try {
      await env.QUOTA_COUNTERS.put(
        state.key,
        JSON.stringify({
          scope: state.scope,
          used: state.nextCount,
          limit: state.limit,
          resetAt: new Date(state.resetAt).toISOString(),
        }),
        { expirationTtl: ttlSeconds }
      )
    } catch (error) {
      console.warn('[rate-limit] kv write skipped', {
        key: state.key,
        error: (error as Error).message,
      })
    }
    metas.push({
      scope: state.scope,
      limit: state.limit,
      remaining: Math.max(0, state.limit - state.nextCount),
      resetAt: new Date(state.resetAt).toISOString(),
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - now) / 1000)),
    })
  }

  return { allowed: true as const, meta: metas }
}

async function ensureAnonId(c: Parameters<MiddlewareHandler>[0]) {
  const secret = c.env.APP_SECRET
  const raw = getCookie(c, COOKIE_NAME)
  const secure = isSecureRequest(c.req.url, c.req.header('x-forwarded-proto'))

  if (raw) {
    if (!secret) {
      return { userId: raw }
    }
    const [id, signature] = raw.split('.', 2)
    if (id && signature && (await verifySignature(secret, id, signature))) {
      return { userId: id }
    }
    console.warn('[security] invalid signed cookie, rotating anon id')
  }

  const userId = crypto.randomUUID()
  const value = secret ? `${userId}.${await signValue(secret, userId)}` : userId
  setCookie(c, COOKIE_NAME, value, {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
  return { userId }
}

export const securityMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  auditSecrets(c.env)
  if (c.req.method === 'OPTIONS') {
    await next()
    applySecurityHeaders(c)
    return
  }

  const url = new URL(c.req.url)
  const path = url.pathname
  const isMetricsRead = c.req.method === 'GET' && path === '/api/metrics'

  const { userId } = await ensureAnonId(c)
  c.set('anonUserId', userId)

  const ipHeader =
    c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
  const clientIp = ipHeader && ipHeader.length ? ipHeader : 'unknown'
  const ipHash = await sha256Hex(clientIp)

  const configs: LimitConfig[] = []
  if (!isMetricsRead) {
    const { IP, USER } = RATE_LIMITS
    if (IP.HOUR_MAX > 0) {
      configs.push({
        scope: 'ip',
        identifier: `${IP.HOUR_WINDOW_SEC}:${ipHash}`,
        windowSeconds: IP.HOUR_WINDOW_SEC,
        max: IP.HOUR_MAX,
      })
    }
    if (IP.DAY_MAX > 0) {
      configs.push({
        scope: 'ip',
        identifier: `${IP.DAY_WINDOW_SEC}:${ipHash}`,
        windowSeconds: IP.DAY_WINDOW_SEC,
        max: IP.DAY_MAX,
      })
    }
    if (USER.HOUR_MAX > 0) {
      configs.push({
        scope: 'user',
        identifier: `${USER.HOUR_WINDOW_SEC}:${userId}`,
        windowSeconds: USER.HOUR_WINDOW_SEC,
        max: USER.HOUR_MAX,
      })
    }
    if (USER.DAY_MAX > 0) {
      configs.push({
        scope: 'user',
        identifier: `${USER.DAY_WINDOW_SEC}:${userId}`,
        windowSeconds: USER.DAY_WINDOW_SEC,
        max: USER.DAY_MAX,
      })
    }
  }

  const result = await applyRateLimits(c.env, configs)
  if (!result.allowed) {
    const meta = result.meta[0]
    if (meta) c.set('rateLimitMeta', meta)
    logAnomaly('rate_limit_blocked', {
      scope: meta?.scope ?? 'unknown',
      userId,
      ipHash,
    })
    console.warn('[security] rate limit exceeded', {
      scope: meta?.scope,
      userId,
      ipHash,
    })
    applySecurityHeaders(c)
    return c.json(
      {
        error: 'rate_limit_exceeded',
        scope: meta?.scope ?? 'unknown',
        retryAfterSeconds: meta?.retryAfterSeconds ?? 60,
      },
      429
    )
  }

  if (result.meta.length) {
    const latest = result.meta[result.meta.length - 1]
    c.set('rateLimitMeta', latest)
    if (latest.remaining <= 5) {
      logAnomaly('rate_limit_near_exhaustion', {
        scope: latest.scope,
        remaining: latest.remaining,
        resetAt: latest.resetAt,
      })
    }
  }

  await next()
  applySecurityHeaders(c)
}
