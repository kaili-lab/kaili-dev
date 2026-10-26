import { expect, test } from '@playwright/test'

const pages = [
  { name: 'home', path: '' },
  { name: 'writing', path: '/writing' },
  { name: 'article', path: '/writing/boundary-example' },
  { name: 'projects', path: '/projects' },
  { name: 'bookshelf', path: '/bookshelf' },
] as const

for (const language of ['zh', 'en'] as const) {
  for (const pageType of pages) {
    for (const width of [1440, 820, 390]) {
      for (const scheme of ['light', 'dark'] as const) {
        test(`${language}-${pageType.name}-${width}-${scheme}`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 900 })
          await page.emulateMedia({ colorScheme: scheme })
          const response = await page.goto(`/${language}${pageType.path}`)
          expect(response?.status()).toBe(200)
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
          await page.waitForLoadState('networkidle')
          await expect(page.locator('html')).toHaveAttribute(
            'data-theme',
            scheme,
          )
          await expect(page.locator('[data-palette-switcher]')).toHaveCount(0)
          await expect(page.locator('#k2-fonts')).toHaveAttribute(
            'media',
            'all',
          )
          await page.evaluate(async (locale) => {
            const font =
              locale === 'zh'
                ? '900 16px "Noto Serif SC"'
                : '800 16px "Source Serif 4"'
            const sample = locale === 'zh' ? '中' : 'A'
            const faces = await document.fonts.load(font, sample)
            await document.fonts.ready
            if (faces.length === 0 || !document.fonts.check(font, sample))
              throw new Error('Display font unavailable')
            await Promise.all(
              [...document.images].map(async (image) => {
                image.loading = 'eager'
                await image.decode()
              }),
            )
          }, language)
          expect(
            await page.evaluate(
              () =>
                document.documentElement.scrollWidth ===
                document.documentElement.clientWidth,
            ),
          ).toBe(true)
          await page.mouse.move(-1, -1)
          await expect(page).toHaveScreenshot(
            `${language}-${pageType.name}-${width}-${scheme}.png`,
            { fullPage: true, threshold: 0.1 },
          )
        })
      }
    }
  }
}
