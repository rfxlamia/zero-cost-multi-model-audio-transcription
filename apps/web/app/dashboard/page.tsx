"use client"

import { useEffect, useState } from 'react'

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

function percent(used?: number | null, limit?: number | null) {
  if (!limit || limit <= 0 || !used) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

export default function DashboardPage() {
  const [apiBase] = useState(process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8787')
  const [quotas, setQuotas] = useState<Record<string, Quotas>>({})
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const providers = ['groq', 'huggingface', 'together', 'cohere', 'workersAI']

  async function fetchAll() {
    setLoading(true)
    try {
      const [q, m] = await Promise.all([
        fetch(`${apiBase}/api/quotas`).then((r) => r.json()),
        fetch(`${apiBase}/api/metrics`).then((r) => r.json()),
      ])
      setQuotas(q?.quotas || {})
      setMetrics(m)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    const t = setInterval(fetchAll, 5000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Quota Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-300">Monitor usage, provider status, and queues.</p>
        </div>

        {loading && (
          <div className="mb-6 text-sm text-gray-600 dark:text-gray-300">Loading metrics…</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {providers.map((p) => {
            const q = quotas[p]
            const m = metrics?.providers?.[p]
            const minutePct = percent(q?.minute?.used ?? 0, (q?.minute?.limit as number | null) ?? null)
            const dayPct = percent(q?.day?.used ?? 0, (q?.day?.limit as number | null) ?? null)
            return (
              <div key={p} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">{p}</div>
                  <div className="flex gap-1 items-center">
                    <span className={`px-2 py-0.5 rounded text-xs ${m?.enabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>{m?.enabled ? 'enabled' : 'disabled'}</span>
                    {m?.nearLimit && <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">near limit</span>}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mb-3">Success rate: {m ? Math.round((m.daily.successRate || 0) * 100) : 100}%</div>
                <div className="mb-2">
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span>Minute</span>
                    <span>{q?.minute?.used ?? 0}/{q?.minute?.limit ?? '—'}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded">
                    <div className="h-2 bg-indigo-500 rounded" style={{ width: `${minutePct}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span>Day</span>
                    <span>{q?.day?.used ?? 0}/{q?.day?.limit ?? '—'}</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded">
                    <div className="h-2 bg-indigo-700 rounded" style={{ width: `${dayPct}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">Queue</div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">Total items: {metrics?.queue?.totalItems ?? 0}</div>
            <div className="space-y-2">
              {metrics?.queue?.queues?.map((q) => (
                <div key={q.key} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-200">{q.key}</span>
                  <span className="text-gray-500">{q.count}</span>
                </div>
              ))}
              {(!metrics || metrics.queue.queues.length === 0) && (
                <div className="text-sm text-gray-500">No pending batches</div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">Semaphores</div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">Provider concurrency: {metrics?.semaphores?.providerConcurrency ?? 5}</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">KV concurrency: {metrics?.semaphores?.kvConcurrency ?? 5}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

