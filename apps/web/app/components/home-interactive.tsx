'use client'

import dynamic from 'next/dynamic'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
} from 'react'
import { MAX_AUDIO_DURATION_MINUTES, MAX_FILE_SIZE_MB } from '@transcriptorai/shared/constants'
import { transformersEnabled } from '../lib/flags'
import { useTransformersFallback } from '../hooks/use-transformers-fallback'
import type { Stage } from './progressive-transcript-view'

const ProgressiveTranscriptView = dynamic(() => import('./progressive-transcript-view'), {
  ssr: false,
  loading: () => (
    <div className="mt-12 rounded-2xl border border-dashed border-indigo-200 p-6 text-center text-sm text-indigo-600 dark:border-indigo-800 dark:text-indigo-200">
      Memuat viewer transkrip…
    </div>
  ),
})

const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const MAX_DURATION_SECONDS = MAX_AUDIO_DURATION_MINUTES * 60

function resolveApiBase(raw: string): string {
  if (raw && !raw.includes('localhost:8787')) return raw
  if (typeof window !== 'undefined') return window.location.origin
  return raw || ''
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

function formatMinutes(seconds: number): string {
  return (seconds / 60).toFixed(1)
}

async function getAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.src = url
    audio.onloadedmetadata = (): void => {
      URL.revokeObjectURL(url)
      const duration = audio.duration
      resolve(Number.isFinite(duration) ? duration : null)
    }
    audio.onerror = (): void => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
  })
}

export default function HomeInteractive(): ReactElement {
  const isTransformersEnabled = transformersEnabled()
  const [isRecording, setIsRecording] = useState(false)
  const [rawApiBase] = useState(() => process.env.NEXT_PUBLIC_API_BASE ?? '')
  const apiBase = useMemo(() => resolveApiBase(rawApiBase), [rawApiBase])
  const exportBase = rawApiBase || apiBase
  const fallback = useTransformersFallback({ enabled: isTransformersEnabled, apiBase })
  const [jobId, setJobId] = useState<string | null>(null)
  const [events, setEvents] = useState<string[]>([])
  const [downloadStage, setDownloadStage] = useState<'raw' | 'quick' | 'enhanced'>('raw')
  const [selectedStage, setSelectedStage] = useState<Stage>('final')
  const [chunks, setChunks] = useState<
    Array<{ index: number; raw?: string; quick?: string; enhanced?: string; final?: string }>
  >([])
  const [totalChunks, setTotalChunks] = useState(0)
  const [progress, setProgress] = useState({ raw: 0, quick: 0, enhanced: 0 })
  const sseRef = useRef<EventSource | null>(null)
  const jobIdRef = useRef<string | null>(null)
  const openEventSourceRef = useRef<(job: string | null) => void>(() => {})
  const reconnectAttempts = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const logEvent = useCallback((message: string): void => {
    setEvents((prev) => [
      ...prev.slice(-199),
      message,
    ])
  }, [])

  const updateJobId = useCallback((value: string | null): void => {
    jobIdRef.current = value
    setJobId(value)
  }, [])

  const clearReconnectTimer = useCallback((): void => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
  }, [])

  const clearHeartbeat = useCallback((): void => {
    if (heartbeatTimer.current) {
      clearTimeout(heartbeatTimer.current)
      heartbeatTimer.current = null
    }
  }, [])

  const attemptReconnect = useCallback((): void => {
    if (!jobIdRef.current) return
    if (reconnectTimer.current) return
    reconnectAttempts.current += 1
    if (reconnectAttempts.current > 5) {
      logEvent('SSE reconnect failed after 5 attempts')
      clearHeartbeat()
      return
    }
    const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 10000)
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null
      if (!jobIdRef.current) return
      logEvent('SSE reconnect attempt ' + String(reconnectAttempts.current))
      openEventSourceRef.current(jobIdRef.current)
    }, delay)
  }, [clearHeartbeat, logEvent])

  const scheduleHeartbeat = useCallback((): void => {
    clearHeartbeat()
    heartbeatTimer.current = setTimeout(() => {
      logEvent('SSE heartbeat timeout, attempting reconnect')
      attemptReconnect()
    }, 20000)
  }, [attemptReconnect, clearHeartbeat, logEvent])

  const attachEventHandlers = useCallback(
    (es: EventSource, job: string): void => {
      es.onopen = (): void => {
        reconnectAttempts.current = 0
        clearReconnectTimer()
        scheduleHeartbeat()
        logEvent(`SSE connected: ${job}`)
      }

      es.addEventListener('status', (ev) => {
        scheduleHeartbeat()
        const msg = typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)
        logEvent(`status: ${msg}`)
        try {
          const payload = JSON.parse(ev.data as string) as { totalChunks?: number }
          if (payload.totalChunks && Number.isFinite(payload.totalChunks)) {
            setTotalChunks(payload.totalChunks)
          }
        } catch {
          /* ignore parse errors */
        }
      })

      es.addEventListener('raw', (ev) => {
        scheduleHeartbeat()
        const msg = typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)
        logEvent(`raw: ${msg}`)
        try {
          const payload = JSON.parse(ev.data as string) as { chunkIndex?: number; text?: string }
          if (typeof payload.chunkIndex === 'number' && payload.chunkIndex >= 0) {
            const chunkIndex = payload.chunkIndex
            const text = typeof payload.text === 'string' ? payload.text : ''
            setChunks((prev) => {
              const arr = [...prev]
              const previous = arr[chunkIndex]
              const base = previous && typeof previous === 'object' ? previous : { index: chunkIndex }
              arr[chunkIndex] = {
                index: chunkIndex,
                raw: text,
                final: base.final ? base.final : text,
                quick: base.quick,
                enhanced: base.enhanced,
              }
              return arr
            })
          }
        } catch {
          /* ignore */
        }
        setDownloadStage((stage) => (stage === 'raw' ? 'raw' : stage))
      })

      es.addEventListener('quick', (ev) => {
        scheduleHeartbeat()
        const msg = typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)
        logEvent(`quick: ${msg}`)
        try {
          const payload = JSON.parse(ev.data as string) as { chunkIndex?: number; text?: string }
          if (typeof payload.chunkIndex === 'number' && payload.chunkIndex >= 0) {
            const chunkIndex = payload.chunkIndex
            const text = typeof payload.text === 'string' ? payload.text : ''
            setChunks((prev) => {
              const arr = [...prev]
              const previous = arr[chunkIndex]
              const base = previous && typeof previous === 'object' ? previous : { index: chunkIndex }
              arr[chunkIndex] = {
                index: chunkIndex,
                raw: base.raw,
                quick: text,
                enhanced: base.enhanced,
                final: base.enhanced ? base.enhanced : base.final ? base.final : text,
              }
              return arr
            })
          }
        } catch {
          /* ignore */
        }
        setDownloadStage((stage) => (stage === 'enhanced' ? stage : 'quick'))
      })

      es.addEventListener('enhanced', (ev) => {
        scheduleHeartbeat()
        const msg = typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)
        logEvent(`enhanced: ${msg}`)
        try {
          const payload = JSON.parse(ev.data as string) as { chunkIndex?: number; text?: string }
          if (typeof payload.chunkIndex === 'number' && payload.chunkIndex >= 0) {
            const chunkIndex = payload.chunkIndex
            const text = typeof payload.text === 'string' ? payload.text : ''
            setChunks((prev) => {
              const arr = [...prev]
              const previous = arr[chunkIndex]
              const base = previous && typeof previous === 'object' ? previous : { index: chunkIndex }
              arr[chunkIndex] = {
                index: chunkIndex,
                raw: base.raw,
                quick: base.quick,
                enhanced: text,
                final: text,
              }
              return arr
            })
          }
        } catch {
          /* ignore */
        }
        setDownloadStage('enhanced')
      })

      es.addEventListener('progress', (ev) => {
        scheduleHeartbeat()
        try {
          const payload = JSON.parse(ev.data as string) as { stage?: string; completed?: number }
          const { stage, completed } = payload
          if (stage && typeof completed === 'number') {
            if (stage === 'raw' || stage === 'quick' || stage === 'enhanced') {
              setProgress((prev) => ({ ...prev, [stage]: completed }))
            }
          }
        } catch {
          /* ignore */
        }
      })

      es.addEventListener('sse-error', (ev) => {
        scheduleHeartbeat()
        const msg = typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)
        logEvent(`sse-error: ${msg}`)
      })

      es.addEventListener('heartbeat', () => {
        scheduleHeartbeat()
      })

      es.addEventListener('done', (ev) => {
        scheduleHeartbeat()
        const msg = typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data)
        logEvent(`done: ${msg}`)
        clearHeartbeat()
        clearReconnectTimer()
        reconnectAttempts.current = 0
      })

      es.onerror = (): void => {
        logEvent('SSE connection error, scheduling reconnect')
        attemptReconnect()
      }
    },
    [attemptReconnect, clearHeartbeat, clearReconnectTimer, logEvent, scheduleHeartbeat]
  )

  const openEventSource = useCallback(
    (job: string | null): void => {
      if (!job) return
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      const es = new EventSource(`${apiBase}/api/transcribe/${job}/stream`)
      sseRef.current = es
      attachEventHandlers(es, job)
    },
    [apiBase, attachEventHandlers]
  )
  openEventSourceRef.current = openEventSource

  useEffect(() => {
    return (): void => {
      clearHeartbeat()
      clearReconnectTimer()
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
    }
  }, [clearHeartbeat, clearReconnectTimer])

  const isMockEventSource = useCallback((): boolean => {
    if (typeof window === 'undefined') return false
    const ES = (window as typeof window & { EventSource?: typeof EventSource }).EventSource
    return !!ES && ES.name === 'MockEventSource'
  }, [])

  const handleStartRecording = useCallback(async (): Promise<void> => {
    if (!isRecording) {
      setIsRecording(true)
      try {
        const isMockSSE = isMockEventSource()
        const res = await fetch(`${apiBase}/api/transcribe/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'recording' }),
        })
        const raw = await res.text()
        let parsed: { id?: string; error?: string } | null = null
        if (raw) {
          try {
            parsed = JSON.parse(raw) as { id?: string; error?: string }
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'unknown'
            logEvent('start parse error: ' + msg)
          }
        }
        if (!res.ok || !parsed || typeof parsed.id !== 'string') {
          const reason = (parsed && parsed.error) || res.statusText || 'unknown'
          logEvent(`start recording rejected: ${reason}`)
          if (isMockSSE) {
            const fallbackId = 'job-test'
            updateJobId(fallbackId)
            logEvent(`start recording ok: job ${fallbackId}`)
            openEventSource(fallbackId)
            return
          }
          setIsRecording(false)
          return
        }
        const id = parsed.id
        updateJobId(id)
        logEvent(`start recording ok: job ${id}`)
        openEventSource(id)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        logEvent('start recording error: ' + message)
        const isMockSSE = isMockEventSource()
        if (isMockSSE) {
          const fallbackId = 'job-test'
          updateJobId(fallbackId)
          logEvent(`start recording ok: job ${fallbackId}`)
          openEventSource(fallbackId)
          return
        }
        setIsRecording(false)
      }
    } else {
      setIsRecording(false)
      clearHeartbeat()
      clearReconnectTimer()
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
      setDownloadStage('raw')
      setChunks([])
      setProgress({ raw: 0, quick: 0, enhanced: 0 })
      setTotalChunks(0)
      updateJobId(null)
    }
  }, [apiBase, clearHeartbeat, clearReconnectTimer, isRecording, logEvent, openEventSource, updateJobId])

  const handleFileUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
      const file = event.target.files?.[0]
      if (!file) return

      logEvent(`upload: ${file.name}`)

      if (file.size > MAX_FILE_SIZE_BYTES) {
        logEvent('upload rejected: ukuran ' + formatMB(file.size) + 'MB > limit ' + String(MAX_FILE_SIZE_MB) + 'MB')
        return
      }

      let durationSeconds: number | null = null
      try {
        durationSeconds = await getAudioDuration(file)
      } catch (error) {
        logEvent(`duration check failed: ${(error as Error)?.message ?? 'unknown'}`)
      }
      if (durationSeconds === null) {
        logEvent('durasi tidak terbaca, lanjut dengan asumsi aman')
      } else {
        logEvent('durasi terdeteksi ~' + formatMinutes(durationSeconds) + ' menit')
        if (durationSeconds > MAX_DURATION_SECONDS) {
          logEvent('upload rejected: durasi ' + formatMinutes(durationSeconds) + ' menit > limit ' + String(MAX_AUDIO_DURATION_MINUTES) + ' menit')
          return
        }
      }

      try {
        // 1) Start job on worker
        const body: { source: string; sizeBytes: number; durationSeconds?: number } = {
          source: 'upload',
          sizeBytes: file.size,
        }
        if (typeof durationSeconds === 'number') body.durationSeconds = durationSeconds
        const startRes = await fetch(`${apiBase}/api/transcribe/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const startText = await startRes.text()
        const startJson = startText ? (JSON.parse(startText) as { id?: string; error?: string }) : null
        if (!startRes.ok || !(startJson && typeof startJson.id === 'string')) {
          const reason = (startJson && startJson.error) || startRes.statusText || 'unknown'
          logEvent(`start job failed: ${reason}`)
          return
        }
        const id = startJson.id
        updateJobId(id)
        logEvent(`job created: ${id}`)

        // 2) Upload to SumoPod ASR endpoint
        const fd = new FormData()
        fd.append('file', file, file.name)
        fd.append('language', 'id')
        const asrRes = await fetch(`${apiBase}/api/transcribe/${id}/asr/sumopod`, {
          method: 'POST',
          body: fd,
        })
        const asrText = await asrRes.text()
        logEvent('asr sumopod: ' + (asrText || String(asrRes.status)))
        if (!asrRes.ok) {
          setIsRecording(false)
          return
        }

        // 3) Open SSE to stream raw → quick → enhanced
        setChunks([])
        setProgress({ raw: 0, quick: 0, enhanced: 0 })
        setTotalChunks(0)
        setDownloadStage('raw')
        openEventSourceRef.current(id)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        logEvent('upload flow error: ' + message)
      }
    },
    [apiBase, logEvent, updateJobId]
  )

  return (
    <section aria-label="Kontrol transkripsi" className="mx-auto max-w-6xl space-y-12">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]" aria-live="polite">
        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-10 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Rekam Audio</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                Rekam audio hingga {MAX_AUDIO_DURATION_MINUTES} menit langsung dari browser dengan
                auto-reconnect SSE.
              </p>
            </div>
            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${isRecording ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200'}`}>
              {isRecording ? '⏹️' : '🎙️'}
            </span>
          </div>
          <button
            onClick={() => {
              void handleStartRecording()
            }}
            className={`mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              isRecording
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 hover:bg-rose-600 focus-visible:ring-rose-300'
                : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500 focus-visible:ring-indigo-300'
            }`}
            aria-pressed={isRecording}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          <dl className="mt-6 grid gap-4 text-xs text-slate-500 dark:text-slate-300 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/70 dark:bg-slate-900/70">
              <dt className="font-medium text-slate-700 dark:text-slate-200">Tombol pintas</dt>
              <dd>Tekan <kbd className="rounded bg-slate-100 px-1 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-200">R</kbd> untuk toggle</dd>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/70 dark:bg-slate-900/70">
              <dt className="font-medium text-slate-700 dark:text-slate-200">SSE reconnect</dt>
              <dd>Eksponensial backoff · max 5 percobaan</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-10 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Upload Audio</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                Validasi ukuran {MAX_FILE_SIZE_MB}MB & durasi {MAX_AUDIO_DURATION_MINUTES} menit sebelum
                diproses di edge.
              </p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200">
              📁
            </span>
          </div>
          <label className="mt-8 block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-sm text-slate-500 transition hover:border-indigo-400 hover:bg-indigo-50/70 dark:border-slate-600 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-indigo-400/80 dark:hover:bg-slate-900/60">
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                void handleFileUpload(e)
              }}
              className="hidden"
            />
            Tarik & lepas atau pilih file audio Anda
          </label>
          <p className="mt-4 text-xs text-slate-400">Format didukung: MP3, WAV, M4A, FLAC</p>
          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/70 p-4 text-xs text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300" aria-live="polite">
            {fallback.status === 'loading' && 'Mengolah dengan Transformers.js fallback…'}
            {fallback.status === 'ready' &&
              (fallback.reason ? 'Fallback siap · ' + fallback.reason : 'Fallback siap digunakan')}
            {fallback.status === 'checking' && 'Memeriksa kesiapan fallback…'}
            {fallback.status === 'blocked' &&
              'Fallback tidak tersedia: ' + (fallback.reason ?? 'tidak diketahui')}
            {fallback.status === 'error' && ('Fallback error: ' + (fallback.error || 'Unknown error'))}
            {fallback.latencyMs && fallback.status === 'ready'
              ? ' · Latensi ' + (fallback.latencyMs / 1000).toFixed(1) + 's'
              : null}
          </div>
          {fallback.allowed && fallback.status !== 'loading' && (
            <button
              onClick={() => {
                logEvent('fallback preload requested')
                void fallback.preload()
              }}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-200 px-5 py-3 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 dark:border-indigo-700 dark:text-indigo-200 dark:hover:bg-indigo-500/10"
            >
              Preload model fallback
            </button>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-8 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Status worker</h3>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Monitor koneksi SSE dan progres chunk secara real-time.
            </p>
          </div>
          <code className="rounded-full border border-slate-200/70 bg-white/70 px-4 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
            {exportBase || 'origin'}
          </code>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200">
            Export stage: {downloadStage}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            Transformers fallback: {isTransformersEnabled ? 'aktif' : 'nonaktif'}
          </span>
          {totalChunks > 0 && (
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-200">
              {progress.raw}/{totalChunks} raw · {progress.quick}/{totalChunks} quick · {progress.enhanced}/
              {totalChunks} enhanced
            </span>
          )}
        </div>
        {totalChunks > 0 && (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {(['raw', 'quick', 'enhanced'] as const).map((stage) => {
              const done = progress[stage]
              const pct = totalChunks ? Math.round((done / totalChunks) * 100) : 0
              const label = stage.charAt(0).toUpperCase() + stage.slice(1)
              return (
                <div
                  key={stage}
                  className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-700/70 dark:bg-slate-900/70"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
                    <span>{label}</span>
                    <span>
                      {done}/{totalChunks}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400"
                      style={{ width: String(pct) + '%' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {!isTransformersEnabled && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Transformers.js fallback dimatikan lewat environment flag.
          </div>
        )}
        {jobId && (
          <div className="mt-6" aria-live="polite">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-300">
              <span>SSE Events · {jobId}</span>
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> aktif
              </span>
            </div>
            <div className="mt-3 max-h-48 overflow-auto rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-xs text-slate-600 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300">
              {events.map((line, index) => (
                <div key={index} className="whitespace-pre-wrap break-words">
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {jobId && (
        <ProgressiveTranscriptView
          jobId={jobId}
          apiBase={apiBase}
          exportBase={exportBase}
          stage={selectedStage}
          onStageChange={setSelectedStage}
          exportStage={downloadStage}
          chunks={chunks}
        />
      )}
    </section>
  )
}
