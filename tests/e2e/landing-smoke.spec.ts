import { test, expect } from '@playwright/test'

test.describe('Landing page progressive flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const store: any[] = []
      class MockEventSource {
        url: string
        readyState = 1
        listeners: Record<string, Array<(ev: MessageEvent<any>) => void>> = {}
        onopen?: (ev: Event) => void
        onerror?: (ev: Event) => void

        constructor(url: string) {
          this.url = url
          store.push(this)
          setTimeout(() => {
            this.onopen?.(new Event('open'))
          }, 10)
        }

        addEventListener(type: string, listener: (ev: MessageEvent<any>) => void) {
          if (!this.listeners[type]) this.listeners[type] = []
          this.listeners[type].push(listener)
        }

        close() {
          // no-op
        }

        emit(type: string, payload: unknown) {
          const evt = new MessageEvent(type, { data: JSON.stringify(payload) })
          this.listeners[type]?.forEach((listener) => listener(evt))
        }
      }

      Object.defineProperty(window, '__mockSSE', {
        value: { sources: store },
        writable: false,
      })

      // @ts-expect-error override for tests
      window.EventSource = MockEventSource

      if (!navigator.clipboard) {
        // @ts-expect-error shim clipboard for tests
        navigator.clipboard = {
          writeText: async () => undefined,
        }
      }
    })
  })

  test('streams SSE updates and exposes export links', async ({ page }) => {
    await page.route('**/api/transcribe/start', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'job-test' }),
      })
    })

    await page.goto('/')
    await page.getByRole('button', { name: /start recording/i }).click()

    await expect(page.getByText('SSE connected: job-test')).toBeVisible()

    await page.evaluate(() => {
      const src = (window as any).__mockSSE.sources.at(-1)
      src?.emit('status', { totalChunks: 1 })
      src?.emit('raw', { chunkIndex: 0, text: 'halo raw', completed: 1 })
      src?.emit('quick', { chunkIndex: 0, text: 'halo cepat', completed: 1 })
      src?.emit('enhanced', { chunkIndex: 0, text: 'halo final', completed: 1 })
      src?.emit('done', { status: 'complete' })
    })

    const mergedFinal = page.locator('pre').filter({ hasText: /^halo final$/ })
    await expect(mergedFinal).toBeVisible()
    const srtHref = await page
      .getByRole('link', { name: /download srt/i })
      .getAttribute('href')
    expect(srtHref).toBe('http://localhost:8787/api/export/job-test.srt')
    await expect(page.getByText('done: {"status":"complete"}')).toBeVisible()

    const stageToggle = page.getByRole('group', { name: /stage selector/i })
    await expect(stageToggle).toBeVisible()
    await stageToggle.getByRole('button', { name: 'quick', exact: true }).click()
    const mergedQuick = page.locator('pre').filter({ hasText: /^halo cepat$/ })
    await expect(mergedQuick).toBeVisible()
  })
})
