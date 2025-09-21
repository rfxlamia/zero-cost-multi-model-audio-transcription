import { test, expect } from '@playwright/test'

test.describe('Quota dashboard renders metrics', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/quotas', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          quotas: {
            groq: {
              minute: { used: 28, limit: 30, resetAt: new Date(Date.now() + 60000).toISOString() },
              day: { used: 450, limit: 500, resetAt: new Date(Date.now() + 3600000).toISOString() },
            },
            huggingface: {
              minute: { used: 10, limit: 60, resetAt: null },
              day: { used: 100, limit: 1000, resetAt: null },
            },
          },
        }),
      })
    })

    await page.route('**/api/metrics', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          providers: {
            groq: {
              enabled: true,
              nearLimit: true,
              daily: { day: '2024-01-01', success: 120, failure: 5, successRate: 0.96 },
            },
            huggingface: {
              enabled: true,
              nearLimit: false,
              daily: { day: '2024-01-01', success: 80, failure: 2, successRate: 0.98 },
            },
          },
          queue: {
            totalItems: 3,
            queues: [
              { key: 'quick|default', count: 2 },
              { key: 'enhanced|medical', count: 1 },
            ],
          },
          semaphores: { providerConcurrency: 4, kvConcurrency: 3 },
        }),
      })
    })
  })

  test('shows provider cards and queue stats', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /quota dashboard/i })).toBeVisible()
    const groqCard = page.getByText('groq', { exact: true }).first()
    await expect(groqCard).toBeVisible()
    await expect(page.getByText('near limit')).toBeVisible()
    await expect(page.getByText('Total items: 3')).toBeVisible()
    await expect(page.getByText('provider concurrency: 4', { exact: false })).toBeVisible()
    await expect(page.getByText('quick|default')).toBeVisible()
  })
})
