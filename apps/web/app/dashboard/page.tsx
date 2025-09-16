'use client'

import { useCallback, useEffect, useState, type ReactElement } from 'react'

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

function percent(used?: number | null, limit?: number | null): number {
  if (!limit || limit <= 0 || !used) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

export default function DashboardPage(): ReactElement {
  const [apiBase] = useState(process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8787')
  const [quotas, setQuotas] = useState<Partial<Record<string, Quotas>>>({})
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const providers = ['groq', 'huggingface', 'together', 'cohere', 'workersAI']

  const fetchAll = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const [q, m] = await Promise.all<[QuotasResponse, Metrics]>([
        fetch(`${apiBase}/api/quotas`).then((r) => r.json() as Promise<QuotasResponse>),
        fetch(`${apiBase}/api/metrics`).then((r) => r.json() as Promise<Metrics>),
      ])
      setQuotas(q.quotas)
      setMetrics(m)
    } catch (e) {
      console.error(e)
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Quota Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Monitor usage, provider status, and queues.
          </p>
        </div>

        {loading && (
          <div className="mb-6 text-sm text-gray-600 dark:text-gray-300">Loading metrics…</div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{p}</div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${m?.enabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}
                    >
                      {m?.enabled ? 'enabled' : 'disabled'}
                    </span>
                    {m?.nearLimit && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        near limit
                      </span>
                    )}
                  </div>
                </div>
                <div className="mb-3 text-xs text-gray-500">
                  Success rate: {m ? Math.round((m.daily.successRate || 0) * 100) : 100}%
                </div>
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span>Minute</span>
                    <span>
                      {minuteUsed}/{minuteLimit ?? '—'}
                    </span>
                  </div>
                  <div className="h-2 rounded bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-2 rounded bg-indigo-500"
                      style={{ width: `${minutePct.toString()}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span>Day</span>
                    <span>
                      {dayUsed}/{dayLimit ?? '—'}
                    </span>
                  </div>
                  <div className="h-2 rounded bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-2 rounded bg-indigo-700"
                      style={{ width: `${dayPct.toString()}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">Queue</div>
            </div>
            <div className="mb-2 text-sm text-gray-600 dark:text-gray-300">
              Total items: {metrics?.queue.totalItems ?? 0}
            </div>
            <div className="space-y-2">
              {metrics?.queue.queues.map((q) => (
                <div key={q.key} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-200">{q.key}</span>
                  <span className="text-gray-500">{q.count}</span>
                </div>
              ))}
              {(metrics?.queue.queues.length ?? 0) === 0 && (
                <div className="text-sm text-gray-500">No pending batches</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">Semaphores</div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Provider concurrency: {metrics?.semaphores.providerConcurrency ?? 5}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              KV concurrency: {metrics?.semaphores.kvConcurrency ?? 5}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
