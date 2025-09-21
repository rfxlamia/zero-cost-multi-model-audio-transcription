import { test, expect } from '@playwright/test'

test.describe('Accessibility basics', () => {
  test('has language tag and landmark headings', async ({ page }) => {
    await page.goto('/')
    const lang = await page.locator('html').getAttribute('lang')
    expect(lang).toBe('id')
    await expect(page.getByRole('heading', { level: 1, name: /TranscriptorAI/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Open Quota Dashboard/i })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: /Rekam Audio/i })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: /Upload Audio/i })).toBeVisible()
  })
})
