import { expect, test } from '@playwright/test'

test('saved development palette applies before hydration and survives reload', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('kaili-palette', 'cool'))

  await page.goto('/zh')
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'cool')
  await expect(page.getByRole('button', { name: '冷色' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'cool')
  await expect(page.getByRole('button', { name: '冷色' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  expect(errors).toEqual([])
})
