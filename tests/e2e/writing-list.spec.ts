import { expect, test, type Page } from '@playwright/test'

// T4.2 acceptance (D-037 / D-132 / D-036 / D-153 / D-154) on the production
// Worker. Fixture taxonomy: categories engineering, ai; tags typescript,
// cloudflare. Published zh posts: boundary-example (2026-09-02),
// zh-only-example (2026-08-01); all are engineering + typescript.

const shots = 'test-results/writing-list'

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth ===
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
}

async function markClientDocument(page: Page) {
  // The first visit swaps fonts once (D-152); measure after that settles.
  await page.waitForFunction(
    () =>
      (document.getElementById('k2-fonts') as HTMLLinkElement | null)?.media ===
        'all' && document.fonts.status === 'loaded',
  )
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.evaluate(() => {
    const state = window as Window & {
      __kailiClientMarker?: string
      __kailiFontLink?: Element | null
    }
    state.__kailiClientMarker = 'same-document'
    state.__kailiFontLink = document.getElementById('k2-fonts')
  })
}

async function clientDocumentState(page: Page) {
  return page.evaluate(() => {
    const state = window as Window & {
      __kailiClientMarker?: string
      __kailiFontLink?: Element | null
    }
    const rect = (selector: string) => {
      const element = document.querySelector(selector)
      if (!element) return null
      const box = element.getBoundingClientRect()
      return [box.x, box.y, box.width, box.height].map(
        (value) => Math.round(value * 10) / 10,
      )
    }
    return {
      marker: state.__kailiClientMarker,
      sameFontLink:
        state.__kailiFontLink === document.getElementById('k2-fonts'),
      brand: rect('.k2-brand'),
      filters: rect('.site-writing-filters'),
    }
  })
}

// Auto-retrying locator: the list updates after each navigation.
function listTitles(page: Page) {
  return page.locator('.site-writing-list').getByRole('heading')
}

test.describe('T4.2 writing list', () => {
  test('default lists current-language published posts newest first', async ({
    page,
  }) => {
    await page.goto('/zh/writing')
    await expect(listTitles(page)).toHaveText([
      '把边界写清楚',
      '只有中文的文章',
    ])
    await expect(
      page.locator('.site-writing-filters a[aria-current="page"]'),
    ).toHaveText(['全部', '全部'])
    await expect(page.getByRole('status')).toHaveCount(0)
    await noOverflow(page)
    await page.screenshot({ path: `${shots}/default.png`, fullPage: true })

    await page.goto('/en/writing')
    await expect(listTitles(page)).toHaveText([
      'Make boundaries visible',
      'An English-only article',
    ])
  })

  test('filter links set, combine and clear conditions', async ({ page }) => {
    await page.goto('/zh/writing')
    await page.getByRole('link', { name: '工程', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/writing\?category=engineering$/)
    await page.getByRole('link', { name: 'TypeScript', exact: true }).click()
    await expect(page).toHaveURL(
      /\/zh\/writing\?category=engineering&tag=typescript$/,
    )
    await expect(
      page.locator('.site-writing-filters a[aria-current="page"]'),
    ).toHaveText(['工程', 'TypeScript'])
    await expect(listTitles(page)).toHaveText([
      '把边界写清楚',
      '只有中文的文章',
    ])
    await noOverflow(page)
    await page.screenshot({ path: `${shots}/filtered.png`, fullPage: true })
    // "All" in the category row drops only the category.
    await page
      .locator('.site-writing-filter')
      .first()
      .getByRole('link', { name: '全部' })
      .click()
    await expect(page).toHaveURL(/\/zh\/writing\?tag=typescript$/)
    await expect(listTitles(page)).toHaveText([
      '把边界写清楚',
      '只有中文的文章',
    ])
    await expect(
      page.locator('.site-writing-filters a[aria-current="page"]'),
    ).toHaveText(['全部', 'TypeScript'])
  })

  test('filter, navigation and article links stay in the same document', async ({
    page,
  }) => {
    await page.goto('/zh/writing')
    await markClientDocument(page)
    const before = await clientDocumentState(page)

    await page.getByRole('link', { name: '工程', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/writing\?category=engineering$/)
    await expect(listTitles(page)).toHaveText([
      '把边界写清楚',
      '只有中文的文章',
    ])
    expect(await clientDocumentState(page)).toEqual(before)

    // Links follow the address within a frame; wait for that, then click.
    await expect(
      page.getByRole('link', { name: 'TypeScript', exact: true }),
    ).toHaveAttribute('href', '/zh/writing?category=engineering&tag=typescript')
    await page.getByRole('link', { name: 'TypeScript', exact: true }).click()
    await expect(page).toHaveURL(
      /\/zh\/writing\?category=engineering&tag=typescript$/,
    )
    expect(await clientDocumentState(page)).toEqual(before)

    await page
      .locator('.site-writing-filter')
      .first()
      .getByRole('link', { name: '全部' })
      .click()
    await expect(page).toHaveURL(/\/zh\/writing\?tag=typescript$/)
    expect(await clientDocumentState(page)).toEqual(before)

    await page.locator('.k2-post').first().getByRole('link').click()
    await expect(page).toHaveURL(/\/zh\/writing\/boundary-example$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '把边界写清楚',
    )
    const articleState = await clientDocumentState(page)
    expect(articleState.marker).toBe('same-document')
    expect(articleState.sameFontLink).toBe(true)
    expect(articleState.brand).toEqual(before.brand)
    await page.getByRole('link', { name: '书架', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/bookshelf$/)
    const bookshelfState = await clientDocumentState(page)
    expect(bookshelfState.marker).toBe('same-document')
    expect(bookshelfState.sameFontLink).toBe(true)
  })

  test('a second filter chosen before the list loads keeps the first (D-165)', async ({
    page,
  }) => {
    await page.goto('/zh/writing')
    // Hold every list request, so the second click lands while loading.
    await page.route(
      (url) => url.pathname.startsWith('/_serverFn/'),
      async (route) => {
        await new Promise((done) => setTimeout(done, 1500))
        await route.continue()
      },
    )
    await page.getByRole('link', { name: '工程', exact: true }).click()
    await expect(page).toHaveURL(/category=engineering/)
    // The mark and the other links follow the address at once, well before
    // the held list request (1.5s) returns.
    await expect(
      page.getByRole('link', { name: '工程', exact: true }),
    ).toHaveAttribute('aria-current', 'page', { timeout: 1000 })
    await expect(
      page.getByRole('link', { name: 'TypeScript', exact: true }),
    ).toHaveAttribute(
      'href',
      '/zh/writing?category=engineering&tag=typescript',
      {
        timeout: 1000,
      },
    )
    await page.getByRole('link', { name: 'TypeScript', exact: true }).click()
    await expect(page).toHaveURL(
      /\/zh\/writing\?category=engineering&tag=typescript$/,
    )
    await expect(listTitles(page)).toHaveText([
      '把边界写清楚',
      '只有中文的文章',
    ])
  })

  test('public page links keep hrefs without JavaScript', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    try {
      await page.goto('/zh')
      const navigation = page.getByRole('navigation', { name: '主导航' })
      await expect(
        navigation.getByRole('link', { name: '写作' }),
      ).toHaveAttribute('href', '/zh/writing')
      await navigation.getByRole('link', { name: '写作' }).click()
      await expect(page).toHaveURL(/\/zh\/writing$/)
      await expect(
        page.getByRole('link', { name: '工程', exact: true }),
      ).toHaveAttribute('href', '/zh/writing?category=engineering')
      await page.getByRole('link', { name: '工程', exact: true }).click()
      await expect(page).toHaveURL(/\/zh\/writing\?category=engineering$/)
    } finally {
      await context.close()
    }
  })

  // [from, to, current category, current tag]; all fixture zh posts are
  // engineering + typescript, so every surviving filter lists both.
  for (const [from, to, category, tag] of [
    ['?category=nope', '', '全部', '全部'],
    ['?category=nope&tag=typescript', '?tag=typescript', '全部', 'TypeScript'],
    ['?category=', '', '全部', '全部'],
    ['?tag=TypeScript', '?tag=typescript', '全部', 'TypeScript'],
    ['?tag=typescript&tag=cloudflare', '?tag=typescript', '全部', 'TypeScript'],
    [
      '?utm_source=x&category=nope&ref=y',
      '?utm_source=x&ref=y',
      '全部',
      '全部',
    ],
    ['?category=nope&ref=a%20b&flag', '?ref=a%20b&flag', '全部', '全部'],
  ] as const) {
    test(`${from} redirects once to "${to || '(no query)'}"`, async ({
      page,
      request,
    }) => {
      const response = await request.get(`/zh/writing${from}`, {
        maxRedirects: 0,
      })
      expect(response.status()).toBe(302)
      expect(response.headers()['location']).toBe(`/zh/writing${to}`)
      await page.goto(`/zh/writing${from}`)
      expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
        `/zh/writing${to}`,
      )
      await expect(listTitles(page)).toHaveText([
        '把边界写清楚',
        '只有中文的文章',
      ])
      await expect(page.locator('.site-writing-empty')).toHaveCount(0)
      await expect(
        page.locator('.site-writing-filters a[aria-current="page"]'),
      ).toHaveText([category, tag])
      await noOverflow(page)
    })
  }

  test('unrelated parameters alone do not redirect', async ({ request }) => {
    const response = await request.get('/zh/writing?utm_source=x', {
      maxRedirects: 0,
    })
    expect(response.status()).toBe(200)
  })

  test('valid but empty intersection keeps the address and shows the empty state', async ({
    page,
    request,
  }) => {
    const path = '/zh/writing?category=engineering&tag=cloudflare'
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status()).toBe(200)
    await page.goto(path)
    await expect(page).toHaveURL(new RegExp(`${path.replace(/[?]/g, '\\?')}$`))
    await expect(page.locator('.site-writing-list')).toHaveCount(0)
    await expect(page.locator('.site-writing-empty p')).toHaveText(
      '「工程」分类下没有带「Cloudflare」标签的文章。',
    )
    await expect(page.locator('.site-writing-empty a')).toHaveAttribute(
      'href',
      '/zh/writing',
    )
    await noOverflow(page)
    await page.screenshot({ path: `${shots}/empty.png`, fullPage: true })

    await page.goto('/en/writing?category=ai')
    expect(new URL(page.url()).search).toBe('?category=ai')
    await expect(page.locator('.site-writing-list')).toHaveCount(0)
    await expect(page.locator('.site-writing-empty p')).toHaveText(
      'No articles in “AI” yet.',
    )
    await expect(
      page.locator('.site-writing-filters a[aria-current="page"]'),
    ).toHaveText(['AI', 'All'])
    await expect(page.locator('.site-writing-empty a')).toHaveAttribute(
      'href',
      '/en/writing',
    )
    await noOverflow(page)
  })

  test('canonical and hreflang ignore the query (D-143)', async ({ page }) => {
    await page.goto('/zh/writing?category=engineering&tag=typescript')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      '/zh/writing',
    )
  })

  test('language switch: target article exists → article; missing → list with one-time notice', async ({
    page,
    browser,
  }) => {
    await page.goto('/zh/writing/boundary-example')
    await page.getByRole('link', { name: 'EN', exact: true }).click()
    await expect(page).toHaveURL(/\/en\/writing\/boundary-example$/)

    await page.goto('/en/writing/en-only-example')
    await page.getByRole('link', { name: '中', exact: true }).click()
    await expect(page).toHaveURL(/\/zh\/writing$/)
    await expect(page.getByRole('status')).toHaveText('这篇文章暂无中文版')
    // design.md §9: notice sits between the heading rule and the filters.
    const order = await page.evaluate(() => {
      const heading = document.querySelector('.k2-page-heading')!
      const notice = document.querySelector('[role="status"]')!
      const filters = document.querySelector('.site-writing-filters')!
      return [
        heading.compareDocumentPosition(notice) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        notice.compareDocumentPosition(filters) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ]
    })
    expect(order.every(Boolean)).toBe(true)
    await noOverflow(page)
    await page.screenshot({ path: `${shots}/notice.png`, fullPage: true })

    // The next move inside the list (client-side, D-165): gone, and it does
    // not come back on returning to the same address.
    await page.getByRole('link', { name: '工程', exact: true }).click()
    await expect(page).toHaveURL(/category=engineering/)
    await expect(page.getByRole('status')).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(/\/zh\/writing$/)
    await expect(page.getByRole('status')).toHaveCount(0)

    // Refresh: gone.
    await page.reload()
    await expect(page.getByRole('status')).toHaveCount(0)

    // Same address opened in another session: never shown.
    const other = await browser.newContext()
    const fresh = await other.newPage()
    await fresh.goto('/zh/writing')
    await expect(fresh.getByRole('status')).toHaveCount(0)
    await other.close()
  })

  for (const width of [1440, 820, 390]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      for (const path of [
        '/zh/writing',
        '/zh/writing?category=engineering&tag=typescript',
        '/zh/writing?category=engineering&tag=cloudflare',
        '/en/writing?category=ai',
      ]) {
        await page.goto(path)
        await noOverflow(page)
      }
    })
  }

  test('article tags show display names and link by slug (D-118)', async ({
    page,
  }) => {
    for (const language of ['zh', 'en']) {
      await page.goto(`/${language}/writing/boundary-example`)
      const tag = page.locator('.k2-tags a')
      await expect(tag).toHaveText(['TypeScript'])
      await expect(tag).toHaveAttribute(
        'href',
        `/${language}/writing?tag=typescript`,
      )
    }
  })
})
