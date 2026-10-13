import { expect, test } from '@playwright/test'

// D-152: the @font-face list must not block first paint, and project
// thumbnails must stay small and lazy.
test.describe('T3.5 first-screen weight', () => {
  for (const language of ['zh', 'en']) {
    test(`/${language} keeps fonts off the critical path`, async ({
      page,
      request,
    }) => {
      const html = await (await request.get(`/${language}`)).text()
      const blocking = [
        ...html
          .replace(/<noscript>.*?<\/noscript>/gs, '')
          .matchAll(/<link rel="stylesheet" href="([^"]+)"\/>/g),
      ].map((match) => match[1]!)
      expect(blocking).toHaveLength(1)
      const main = await request.get(blocking[0]!)
      const css = await main.text()
      expect(css).not.toContain('@font-face')
      expect(css.length).toBeLessThan(60_000)
      // The font sheet is injected by a script that runs after the main
      // stylesheet has loaded, so it is not in the HTML at all.
      expect(html).not.toMatch(/<link[^>]+id="k2-fonts"/)
      expect(html).toContain("l.id='k2-fonts'")
      expect(html).toMatch(
        /<noscript><link rel="stylesheet" href="[^"]+"\/><\/noscript>/,
      )

      await page.goto(`/${language}`)
      await expect(page.locator('#k2-fonts')).toHaveAttribute('media', 'all')
      expect(await page.evaluate(() => document.fonts.size)).toBeGreaterThan(
        100,
      )

      const thumbs = page.locator('.k2-thumb img')
      expect(await thumbs.count()).toBeGreaterThan(0)
      for (const image of await thumbs.all()) {
        // Lazy, but only ~10 KB each at 280px (D-157).
        await expect(image).toHaveAttribute('loading', 'lazy')
        const src = await image.getAttribute('src')
        expect(src).toMatch(/^\/images\/thumbs\/.+\.jpg$/)
        await expect(image).toHaveAttribute('sizes', '138px')
        // The browser must have picked the 280px file for the 92px slot.
        await image.scrollIntoViewIfNeeded()
        await expect
          .poll(() =>
            image.evaluate((element: HTMLImageElement) => element.currentSrc),
          )
          .not.toBe('')
        const current = await image.evaluate(
          (element: HTMLImageElement) => element.currentSrc,
        )
        expect(current).toMatch(/-280\.jpg$/)
        const body = await request.get(src!)
        expect((await body.body()).length).toBeLessThan(80_000)
        const small = await request.get(current)
        expect((await small.body()).length).toBeLessThan(20_000)
      }
    })
  }

  test('home thumbnails in the first screen load without scrolling', async ({
    page,
  }) => {
    // D-157 accepts empty boxes at first paint; they must still fill in on
    // their own at 1440×1000, where they sit inside the first screen.
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/zh')
    const thumbs = page.locator('.k2-thumb img')
    await expect(thumbs).toHaveCount(3)
    for (const image of await thumbs.all()) {
      const box = await image.boundingBox()
      expect(box!.y + box!.height).toBeLessThanOrEqual(1000)
      await expect
        .poll(() =>
          image.evaluate(
            (element: HTMLImageElement) =>
              element.complete && element.naturalWidth > 0,
          ),
        )
        .toBe(true)
    }
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })

  test('Projects page thumbnails load lazily', async ({ page }) => {
    await page.goto('/zh/projects')
    const thumbs = page.locator('.k2-thumb img')
    expect(await thumbs.count()).toBeGreaterThan(0)
    for (const image of await thumbs.all())
      await expect(image).toHaveAttribute('loading', 'lazy')
  })
})
