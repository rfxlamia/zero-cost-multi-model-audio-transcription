'use client'

import { useRef, useState } from 'react'
import ProgressiveTranscriptView, { type Stage } from './components/progressive-transcript-view'
import { transformersEnabled } from './lib/flags'

export default function HomePage() {
  const [isRecording, setIsRecording] = useState(false)
  const [apiBase] = useState(process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8787')
  const [jobId, setJobId] = useState<string | null>(null)
  const [events, setEvents] = useState<string[]>([])
  const [downloadStage, setDownloadStage] = useState<'raw' | 'quick' | 'enhanced'>('raw')
  const [selectedStage, setSelectedStage] = useState<Stage>('final')
  const [chunks, setChunks] = useState<Array<{ index: number; raw?: string; quick?: string; enhanced?: string; final?: string }>>([])
  const [totalChunks, setTotalChunks] = useState<number>(0)
  const [progress, setProgress] = useState<{ raw: number; quick: number; enhanced: number }>({ raw: 0, quick: 0, enhanced: 0 })
  const sseRef = useRef<EventSource | null>(null)

  const handleStartRecording = async () => {
    if (!isRecording) {
      setIsRecording(true)
      try {
        const res = await fetch(`${apiBase}/api/transcribe/start`, { method: 'POST' })
        const data = await res.json()
        const id = data.id as string
        setJobId(id)
        // Open SSE
        const es = new EventSource(`${apiBase}/api/transcribe/${id}/stream`)
        sseRef.current = es
        es.addEventListener('status', (e) => {
          setEvents((prev) => [...prev, `status: ${e.data}`])
          try {
            const d = JSON.parse((e as MessageEvent).data as string)
            if (typeof d?.totalChunks === 'number') setTotalChunks(d.totalChunks)
          } catch {}
        })
        es.addEventListener('raw', (e) => {
          setEvents((prev) => [...prev, `raw: ${e.data}`])
          try {
            const d = JSON.parse((e as MessageEvent).data as string)
            const idx = Number(d?.chunkIndex)
            const text = String(d?.text ?? '')
            if (Number.isFinite(idx)) {
              setChunks((prev) => {
                const arr = [...prev]
                if (!arr[idx]) arr[idx] = { index: idx }
                arr[idx].raw = text
                arr[idx].final = arr[idx].final ?? text
                return arr
              })
            }
          } catch {}
          setDownloadStage((s) => (s === 'raw' ? 'raw' : s))
        })
        es.addEventListener('quick', (e) => {
          setEvents((prev) => [...prev, `quick: ${e.data}`])
          try {
            const d = JSON.parse((e as MessageEvent).data as string)
            const idx = Number(d?.chunkIndex)
            const text = String(d?.text ?? '')
            if (Number.isFinite(idx)) {
              setChunks((prev) => {
                const arr = [...prev]
                if (!arr[idx]) arr[idx] = { index: idx }
                arr[idx].quick = text
                arr[idx].final = arr[idx].enhanced ?? text
                return arr
              })
            }
          } catch {}
          setDownloadStage((s) => (s === 'enhanced' ? s : 'quick'))
        })
        es.addEventListener('enhanced', (e) => {
          setEvents((prev) => [...prev, `enhanced: ${e.data}`])
          try {
            const d = JSON.parse((e as MessageEvent).data as string)
            const idx = Number(d?.chunkIndex)
            const text = String(d?.text ?? '')
            if (Number.isFinite(idx)) {
              setChunks((prev) => {
                const arr = [...prev]
                if (!arr[idx]) arr[idx] = { index: idx }
                arr[idx].enhanced = text
                arr[idx].final = text
                return arr
              })
            }
          } catch {}
          setDownloadStage('enhanced')
        })
        es.addEventListener('done', (e) => setEvents((prev) => [...prev, `done: ${e.data}`]))
        es.addEventListener('error', () => setEvents((prev) => [...prev, `error`]))
      } catch (e) {
        console.error(e)
        setIsRecording(false)
      }
    } else {
      setIsRecording(false)
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      console.log('File selected:', file.name)
      // TODO: Implement file upload
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
            TranscriptorAI
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Transkripsi suara ke teks Bahasa Indonesia dengan AI correction
          </p>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            ✨ Zero-cost • Free tier providers
          </div>
          <div className="mt-4">
            <a
              href="/dashboard"
              className="inline-block px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm"
            >
              Open Quota Dashboard
            </a>
          </div>
        </div>

        {/* Main Features */}
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8 mb-16">
          {/* Recorder Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              🎤 Rekam Audio
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Rekam langsung dari browser Anda, maksimal 10 menit
            </p>
            <button
              onClick={handleStartRecording}
              className={`w-full py-4 px-6 rounded-xl font-medium transition-all ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isRecording ? '⏹️ Stop Recording' : '🎙️ Start Recording'}
            </button>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Shortcut: Tekan R untuk toggle recording
            </div>
          </div>

          {/* Uploader Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              📁 Upload Audio
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Drag & drop atau pilih file audio (max 100MB)
            </p>
            <label className="block w-full">
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-full py-4 px-6 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 cursor-pointer text-center transition-colors">
                <span className="text-gray-600 dark:text-gray-300">
                  📤 Click to upload atau drag file di sini
                </span>
              </div>
            </label>
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Format: MP3, WAV, M4A, FLAC
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 mb-16">
          <div className="text-center p-6">
            <div className="text-3xl mb-4">⚡</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Progressive Enhancement
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Quick correction → Enhanced correction secara bertahap
            </p>
          </div>

          <div className="text-center p-6">
            <div className="text-3xl mb-4">🔄</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Multi-Provider Fallback
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Groq → HuggingFace → Together → Cohere → Local
            </p>
          </div>

          <div className="text-center p-6">
            <div className="text-3xl mb-4">🚀</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Smart Batching
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              5 segments per request untuk efisiensi quota
            </p>
          </div>
        </div>

        {/* API Status */}
        <div className="max-w-2xl mx-auto bg-gray-100 dark:bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            🔗 API Status
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-300">Worker API:</span>
            <code className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm">
              {apiBase}
            </code>
          </div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Status akan ditampilkan real-time di dashboard
          </div>
          <div className="mt-3 text-sm">
            <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">
              Export stage: {downloadStage}
            </span>
            <span className="ml-2 px-2 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              Transformers fallback: {transformersEnabled() ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {totalChunks > 0 && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              {(['raw', 'quick', 'enhanced'] as const).map((s) => {
                const done = progress[s]
                const pct = totalChunks ? Math.round((done / totalChunks) * 100) : 0
                const label = s.charAt(0).toUpperCase() + s.slice(1)
                return (
                  <div key={s} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700 dark:text-gray-200">{label}</span>
                      <span className="text-gray-500">{done}/{totalChunks}</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded">
                      <div className="h-2 bg-indigo-600 rounded" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {!transformersEnabled() && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-900">
              Transformers.js fallback disabled via environment flag
            </div>
          )}
          {jobId && (
            <div className="mt-4">
              <div className="text-gray-700 dark:text-gray-200 text-sm mb-2">SSE Events (job {jobId}):</div>
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-3 max-h-48 overflow-auto text-xs">
        es.addEventListener('progress', (e) => {
          try {
            const d = JSON.parse((e as MessageEvent).data as string)
            if (d?.stage === 'raw') setProgress((p) => ({ ...p, raw: Number(d.completed || 0) }))
            if (d?.stage === 'quick') setProgress((p) => ({ ...p, quick: Number(d.completed || 0) }))
            if (d?.stage === 'enhanced') setProgress((p) => ({ ...p, enhanced: Number(d.completed || 0) }))
          } catch {}
        })
                {events.map((l, i) => (
                  <div key={i} className="whitespace-pre-wrap break-words">{l}</div>
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
            onStageChange={(s) => setSelectedStage(s)}
            exportStage={downloadStage}
            chunks={chunks}
          />
        )}
      </div>
    </div>
  )
}
