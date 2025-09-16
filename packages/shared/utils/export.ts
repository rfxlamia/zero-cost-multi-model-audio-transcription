const DEFAULT_CHUNK_SECONDS = 30
const TIMESTAMP_TOLERANCE_SECONDS = 0.5
const MIN_SEGMENT_DURATION_SECONDS = 0.2

export interface ExportChunkLike {
  index?: number
  startTime?: number
  endTime?: number
  transcription?: {
    raw?: string
    quick?: string
    enhanced?: string
    final?: string
  }
  raw?: string
  quick?: string
  enhanced?: string
  final?: string
}

export interface ExportBuildOptions {
  chunkSeconds?: number
  toleranceSeconds?: number
  mergeThresholdSeconds?: number
  minDurationSeconds?: number
}

export interface ExportSegment {
  index: number
  start: number
  end: number
  text: string
}

const clamp = (value: number, lower: number, upper: number) =>
  Math.min(Math.max(value, lower), upper)

const pickText = (chunk: ExportChunkLike) => {
  if (chunk?.transcription) {
    return (
      chunk.transcription.final ??
      chunk.transcription.enhanced ??
      chunk.transcription.quick ??
      chunk.transcription.raw ??
      ''
    )
  }
  return chunk?.final ?? chunk?.enhanced ?? chunk?.quick ?? chunk?.raw ?? ''
}

const sanitizeNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

function collectSegments(
  chunks: ExportChunkLike[] | undefined,
  options: Required<
    Pick<ExportBuildOptions, 'chunkSeconds' | 'toleranceSeconds' | 'minDurationSeconds'>
  >
) {
  const items = Array.isArray(chunks) ? chunks : []
  const sorted = [...items].map((chunk, idx) => ({
    chunk,
    fallbackIndex: idx,
  }))

  sorted.sort((a, b) => {
    const ai = sanitizeNumber(a.chunk?.index) ?? a.fallbackIndex
    const bi = sanitizeNumber(b.chunk?.index) ?? b.fallbackIndex
    if (ai !== bi) return ai - bi
    const as = sanitizeNumber(a.chunk?.startTime)
    const bs = sanitizeNumber(b.chunk?.startTime)
    if (as != null && bs != null && as !== bs) return as - bs
    return 0
  })

  const segments: ExportSegment[] = []
  let previousEnd = 0

  for (const item of sorted) {
    const chunk = item.chunk ?? {}
    const index = sanitizeNumber(chunk.index) ?? item.fallbackIndex
    const expectedStart = index * options.chunkSeconds
    const expectedEnd = expectedStart + options.chunkSeconds
    const rawStart = sanitizeNumber(chunk.startTime) ?? expectedStart
    const rawEnd = sanitizeNumber(chunk.endTime)
    const start = clamp(
      rawStart,
      expectedStart - options.toleranceSeconds,
      expectedStart + options.toleranceSeconds
    )
    let endCandidate = rawEnd ?? start + options.chunkSeconds
    endCandidate = clamp(
      endCandidate,
      expectedEnd - options.toleranceSeconds,
      expectedEnd + options.toleranceSeconds
    )

    let finalStart = start
    if (segments.length > 0 && finalStart < previousEnd) {
      finalStart = previousEnd
    }

    let finalEnd = Math.max(endCandidate, finalStart + options.minDurationSeconds)
    if (finalEnd < finalStart) {
      finalEnd = finalStart + options.minDurationSeconds
    }

    previousEnd = finalEnd

    const text = String(pickText(chunk) ?? '')
    segments.push({ index, start: finalStart, end: finalEnd, text })
  }

  return segments
}

function mergeSegments(segments: ExportSegment[], thresholdSeconds: number) {
  if (!segments.length) return [] as ExportSegment[]
  const merged: ExportSegment[] = []

  for (const seg of segments) {
    if (!merged.length) {
      merged.push({ ...seg })
      continue
    }

    const last = merged[merged.length - 1]
    const gap = seg.start - last.end
    if (gap > 0 && gap <= thresholdSeconds) {
      last.end = Math.max(last.end, seg.end)
      if (seg.text && seg.text.trim()) {
        const existing = last.text && last.text.trim() ? last.text : ''
        const addition = seg.text
        last.text = existing ? `${existing}\n${addition}` : addition
      }
      continue
    }

    merged.push({ ...seg })
  }

  return merged
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0')

const formatNumber = (seconds: number, separator: ',' | '.') => {
  const whole = Math.floor(seconds)
  const ms = Math.round((seconds - whole) * 1000)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const secs = whole % 60
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}${separator}${pad(ms, 3)}`
}

export function getExportSegments(
  job: { chunks?: ExportChunkLike[] } | null | undefined,
  opts: ExportBuildOptions = {}
) {
  const chunkSeconds = opts.chunkSeconds ?? DEFAULT_CHUNK_SECONDS
  const toleranceSeconds = opts.toleranceSeconds ?? TIMESTAMP_TOLERANCE_SECONDS
  const minDurationSeconds = opts.minDurationSeconds ?? MIN_SEGMENT_DURATION_SECONDS
  const mergeThresholdSeconds = opts.mergeThresholdSeconds ?? toleranceSeconds
  const base = collectSegments(job?.chunks, {
    chunkSeconds,
    toleranceSeconds,
    minDurationSeconds,
  })
  return mergeSegments(base, mergeThresholdSeconds)
}

export function segmentsToTxt(segments: ExportSegment[]) {
  return segments
    .map((seg) => seg.text)
    .join('\n')
    .trim()
}

export function segmentsToSrt(segments: ExportSegment[]) {
  if (!segments.length) return ''
  return (
    segments
      .map((seg, i) => {
        const start = formatNumber(seg.start, ',')
        const end = formatNumber(seg.end, ',')
        const text = seg.text || ''
        return `${i + 1}\n${start} --> ${end}\n${text}`
      })
      .join('\n\n') + '\n'
  )
}

export function segmentsToVtt(segments: ExportSegment[]) {
  if (!segments.length) return 'WEBVTT\n\n'
  const body = segments
    .map((seg) => {
      const start = formatNumber(seg.start, '.')
      const end = formatNumber(seg.end, '.')
      const text = seg.text || ''
      return `${start} --> ${end}\n${text}`
    })
    .join('\n\n')
  return `WEBVTT\n\n${body}\n`
}

export const EXPORT_DEFAULTS = {
  CHUNK_SECONDS: DEFAULT_CHUNK_SECONDS,
  TOLERANCE_SECONDS: TIMESTAMP_TOLERANCE_SECONDS,
  MERGE_THRESHOLD_SECONDS: TIMESTAMP_TOLERANCE_SECONDS,
  MIN_SEGMENT_DURATION_SECONDS,
}
