import { describe, expect, it } from 'vitest'
import { evaluateFaithfulness } from '@worker/utils/faithfulness'

describe('evaluateFaithfulness', () => {
  it('returns perfect score for identical text', () => {
    const report = evaluateFaithfulness('halo dunia', 'halo dunia')
    expect(report.score).toBe(1)
    expect(report.accepted).toBe(true)
    expect(report.novelPhrases).toHaveLength(0)
  })

  it('allows minor additions while staying above threshold', () => {
    const original =
      'pemerintah kota bandung bersama universitas teknologi membuka lokakarya kurikulum kecerdasan buatan untuk pelajar sma dan mahasiswa tingkat akhir dengan dukungan mentor industri berpengalaman dan perangkat laboratorium lengkap'
    const corrected =
      'pemerintah kota bandung bersama universitas teknologi membuka lokakarya kurikulum kecerdasan buatan untuk pelajar sma dan mahasiswa tingkat akhir dengan dukungan mentor industri berpengalaman dan perangkat laboratorium lengkap serta sesi konsultasi pribadi'
    const report = evaluateFaithfulness(original, corrected, { minSharedRatio: 0.85 })
    expect(report.score).toBeGreaterThanOrEqual(0.85)
    expect(report.accepted).toBe(true)
    expect(report.novelPhrases).toHaveLength(0)
  })

  it('flags long hallucinated phrases and rejects output', () => {
    const original = 'wawancara khusus membahas ekonomi kreatif di indonesia'
    const corrected =
      'wawancara khusus membahas ekonomi kreatif di indonesia kemudian pemerintah memberikan subsidi besar untuk industri roket eksperimental rahasia'
    const report = evaluateFaithfulness(original, corrected)
    expect(report.accepted).toBe(false)
    expect(report.novelPhrases[0]).toContain('pemerintah memberikan subsidi besar untuk industri roket eksperimental rahasia')
  })
})
