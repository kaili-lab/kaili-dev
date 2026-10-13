import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'

import {
  noOverflow,
  open,
  publicSnapshot,
  reset,
  sitemap,
  typeBody,
} from './helpers'

// T5.4 acceptance on the dev server (D-132). Seed data: boundary-example
// (zh + en published, both with different unpublished drafts),
// zh-only-example, en-only-example, private-example; Idea idea-boundaries.

let hydrationErrors: string[] = []
test.beforeEach(async ({ request, page }) => {
  await reset(request)
  hydrationErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrat/i.test(message.text()))
      hydrationErrors.push(message.text().slice(0, 200))
  })
})
// Server render and browser must agree (fixed time zone, no client-only text).
test.afterEach(() => {
  expect(hydrationErrors).toEqual([])
})

const status = (page: import('@playwright/test').Page) =>
  page.locator('.ad-toolbar').getByRole('status')
const alert = (page: import('@playwright/test').Page) =>
  page.locator('.ad-toolbar').getByRole('alert')

test('new article: blocked without category, saved, published, edited, republished', async ({
  page,
  request,
}) => {
  await open(page, '/admin')
  await expect(page).toHaveURL(/\/admin\/posts$/)
  await expect(page.locator('.ad-nav')).toContainText(
    'Kai Li（开发环境假登录）',
  )
  await open(page, '/admin/posts/new')
  await page.getByLabel('标题').fill('流程测试')
  await page.getByLabel('摘要').fill('第一版摘要')
  await typeBody(page, '第一版正文')
  await page.getByLabel('slug').fill('flow-test')

  // Save without a category is refused and nothing is created (D-123).
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(alert(page)).toHaveText('保存失败：请选择分类')
  await expect(page).toHaveURL(/\/admin\/posts\/new/)
  await expect(page.getByLabel('分类')).toBeFocused()

  await page.getByLabel('分类').selectOption('engineering')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}\?lang=zh$/)
  await expect(status(page)).toHaveText(/^已保存 \d\d:\d\d$/)
  await expect(page.getByRole('tab', { name: /中文 · 草稿/ })).toBeVisible()
  // Saving never publishes (D-034).
  expect((await request.get('/zh/writing/flow-test')).status()).toBe(404)

  await page.getByRole('button', { name: '发布中文' }).click()
  await expect(status(page)).toHaveText(/^中文版已发布 \d\d:\d\d$/)
  await expect(page.getByRole('tab', { name: /中文 · 已发布$/ })).toBeVisible()
  let snapshot = await publicSnapshot(request, '/zh/writing/flow-test')
  expect(snapshot).toMatchObject({
    status: 200,
    h1: '流程测试',
    description: '第一版摘要',
  })

  // Edit and save: the public page keeps the published version.
  await page.getByLabel('标题').fill('流程测试第二版')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(status(page)).toHaveText(/^已保存/)
  await expect(
    page.getByRole('tab', { name: /中文 · 已发布 · 有未发布修改/ }),
  ).toBeVisible()
  snapshot = await publicSnapshot(request, '/zh/writing/flow-test')
  expect(snapshot.h1).toBe('流程测试')

  await page.getByRole('button', { name: '发布中文' }).click()
  await expect(status(page)).toHaveText(/^中文版已发布/)
  snapshot = await publicSnapshot(request, '/zh/writing/flow-test')
  expect(snapshot.h1).toBe('流程测试第二版')

  // English was never written: still unpublished and independent.
  await expect(
    page.getByRole('tab', { name: 'English · 未创建' }),
  ).toBeVisible()
  expect(
    (await request.get('/en/writing/flow-test', { maxRedirects: 0 })).status(),
  ).toBe(404)
})

test('Chinese publishes alone while English stays a draft; tabs keep separate edits', async ({
  page,
  request,
}) => {
  await open(page, '/admin/posts/new')
  await page.getByLabel('分类').selectOption('engineering')
  await page.getByLabel('slug').fill('two-tabs')
  await page.getByLabel('标题').fill('中文标题')
  await page.getByLabel('摘要').fill('中文摘要')
  await typeBody(page, '中文正文')

  await page.getByRole('tab', { name: /English/ }).click()
  await expect(page).toHaveURL(/lang=en/)
  await expect(page.getByLabel('标题')).toHaveValue('')
  await page.getByLabel('标题').fill('English draft')
  await page.getByRole('tab', { name: /中文/ }).click()
  await expect(page.getByLabel('标题')).toHaveValue('中文标题')
  await expect(page.locator('.cm-content')).toHaveText('中文正文')

  await page.getByRole('button', { name: '发布中文' }).click()
  await expect(status(page)).toHaveText(/^中文版已发布/)
  // The English edit is still unsaved and still there.
  await expect(
    page.getByRole('tab', { name: /English · 未创建 •/ }),
  ).toBeVisible()
  await page.getByRole('tab', { name: /English/ }).click()
  await expect(page.getByLabel('标题')).toHaveValue('English draft')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(status(page)).toHaveText(/^已保存/)
  await expect(page.getByRole('tab', { name: 'English · 草稿' })).toBeVisible()

  expect((await publicSnapshot(request, '/zh/writing/two-tabs')).h1).toBe(
    '中文标题',
  )
  expect(
    (await request.get('/en/writing/two-tabs', { maxRedirects: 0 })).status(),
  ).toBe(404)
})

test('publish validates only the current language and lists every missing field', async ({
  page,
}) => {
  await open(page, '/admin/posts/new')
  await page.getByLabel('分类').selectOption('engineering')
  await page.getByRole('button', { name: '发布中文' }).click()
  await expect(alert(page)).toHaveText(
    '发布失败，公开内容未改变：缺少标题；缺少摘要；缺少正文；缺少 slug',
  )
  await expect(page).toHaveURL(/\/admin\/posts\/new/)
})

test('new category from the editor is created and selected (D-118)', async ({
  page,
}) => {
  await open(page, '/admin/posts/new')
  await page.getByRole('button', { name: '新建分类' }).click()
  const dialog = page.getByRole('dialog', { name: '新建分类' })
  await dialog.getByLabel('中文名').fill('读书')
  await dialog.getByLabel('英文名').fill('Reading')
  await dialog.getByLabel('slug').fill('Reading')
  await dialog.getByRole('button', { name: '创建并选中' }).click()
  await expect(dialog.getByRole('alert')).toContainText('slug 只能用小写字母')
  await dialog.getByLabel('slug').fill('reading')
  await dialog.getByRole('button', { name: '创建并选中' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel('分类')).toHaveValue('reading')
  await expect(page.getByLabel('分类').locator('option:checked')).toHaveText(
    '读书',
  )
})

test('Ideas: blank cannot be saved; "用它写文章" attaches the Idea; references hold only Ideas', async ({
  page,
}) => {
  await open(page, '/admin/ideas')
  for (const blank of ['', '   ', '\u3000']) {
    await typeBody(page, blank)
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('请输入内容')
  }
  await typeBody(page, '新的想法：写一篇关于后台的文章')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('已保存')
  const newest = page.locator('.ad-stack > li').first()
  await expect(newest.locator('.ad-idea-text')).toHaveText(
    '新的想法：写一篇关于后台的文章',
  )

  await newest.getByRole('link', { name: '用它写文章' }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/new\?idea=/)
  const references = page.locator('.ad-references')
  await expect(references.locator('summary').first()).toHaveText(
    '参考资料（Idea · 1）',
  )
  await references.locator('summary').first().click()
  await expect(references.locator('.ad-refs > li')).toHaveCount(1)
  await expect(references.locator('.ad-refs')).toContainText(
    '新的想法：写一篇关于后台的文章',
  )
  // The picker offers Ideas and nothing else (D-103).
  await expect(references.getByLabel('选择 Idea').locator('option')).toHaveText(
    [/边界的本质是归属/],
  )

  // The attachment is saved with the draft.
  await page.getByLabel('分类').selectOption('engineering')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(status(page)).toHaveText(/^已保存/)
  await page.reload()
  await page.locator('.ad-root[data-hydrated]').waitFor()
  await expect(page.locator('.ad-references summary').first()).toHaveText(
    '参考资料（Idea · 1）',
  )
})

test('deleting an Idea asks first and removes its article references (D-068)', async ({
  page,
}) => {
  // Attach the seed Idea to a saved draft.
  await open(page, '/admin/posts/new?idea=idea-boundaries')
  await page.getByLabel('分类').selectOption('engineering')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(status(page)).toHaveText(/^已保存/)
  const editor = page.url()

  await open(page, '/admin/ideas')
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('永久删除这条 Idea？')
    void dialog.dismiss()
  })
  await page.getByRole('button', { name: '删除' }).click()
  await expect(page.locator('.ad-stack > li')).toHaveCount(1)
  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: '删除' }).click()
  await expect(page.getByRole('status')).toHaveText('已删除')
  await expect(page.getByText('还没有 Idea。')).toBeVisible()

  await open(page, editor)
  await expect(page.locator('.ad-references summary').first()).toHaveText(
    '参考资料（Idea · 0）',
  )
})

test('leaving with unsaved changes asks; leaving without changes does not (D-038)', async ({
  page,
}) => {
  await open(page, '/admin/posts/boundary-example?lang=zh')
  // Clean: navigation happens without a prompt.
  let prompted = false
  let answer: 'dismiss' | 'accept' = 'dismiss'
  page.on('dialog', (dialog) => {
    prompted = true
    void (answer === 'accept' ? dialog.accept() : dialog.dismiss())
  })
  await page.getByRole('link', { name: 'Idea', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/ideas$/)
  expect(prompted).toBe(false)
  await expect(page.getByRole('heading', { name: 'Idea' })).toBeVisible()

  await open(page, '/admin/posts/boundary-example?lang=zh')
  await page.getByLabel('标题').fill('改了但没保存')
  await expect(page.getByRole('tab', { name: /中文 .* •/ })).toBeVisible()
  await page.getByRole('link', { name: 'Idea', exact: true }).click()
  await expect.poll(() => prompted).toBe(true)
  await expect(page).toHaveURL(/\/admin\/posts\/boundary-example/)
  await expect(page.getByLabel('标题')).toHaveValue('改了但没保存')

  // Shared-field edits count too. (Leave the dirty page first, accepting.)
  answer = 'accept'
  await open(page, '/admin/posts/boundary-example?lang=zh')
  answer = 'dismiss'
  // The page we left for renders normally (no error boundary).
  await expect(page.getByLabel('标题')).toHaveValue('未发布中文标题不得出现')
  await expect(page.getByRole('alert')).toHaveCount(0)
  prompted = false
  await page.getByRole('checkbox', { name: 'Cloudflare' }).check()
  await expect(page.locator('.ad-shared legend')).toContainText('共享信息 •')
  await page.getByRole('link', { name: '文章', exact: true }).click()
  await expect.poll(() => prompted).toBe(true)
})

test('categories and tags: two tabs, referenced entries cannot be deleted', async ({
  page,
}) => {
  await open(page, '/admin/taxonomy')
  await expect(page.getByRole('tab', { name: '分类' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  const engineering = page.locator('.ad-taxonomy > li', { hasText: '工程' })
  await expect(engineering.getByRole('button', { name: '删除' })).toBeDisabled()
  await expect(engineering).toContainText('有 4 篇文章引用，不能删除')

  await page.getByRole('tab', { name: '标签' }).click()
  await expect(page).toHaveURL(/tab=tags/)
  await expect(page.locator('.ad-taxonomy > li').first()).toContainText(
    'TypeScript',
  )
  await page.getByRole('button', { name: '新建标签' }).click()
  const dialog = page.getByRole('dialog', { name: '新建标签' })
  await dialog.getByLabel('中文名').fill('临时')
  await dialog.getByLabel('英文名').fill('Temp')
  await dialog.getByLabel('slug').fill('temp')
  await dialog.getByRole('button', { name: '保存' }).click()
  const temp = page.locator('.ad-taxonomy > li', { hasText: '临时' })
  await expect(temp).toContainText('引用 0')
  page.once('dialog', (confirm) => void confirm.accept())
  await temp.getByRole('button', { name: '删除' }).click()
  await expect(
    page.locator('.ad-taxonomy > li', { hasText: '临时' }),
  ).toHaveCount(0)
})

test('the server rejects a missing category even when the form is bypassed (T51-O04)', async ({
  page,
  request,
}) => {
  const before = await publicSnapshot(request, '/zh/writing/boundary-example')
  await open(page, '/admin/posts/boundary-example?lang=zh')
  // Capture the real save request, then replay it with the category removed.
  const [captured] = await Promise.all([
    page.waitForRequest(
      (candidate) =>
        candidate.method() === 'POST' && candidate.url().includes('_serverFn'),
    ),
    page.getByRole('button', { name: '保存', exact: true }).click(),
  ])
  await expect(status(page)).toHaveText(/^已保存/)
  const body = captured.postData() ?? ''
  // Server functions use seroval; strings are {"t":1,"s":…}.
  expect(body).toContain('{"t":1,"s":"engineering"}')
  const replay = await page.evaluate(
    async ({ url, headers, payload }) => {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: payload,
      })
      return response.text()
    },
    {
      url: captured.url(),
      headers: await captured.allHeaders(),
      payload: body
        .replace('{"t":1,"s":"engineering"}', '{"t":1,"s":""}')
        .replace(
          '{"t":1,"s":"未发布中文标题不得出现"}',
          '{"t":1,"s":"绕过表单"}',
        ),
    },
  )
  expect(replay).toContain('category-required')
  await page.reload()
  await page.locator('.ad-root[data-hydrated]').waitFor()
  await expect(page.getByLabel('标题')).not.toHaveValue('绕过表单')
  expect(await publicSnapshot(request, '/zh/writing/boundary-example')).toEqual(
    before,
  )
})

for (const language of ['zh', 'en'] as const) {
  const other = language === 'zh' ? 'en' : 'zh'
  const button = language === 'zh' ? '发布中文' : '发布英文'
  test(`R-SEO-04/05 (${language}): save changes nothing public; publish updates only ${language}`, async ({
    page,
    request,
  }) => {
    const path = (lang: string) => `/${lang}/writing/boundary-example`
    const before = {
      current: await publicSnapshot(request, path(language)),
      other: await publicSnapshot(request, path(other)),
      sitemap: await sitemap(request),
    }
    expect(before.current.status).toBe(200)

    await open(page, `/admin/posts/boundary-example?lang=${language}`)
    const title =
      language === 'zh' ? '联验中文新标题' : 'Joint check English title'
    const summary =
      language === 'zh' ? '联验中文新摘要' : 'Joint check English summary'
    const body =
      language === 'zh'
        ? '联验中文新正文第一段。'
        : 'Joint check new English body.'
    await page.getByLabel('标题').fill(title)
    await page.getByLabel('摘要').fill(summary)
    await typeBody(page, body)
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await expect(status(page)).toHaveText(/^已保存/)
    // The old public body is what readers see before publishing.
    const oldLine =
      language === 'zh'
        ? '段落使用正文宋体。这里是一篇中文公开文章。'
        : 'This is the published English article.'
    expect(before.current.mainText).toContain(oldLine)
    expect(before.current.mainText).not.toContain(body)

    // Saving: HTML, title, description, canonical, hreflang, OG and sitemap all unchanged.
    expect(await publicSnapshot(request, path(language))).toEqual(
      before.current,
    )
    expect(await publicSnapshot(request, path(other))).toEqual(before.other)
    expect(await sitemap(request)).toEqual(before.sitemap)

    await page.getByRole('button', { name: button }).click()
    await expect(status(page)).toHaveText(/已发布/)
    const after = await publicSnapshot(request, path(language))
    expect(after).toMatchObject({
      status: 200,
      h1: title,
      title: `${title} · Kai Li`,
      description: summary,
      ogTitle: title,
      ogDescription: summary,
      canonical: before.current.canonical,
      hreflang: before.current.hreflang,
    })
    expect(after.ogHash).not.toBe(before.current.ogHash)
    // The public body is the new one and the old one is gone.
    expect(after.mainText).toContain(body)
    expect(after.mainText).not.toContain(oldLine)
    // The other language keeps its baseline, OG included.
    expect(await publicSnapshot(request, path(other))).toEqual(before.other)
    // Sitemap: same members; only this language's lastmod moves.
    const map = await sitemap(request)
    const loc = (lang: string) => `https://kaili.dev${path(lang)} `
    expect(map.map((row) => row.split(' ')[0])).toEqual(
      before.sitemap.map((row) => row.split(' ')[0]),
    )
    expect(map.find((row) => row.startsWith(loc(other)))).toBe(
      before.sitemap.find((row) => row.startsWith(loc(other))),
    )
    expect(map.find((row) => row.startsWith(loc(language)))).not.toBe(
      before.sitemap.find((row) => row.startsWith(loc(language))),
    )
  })
}

test('T6.1: saving leaves the sitemap alone; first publish adds one page; republish moves lastmod', async ({
  page,
  request,
}) => {
  const base = await sitemap(request)
  await open(page, '/admin/posts/new')
  await page.getByLabel('分类').selectOption('engineering')
  await page.getByLabel('slug').fill('sitemap-check')
  await page.getByLabel('标题').fill('网站地图')
  await page.getByLabel('摘要').fill('摘要')
  await typeBody(page, '正文')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(status(page)).toHaveText(/^已保存/)
  expect(await sitemap(request)).toEqual(base)

  await page.getByRole('button', { name: '发布中文' }).click()
  await expect(status(page)).toHaveText(/已发布/)
  const first = await sitemap(request)
  const added = first.filter((row) => !base.includes(row))
  expect(added).toHaveLength(1)
  // ...and nothing that was there before went missing or changed.
  expect(base.filter((row) => !first.includes(row))).toEqual([])
  expect(added[0]).toMatch(
    /^https:\/\/kaili\.dev\/zh\/writing\/sitemap-check \d{4}-\d\d-\d\dT/,
  )
  expect(
    first.filter((row) => row.includes('/en/writing/sitemap-check')),
  ).toEqual([])

  await page.getByLabel('标题').fill('网站地图第二版')
  await page.getByRole('button', { name: '发布中文' }).click()
  await expect(status(page)).toHaveText(/已发布/)
  const second = await sitemap(request)
  const row = second.find((item) => item.includes('/zh/writing/sitemap-check'))
  expect(row).toBeDefined()
  expect(row).not.toBe(added[0])
  expect(second.filter((item) => !item.includes('sitemap-check'))).toEqual(
    first.filter((item) => !item.includes('sitemap-check')),
  )
})

test('T4.2: a language with no published posts shows the no-posts sentence', async ({
  page,
  request,
}) => {
  await reset(request, 'en-only')
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/zh/writing')
    await expect(page.locator('.site-writing-list')).toHaveCount(0)
    await expect(page.locator('.site-writing-empty p')).toHaveText(
      '还没有已发布的文章。',
    )
    await expect(page.locator('.site-writing-empty a')).toHaveAttribute(
      'href',
      '/zh/writing',
    )
    await expect(
      page.locator('.site-writing-filters a[aria-current="page"]'),
    ).toHaveText(['全部', '全部'])
    await expect(page.getByText('An English-only article')).toHaveCount(0)
    await noOverflow(page)
  }
  await page.goto('/en/writing')
  await expect(
    page.locator('.site-writing-list').getByRole('heading'),
  ).toHaveText(['An English-only article'])
})

// ---- T5.4 review round 1 ----------------------------------------------------

// Server function URLs carry base64url JSON naming the exported function.
const serverFunction = (url: string) => {
  const id = url.split('/_serverFn/')[1]?.split('?')[0]
  if (!id) return null
  try {
    const decoded = JSON.parse(Buffer.from(id, 'base64url').toString()) as {
      export?: string
    }
    return decoded.export ?? null
  } catch {
    return null
  }
}
const calls = (name: string) => (url: string) =>
  serverFunction(url)?.startsWith(name) ?? false
const saveCall = calls('saveAdminArticle')

test('edits made while a save is in flight are kept and stay unsaved', async ({
  page,
}) => {
  await open(page, '/admin/posts/boundary-example?lang=zh')
  await page.route(
    (url) => saveCall(url.href),
    async (route) => {
      await new Promise((done) => setTimeout(done, 1200))
      await route.continue()
    },
  )
  await page.getByLabel('标题').fill('提交时的标题')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByLabel('标题').fill('请求期间继续改的标题')
  await page.getByRole('checkbox', { name: 'Cloudflare' }).check()
  await expect(status(page)).toHaveText(/^已保存/)
  await expect(page.getByLabel('标题')).toHaveValue('请求期间继续改的标题')
  await expect(page.getByRole('checkbox', { name: 'Cloudflare' })).toBeChecked()
  await expect(page.getByRole('tab', { name: /中文 .* •/ })).toBeVisible()
  await expect(page.locator('.ad-shared legend')).toContainText('共享信息 •')
  // What was committed is the snapshot taken at click time.
  await page.unroute((url) => saveCall(url.href))
  page.once('dialog', (dialog) => void dialog.accept())
  await open(page, '/admin/posts/boundary-example?lang=zh')
  await expect(page.getByLabel('标题')).toHaveValue('提交时的标题')
  await expect(
    page.getByRole('checkbox', { name: 'Cloudflare' }),
  ).not.toBeChecked()
})

test('a new article keeps the latest edits of both tabs across its first save', async ({
  page,
}) => {
  await open(page, '/admin/posts/new')
  await page.getByLabel('分类').selectOption('engineering')
  await page.getByLabel('标题').fill('中文初稿')
  await page.getByRole('tab', { name: /English/ }).click()
  await page.getByLabel('标题').fill('English first')
  await page.getByRole('tab', { name: /中文/ }).click()
  await page.route(
    (url) => saveCall(url.href),
    async (route) => {
      await new Promise((done) => setTimeout(done, 1200))
      await route.continue()
    },
  )
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByLabel('标题').fill('中文初稿（请求期间又改）')
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}\?lang=zh$/)
  await page.locator('.ad-root[data-hydrated]').waitFor()
  await expect(page.getByLabel('标题')).toHaveValue('中文初稿（请求期间又改）')
  await expect(page.getByRole('tab', { name: /中文 · 草稿 •/ })).toBeVisible()
  await page.getByRole('tab', { name: /English/ }).click()
  await expect(page.getByLabel('标题')).toHaveValue('English first')
})

test('the server rejects a category or tag that does not exist', async ({
  page,
  request,
}) => {
  const before = await publicSnapshot(request, '/zh/writing/boundary-example')
  await open(page, '/admin/posts/boundary-example?lang=zh')
  const [captured] = await Promise.all([
    page.waitForRequest(
      (candidate) =>
        candidate.method() === 'POST' &&
        calls('publishAdminArticle')(candidate.url()),
    ),
    page.getByRole('button', { name: '发布中文' }).click(),
  ])
  await expect(status(page)).toHaveText(/已发布/)
  const published = await publicSnapshot(
    request,
    '/zh/writing/boundary-example',
  )
  const body = captured.postData() ?? ''
  const replay = (payload: string) =>
    page.evaluate(
      async ({ url, payload: text }) =>
        (
          await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: text,
          })
        ).text(),
      {
        url: captured
          .url()
          .replace('publishAdminArticle', 'publishAdminArticle'),
        payload,
      },
    )
  const ghost = await replay(
    body.replace('{"t":1,"s":"engineering"}', '{"t":1,"s":"ghost"}'),
  )
  expect(ghost).toContain('category-unknown')
  const ghostTag = await replay(
    body.replace('{"t":1,"s":"typescript"}', '{"t":1,"s":"ghost-tag"}'),
  )
  expect(ghostTag).toContain('tag-unknown')
  expect(await publicSnapshot(request, '/zh/writing/boundary-example')).toEqual(
    published,
  )
  expect(published.mainText).not.toEqual(before.mainText)
})

test('feedback names the language that was published, not the tab now open', async ({
  page,
}) => {
  await open(page, '/admin/posts/boundary-example?lang=zh')
  await page.getByRole('button', { name: '发布中文' }).click()
  await expect(status(page)).toHaveText(/^中文版已发布/)
  await page.getByRole('tab', { name: /English/ }).click()
  await expect(status(page)).toHaveText(/^中文版已发布/)
})

test('a late preview from one language never shows in the other', async ({
  page,
}) => {
  await open(page, '/admin/posts/boundary-example?lang=zh')
  await page.route(
    (url) => calls('previewMarkdown')(url.href),
    async (route) => {
      await new Promise((done) => setTimeout(done, 1200))
      await route.continue()
    },
  )
  await page.getByRole('button', { name: '预览' }).click()
  await expect(page.getByText('正在生成预览…')).toBeVisible()
  await page.getByRole('tab', { name: /English/ }).click()
  await page.waitForTimeout(1600)
  await expect(page.locator('[data-preview]')).toHaveCount(0)
  await expect(page.locator('.cm-content')).toContainText(
    'Unpublished English edit',
  )
})

test('Ideas have a Markdown preview that does not save (D-071)', async ({
  page,
}) => {
  await open(page, '/admin/ideas/idea-boundaries')
  await typeBody(page, '**粗体想法**')
  await page.getByRole('button', { name: '预览' }).click()
  await expect(page.locator('[data-preview="Idea"] strong')).toHaveText(
    '粗体想法',
  )
  page.once('dialog', (dialog) => void dialog.accept())
  await open(page, '/admin/ideas/idea-boundaries')
  await expect(page.locator('.cm-content')).toContainText('边界的本质是归属')
})

test('the list opens the language edited last', async ({ page }) => {
  await open(page, '/admin/posts/boundary-example?lang=en')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(status(page)).toHaveText(/^已保存/)
  await open(page, '/admin/posts')
  const link = page
    .locator('.ad-stack > li', { hasText: '未发布中文标题不得出现' })
    .getByRole('link')
  await expect(link).toHaveAttribute(
    'href',
    '/admin/posts/boundary-example?lang=en',
  )
  const untouched = page
    .locator('.ad-stack > li', { hasText: '只有中文的文章' })
    .getByRole('link')
  await expect(untouched).toHaveAttribute(
    'href',
    '/admin/posts/zh-only-example?lang=zh',
  )
})

test('closing or reloading with unsaved changes asks; the Idea editor asks too', async ({
  page,
}) => {
  await open(page, '/admin/posts/boundary-example?lang=zh')
  await page.getByLabel('标题').fill('未保存')
  const unload = page.waitForEvent('dialog')
  void page.close({ runBeforeUnload: true })
  const dialog = await unload
  expect(dialog.type()).toBe('beforeunload')
  await dialog.dismiss()

  const idea = await page.context().newPage()
  await open(idea, '/admin/ideas/idea-boundaries')
  await typeBody(idea, '改了还没保存')
  await expect(idea.getByRole('heading', { name: '编辑 Idea •' })).toBeVisible()
  const leave = idea.waitForEvent('dialog')
  void idea.getByRole('link', { name: '返回列表' }).click()
  const prompt = await leave
  expect(prompt.message()).toContain('有未保存的修改')
  await prompt.dismiss()
  await expect(idea).toHaveURL(/\/admin\/ideas\/idea-boundaries$/)
})

test('a failed request reports an unknown result and keeps the edits (D-160 ②)', async ({
  page,
}) => {
  await open(page, '/admin/posts/boundary-example?lang=zh')
  await page.route(
    (url) => saveCall(url.href),
    (route) => route.abort('connectionreset'),
  )
  await page.getByLabel('标题').fill('网络断开时的标题')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(alert(page)).toHaveText(
    '无法确认保存结果，请刷新查看当前状态；编辑内容仍保留在编辑器中',
  )
  await expect(page.getByLabel('标题')).toHaveValue('网络断开时的标题')
  await expect(page.getByRole('tab', { name: /中文 .* •/ })).toBeVisible()
})

test('renaming a category shows at once on published pages and OG (D-160 ①)', async ({
  page,
  request,
}) => {
  const before = await publicSnapshot(request, '/zh/writing/boundary-example')
  expect(before.mainText).toContain('工程')
  await open(page, '/admin/taxonomy?tab=categories')
  await page
    .locator('.ad-taxonomy > li', { hasText: '工程' })
    .getByRole('button', { name: '编辑' })
    .click()
  const dialog = page.getByRole('dialog', { name: '编辑分类' })
  await expect(dialog).toContainText('改名会立即显示在所有已发布文章上')
  await expect(dialog.getByLabel('slug')).toHaveAttribute('readonly', '')
  await dialog.getByLabel('中文名').fill('工程实践')
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('status')).toHaveText('已保存')
  const after = await publicSnapshot(request, '/zh/writing/boundary-example')
  expect(after.mainText).toContain('工程实践')
  expect(after.ogHash).not.toBe(before.ogHash)
  // The article itself (title, body) is untouched.
  expect(after.h1).toBe(before.h1)
})

for (const theme of ['light', 'dark'] as const) {
  test(`editor syntax colours come only from K2 tokens (${theme})`, async ({
    page,
  }) => {
    await page.addInitScript(
      (value) => localStorage.setItem('kaili-theme', value),
      theme,
    )
    await open(page, '/admin/posts/new')
    await typeBody(
      page,
      '# 标题\n\n**粗** *斜* [链接](https://kaili.dev) `代码` (括号) > 引用\n\n```ts\nconst a = [1]\n```',
    )
    const result = await page.evaluate(() => {
      const probe = document.createElement('span')
      document.body.append(probe)
      const resolve = (token: string) => {
        probe.style.color = `var(${token})`
        return getComputedStyle(probe).color
      }
      const allowed = ['--ink', '--ink-2', '--mute', '--indigo'].map(resolve)
      probe.remove()
      const used = [
        ...document.querySelectorAll('.cm-content, .cm-content *'),
      ].map((element) => getComputedStyle(element).color)
      return { allowed, used: [...new Set(used)] }
    })
    expect(result.used.length).toBeGreaterThan(1)
    for (const colour of result.used)
      expect(result.allowed, colour).toContain(colour)
  })
}

test('first-save redirect keeps tags and Idea links changed meanwhile', async ({
  page,
}) => {
  await open(page, '/admin/posts/new')
  await page.getByLabel('分类').selectOption('engineering')
  await page.route(
    (url) => saveCall(url.href),
    async (route) => {
      await new Promise((done) => setTimeout(done, 1200))
      await route.continue()
    },
  )
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByRole('checkbox', { name: 'TypeScript' }).check()
  await page.locator('.ad-references summary').first().click()
  await page.getByRole('button', { name: '添加 Idea' }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}\?lang=zh$/)
  await page.locator('.ad-root[data-hydrated]').waitFor()
  await expect(page.getByRole('checkbox', { name: 'TypeScript' })).toBeChecked()
  await expect(page.locator('.ad-shared legend')).toContainText('共享信息 •')
  await expect(page.locator('.ad-references summary').first()).toHaveText(
    '参考资料（Idea · 1） •',
  )
})

test('a slug typed during the first publish snaps to the published slug', async ({
  page,
}) => {
  await open(page, '/admin/posts/new')
  await page.getByLabel('分类').selectOption('engineering')
  await page.getByLabel('slug').fill('first-slug')
  await page.getByLabel('标题').fill('锁定测试')
  await page.getByLabel('摘要').fill('摘要')
  await typeBody(page, '正文')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}/)
  await page.locator('.ad-root[data-hydrated]').waitFor()
  await page.route(
    (url) => calls('publishAdminArticle')(url.href),
    async (route) => {
      await new Promise((done) => setTimeout(done, 1200))
      await route.continue()
    },
  )
  await page.getByRole('button', { name: '发布中文' }).click()
  await page.getByLabel('slug').fill('second-slug')
  await expect(status(page)).toHaveText(/^中文版已发布/)
  await expect(page.getByLabel('slug')).toHaveValue('first-slug')
  await expect(page.getByLabel('slug')).toHaveAttribute('readonly', '')
  await page.unroute((url) => calls('publishAdminArticle')(url.href))
  // Later commits still work.
  await page.getByLabel('标题').fill('锁定测试第二版')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(status(page)).toHaveText(/^已保存/)
})

test('reloading with unsaved changes asks first', async ({ page }) => {
  await open(page, '/admin/posts/boundary-example?lang=zh')
  await page.getByLabel('标题').fill('刷新前未保存')
  const prompt = page.waitForEvent('dialog')
  const reload = page.reload({ timeout: 3000 }).catch(() => 'cancelled')
  const dialog = await prompt
  expect(dialog.type()).toBe('beforeunload')
  await dialog.dismiss()
  expect(await reload).toBe('cancelled')
  await expect(page.getByLabel('标题')).toHaveValue('刷新前未保存')
})

test('a failed page load shows the admin error state', async ({ page }) => {
  await open(page, '/admin/posts')
  await page.route(
    (url) => calls('listIdeas')(url.href),
    (route) => route.abort('connectionreset'),
  )
  await page.getByRole('link', { name: 'Idea', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    '页面加载失败，请刷新重试。',
  )
  await expect(page.getByRole('link', { name: '返回文章列表' })).toBeVisible()
})

test('renaming tags and English names shows at once on both languages (D-160 ①)', async ({
  page,
  request,
}) => {
  const before = {
    zh: await publicSnapshot(request, '/zh/writing/boundary-example'),
    en: await publicSnapshot(request, '/en/writing/boundary-example'),
  }
  await open(page, '/admin/taxonomy?tab=tags')
  await page
    .locator('.ad-taxonomy > li', { hasText: 'TypeScript' })
    .getByRole('button', { name: '编辑' })
    .click()
  let dialog = page.getByRole('dialog', { name: '编辑标签' })
  await dialog.getByLabel('中文名').fill('类型脚本')
  await dialog.getByLabel('英文名').fill('TS Lang')
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('status')).toHaveText('已保存')

  await open(page, '/admin/taxonomy?tab=categories')
  await page
    .locator('.ad-taxonomy > li', { hasText: '工程' })
    .getByRole('button', { name: '编辑' })
    .click()
  dialog = page.getByRole('dialog', { name: '编辑分类' })
  await dialog.getByLabel('英文名').fill('Craft')
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('status')).toHaveText('已保存')

  const after = {
    zh: await publicSnapshot(request, '/zh/writing/boundary-example'),
    en: await publicSnapshot(request, '/en/writing/boundary-example'),
  }
  expect(after.zh.mainText).toContain('类型脚本')
  expect(after.zh.mainText).toContain('工程')
  expect(after.en.mainText).toContain('TS Lang')
  expect(after.en.mainText).toContain('Craft')
  expect(after.en.mainText).not.toContain('Engineering')
  expect(after.en.ogHash).not.toBe(before.en.ogHash)
  // Chinese OG uses the Chinese category name, which did not change.
  expect(after.zh.ogHash).toBe(before.zh.ogHash)
  expect(after.zh.h1).toBe(before.zh.h1)
  expect(after.en.h1).toBe(before.en.h1)
})

test('a new article published directly keeps the published slug across the redirect', async ({
  page,
}) => {
  await open(page, '/admin/posts/new')
  await page.getByLabel('分类').selectOption('engineering')
  await page.getByLabel('slug').fill('direct-slug')
  await page.getByLabel('标题').fill('直接发布')
  await page.getByLabel('摘要').fill('摘要')
  await typeBody(page, '正文')
  await page.route(
    (url) => calls('publishAdminArticle')(url.href),
    async (route) => {
      await new Promise((done) => setTimeout(done, 1200))
      await route.continue()
    },
  )
  await page.getByRole('button', { name: '发布中文' }).click()
  await page.getByLabel('slug').fill('typed-meanwhile')
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}\?lang=zh$/)
  await page.locator('.ad-root[data-hydrated]').waitFor()
  await expect(page.getByLabel('slug')).toHaveValue('direct-slug')
  await expect(page.getByLabel('slug')).toHaveAttribute('readonly', '')
  await page.unroute((url) => calls('publishAdminArticle')(url.href))
  await page.getByLabel('标题').fill('直接发布第二版')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(status(page)).toHaveText(/^已保存/)
})
