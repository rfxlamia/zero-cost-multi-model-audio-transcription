'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Status = 'idle' | 'checking' | 'blocked' | 'ready' | 'loading' | 'error'

type TransformersModule = typeof import('@xenova/transformers')

declare global {
  interface Window {
    transformers?: TransformersModule
  }
}

export interface FallbackSegment {
  start: number
  end: number
  text: string
}

export interface FallbackResult {
  text: string
  segments: FallbackSegment[]
  elapsedMs: number
}

interface Options {
  enabled: boolean
  apiBase?: string | null
  minDeviceMemory?: number
}

interface State {
  allowed: boolean
  status: Status
  reason?: string
  error?: string
  latencyMs?: number
}

const DEFAULT_MIN_MEMORY_GB = 4

type ASRChunk = { timestamp?: [number, number] | number[] | null; text?: unknown }
type ASRResult = { text?: string; chunks?: ASRChunk[] }

type ASRPipeline = (
  input: Float32Array,
  options: {
    sampling_rate: number
    chunk_length_s: number
    stride_length_s: number
    return_timestamps: boolean
  }
) => Promise<ASRResult>

let pipelinePromise: Promise<ASRPipeline> | null = null
let transformersModule: TransformersModule | null = null

const isProd = process.env.NEXT_PUBLIC_ENV === 'production'
const logFallback = (...args: unknown[]): void => {
  if (!isProd) console.warn('[fallback]', ...args)
}

function isTransformersModule(value: unknown): value is TransformersModule {
  if (!value || typeof value !== 'object' || !('pipeline' in value)) {
    return false
  }
  const candidate = (value as { pipeline?: unknown }).pipeline
  return typeof candidate === 'function'
}

async function loadTransformersModule(): Promise<TransformersModule> {
  if (transformersModule) return transformersModule
  if (typeof window === 'undefined') {
    throw new Error('Transformers fallback hanya berjalan di browser')
  }
  if (window.transformers) {
    transformersModule = window.transformers
    logFallback('reusing cached transformers bundle')
    return transformersModule
  }
  const url = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js'
  logFallback('loading transformers bundle', url)
  const imported: unknown = await import(/* webpackIgnore: true */ url)
  const candidate = (imported as { default?: unknown }).default ?? imported
  if (!isTransformersModule(candidate)) {
    throw new Error('Transformers module gagal dimuat dari CDN')
  }
  transformersModule = candidate
  try {
    candidate.env.allowLocalModels = false
    candidate.env.allowRemoteModels = true
  } catch (error) {
    logFallback('failed to set transformers env flags', error)
  }
  logFallback('transformers bundle loaded')
  window.transformers = candidate
  return transformersModule
}

async function ensurePipeline(): Promise<ASRPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async (): Promise<ASRPipeline> => {
      const loadedModule = await loadTransformersModule()
      const { pipeline } = loadedModule
      const p = (await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
        quantized: true,
      })) as unknown as ASRPipeline
      return p
    })()
  }
  return pipelinePromise
}

async function decodeAudioBlob(
  blob: Blob
): Promise<{ waveform: Float32Array; sampleRate: number }> {
  const arrayBuffer = await blob.arrayBuffer()
  type W = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }
  const AC =
    'AudioContext' in (window as W) ? (window as W).AudioContext : (window as W).webkitAudioContext
  if (!AC) throw new Error('AudioContext is not supported in this environment')
  const audioContext = new AC()
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0))
    const length = decoded.length
    const channels = decoded.numberOfChannels
    let data: Float32Array
    if (channels === 1) {
      data = decoded.getChannelData(0)
    } else {
      data = new Float32Array(length)
      for (let ch = 0; ch < channels; ch++) {
        const channel = decoded.getChannelData(ch)
        for (let i = 0; i < length; i++) data[i] += channel[i] / channels
      }
    }
    return { waveform: data, sampleRate: decoded.sampleRate }
  } finally {
    try {
      await audioContext.close()
    } catch {
      // ignore
    }
  }
}

function normaliseSegments(raw: unknown, fallbackDuration: number): FallbackSegment[] {
  if (!raw || (typeof raw !== 'object' && !Array.isArray(raw))) {
    return [
      {
        start: 0,
        end: fallbackDuration,
        text: '',
      },
    ]
  }
  if (Array.isArray(raw)) {
    return (raw as unknown[]).map((chunk, idx: number) => {
      const c = chunk as { timestamp?: unknown; text?: unknown }
      const ts = Array.isArray(c.timestamp)
        ? (c.timestamp as unknown[])
        : [idx * 30, (idx + 1) * 30]
      const start = typeof ts[0] === 'number' ? ts[0] : idx * 30
      const end = typeof ts[1] === 'number' ? ts[1] : (idx + 1) * 30
      const text =
        typeof c.text === 'string'
          ? c.text
          : c.text !== null && c.text !== undefined
            ? JSON.stringify(c.text)
            : ''
      return { start, end, text }
    })
  }
  const obj = raw as { text?: unknown }
  return [
    {
      start: 0,
      end: fallbackDuration,
      text:
        typeof obj.text === 'string'
          ? obj.text
          : obj.text !== null && obj.text !== undefined
            ? JSON.stringify(obj.text)
            : '',
    },
  ]
}

export interface UseTransformersFallbackReturn {
  allowed: boolean
  status: Status
  reason?: string
  error?: string
  latencyMs?: number
  preload: () => Promise<void>
  transcribeFile: (file: File | Blob) => Promise<FallbackResult>
  cancel: () => void
  isReady: boolean
  isLoading: boolean
}

export function useTransformersFallback(options: Options): UseTransformersFallbackReturn {
  const { enabled, apiBase, minDeviceMemory = DEFAULT_MIN_MEMORY_GB } = options
  const [state, setState] = useState<State>(() => ({
    allowed: false,
    status: enabled ? 'idle' : 'blocked',
    reason: enabled ? undefined : 'Dinonaktifkan via konfigurasi',
  }))
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!enabled) {
      setState({ allowed: false, status: 'blocked', reason: 'Dinonaktifkan via konfigurasi' })
      return
    }
    if (typeof window === 'undefined') return
    let cancelled = false
    setState((prev) => ({ ...prev, status: 'checking', error: undefined }))

    const check = async (): Promise<void> => {
      let allowed = true
      let reason: string | undefined
      // Device memory gating
      type NavigatorWithMemory = Navigator & { deviceMemory?: number }
      const deviceMemory = (navigator as NavigatorWithMemory).deviceMemory
      if (typeof deviceMemory === 'number' && deviceMemory < minDeviceMemory) {
        allowed = false
        reason = `Perlu minimal ${String(minDeviceMemory)}GB RAM (deteksi: ${deviceMemory.toString()}GB)`
      }
      if (allowed && typeof navigator !== 'undefined' && !navigator.onLine) {
        // offline is fine for fallback, keep allowed but inform reason
        reason = 'Offline: fallback lokal akan digunakan'
      }
      if (allowed && apiBase) {
        try {
          const target = new URL('/api/transformers/fallback', apiBase)
          const sameOrigin = target.origin === window.location.origin
          if (sameOrigin) {
            const res = await fetch(target, { cache: 'no-store' })
            if (!res.ok) {
              allowed = false
              const body = (await res.json().catch(() => null)) as { reason?: string } | null
              reason = body?.reason || `Fallback diblokir oleh server (${String(res.status)})`
            }
          } else {
            reason = 'Worker remote: lewati preflight'
          }
        } catch {
          reason = 'Tidak bisa menghubungi Worker, fallback lokal disiapkan'
        }
      }

      if (!cancelled) {
        setState({
          allowed,
          status: allowed ? 'ready' : 'blocked',
          reason,
          error: undefined,
        })
      }
    }

    void check()

    return (): void => {
      cancelled = true
    }
  }, [enabled, apiBase, minDeviceMemory])

  const preload = useCallback(async (): Promise<void> => {
    if (!enabled) throw new Error('Fallback dinonaktifkan')
    await ensurePipeline()
    setState((prev) => ({ ...prev, status: 'ready', error: undefined }))
  }, [enabled])

  const transcribeFile = useCallback(
    async (file: File | Blob): Promise<FallbackResult> => {
      if (!enabled) throw new Error('Fallback dinonaktifkan')
      if (state.status === 'blocked') throw new Error(state.reason || 'Fallback tidak diizinkan')
      if (typeof window === 'undefined') throw new Error('Fallback hanya tersedia di browser')

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState((prev) => ({ ...prev, status: 'loading', error: undefined }))
      const started = performance.now()

      try {
        const { waveform, sampleRate } = await decodeAudioBlob(file)
        if (controller.signal.aborted) throw new Error('Dibatalkan')
        const pipe = await ensurePipeline()
        const output = await pipe(waveform, {
          sampling_rate: sampleRate,
          chunk_length_s: 30,
          stride_length_s: 5,
          return_timestamps: true,
        })
        const elapsedMs = performance.now() - started
        const segments = normaliseSegments(output.chunks, waveform.length / sampleRate)
        const text =
          typeof output.text === 'string' && output.text.trim().length > 0
            ? output.text
            : segments.map((s) => s.text).join(' ')

        setState({
          allowed: true,
          status: 'ready',
          latencyMs: elapsedMs,
          reason: state.reason,
        })
        return { text, segments, elapsedMs }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Fallback gagal'
        setState({
          allowed: true,
          status: 'error',
          error: message,
          reason: state.reason,
        })
        throw error
      }
    },
    [enabled, state.status, state.reason]
  )

  const cancel = useCallback((): void => {
    abortRef.current?.abort()
    abortRef.current = null
    setState((prev) => ({ ...prev, status: 'ready' }))
  }, [])

  return {
    ...state,
    preload,
    transcribeFile,
    cancel,
    isReady: state.status === 'ready',
    isLoading: state.status === 'loading',
  }
}
