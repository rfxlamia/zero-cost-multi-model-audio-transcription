import { describe, expect, it, vi } from 'vitest'
import { sumopodTranscribe } from './sumopod'

describe('sumopodTranscribe', () => {
  it('sends multipart request and returns text', async () => {
    const fakeText = 'halo dunia'
    const fetchMock = vi.fn(async () =>
      new Response(fakeText, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    )
    // @ts-expect-error override global
    global.fetch = fetchMock
    const env: Partial<{ SUMOPOD_API_KEY: string; QUOTA_COUNTERS: { put: typeof vi.fn; get: typeof vi.fn } }> = {
      SUMOPOD_API_KEY: 'test-key',
      QUOTA_COUNTERS: { put: vi.fn(), get: vi.fn() } as any,
    }
    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' })
    const out = await sumopodTranscribe(env, audio, { language: 'id' })
    expect(out).toBe(fakeText)
    const call = fetchMock.mock.calls[0]
    expect(call[0]).toMatch(/\/v1\/audio\/transcriptions$/)
    const init = call[1] as RequestInit
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^Bearer /)
    expect(init.body).instanceOf(FormData)
  })

  it('throws on HTTP error', async () => {
    const fetchMock = vi.fn(async () => new Response('err', { status: 500 }))
    // @ts-expect-error override global
    global.fetch = fetchMock
    const env: Partial<{ SUMOPOD_API_KEY: string; QUOTA_COUNTERS: { put: typeof vi.fn; get: typeof vi.fn } }> = {
      SUMOPOD_API_KEY: 'test-key',
      QUOTA_COUNTERS: { put: vi.fn(), get: vi.fn() } as any,
    }
    const audio = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' })
    await expect(sumopodTranscribe(env, audio)).rejects.toThrow(/SumoPod error/)
  })
})
