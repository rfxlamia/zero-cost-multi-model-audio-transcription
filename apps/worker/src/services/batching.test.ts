import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./router', () => ({
  correctTextsWithFallback: vi.fn(async (_env: any, texts: string[]) => ({
    provider: 'huggingface',
    texts: texts.map((t) => `HF:${t}`),
  })),
}))

vi.mock('./metrics', () => ({
  recordProviderLatency: vi.fn(async () => {}),
}))

import { enqueueForCorrection, getQueueStats, __resetQueuesForTest } from './batching'
import { correctTextsWithFallback } from './router'
import { recordProviderLatency } from './metrics'

describe('batching service', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    __resetQueuesForTest()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('flushes immediately when queue hits max batch and records latency', async () => {
    const env: any = {}
    const inputs = Array.from({ length: 5 }, (_, i) =>
      enqueueForCorrection(env, 'quick', `t${i}`, `hash${i}`)
    )
    const outputs = await Promise.all(inputs)
    expect(outputs.every((t) => t.startsWith('HF:'))).toBe(true)
    expect(correctTextsWithFallback).toHaveBeenCalledTimes(1)
    expect(recordProviderLatency).toHaveBeenCalledTimes(1)
    expect(getQueueStats().totalItems).toBe(0)
  })

  it('flushes after timer for partial batches using quick mode interval', async () => {
    const env: any = {}
    const p1 = enqueueForCorrection(env, 'quick', 'foo', 'hash1')
    const p2 = enqueueForCorrection(env, 'quick', 'bar', 'hash2')

    expect(correctTextsWithFallback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(correctTextsWithFallback).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000) // exceeds QUICK_FLUSH_MS
    await Promise.all([p1, p2])
    expect(correctTextsWithFallback).toHaveBeenCalledTimes(1)
  })
})
