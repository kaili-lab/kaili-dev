import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'

const baseURL = 'http://127.0.0.1:4173'

const posts = {
  zhBoundary: {
    title: '把边界写清楚',
    summary: '所有权、边界和事务结束的位置，决定了服务是否容易理解。',
    body: '边界不是额外的文档，而是让每次改变都有清晰归属的约定。',
  },
  enBoundary: {
    title: 'Make boundaries visible',
    summary:
      'Ownership, boundaries, and where the transaction ends make a service understandable.',
    body: 'A boundary is a small agreement about ownership, not another document to maintain.',
  },
  zhOnly: {
    title: '只有中文的文章',
    summary: '这篇文章还没有英文版本。',
    body: '语言版本彼此独立发布，读者只会看到当前语言真正可用的内容。',
  },
  enOnly: {
    title: 'An English-only article',
    summary: 'This article is currently available in English only.',
    body: 'Each language is published independently so a reader sees only what is ready.',
  },
} as const

const privateAndDraftText = [
  '未发布中文修改不得出现',
  'Unpublished English edit must not appear',
  posts.zhBoundary.body,
  posts.enBoundary.body,
  posts.zhOnly.body,
  posts.enOnly.body,
]

async function setLanguageCookie(page: Page, language: 'zh' | 'en') {
  await page
    .context()
    .addCookies([
      { name: 'kaili-language', value: language, url: `${baseURL}/` },
    ])
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth ===
        document.documentElement.clientWidth,
    ),
  ).toBe(true)
}

async function expectNavigation(page: Page, language: 'zh' | 'en') {
  const navigation = page.getByRole('navigation', {
    name: language === 'zh' ? '主导航' : 'Main navigation',
    exact: true,
  })
  await expect(navigation).toHaveCount(1)
  await expect(
    navigation.getByRole('link', {
      name: language === 'zh' ? '写作' : 'Writing',
      exact: true,
    }),
  ).toHaveCount(1)
  await expect(
    navigation.getByRole('link', {
      name: language === 'zh' ? '书架' : 'Bookshelf',
      exact: true,
    }),
  ).toHaveCount(1)
}

async function expectSeo(page: Page, canonical: string, alternates: string[]) {
  const canonicalLinks = page.locator('link[rel="canonical"]')
  await expect(canonicalLinks).toHaveCount(1)
  await expect(canonicalLinks).toHaveAttribute('href', canonical)
  const actualAlternates = await page
    .locator('link[rel="alternate"]')
    .evaluateAll((elements) =>
      elements.map((element) => ({
        hrefLang: element.getAttribute('hreflang'),
        href: element.getAttribute('href'),
      })),
    )
  const expected = alternates.map((href) => ({
    hrefLang: href.startsWith('/zh') ? 'zh-CN' : 'en',
    href,
  }))
  const sortLinks = (
    links: Array<{ hrefLang: string | null; href: string | null }>,
  ) =>
    [...links].sort((left, right) =>
      `${left.hrefLang}:${left.href}`.localeCompare(
        `${right.hrefLang}:${right.href}`,
      ),
    )
  expect(sortLinks(actualAlternates)).toEqual(sortLinks(expected))
}

async function expectPublicShell(page: Page, language: 'zh' | 'en') {
  await expect(page.locator('html')).toHaveAttribute(
    'lang',
    language === 'zh' ? 'zh-CN' : 'en',
  )
  await expectNavigation(page, language)
  await expectNoOverflow(page)
  for (const draft of privateAndDraftText.slice(0, 2)) {
    await expect(page.locator('body')).not.toContainText(draft)
  }
}

async function expectDirect200(
  request: APIRequestContext,
  path: string,
  headers: Record<string, string>,
) {
  const response = await request.get(path, { headers, maxRedirects: 0 })
  expect(response.status(), path).toBe(200)
  expect(response.headers().location, path).toBeUndefined()
  const html = await response.text()
  for (const draft of privateAndDraftText.slice(0, 2))
    expect(html).not.toContain(draft)
}

async function openPage(page: Page, path: string, reload = false) {
  const response = reload ? await page.reload() : await page.goto(path)
  expect(response?.status(), path).toBe(200)
  expect(response?.request().redirectedFrom(), path).toBeNull()
  expect(response?.headers().location, path).toBeUndefined()
  await expect(page).toHaveURL(`${baseURL}${path}`)
}

async function switchLanguage(page: Page, name: 'EN' | '中', path: string) {
  // D-165: the switch is client-side, so check the target directly as well:
  // it must be a real page (200), reached without a server redirect.
  const response = await page.request.get(path, { maxRedirects: 0 })
  expect(response.status()).toBe(200)
  expect(response.headers().location).toBeUndefined()
  // The click itself stays in the same document (no reload).
  await page.evaluate(() => {
    ;(window as Window & { __sameDocument?: boolean }).__sameDocument = true
  })
  await Promise.all([
    page.waitForURL(`${baseURL}${path}`),
    page.getByRole('link', { name, exact: true }).click(),
  ])
  await expect(page).toHaveURL(`${baseURL}${path}`)
  expect(
    await page.evaluate(
      () => (window as Window & { __sameDocument?: boolean }).__sameDocument,
    ),
  ).toBe(true)
}

async function expectList(
  page: Page,
  request: APIRequestContext,
  path: string,
  language: 'zh' | 'en',
  hrefs: readonly string[],
  titles: readonly string[],
  headers: Record<string, string> = {},
  navigate = true,
  notice?: string,
) {
  await expectDirect200(request, path, headers)
  if (navigate) await openPage(page, path)
  const canonical = path.split('?')[0] ?? path
  const home = canonical === '/zh' || canonical === '/en'
  const assertList = async (message?: string) => {
    await expect(page).toHaveURL(`${baseURL}${path}`)
    await expectPublicShell(page, language)
    await expect(page).toHaveTitle(
      home
        ? language === 'zh'
          ? 'Kai Li · 写作与思考'
          : 'Kai Li · Writing and thinking'
        : language === 'zh'
          ? '写作 · Kai Li'
          : 'Writing · Kai Li',
    )
    const rows = home
      ? page
          .getByRole('region', {
            name: language === 'zh' ? '最近写的' : 'Recent writing',
          })
          .getByRole('article')
      : page.locator('.site-writing-list').getByRole('article')
    expect(
      await rows
        .locator('a')
        .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
    ).toEqual(hrefs)
    await expect(rows.getByRole('heading')).toHaveText([...titles])
    await expect(rows.locator('p')).toHaveText(
      language === 'zh'
        ? [posts.zhBoundary.summary, posts.zhOnly.summary]
        : [posts.enBoundary.summary, posts.enOnly.summary],
    )
    expect(
      await rows
        .locator('time')
        .evaluateAll((dates) =>
          dates.map((date) => date.getAttribute('datetime')),
        ),
    ).toEqual(
      language === 'zh'
        ? ['2026-09-02', '2026-08-01']
        : ['2026-09-02', '2026-07-01'],
    )
    await expectSeo(
      page,
      canonical,
      home ? ['/zh', '/en'] : ['/zh/writing', '/en/writing'],
    )
    await expect(page.getByRole('status')).toHaveCount(message ? 1 : 0)
    if (message) await expect(page.getByRole('status')).toHaveText(message)
  }
  await assertList(notice)
  await openPage(page, path, true)
  await assertList()
}

async function expectArticle(
  page: Page,
  request: APIRequestContext,
  path: string,
  language: 'zh' | 'en',
  version: { title: string; summary: string; body: string },
  alternates: string[],
  headers: Record<string, string> = {},
  navigate = true,
) {
  await expectDirect200(request, path, headers)
  if (navigate) await openPage(page, path)
  await expect(page).toHaveURL(`${baseURL}${path}`)
  await expectPublicShell(page, language)
  const assertArticle = async () => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      version.title,
    )
    await expect(page.locator('.k2-article-summary')).toHaveText(
      version.summary,
    )
    await expect(page.locator('.prose')).toContainText(version.body)
    await expectSeo(page, path, alternates)
    await expect(page).toHaveTitle(`${version.title} · Kai Li`)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      version.summary,
    )
    await expect(page.locator('meta[name="description"]')).toHaveCount(1)
    await expect(page.getByRole('status')).toHaveCount(0)
  }
  await assertArticle()
  await openPage(page, path, true)
  await expect(page).toHaveURL(`${baseURL}${path}`)
  await expectPublicShell(page, language)
  await assertArticle()
}

async function expectNotFound(
  page: Page,
  request: APIRequestContext,
  path: string,
) {
  const response = await request.get(path, { maxRedirects: 0 })
  expect(response.status(), path).toBe(404)
  expect(response.headers().location, path).toBeUndefined()
  const html = await response.text()
  for (const forbidden of privateAndDraftText)
    expect(html).not.toContain(forbidden)
  expect(html).not.toMatch(/rel="(?:canonical|alternate)"/)
  const pageResponse = await page.goto(path)
  expect(pageResponse?.status(), path).toBe(404)
  await expect(page).toHaveURL(`${baseURL}${path}`)
  const assertNotFound = async () => {
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
    await expect(page.locator('link[rel="alternate"]')).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'EN', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: '中', exact: true }),
    ).toHaveCount(0)
    const body = (await page.locator('body').textContent()) ?? ''
    for (const forbidden of privateAndDraftText)
      expect(body).not.toContain(forbidden)
    await expectNoOverflow(page)
    await expect(page.getByRole('status')).toHaveCount(0)
  }
  await assertNotFound()
  const reload = await page.reload()
  expect(reload?.status(), `${path} reload`).toBe(404)
  await expect(page).toHaveURL(`${baseURL}${path}`)
  await assertNotFound()
}

const listCases = {
  zhHome: {
    path: '/zh',
    language: 'zh' as const,
    hrefs: ['/zh/writing/boundary-example', '/zh/writing/zh-only-example'],
    titles: [posts.zhBoundary.title, posts.zhOnly.title],
  },
  enHome: {
    path: '/en',
    language: 'en' as const,
    hrefs: ['/en/writing/boundary-example', '/en/writing/en-only-example'],
    titles: [posts.enBoundary.title, posts.enOnly.title],
  },
  zhWriting: {
    path: '/zh/writing',
    language: 'zh' as const,
    hrefs: ['/zh/writing/boundary-example', '/zh/writing/zh-only-example'],
    titles: [posts.zhBoundary.title, posts.zhOnly.title],
  },
  enWriting: {
    path: '/en/writing',
    language: 'en' as const,
    hrefs: ['/en/writing/boundary-example', '/en/writing/en-only-example'],
    titles: [posts.enBoundary.title, posts.enOnly.title],
  },
} as const

for (const [id, path, language, list] of [
  ['R-HOME-01', '/zh', 'zh', listCases.zhHome],
  ['R-HOME-02', '/en', 'en', listCases.enHome],
  [
    'R-HOME-03 R-ARTICLE-12 R-LANG-08',
    '/zh/writing',
    'zh',
    listCases.zhWriting,
  ],
  [
    'R-HOME-04 R-ARTICLE-08 R-LANG-08',
    '/en/writing',
    'en',
    listCases.enWriting,
  ],
] as const) {
  test(`${id} exact published list members and SEO`, async ({
    page,
    request,
  }) => {
    await page.setExtraHTTPHeaders({
      'Accept-Language':
        language === 'zh' ? 'en-US,en;q=0.9' : 'zh-CN,zh;q=0.9',
    })
    await setLanguageCookie(page, language === 'zh' ? 'en' : 'zh')
    await expectList(page, request, path, language, list.hrefs, list.titles, {
      'Accept-Language':
        language === 'zh' ? 'en-US,en;q=0.9' : 'zh-CN,zh;q=0.9',
      Cookie: `kaili-language=${language === 'zh' ? 'en' : 'zh'}`,
    })
  })
}

for (const [id, path, language, list] of [
  [
    'R-HOME-05',
    '/zh/writing?category=engineering&tag=typescript',
    'zh',
    listCases.zhWriting,
  ],
  [
    'R-HOME-06',
    '/en/writing?category=engineering&tag=typescript',
    'en',
    listCases.enWriting,
  ],
] as const) {
  test(`${id} preserves filters while using the unfiltered SEO address`, async ({
    page,
    request,
  }) => {
    await page.setExtraHTTPHeaders({
      'Accept-Language':
        language === 'zh' ? 'en-US,en;q=0.9' : 'zh-CN,zh;q=0.9',
    })
    await expectList(page, request, path, language, list.hrefs, list.titles)
  })
}

test('R-ARTICLE-01 R-SEO-01 Chinese published article ignores English preference', async ({
  page,
  request,
}) => {
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })
  await setLanguageCookie(page, 'en')
  await expectArticle(
    page,
    request,
    '/zh/writing/boundary-example',
    'zh',
    posts.zhBoundary,
    ['/zh/writing/boundary-example', '/en/writing/boundary-example'],
    { 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'kaili-language=en' },
  )
})

test('R-ARTICLE-02 R-SEO-02 English published article ignores Chinese preference', async ({
  page,
  request,
}) => {
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' })
  await setLanguageCookie(page, 'zh')
  await expectArticle(
    page,
    request,
    '/en/writing/boundary-example',
    'en',
    posts.enBoundary,
    ['/zh/writing/boundary-example', '/en/writing/boundary-example'],
    { 'Accept-Language': 'zh-CN,zh;q=0.9', Cookie: 'kaili-language=zh' },
  )
})

test('R-ARTICLE-03 R-LANG-05 bilingual article switch Chinese to English', async ({
  page,
  request,
}) => {
  await page.goto('/zh/writing/boundary-example')
  await switchLanguage(page, 'EN', '/en/writing/boundary-example')
  await expect(page).toHaveURL(`${baseURL}/en/writing/boundary-example`)
  await expectArticle(
    page,
    request,
    '/en/writing/boundary-example',
    'en',
    posts.enBoundary,
    ['/zh/writing/boundary-example', '/en/writing/boundary-example'],
    {},
    false,
  )
  await expect(page.getByRole('status')).toHaveCount(0)
  expect(await page.evaluate(() => document.cookie)).toContain(
    'kaili-language=en',
  )
})

test('R-ARTICLE-04 R-LANG-05 bilingual article switch English to Chinese', async ({
  page,
  request,
}) => {
  await page.goto('/en/writing/boundary-example')
  await switchLanguage(page, '中', '/zh/writing/boundary-example')
  await expect(page).toHaveURL(`${baseURL}/zh/writing/boundary-example`)
  await expectArticle(
    page,
    request,
    '/zh/writing/boundary-example',
    'zh',
    posts.zhBoundary,
    ['/zh/writing/boundary-example', '/en/writing/boundary-example'],
    {},
    false,
  )
  await expect(page.getByRole('status')).toHaveCount(0)
  expect(await page.evaluate(() => document.cookie)).toContain(
    'kaili-language=zh',
  )
})

test('R-ARTICLE-05 R-SEO-03 Chinese-only article has one-language SEO', async ({
  page,
  request,
}) => {
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en' })
  await setLanguageCookie(page, 'en')
  await expectArticle(
    page,
    request,
    '/zh/writing/zh-only-example',
    'zh',
    posts.zhOnly,
    ['/zh/writing/zh-only-example'],
    { 'Accept-Language': 'en', Cookie: 'kaili-language=en' },
  )
  await expect(page).toHaveTitle(`${posts.zhOnly.title} · Kai Li`)
  await page.reload()
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('R-ARTICLE-09 R-SEO-03 English-only article has one-language SEO', async ({
  page,
  request,
}) => {
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh' })
  await setLanguageCookie(page, 'zh')
  await expectArticle(
    page,
    request,
    '/en/writing/en-only-example',
    'en',
    posts.enOnly,
    ['/en/writing/en-only-example'],
    { 'Accept-Language': 'zh', Cookie: 'kaili-language=zh' },
  )
  await expect(page).toHaveTitle(`${posts.enOnly.title} · Kai Li`)
  await page.reload()
  await expect(page.getByRole('status')).toHaveCount(0)
})

for (const [id, path] of [
  ['R-ARTICLE-06', '/en/writing/zh-only-example'],
  ['R-ARTICLE-10', '/zh/writing/en-only-example'],
  ['R-ARTICLE-13 R-ARTICLE-17', '/zh/writing/private-example'],
  ['R-ARTICLE-14', '/en/writing/private-example'],
  ['R-ARTICLE-15', '/zh/writing/missing-example'],
  ['R-ARTICLE-16', '/en/writing/missing-example'],
] as const) {
  test(`${id} unpublished or missing article is an SEO-free 404`, async ({
    page,
    request,
  }) => {
    await expectNotFound(page, request, path)
  })
}

test('R-ARTICLE-07 R-LANG-06 R-LANG-07 missing English translation notice and refresh', async ({
  page,
  request,
}) => {
  await page.goto('/zh/writing/zh-only-example')
  await switchLanguage(page, 'EN', '/en/writing')
  await expectList(
    page,
    request,
    '/en/writing',
    'en',
    listCases.enWriting.hrefs,
    listCases.enWriting.titles,
    {},
    false,
    "This article isn't available in English.",
  )
  expect(await page.evaluate(() => document.cookie)).toContain(
    'kaili-language=en',
  )
})

test('R-ARTICLE-11 R-LANG-06 R-LANG-07 missing Chinese translation notice and refresh', async ({
  page,
  request,
}) => {
  await page.goto('/en/writing/en-only-example')
  await switchLanguage(page, '中', '/zh/writing')
  await expectList(
    page,
    request,
    '/zh/writing',
    'zh',
    listCases.zhWriting.hrefs,
    listCases.zhWriting.titles,
    {},
    false,
    '这篇文章暂无中文版',
  )
  expect(await page.evaluate(() => document.cookie)).toContain(
    'kaili-language=zh',
  )
})

test('R-LANG-01 Chinese home EN button writes cookie and keeps SEO', async ({
  page,
  request,
}) => {
  await page.goto('/zh')
  await switchLanguage(page, 'EN', '/en')
  await expect(page).toHaveURL(`${baseURL}/en`)
  await expectList(
    page,
    request,
    '/en',
    'en',
    listCases.enHome.hrefs,
    listCases.enHome.titles,
    {},
    false,
  )
  await expectSeo(page, '/en', ['/zh', '/en'])
  expect(await page.evaluate(() => document.cookie)).toContain(
    'kaili-language=en',
  )
})

test('R-LANG-02 English home Chinese button writes cookie and keeps SEO', async ({
  page,
  request,
}) => {
  await page.goto('/en')
  await switchLanguage(page, '中', '/zh')
  await expect(page).toHaveURL(`${baseURL}/zh`)
  await expectList(
    page,
    request,
    '/zh',
    'zh',
    listCases.zhHome.hrefs,
    listCases.zhHome.titles,
    {},
    false,
  )
  await expectSeo(page, '/zh', ['/zh', '/en'])
  expect(await page.evaluate(() => document.cookie)).toContain(
    'kaili-language=zh',
  )
})

test('R-LANG-03 filtered Chinese list EN switch preserves query and exact list', async ({
  page,
  request,
}) => {
  await page.goto('/zh/writing?category=engineering&tag=typescript')
  await switchLanguage(
    page,
    'EN',
    '/en/writing?category=engineering&tag=typescript',
  )
  const path = '/en/writing?category=engineering&tag=typescript'
  await expect(page).toHaveURL(`${baseURL}${path}`)
  await expectList(
    page,
    request,
    path,
    'en',
    listCases.enWriting.hrefs,
    listCases.enWriting.titles,
    {},
    false,
  )
  await expectSeo(page, '/en/writing', ['/zh/writing', '/en/writing'])
  expect(await page.evaluate(() => document.cookie)).toContain(
    'kaili-language=en',
  )
})

test('R-LANG-04 filtered English list Chinese switch preserves query and exact list', async ({
  page,
  request,
}) => {
  await page.goto('/en/writing?category=engineering&tag=typescript')
  await switchLanguage(
    page,
    '中',
    '/zh/writing?category=engineering&tag=typescript',
  )
  const path = '/zh/writing?category=engineering&tag=typescript'
  await expect(page).toHaveURL(`${baseURL}${path}`)
  await expectList(
    page,
    request,
    path,
    'zh',
    listCases.zhWriting.hrefs,
    listCases.zhWriting.titles,
    {},
    false,
  )
  await expectSeo(page, '/zh/writing', ['/zh/writing', '/en/writing'])
  expect(await page.evaluate(() => document.cookie)).toContain(
    'kaili-language=zh',
  )
})

test('R-LANG-09 switched list in same-context newPage and new context has no notice', async ({
  page,
  request,
  browser,
}) => {
  await page.goto('/zh/writing/zh-only-example')
  await switchLanguage(page, 'EN', '/en/writing')
  await expect(page).toHaveURL(`${baseURL}/en/writing`)
  await expect(page.getByRole('status')).toHaveText(
    "This article isn't available in English.",
  )
  await expectSeo(page, '/en/writing', ['/zh/writing', '/en/writing'])
  await expectPublicShell(page, 'en')
  const sameContextPage = await page.context().newPage()
  try {
    await expectList(
      sameContextPage,
      request,
      '/en/writing',
      'en',
      listCases.enWriting.hrefs,
      listCases.enWriting.titles,
    )
    await expect(sameContextPage.getByRole('status')).toHaveCount(0)
  } finally {
    await sameContextPage.close()
  }
  const newContext = await browser.newContext({ baseURL })
  try {
    const newContextPage = await newContext.newPage()
    await expectList(
      newContextPage,
      request,
      '/en/writing',
      'en',
      listCases.enWriting.hrefs,
      listCases.enWriting.titles,
    )
    await expect(newContextPage.getByRole('status')).toHaveCount(0)
    await newContextPage.close()
  } finally {
    await newContext.close()
  }
})

test('static unpublished data isolation', async ({ request }) => {
  for (const [path, publishedBody, draft] of [
    [
      '/zh/writing/boundary-example',
      posts.zhBoundary.body,
      '未发布中文修改不得出现',
    ],
    [
      '/en/writing/boundary-example',
      posts.enBoundary.body,
      'Unpublished English edit must not appear',
    ],
  ] as const) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(200)
    expect(response.headers().location, path).toBeUndefined()
    const html = await response.text()
    expect(html).toContain(publishedBody)
    expect(html).not.toContain(draft)
  }
})

for (const width of [1440, 820, 390]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`routing surfaces ${width}px ${colorScheme} no horizontal overflow`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme })
      for (const surface of [
        ['/zh', 'zh'],
        ['/en', 'en'],
        ['/zh/writing', 'zh'],
        ['/en/writing', 'en'],
        ['/zh/writing/boundary-example', 'zh'],
        ['/en/writing/boundary-example', 'en'],
        ['/zh/writing/zh-only-example', 'zh'],
        ['/en/writing/en-only-example', 'en'],
        ['/zh/writing/missing-example', 'zh'],
        ['/en/writing/missing-example', 'en'],
      ] as const) {
        const response = await page.goto(surface[0])
        expect(response?.status(), surface[0]).toBe(
          surface[0].includes('missing-example') ? 404 : 200,
        )
        await expectNoOverflow(page)
        if (!surface[0].includes('missing-example')) {
          await expect(page.locator('html')).toHaveAttribute(
            'lang',
            surface[1] === 'zh' ? 'zh-CN' : 'en',
          )
        }
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          colorScheme,
        )
        await page.evaluate(() => document.fonts.ready)
        await page.screenshot({
          path: testInfo.outputPath(
            `${surface[0].slice(1).replaceAll('/', '-')}-${width}-${colorScheme}.png`,
          ),
          fullPage: true,
        })
      }
    })
  }
}
