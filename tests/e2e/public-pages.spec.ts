import { expect, test } from '@playwright/test'

for (const language of ['zh', 'en'] as const) {
  for (const width of [1440, 390]) {
    test(`${language} ${width}px missing article neighbor leaves its slot empty`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      for (const [slug, relation] of [
        ['boundary-example', 'prev'],
        [language === 'zh' ? 'zh-only-example' : 'en-only-example', 'next'],
      ] as const) {
        await page.goto(`/${language}/writing/${slug}`)
        const navigation = page.getByRole('navigation', {
          name: language === 'zh' ? '文章翻页' : 'Article pagination',
          exact: true,
        })
        const link = navigation.locator(`a[rel="${relation}"]`)
        await expect(navigation.locator('a')).toHaveCount(1)
        const navBox = await navigation.boundingBox()
        const linkBox = await link.boundingBox()
        if (!navBox || !linkBox) throw new Error('Pagination must be visible')
        if (width > 640) {
          const midpoint = navBox.x + navBox.width / 2
          if (relation === 'prev')
            expect(linkBox.x + linkBox.width).toBeLessThan(midpoint)
          else expect(linkBox.x).toBeGreaterThan(midpoint)
        } else if (relation === 'prev') {
          expect(linkBox.y + linkBox.height).toBeLessThan(
            navBox.y + navBox.height - 16,
          )
        } else {
          expect(linkBox.y - navBox.y).toBeGreaterThan(linkBox.height)
        }
      }
    })
  }
}
