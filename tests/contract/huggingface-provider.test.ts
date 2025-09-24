import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { huggingfaceCorrectBatch } from '@worker/providers/huggingface'

const MODEL = 'openai/gpt-oss-20b:nebius'
const ENDPOINT = `https://api-inference.huggingface.co/models/${encodeURIComponent(MODEL)}`

describe('HuggingFace provider contract', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('sends chat completion request with bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          generated_text: '1) hasil pertama\n2) hasil kedua',
        },
      ],
    })
    globalThis.fetch = fetchMock as typeof globalThis.fetch

    const env = { HF_API_TOKEN: 'hf-test-token' }
    const output = await huggingfaceCorrectBatch(env, ['foo', 'bar'], {
      mode: 'enhanced',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(ENDPOINT)
    expect(init?.method).toBe('POST')
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer hf-test-token',
    })

    const body = JSON.parse(String(init?.body ?? '{}'))
    expect(body.inputs).toContain('foo')
    expect(body.parameters.max_new_tokens).toBeGreaterThan(0)

    expect(output).toEqual(['hasil pertama', 'hasil kedua'])
  })

  it('throws when token missing', async () => {
    await expect(
      huggingfaceCorrectBatch({}, ['foo'], { mode: 'quick' })
    ).rejects.toThrow(/HF_API_TOKEN not set/)
  })
})
