'use client'

import { useEffect, useRef, useState, type ChangeEvent, type ReactElement } from 'react'
import { MAX_AUDIO_DURATION_MINUTES, MAX_FILE_SIZE_MB } from '@transcriptorai/shared/constants'
import ProgressiveTranscriptView, { type Stage } from './components/progressive-transcript-view'
import { transformersEnabled } from './lib/flags'
import { useTransformersFallback } from './hooks/use-transformers-fallback'

const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const MAX_DURATION_SECONDS = MAX_AUDIO_DURATION_MINUTES * 60

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
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const duration = Number(audio.duration)
      resolve(Number.isFinite(duration) ? duration : null)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
  })
}

export default function HomePage(): ReactElement {
  const [isRecording, setIsRecording] = useState(false)
  const [apiBase] = useState(process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8787')
  const fallback = useTransformersFallback({ enabled: transformersEnabled(), apiBase })
  const [jobId, setJobId] = useState<string | null>(null)
  const [events, setEvents] = useState<string[]>([])
  const [downloadStage, setDownloadStage] = useState<'raw' | 'quick' | 'enhanced'>('raw')
  const [selectedStage, setSelectedStage] = useState<Stage>('final')
  const [chunks, setChunks] = useState<
    Array<{ index: number; raw?: string; quick?: string; enhanced?: string; final?: string }>
  >([])
  const [totalChunks, setTotalChunks] = useState<number>(0)
  const [progress, setProgress] = useState<{ raw: number; quick: number; enhanced: number }>({
    raw: 0,
    quick: 0,
    enhanced: 0,
  })
  const sseRef = useRef<EventSource | null>(null)
  const jobIdRef = useRef<string | null>(null)
  const reconnectAttempts = useRef(0)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateJobId = (value: string | null): void => {
    jobIdRef.current = value
    setJobId(value)
  }

  const clearReconnectTimer = (): void => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
  }

  const clearHeartbeat = (): void => {
    if (heartbeatTimer.current) {
      clearTimeout(heartbeatTimer.current)
      heartbeatTimer.current = null
    }
  }

  function attemptReconnect(): void {
    if (!jobIdRef.current) return
    if (reconnectTimer.current) return
    reconnectAttempts.current += 1
    if (reconnectAttempts.current > 5) {
      setEvents((prev) => [...prev, 'SSE reconnect failed after 5 attempts'])
      clearHeartbeat()
      return
    }
    const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 10000)
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null
      if (!jobIdRef.current) return
      setEvents((prev) => [...prev, `SSE reconnect attempt ${reconnectAttempts.current}`])
      openEventSource(jobIdRef.current)
    }, delay)
  }

  function scheduleHeartbeat(): void {
    clearHeartbeat()
    heartbeatTimer.current = setTimeout(() => {
      setEvents((prev) => [...prev, 'SSE heartbeat timeout, attempting reconnect'])
      attemptReconnect()
    }, 20000)
  }

  function attachEventHandlers(es: EventSource, job: string): void {
    es.onopen = () => {
      reconnectAttempts.current = 0
      clearReconnectTimer()
      scheduleHeartbeat()
      setEvents((prev) => [...prev, `SSE connected: ${job}`])
    }

    es.addEventListener('status', (ev) => {
      scheduleHeartbeat()
      const e = ev
      const msg = typeof e.data === 'string' ? e.data : JSON.stringify(e.data)
      setEvents((prev) => [...prev, `status: ${msg}`])
      try {
        const d: unknown = JSON.parse(e.data as string)
        if (
          typeof d === 'object' &&
          d !== null &&
          'totalChunks' in d &&
          typeof (d as { totalChunks?: unknown }).totalChunks === 'number'
        ) {
          setTotalChunks((d as { totalChunks: number }).totalChunks)
        }
      } catch {
        /* ignore */
      }
    })

    es.addEventListener('raw', (ev) => {
      scheduleHeartbeat()
      const e = ev
      const msg = typeof e.data === 'string' ? e.data : JSON.stringify(e.data)
      setEvents((prev) => [...prev, `raw: ${msg}`])
      try {
        const d: unknown = JSON.parse(e.data as string)
        if (
          typeof d === 'object' &&
          d !== null &&
          'chunkIndex' in d &&
          'text' in d &&
          Number.isFinite(Number((d as { chunkIndex?: unknown }).chunkIndex))
        ) {
          const idx = Number((d as { chunkIndex: unknown }).chunkIndex)
          const text =
            typeof (d as { text?: unknown }).text === 'string' ? (d as { text: string }).text : ''

          setChunks((prev) => {
            const arr = [...prev]
            if (!arr[idx]) arr[idx] = { index: idx }
            arr[idx].raw = text
            arr[idx].final = arr[idx].final ?? text
            return arr
          })
        }
      } catch {
        /* ignore */
      }
      setDownloadStage((s) => (s === 'raw' ? 'raw' : s))
    })

    es.addEventListener('quick', (ev) => {
      scheduleHeartbeat()
      const e = ev
      const msg = typeof e.data === 'string' ? e.data : JSON.stringify(e.data)
      setEvents((prev) => [...prev, `quick: ${msg}`])
      try {
        const d: unknown = JSON.parse(e.data as string)
        if (
          typeof d === 'object' &&
          d !== null &&
          'chunkIndex' in d &&
          'text' in d &&
          Number.isFinite(Number((d as { chunkIndex?: unknown }).chunkIndex))
        ) {
          const idx = Number((d as { chunkIndex: unknown }).chunkIndex)
          const text =
            typeof (d as { text?: unknown }).text === 'string' ? (d as { text: string }).text : ''

          setChunks((prev) => {
            const arr = [...prev]
            if (!arr[idx]) arr[idx] = { index: idx }
            arr[idx].quick = text
            arr[idx].final = arr[idx].enhanced ?? text
            return arr
          })
        }
      } catch {
        /* ignore */
      }
      setDownloadStage((s) => (s === 'enhanced' ? s : 'quick'))
    })

    es.addEventListener('enhanced', (ev) => {
      scheduleHeartbeat()
      const e = ev
      const msg = typeof e.data === 'string' ? e.data : JSON.stringify(e.data)
      setEvents((prev) => [...prev, `enhanced: ${msg}`])
      try {
        const d: unknown = JSON.parse(e.data as string)
        if (
          typeof d === 'object' &&
          d !== null &&
          'chunkIndex' in d &&
          'text' in d &&
          Number.isFinite(Number((d as { chunkIndex?: unknown }).chunkIndex))
        ) {
          const idx = Number((d as { chunkIndex: unknown }).chunkIndex)
          const text =
            typeof (d as { text?: unknown }).text === 'string' ? (d as { text: string }).text : ''

          setChunks((prev) => {
            const arr = [...prev]
            if (!arr[idx]) arr[idx] = { index: idx }
            arr[idx].enhanced = text
            arr[idx].final = text
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
      const e = ev
      try {
        const d: unknown = JSON.parse(e.data as string)
        if (typeof d === 'object' && d !== null && 'stage' in d && 'completed' in d) {
          const stage = (d as { stage: unknown }).stage
          const completed = Number((d as { completed: unknown }).completed ?? 0)
          if (stage === 'raw') setProgress((p) => ({ ...p, raw: completed }))
          if (stage === 'quick') setProgress((p) => ({ ...p, quick: completed }))
          if (stage === 'enhanced') setProgress((p) => ({ ...p, enhanced: completed }))
        }
      } catch {
        /* ignore */
      }
    })

    es.addEventListener('sse-error', (ev) => {
      scheduleHeartbeat()
      const e = ev
      const msg = typeof e.data === 'string' ? e.data : JSON.stringify(e.data)
      setEvents((prev) => [...prev, `sse-error: ${msg}`])
    })

    es.addEventListener('heartbeat', () => {
      scheduleHeartbeat()
    })

    es.addEventListener('done', (ev) => {
      scheduleHeartbeat()
      const e = ev
      const msg = typeof e.data === 'string' ? e.data : JSON.stringify(e.data)
      setEvents((prev) => [...prev, `done: ${msg}`])
      clearHeartbeat()
      clearReconnectTimer()
      reconnectAttempts.current = 0
    })

    es.onerror = () => {
      setEvents((prev) => [...prev, 'SSE connection error, scheduling reconnect'])
      attemptReconnect()
    }
  }

  function openEventSource(job: string | null): void {
    if (!job) return
    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
    }
    const es = new EventSource(`${apiBase}/api/transcribe/${job}/stream`)
    sseRef.current = es
    attachEventHandlers(es, job)
  }

  useEffect(() => {
    return () => {
      clearHeartbeat()
      clearReconnectTimer()
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
    }
  }, [])

  const handleStartRecording = async (): Promise<void> => {
    if (!isRecording) {
      setIsRecording(true)
      try {
        const res = await fetch(`${apiBase}/api/transcribe/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'recording' }),
        })
        const raw = await res.text()
        let parsed: any = null
        if (raw) {
          try {
            parsed = JSON.parse(raw)
          } catch (error) {
            console.error('start parse error', error)
          }
        }
        if (!res.ok || !parsed || typeof parsed.id !== 'string') {
          const reason =
            (parsed && typeof parsed.error === 'string' ? parsed.error : res.statusText) ||
            'unknown'
          setEvents((prev) => [...prev, `start recording rejected: ${reason}`])
          setIsRecording(false)
          return
        }
        const id = parsed.id as string
        updateJobId(id)
        setEvents((prev) => [...prev, `start recording ok: job ${id}`])
        openEventSource(id)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error'
        setEvents((prev) => [...prev, `start recording error: ${message}`])
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
    }
  }

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    if (!file) return

    setEvents((prev) => [...prev, `upload: ${file.name}`])

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setEvents((prev) => [
        ...prev,
        `upload rejected: ukuran ${formatMB(file.size)}MB > limit ${MAX_FILE_SIZE_MB}MB`,
      ])
      return
    }

    let durationSeconds: number | null = null
    try {
      durationSeconds = await getAudioDuration(file)
    } catch (error) {
      console.warn('duration check failed', error)
    }
    if (durationSeconds === null) {
      setEvents((prev) => [...prev, 'durasi tidak terbaca, lanjut dengan asumsi aman'])
    } else {
      setEvents((prev) => [...prev, `durasi terdeteksi ~${formatMinutes(durationSeconds)} menit`])
      if (durationSeconds > MAX_DURATION_SECONDS) {
        setEvents((prev) => [
          ...prev,
          `upload rejected: durasi ${formatMinutes(durationSeconds)} menit > limit ${MAX_AUDIO_DURATION_MINUTES} menit`,
        ])
        return
      }
    }

    if (!transformersEnabled()) {
      setEvents((prev) => [...prev, 'fallback disabled via env'])
      return
    }
    if (!fallback.allowed || fallback.status === 'blocked') {
      setEvents((prev) => [...prev, `fallback unavailable: ${fallback.reason || 'unknown reason'}`])
      return
    }
    try {
      setEvents((prev) => [...prev, 'fallback starting model load'])
      const result = await fallback.transcribeFile(file)
      const segments = result.segments.filter((seg) => seg.text.trim().length)
      setEvents((prev) => [
        ...prev,
        `fallback success: ${String(segments.length || result.segments.length)} segments in ${String(Math.round(result.elapsedMs))}ms`,
      ])
      const mapped = (segments.length ? segments : result.segments).map((seg, idx) => ({
        index: idx,
        raw: seg.text,
        quick: seg.text,
        enhanced: seg.text,
        final: seg.text,
      }))
      setChunks(mapped)
      setTotalChunks(mapped.length)
      setProgress({ raw: mapped.length, quick: mapped.length, enhanced: mapped.length })
      setDownloadStage('enhanced')
      setSelectedStage('final')
      updateJobId(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      setEvents((prev) => [...prev, `fallback error: ${message}`])
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900 md:text-6xl dark:text-white">
            TranscriptorAI
          </h1>
          <p className="mb-8 text-xl text-gray-600 dark:text-gray-300">
            Transkripsi suara ke teks Bahasa Indonesia dengan AI correction
          </p>
          <div className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            ✨ Zero-cost • Free tier providers
          </div>
          <div className="mt-4">
            <a
              href="/dashboard"
              className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
            >
              Open Quota Dashboard
            </a>
          </div>
        </div>

        {/* Main Features */}
        <div className="mx-auto mb-16 grid max-w-4xl gap-8 md:grid-cols-2">
          {/* Recorder Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">
              🎤 Rekam Audio
            </h2>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              Rekam langsung dari browser Anda, maksimal {MAX_AUDIO_DURATION_MINUTES} menit
            </p>
            <button
              onClick={() => {
                void handleStartRecording()
              }}
              className={`w-full rounded-xl px-6 py-4 font-medium transition-all ${
                isRecording
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {isRecording ? '⏹️ Stop Recording' : '🎙️ Start Recording'}
            </button>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Shortcut: Tekan R untuk toggle recording
            </div>
          </div>

          {/* Uploader Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900 dark:text-white">
              📁 Upload Audio
            </h2>
            <p className="mb-6 text-gray-600 dark:text-gray-300">
              Drag & drop atau pilih file audio (max {MAX_FILE_SIZE_MB}MB)
            </p>
            <label className="block w-full">
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  void handleFileUpload(e)
                }}
                className="hidden"
              />
              <div className="w-full cursor-pointer rounded-xl border-2 border-dashed border-gray-300 px-6 py-4 text-center transition-colors hover:border-indigo-500 dark:border-gray-600 dark:hover:border-indigo-400">
                <span className="text-gray-600 dark:text-gray-300">
                  📤 Click to upload atau drag file di sini
                </span>
              </div>
            </label>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Format: MP3, WAV, M4A, FLAC
            </div>
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {fallback.status === 'loading' && 'Mengolah dengan Transformers.js fallback…'}
              {fallback.status === 'ready' &&
                (fallback.reason
                  ? `Fallback siap • ${fallback.reason || ''}`
                  : 'Fallback siap digunakan')}
              {fallback.status === 'checking' && 'Memeriksa kesiapan fallback…'}
              {fallback.status === 'blocked' &&
                `Fallback tidak tersedia: ${fallback.reason ?? 'tidak diketahui'}`}
              {fallback.status === 'error' &&
                `Fallback error: ${fallback.error || 'Unknown error'}`}
              {fallback.latencyMs &&
                fallback.status === 'ready' &&
                ` • Latensi terakhir ${(fallback.latencyMs / 1000).toFixed(1)}s`}
            </div>
            {fallback.allowed && fallback.status !== 'loading' && (
              <button
                onClick={() => {
                  setEvents((prev) => [...prev, 'fallback preload requested'])
                  void (async (): Promise<void> => {
                    try {
                      await fallback.preload()
                      setEvents((prev) => [...prev, 'fallback model siap'])
                    } catch (error) {
                      const message = error instanceof Error ? error.message : 'unknown error'
                      setEvents((prev) => [...prev, `fallback preload gagal: ${message}`])
                    }
                  })()
                }}
                className="mt-3 w-full rounded-lg border border-indigo-200 py-2 text-sm text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900"
              >
                Preload Transformers.js Model
              </button>
            )}
          </div>
        </div>

        {/* Features Grid */}
        <div className="mx-auto mb-16 grid max-w-6xl gap-6 md:grid-cols-3">
          <div className="p-6 text-center">
            <div className="mb-4 text-3xl">⚡</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Progressive Enhancement
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Quick correction → Enhanced correction secara bertahap
            </p>
          </div>

          <div className="p-6 text-center">
            <div className="mb-4 text-3xl">🔄</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Multi-Provider Fallback
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Groq → HuggingFace → Together → Cohere → Local
            </p>
          </div>

          <div className="p-6 text-center">
            <div className="mb-4 text-3xl">🚀</div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Smart Batching
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              5 segments per request untuk efisiensi quota
            </p>
          </div>
        </div>

        {/* API Status */}
        <div className="mx-auto max-w-2xl rounded-xl bg-gray-100 p-6 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            🔗 API Status
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-300">Worker API:</span>
            <code className="rounded bg-gray-200 px-2 py-1 text-sm dark:bg-gray-700">
              {apiBase}
            </code>
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Status akan ditampilkan real-time di dashboard
          </div>
          <div className="mt-3 text-sm">
            <span className="rounded-full bg-indigo-100 px-2 py-1 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">
              Export stage: {downloadStage}
            </span>
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-1 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              Transformers fallback: {transformersEnabled() ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {totalChunks > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              {(['raw', 'quick', 'enhanced'] as const).map((s): ReactElement => {
                const done = progress[s]
                const pct = totalChunks ? Math.round((done / totalChunks) * 100) : 0
                const label = s.charAt(0).toUpperCase() + s.slice(1)
                return (
                  <div
                    key={s}
                    className="rounded border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-gray-700 dark:text-gray-200">{label}</span>
                      <span className="text-gray-500">
                        {done}/{totalChunks}
                      </span>
                    </div>
                    <div className="h-2 rounded bg-gray-200 dark:bg-gray-700">
                      <div
                        className="h-2 rounded bg-indigo-600"
                        style={{ width: `${pct.toString()}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {!transformersEnabled() && (
            <div className="mt-3 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
              Transformers.js fallback disabled via environment flag
            </div>
          )}
          {jobId && (
            <div className="mt-4">
              <div className="mb-2 text-sm text-gray-700 dark:text-gray-200">
                SSE Events (job {jobId}):
              </div>
              <div className="max-h-48 overflow-auto rounded border border-gray-200 bg-white p-3 text-xs dark:border-gray-700 dark:bg-gray-900">
                {events.map((l, i) => (
                  <div key={i} className="whitespace-pre-wrap break-words">
                    {l}
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
            stage={selectedStage}
            onStageChange={(s) => {
              setSelectedStage(s)
            }}
            exportStage={downloadStage}
            chunks={chunks}
          />
        )}
      </div>
    </div>
  )
}
