import { describe, expect, it } from 'vitest'
import {
  getExportSegments,
  segmentsToSrt,
  segmentsToVtt,
  segmentsToTxt,
} from '@transcriptorai/shared/utils'

describe('Export segment builder', () => {
  it('enforces monotonic timestamps with tolerance and minimum duration', () => {
    const segments = getExportSegments(
      {
        chunks: [
          { index: 0, startTime: 0, endTime: 29.5, transcription: { final: 'halo dunia' } },
          { index: 1, startTime: 29.3, endTime: 60.2, transcription: { quick: 'ini test' } },
          { index: 2, startTime: 60.4, endTime: 89.9, transcription: { enhanced: 'segment tiga' } },
        ],
      },
      {
        chunkSeconds: 30,
        toleranceSeconds: 0.5,
        minDurationSeconds: 0.2,
        mergeThresholdSeconds: 0.5,
      }
    )

    const starts = segments.map((seg) => seg.start)
    const ends = segments.map((seg) => seg.end)

    for (let i = 0; i < segments.length; i += 1) {
      expect(ends[i]).toBeGreaterThanOrEqual(starts[i])
      if (i > 0) {
        expect(starts[i]).toBeGreaterThanOrEqual(ends[i - 1])
      }
    }
  })

  it('merges adjacent segments when gap is within threshold and preserves text order', () => {
    const segments = getExportSegments(
      {
        chunks: [
          { index: 0, startTime: 0, endTime: 29.4, transcription: { final: 'baris satu' } },
          { index: 1, startTime: 29.9, endTime: 60.1, transcription: { final: 'baris dua' } },
          {
            index: 3,
            startTime: 90.3,
            endTime: 119.6,
            transcription: { final: 'baris tiga' },
          },
        ],
      },
      {
        chunkSeconds: 30,
        toleranceSeconds: 0.5,
        mergeThresholdSeconds: 0.5,
        minDurationSeconds: 0.2,
      }
    )

    expect(segments).toHaveLength(2)
    expect(segments[0].text).toBe('baris satu\nbaris dua')
    expect(segments[0].end).toBeGreaterThan(segments[0].start)
    expect(segments[1].text).toBe('baris tiga')
  })

  it('renders SRT, VTT, and TXT with consistent ordering', () => {
    const segments = [
      { index: 0, start: 0, end: 2.4, text: 'pertama' },
      { index: 1, start: 2.4, end: 5.75, text: 'kedua' },
    ]

    const txt = segmentsToTxt(segments)
    const srt = segmentsToSrt(segments)
    const vtt = segmentsToVtt(segments)

    expect(txt.split('\n')).toEqual(['pertama', 'kedua'])
    expect(srt).toContain('00:00:00,000 --> 00:00:02,400')
    expect(srt).toContain('00:00:02,400 --> 00:00:05,750')
    expect(vtt).toContain('00:00:00.000 --> 00:00:02.400')
    expect(vtt).toContain('WEBVTT')
  })
})
