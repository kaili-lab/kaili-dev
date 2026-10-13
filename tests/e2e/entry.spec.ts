import { expect, test } from '@playwright/test'

for (const language of ['zh', 'en'] as const) {
  const labels =
    language === 'zh'
      ? {
          light: '浅',
          dark: '深',
          auto: '自动',
          heading: '永远的学生',
          title: 'Kai Li · 写作与思考',
        }
      : {
          light: 'Light',
          dark: 'Dark',
          auto: 'Auto',
          heading: 'A perpetual student',
          title: 'Kai Li · Writing and thinking',
        }
  for (const width of [1440, 820, 390]) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`entry ${language} ${width} ${colorScheme}`, async ({
        page,
      }, testInfo) => {
        const errors: string[] = []
        page.on('pageerror', (error) => errors.push(error.message))
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text())
        })
        await page.setViewportSize({ width, height: 900 })
        await page.emulateMedia({ colorScheme })
        const response = await page.goto(`/${language}`)
        expect(response?.status()).toBe(200)
        await expect(page).toHaveURL(new RegExp(`/${language}$`))
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
          labels.heading,
        )
        await expect(page).toHaveTitle(labels.title)
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          colorScheme,
        )
        await page.evaluate(() => document.fonts.ready)
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth ===
              document.documentElement.clientWidth,
          ),
        ).toBe(true)
        expect(errors).toEqual([])
        await page.screenshot({
          path: testInfo.outputPath(
            `entry-${language}-${width}-${colorScheme}.png`,
          ),
          fullPage: true,
        })
      })
    }
  }

  for (const scenario of [
    { system: 'dark', stored: null, expected: 'dark' },
    { system: 'light', stored: null, expected: 'light' },
    { system: 'light', stored: 'dark', expected: 'dark' },
    { system: 'dark', stored: 'light', expected: 'light' },
  ] as const) {
    test(`theme ${language} before hydration: ${scenario.system} / ${scenario.stored}`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ colorScheme: scenario.system })
      await page.addInitScript((stored) => {
        if (stored) localStorage.setItem('kaili-theme', stored)
        else localStorage.removeItem('kaili-theme')
      }, scenario.stored)
      // Hold every external script: the server HTML must choose the theme by itself.
      await page.route('**/*', (route) =>
        route.request().resourceType() === 'script'
          ? route.abort()
          : route.continue(),
      )
      const response = await page.goto(`/${language}`)
      const html = await response!.text()
      const bootstrapPosition = html.indexOf('root.dataset.themePreference')
      expect(bootstrapPosition).toBeGreaterThan(-1)
      expect(bootstrapPosition).toBeLessThan(html.indexOf('rel="stylesheet"'))
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        scenario.expected,
      )
      const colors = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement)
        const probe = document.createElement('span')
        probe.style.color = 'var(--paper)'
        document.body.append(probe)
        const expected = getComputedStyle(probe).color
        probe.remove()
        return { background: style.backgroundColor, expected }
      })
      expect(colors.background).toBe(colors.expected)
      await page.screenshot({
        path: testInfo.outputPath(
          `before-hydration-${language}-${scenario.system}-${scenario.stored}.png`,
        ),
      })
      await page.reload()
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        scenario.expected,
      )
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth ===
            document.documentElement.clientWidth,
        ),
      ).toBe(true)
      expect(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).backgroundColor,
        ),
      ).toBe(colors.expected)
    })
  }

  test(`manual theme ${language} overrides system and auto clears the preference`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto(`/${language}`)
    await page.getByRole('button', { name: labels.light, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(
      page.getByRole('button', { name: labels.light, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate(() => localStorage.getItem('kaili-theme'))).toBe(
      'light',
    )
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect(
      page.getByRole('button', { name: labels.light, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: labels.dark, exact: true }).click()
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(
      page.getByRole('button', { name: labels.dark, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: labels.auto, exact: true }).click()
    expect(
      await page.evaluate(() => localStorage.getItem('kaili-theme')),
    ).toBeNull()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(
      page.getByRole('button', { name: labels.auto, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(errors).toEqual([])
  })

  test(`theme ${language} remains usable when local storage is unavailable`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('Unavailable', 'SecurityError')
        },
      })
    })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto(`/${language}`)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: labels.light, exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })
}
