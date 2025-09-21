import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { groqCorrectBatch } from '@worker/providers/groq'

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

describe('Groq provider contract', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('sends chat completion payload and returns parsed lines', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '1) kalimat pertama\n2) kalimat kedua',
            },
          },
        ],
      }),
    })
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const env = { GROQ_API_KEY: 'test-key' }
    const texts = ['kalimat pertama', 'kalimat kedua']

    const result = await groqCorrectBatch(env, texts, { mode: 'quick' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    expect(fetchMock.mock.calls[0][0]).toBe(ENDPOINT)
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
    })

    const body = JSON.parse(String(init?.body ?? '{}'))
    expect(body.model).toContain('llama-3.1')
    expect(body.messages?.[1]?.content).toContain('kalimat pertama')

    expect(result).toEqual(['kalimat pertama', 'kalimat kedua'])
  })

  it('throws when API responds non-ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 })
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    await expect(
      groqCorrectBatch({ GROQ_API_KEY: 'test-key' }, ['foo'], { mode: 'enhanced' })
    ).rejects.toThrow(/Groq error 429/)
  })
})
