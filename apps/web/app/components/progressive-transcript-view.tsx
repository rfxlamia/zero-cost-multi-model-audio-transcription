'use client'

import React from 'react'

export type Stage = 'raw' | 'quick' | 'enhanced' | 'final'

export type ChunkView = {
  index: number
  raw?: string
  quick?: string
  enhanced?: string
  final?: string
}

type Props = {
  jobId: string | null
  apiBase: string
  stage: Stage
  onStageChange?: (s: Stage) => void
  exportStage: Exclude<Stage, 'final'> | 'raw' | 'quick' | 'enhanced'
  chunks: ChunkView[]
}

function textForStage(c: ChunkView, stage: Stage): string {
  if (stage === 'final') return c.final ?? c.enhanced ?? c.quick ?? c.raw ?? ''
  if (stage === 'enhanced') return c.enhanced ?? ''
  if (stage === 'quick') return c.quick ?? ''
  return c.raw ?? ''
}

function mergedText(chunks: ChunkView[], stage: Stage): string {
  return chunks
    .sort((a, b) => a.index - b.index)
    .map((c) => textForStage(c, stage))
    .filter((t) => t && t.length)
    .join('\n')
}

const StageToggle: React.FC<{ value: Stage; onChange?: (s: Stage) => void }> = ({
  value,
  onChange,
}) => {
  const btn = (label: Stage, title: string): React.ReactElement => (
    <button
      key={label}
      onClick={() => {
        onChange?.(label)
      }}
      className={`rounded-lg border px-3 py-1 text-sm transition-colors ${
        value === label
          ? 'border-indigo-600 bg-indigo-600 text-white'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-indigo-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
      }`}
      title={title}
    >
      {label}
    </button>
  )
  return (
    <div className="inline-flex gap-2" role="group" aria-label="Stage selector">
      {btn('raw', 'Tampilkan hasil ASR mentah')}
      {btn('quick', 'Koreksi cepat')}
      {btn('enhanced', 'Koreksi lanjutan')}
      {btn('final', 'Terbaik tersedia')}
    </div>
  )
}

export const ProgressiveTranscriptView: React.FC<Props> = ({
  jobId,
  apiBase,
  stage,
  onStageChange,
  exportStage,
  chunks,
}) => {
  const merged = React.useMemo(() => mergedText(chunks, stage), [chunks, stage])
  const mergedQuick = React.useMemo(() => mergedText(chunks, 'quick'), [chunks])
  const mergedEnhanced = React.useMemo(() => mergedText(chunks, 'enhanced'), [chunks])
  const [copied, setCopied] = React.useState(false)
  const [compare, setCompare] = React.useState(false)

  async function copyTranscript(): Promise<void> {
    try {
      await navigator.clipboard.writeText(merged)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
      }, 1500)
    } catch (e) {
      console.error('copy failed', e)
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <StageToggle value={stage} onChange={onStageChange} />
          <span className="text-sm text-gray-600 dark:text-gray-300">Viewing</span>
          <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100">
            {stage}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-300">Export</span>
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100">
            {exportStage}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCompare((v) => !v)
            }}
            className="rounded-lg bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            title="Compare quick vs enhanced"
          >
            {compare ? 'Close Compare' : 'Compare quick vs enhanced'}
          </button>
          <button
            onClick={() => {
              void copyTranscript()
            }}
            className="rounded-lg bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700"
            disabled={!merged}
            title="Copy merged transcript to clipboard"
          >
            {copied ? 'Copied!' : 'Copy Transcript'}
          </button>
          <a
            className="rounded-lg bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            href={jobId ? `${apiBase}/api/export/${jobId}.txt` : '#'}
            aria-disabled={!jobId}
          >
            Download TXT
          </a>
          <a
            className="rounded-lg bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            href={jobId ? `${apiBase}/api/export/${jobId}.srt` : '#'}
            aria-disabled={!jobId}
          >
            Download SRT
          </a>
          <a
            className="rounded-lg bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            href={jobId ? `${apiBase}/api/export/${jobId}.vtt` : '#'}
            aria-disabled={!jobId}
          >
            Download VTT
          </a>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${compare ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            Merged Transcript ({stage})
          </div>
          <pre className="whitespace-pre-wrap break-words text-xs text-gray-800 dark:text-gray-100">
            {merged || '—'}
          </pre>
        </div>
        {compare && (
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
              Compare View
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                  Quick
                </div>
                <pre className="whitespace-pre-wrap break-words text-xs text-gray-800 dark:text-gray-100">
                  {mergedQuick || '—'}
                </pre>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                  Enhanced
                </div>
                <pre className="whitespace-pre-wrap break-words text-xs text-gray-800 dark:text-gray-100">
                  {mergedEnhanced || '—'}
                </pre>
              </div>
            </div>
          </div>
        )}
        <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
            Per-segment
          </div>
          <div className="space-y-3">
            {chunks
              .sort((a, b) => a.index - b.index)
              .map((c) => {
                const t = textForStage(c, stage)
                const badges = [
                  c.raw ? 'raw' : null,
                  c.quick ? 'quick' : null,
                  c.enhanced ? 'enhanced' : null,
                ].filter(Boolean) as string[]
                return (
                  <div
                    key={c.index}
                    className="rounded border border-gray-200 p-3 dark:border-gray-700"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs text-gray-500">Chunk #{c.index}</div>
                      <div className="flex gap-1">
                        {badges.map((b) => (
                          <span
                            key={b}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-100">
                      {t || '—'}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProgressiveTranscriptView
