'use client'

import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'

type Quotas = {
  day: { used: number; limit: number | null; resetAt: string | null }
  minute: { used: number; limit: number | null; resetAt: string | null }
}

type Metrics = {
  providers: Record<
    string,
    {
      enabled: boolean
      nearLimit: boolean
      daily: { day: string; success: number; failure: number; successRate: number }
    }
  >
  queue: { totalItems: number; queues: { key: string; count: number }[] }
  semaphores: { providerConcurrency: number; kvConcurrency: number }
}

type QuotasResponse = { quotas: Partial<Record<string, Quotas>> }

const SAMPLE_QUOTAS: Partial<Record<string, Quotas>> = {
  groq: {
    minute: { used: 28, limit: 30, resetAt: new Date(Date.now() + 60000).toISOString() },
    day: { used: 450, limit: 500, resetAt: new Date(Date.now() + 3600000).toISOString() },
  },
  huggingface: {
    minute: { used: 10, limit: 60, resetAt: null },
    day: { used: 100, limit: 1000, resetAt: null },
  },
}

const SAMPLE_METRICS: Metrics = {
  providers: {
    groq: {
      enabled: true,
      nearLimit: true,
      daily: { day: 'mock', success: 120, failure: 5, successRate: 0.96 },
    },
    huggingface: {
      enabled: true,
      nearLimit: false,
      daily: { day: 'mock', success: 80, failure: 2, successRate: 0.98 },
    },
  },
  queue: {
    totalItems: 3,
    queues: [
      { key: 'quick|default', count: 2 },
      { key: 'enhanced|medical', count: 1 },
    ],
  },
  semaphores: { providerConcurrency: 4, kvConcurrency: 3 },
}

function resolveApiBase(raw: string): string {
  if (raw && !raw.includes('localhost:8787')) return raw
  if (typeof window !== 'undefined') return window.location.origin
  return raw || ''
}

function percent(used?: number | null, limit?: number | null): number {
  if (!limit || limit <= 0 || !used) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 1500): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }
    return (await response.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

export default function DashboardPage(): ReactElement {
  const [rawApiBase] = useState(() => process.env.NEXT_PUBLIC_API_BASE ?? '')
  const apiBase = useMemo(() => resolveApiBase(rawApiBase), [rawApiBase])
  const [quotas, setQuotas] = useState<Partial<Record<string, Quotas>>>({})
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [usingFallback, setUsingFallback] = useState(false)
  const providers = ['groq', 'huggingface', 'together', 'cohere', 'workersAI']

  const fetchAll = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      setError(false)
      setUsingFallback(false)
      const [q, m] = await Promise.all([
        fetchJsonWithTimeout<QuotasResponse>(`${apiBase}/api/quotas`),
        fetchJsonWithTimeout<Metrics>(`${apiBase}/api/metrics`),
      ])
      setQuotas(q.quotas ?? {})
      setMetrics(m)
    } catch (e) {
      console.error(e)
      setError(true)
      setQuotas({})
      setMetrics(null)
      const lowerBase = apiBase.toLowerCase()
      if (
        !lowerBase ||
        lowerBase.includes('localhost:8787') ||
        lowerBase.includes('127.0.0.1:8787')
      ) {
        setQuotas(SAMPLE_QUOTAS)
        setMetrics(SAMPLE_METRICS)
        setError(false)
        setUsingFallback(true)
      }
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  useEffect((): (() => void) => {
    void fetchAll()
    const t = setInterval((): void => {
      void fetchAll()
    }, 5000)
    return (): void => {
      clearInterval(t)
    }
  }, [fetchAll])

  return (
    <div className="min-h-screen bg-slate-50 pb-20 pt-12 dark:bg-slate-950">
      <div className="container mx-auto flex max-w-6xl flex-col gap-12 px-4 lg:px-8">
        <header className="flex flex-col gap-3">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.3em] text-slate-500 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300">
            Pulse overview
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Quota Dashboard</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-300">
            Lihat status provider, antrean SSE, dan semaphore worker secara realtime. Data mock
            tersedia ketika worker lokal belum terkonfigurasi.
          </p>
        </header>

        {loading && (
          <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 text-sm text-slate-500 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
            Memperbarui metrik…
          </div>
        )}

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
            Tidak dapat memuat metrik dari worker sekarang. Coba lagi beberapa saat lagi.
          </div>
        )}

        {usingFallback && !error && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            Menampilkan data contoh karena worker lokal belum aktif.
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => {
            const q = quotas[p]
            const m = metrics?.providers[p]
            const minuteUsed = q ? q.minute.used : 0
            const minuteLimit = q ? q.minute.limit : null
            const dayUsed = q ? q.day.used : 0
            const dayLimit = q ? q.day.limit : null
            const minutePct = percent(minuteUsed, minuteLimit)
            const dayPct = percent(dayUsed, dayLimit)
            return (
              <div
                key={p}
                className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold capitalize text-slate-900 dark:text-white">{p}</h2>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      Success rate {m ? Math.round((m.daily.successRate || 0) * 100) : 100}% ·{' '}
                      {m?.daily.success ?? 0} sukses / {m?.daily.failure ?? 0} gagal today
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${m?.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}
                    >
                      {m?.enabled ? 'aktif' : 'nonaktif'}
                    </span>
                    {m?.nearLimit && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                        near limit
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  <div>
                    <div className="flex justify-between text-[11px] uppercase tracking-widest text-slate-400">
                      <span>Menit</span>
                      <span>
                        {minuteUsed}/{minuteLimit ?? '—'}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-violet-500"
                        style={{ width: `${minutePct.toString()}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] uppercase tracking-widest text-slate-400">
                      <span>Harian</span>
                      <span>
                        {dayUsed}/{dayLimit ?? '—'}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-indigo-400 via-purple-400 to-rose-400"
                        style={{ width: `${dayPct.toString()}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Antrean</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                Total items: {metrics?.queue.totalItems ?? 0}
              </span>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-500 dark:text-slate-300">
              {metrics?.queue.queues.map((q) => (
                <li
                  key={q.key}
                  className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white/80 p-4 dark:border-slate-700/60 dark:bg-slate-900/70"
                >
                  <span className="font-medium text-slate-700 dark:text-slate-200">{q.key}</span>
                  <span className="text-slate-400">{q.count}</span>
                </li>
              ))}
              {(metrics?.queue.queues.length ?? 0) === 0 && (
                <li className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-slate-400 dark:border-slate-700 dark:text-slate-400">
                  No pending batches
                </li>
              )}
            </ul>
          </section>

          <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/70">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Semaphores</h2>
            <dl className="mt-4 space-y-3 text-sm text-slate-500 dark:text-slate-300">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white/80 p-4 text-sm text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300">
                <span>
                  provider concurrency:{' '}
                  <strong className="font-semibold text-slate-700 dark:text-slate-100">
                    {metrics?.semaphores.providerConcurrency ?? 5}
                  </strong>
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white/80 p-4 text-sm text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/70 dark:text-slate-300">
                <span>
                  KV concurrency:{' '}
                  <strong className="font-semibold text-slate-700 dark:text-slate-100">
                    {metrics?.semaphores.kvConcurrency ?? 5}
                  </strong>
                </span>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}
