import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'

type Headers = Record<string, string>

const zhBody = '边界不是额外的文档，而是让每次改变都有清晰归属的约定。'
const enBody =
  'A boundary is a small agreement about ownership, not another document to maintain.'
const missingNotices = [
  "This article isn't available in English.",
  '这篇文章暂无中文版',
]
const articleExpectations: Record<
  string,
  Partial<Record<'zh' | 'en', readonly string[]>>
> = {
  'boundary-example': {
    zh: [
      '把边界写清楚',
      '所有权、边界和事务结束的位置，决定了服务是否容易理解。',
      zhBody,
    ],
    en: [
      'Make boundaries visible',
      'Ownership, boundaries, and where the transaction ends make a service understandable.',
      enBody,
    ],
  },
  'zh-only-example': {
    zh: [
      '只有中文的文章',
      '这篇文章还没有英文版本。',
      '语言版本彼此独立发布，读者只会看到当前语言真正可用的内容。',
    ],
  },
  'en-only-example': {
    en: [
      'An English-only article',
      'This article is currently available in English only.',
      'Each language is published independently so a reader sees only what is ready.',
    ],
  },
}

async function expectRedirect(
  request: APIRequestContext,
  path: string,
  headers: Headers,
  location: string,
) {
  const first = await request.get(path, { headers, maxRedirects: 0 })
  expect(first.status()).toBe(302)
  expect(first.headers().location).toBe(location)
  const target = await request.get(location, { headers, maxRedirects: 0 })
  expect(target.status()).toBe(200)
  expect(target.headers().location).toBeUndefined()
  const targetHtml = await target.text()
  expect(targetHtml).not.toContain('未发布中文修改不得出现')
  expect(targetHtml).not.toContain('Unpublished English edit must not appear')
  const language = location.startsWith('/zh') ? 'zh' : 'en'
  const slug = location.split('/')[3]
  const expected = slug
    ? articleExpectations[slug]?.[language]
    : articleExpectations['boundary-example']?.[language]?.slice(0, 2)
  expect(expected).toBeDefined()
  for (const text of expected ?? []) expect(targetHtml).toContain(text)
}

async function expectSeo(
  page: Page,
  language: 'zh' | 'en',
  canonical: string,
  alternates: string[],
) {
  await expect(page.locator('html')).toHaveAttribute(
    'lang',
    language === 'zh' ? 'zh-CN' : 'en',
  )
  await expect(page.locator('h1')).toBeVisible()
  const navigation = page.getByRole('navigation', {
    name: language === 'zh' ? '主导航' : 'Main navigation',
    exact: true,
  })
  await expect(navigation.getByRole('link')).toHaveText(
    language === 'zh' ? ['写作', '书架'] : ['Writing', 'Bookshelf'],
  )
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    canonical,
  )
  const actual = await page
    .locator('link[rel="alternate"]')
    .evaluateAll((els) =>
      els.map((el) => [el.getAttribute('hrefLang'), el.getAttribute('href')]),
    )
  expect(actual.sort()).toEqual(
    alternates
      .map((href) => [href.includes('/zh') ? 'zh-CN' : 'en', href])
      .sort(),
  )
  await expect(page.getByRole('status')).toHaveCount(0)
}

async function expectRootPage(page: Page, language: 'zh' | 'en') {
  await expectSeo(page, language, `/${language}`, ['/zh', '/en'])
  await expect(page).toHaveTitle(
    language === 'zh' ? 'Kai Li · 写作与思考' : 'Kai Li · Writing and thinking',
  )
  await expect(page.locator('meta[name="description"]')).toHaveCount(1)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    language === 'zh'
      ? 'Kai Li 的写作、项目和书架。'
      : 'Writing, projects, and bookshelf by Kai Li.',
  )
  expect(
    await page
      .getByRole('region', {
        name: language === 'zh' ? '最近写的' : 'Recent writing',
      })
      .getByRole('article')
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
  ).toEqual(
    language === 'zh'
      ? ['/zh/writing/boundary-example', '/zh/writing/zh-only-example']
      : ['/en/writing/boundary-example', '/en/writing/en-only-example'],
  )
  for (const slug of [
    'boundary-example',
    language === 'zh' ? 'zh-only-example' : 'en-only-example',
  ]) {
    for (const text of articleExpectations[slug]?.[language]?.slice(0, 2) ?? [])
      await expect(page.locator('body')).toContainText(text)
  }
  for (const notice of missingNotices)
    await expect(page.locator('body')).not.toContainText(notice)
  await expect(page.locator('body')).toContainText(
    language === 'zh' ? '把边界写清楚' : 'Make boundaries visible',
  )
  await expect(page.locator('body')).not.toContainText('private-example')
  await expect(
    page.evaluate(
      () =>
        document.documentElement.scrollWidth ===
        document.documentElement.clientWidth,
    ),
  ).resolves.toBe(true)
}

async function expectSharePage(
  page: Page,
  language: 'zh' | 'en',
  slug: string,
  both: boolean,
) {
  const expected = articleExpectations[slug]?.[language]
  expect(expected).toBeDefined()
  for (const text of expected ?? [])
    await expect(page.locator('body')).toContainText(text)
  await expect(page.locator('h1')).toHaveText(expected?.[0] ?? '')
  await expect(page).toHaveTitle(`${expected?.[0]} · Kai Li`)
  await expect(page.locator('meta[name="description"]')).toHaveCount(1)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    expected?.[1] ?? '',
  )
  await expectSeo(
    page,
    language,
    `/${language}/writing/${slug}`,
    both
      ? [`/zh/writing/${slug}`, `/en/writing/${slug}`]
      : [`/${language}/writing/${slug}`],
  )
  for (const notice of missingNotices)
    await expect(page.locator('body')).not.toContainText(notice)
  await expect(
    page.evaluate(
      () =>
        document.documentElement.scrollWidth ===
        document.documentElement.clientWidth,
    ),
  ).resolves.toBe(true)
}

async function openFormal(page: Page, path: string, reload = false) {
  const response = reload ? await page.reload() : await page.goto(path)
  expect(response?.status()).toBe(200)
  expect(response?.request().redirectedFrom()).toBeNull()
  expect(response?.headers().location).toBeUndefined()
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(path)
  const html = await response!.text()
  expect(html).not.toContain('未发布中文修改不得出现')
  expect(html).not.toContain('Unpublished English edit must not appear')
}

const rootCases = [
  ['R-ROOT-01', { 'Accept-Language': 'zh-CN,zh;q=0.9' }, '/zh', 'zh'],
  ['R-ROOT-02', { 'Accept-Language': 'en-US,en;q=0.9' }, '/en', 'en'],
  ['R-ROOT-03', {}, '/zh', 'zh'],
  ['R-ROOT-04', { 'Accept-Language': 'fr-FR,fr;q=0.9' }, '/zh', 'zh'],
  [
    'R-ROOT-05',
    { 'Accept-Language': 'en', Cookie: 'kaili-language=zh' },
    '/zh',
    'zh',
  ],
  [
    'R-ROOT-06',
    { 'Accept-Language': 'zh', Cookie: 'kaili-language=en' },
    '/en',
    'en',
  ],
] as const

for (const [id, headers, location, language] of rootCases) {
  test(id, async ({ request, page }) => {
    await expectRedirect(request, '/', headers, location)
    await openFormal(page, location)
    await expectRootPage(page, language)
    await openFormal(page, location, true)
    await expectRootPage(page, language)
  })
}

test('R-LANGUAGE-Q', async ({ request, page }) => {
  for (const [header, language] of [
    ['fr-FR,en;q=0.8', 'en'],
    ['en;q=0.1,zh;q=0.9', 'zh'],
    ['zh;q=0.1,en;q=0.9', 'en'],
    ['zh;q=0,en;q=0.5', 'en'],
    ['en;q=0,zh;q=0.5', 'zh'],
    ['en;q=0,zh;q=0', 'zh'],
  ] as const) {
    const headers = { 'Accept-Language': header }
    await expectRedirect(request, '/', headers, `/${language}`)
    await openFormal(page, `/${language}`)
    await expectRootPage(page, language)
    await openFormal(page, `/${language}`, true)
    await expectRootPage(page, language)
    const location = `/${language}/writing/boundary-example`
    await expectRedirect(
      request,
      '/writing/boundary-example',
      headers,
      location,
    )
    await openFormal(page, location)
    await expectSharePage(page, language, 'boundary-example', true)
    await openFormal(page, location, true)
    await expectSharePage(page, language, 'boundary-example', true)
  }
})

const shareCases = [
  [
    'R-SHARE-01',
    '/writing/boundary-example',
    { 'Accept-Language': 'zh' },
    '/zh/writing/boundary-example',
    'zh',
    'boundary-example',
    true,
  ],
  [
    'R-SHARE-02',
    '/writing/boundary-example',
    { 'Accept-Language': 'en' },
    '/en/writing/boundary-example',
    'en',
    'boundary-example',
    true,
  ],
  [
    'R-SHARE-03',
    '/writing/zh-only-example',
    { 'Accept-Language': 'zh' },
    '/zh/writing/zh-only-example',
    'zh',
    'zh-only-example',
    false,
  ],
  [
    'R-SHARE-04',
    '/writing/zh-only-example',
    { 'Accept-Language': 'en' },
    '/zh/writing/zh-only-example',
    'zh',
    'zh-only-example',
    false,
  ],
  [
    'R-SHARE-05',
    '/writing/en-only-example',
    { 'Accept-Language': 'en' },
    '/en/writing/en-only-example',
    'en',
    'en-only-example',
    false,
  ],
  [
    'R-SHARE-06',
    '/writing/en-only-example',
    { 'Accept-Language': 'zh' },
    '/en/writing/en-only-example',
    'en',
    'en-only-example',
    false,
  ],
  [
    'R-SHARE-09',
    '/writing/boundary-example',
    { 'Accept-Language': 'en', Cookie: 'kaili-language=zh' },
    '/zh/writing/boundary-example',
    'zh',
    'boundary-example',
    true,
  ],
  [
    'R-SHARE-10',
    '/writing/boundary-example',
    { 'Accept-Language': 'zh', Cookie: 'kaili-language=en' },
    '/en/writing/boundary-example',
    'en',
    'boundary-example',
    true,
  ],
  [
    'R-SHARE-11',
    '/writing/zh-only-example',
    { 'Accept-Language': 'en', Cookie: 'kaili-language=en' },
    '/zh/writing/zh-only-example',
    'zh',
    'zh-only-example',
    false,
  ],
  [
    'R-SHARE-12',
    '/writing/en-only-example',
    { 'Accept-Language': 'zh', Cookie: 'kaili-language=zh' },
    '/en/writing/en-only-example',
    'en',
    'en-only-example',
    false,
  ],
  [
    'R-SHARE-13',
    '/writing/boundary-example',
    {},
    '/zh/writing/boundary-example',
    'zh',
    'boundary-example',
    true,
  ],
  [
    'R-SHARE-14',
    '/writing/boundary-example',
    { 'Accept-Language': 'fr-FR,fr;q=0.9' },
    '/zh/writing/boundary-example',
    'zh',
    'boundary-example',
    true,
  ],
] as const

for (const [id, path, headers, location, language, slug, both] of shareCases) {
  test(id, async ({ request, page }) => {
    await expectRedirect(request, path, headers, location)
    await openFormal(page, location)
    await expectSharePage(page, language, slug, both)
    await openFormal(page, location, true)
    await expectSharePage(page, language, slug, both)
  })
}

for (const [id, path] of [
  ['R-SHARE-07', '/writing/private-example'],
  ['R-SHARE-08', '/writing/missing-example'],
] as const) {
  test(id, async ({ request, page }) => {
    const response = await request.get(path, { maxRedirects: 0 })
    const html = await response.text()
    expect(response.status()).toBe(404)
    expect(response.headers().location).toBeUndefined()
    expect(html).not.toMatch(/rel="(?:canonical|alternate)"/)
    expect(html).not.toContain(zhBody)
    expect(html).not.toContain(enBody)
    for (const notice of missingNotices) expect(html).not.toContain(notice)
    for (const text of [
      zhBody,
      enBody,
      '这篇文章只有中文公开版本。',
      'This article has only an English published version.',
      '未发布中文修改不得出现',
      'Unpublished English edit must not appear',
    ])
      expect(html).not.toContain(text)
    for (const reload of [false, true]) {
      const browserResponse = reload
        ? await page.reload()
        : await page.goto(path)
      expect(browserResponse?.status()).toBe(404)
      expect(browserResponse?.request().redirectedFrom()).toBeNull()
      expect(browserResponse?.headers().location).toBeUndefined()
      expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
        path,
      )
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
      await expect(page.locator('link[rel="alternate"]')).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: 'EN', exact: true }),
      ).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: '中', exact: true }),
      ).toHaveCount(0)
      for (const text of [
        ...missingNotices,
        zhBody,
        enBody,
        '这篇文章只有中文公开版本。',
        'This article has only an English published version.',
        '未发布中文修改不得出现',
        'Unpublished English edit must not appear',
      ])
        await expect(page.locator('body')).not.toContainText(text)
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth ===
            document.documentElement.clientWidth,
        ),
      ).toBe(true)
    }
  })
}
