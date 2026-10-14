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
// D-163 ④: confirmations are in-page dialogs, not window.confirm.
const confirmDialog = (page: import('@playwright/test').Page) =>
  page.getByRole('alertdialog')
const rows = (page: import('@playwright/test').Page) =>
  page.locator('.ad-list-scroll tbody tr')

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
  const opener = page.getByRole('button', { name: '新建分类' })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: '新建分类' })
  // Focus starts on 取消; Escape closes without saving and returns focus.
  await expect(dialog.getByRole('button', { name: '取消' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  await opener.click()
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
  const newest = rows(page).first()
  await expect(newest.locator('.ad-idea-link')).toHaveText(
    '新的想法：写一篇关于后台的文章',
  )

  await newest.getByRole('link', { name: '用它写文章' }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/new\?idea=/)
  const references = page.locator('.ad-references')
  await expect(references.locator('h2')).toHaveText('参考资料（Idea · 1）')
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
  await expect(page.locator('.ad-references h2')).toHaveText(
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
  await page.getByRole('button', { name: '删除' }).click()
  await expect(confirmDialog(page)).toContainText('永久删除这条 Idea？')
  // Focus starts on 取消, and Escape cancels.
  await expect(
    confirmDialog(page).getByRole('button', { name: '取消' }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(confirmDialog(page)).toHaveCount(0)
  await expect(rows(page)).toHaveCount(1)
  await page.getByRole('button', { name: '删除' }).click()
  await confirmDialog(page).getByRole('button', { name: '删除' }).click()
  await expect(page.getByRole('status')).toHaveText('已删除')
  await expect(page.getByText('还没有 Idea。')).toBeVisible()

  await open(page, editor)
  await expect(page.locator('.ad-references h2')).toHaveText(
    '参考资料（Idea · 0）',
  )
})

test('leaving with unsaved changes asks; leaving without changes does not (D-038)', async ({
  page,
}) => {
  await open(page, '/admin/posts/boundary-example?lang=zh')
  // Clean: navigation happens without a prompt.
  await page.getByRole('link', { name: 'Idea', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/ideas$/)
  await expect(page.getByRole('heading', { name: 'Idea' })).toBeVisible()
  await expect(confirmDialog(page)).toHaveCount(0)

  await open(page, '/admin/posts/boundary-example?lang=zh')
  await page.getByLabel('标题').fill('改了但没保存')
  await expect(page.getByRole('tab', { name: /中文 .* •/ })).toBeVisible()
  await page.getByRole('link', { name: 'Idea', exact: true }).click()
  await expect(confirmDialog(page)).toContainText('离开这个页面？')
  await confirmDialog(page).getByRole('button', { name: '取消' }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/boundary-example/)
  await expect(page.getByLabel('标题')).toHaveValue('改了但没保存')

  // Accepting leaves, and the page we left for renders normally.
  await page.getByRole('link', { name: 'Idea', exact: true }).click()
  await confirmDialog(page).getByRole('button', { name: '离开' }).click()
  await expect(page).toHaveURL(/\/admin\/ideas$/)
  await expect(page.getByRole('heading', { name: 'Idea' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)

  // Shared-field edits count too.
  await open(page, '/admin/posts/boundary-example?lang=zh')
  await expect(page.getByLabel('标题')).toHaveValue('未发布中文标题不得出现')
  await page.getByRole('checkbox', { name: 'Cloudflare' }).check()
  await expect(page.locator('.ad-shared legend')).toContainText('共享信息 •')
  await page.getByRole('link', { name: '文章', exact: true }).click()
  await expect(confirmDialog(page)).toBeVisible()
})

test('categories and tags: two tabs, referenced entries cannot be deleted', async ({
  page,
}) => {
  await open(page, '/admin/taxonomy')
  await expect(page.getByRole('tab', { name: '分类' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  const engineering = rows(page).filter({ hasText: '工程' })
  await expect(engineering.getByRole('button', { name: '删除' })).toBeDisabled()
  await expect(engineering).toContainText('有 4 篇文章引用，不能删除')

  await page.getByRole('tab', { name: '标签' }).click()
  await expect(page).toHaveURL(/tab=tags/)
  await expect(rows(page).first()).toContainText('TypeScript')
  await page.getByRole('button', { name: '新建标签' }).click()
  const dialog = page.getByRole('dialog', { name: '新建标签' })
  await dialog.getByLabel('中文名').fill('临时')
  await dialog.getByLabel('英文名').fill('Temp')
  await dialog.getByLabel('slug').fill('temp')
  await dialog.getByRole('button', { name: '保存' }).click()
  const temp = rows(page).filter({ hasText: '临时' })
  await expect(temp.locator('td[data-label="引用"]')).toHaveText('0')
  await temp.getByRole('button', { name: '删除' }).click()
  await expect(confirmDialog(page)).toContainText('删除标签「临时」？')
  await confirmDialog(page).getByRole('button', { name: '删除' }).click()
  await expect(rows(page).filter({ hasText: '临时' })).toHaveCount(0)
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
  await open(page, '/admin/ideas/idea-boundaries?mode=edit')
  await typeBody(page, '**粗体想法**')
  await page.getByRole('button', { name: '预览' }).click()
  await expect(page.locator('[data-preview="Idea"] strong')).toHaveText(
    '粗体想法',
  )
  page.once('dialog', (dialog) => void dialog.accept())
  // Reopened (preview by default, D-164): the stored text is unchanged.
  await open(page, '/admin/ideas/idea-boundaries')
  await expect(page.locator('[data-preview="Idea"]')).toContainText(
    '边界的本质是归属',
  )
  await expect(page.locator('[data-preview="Idea"] strong')).toHaveCount(0)
})

test('the list opens the language edited last', async ({ page }) => {
  await open(page, '/admin/posts/boundary-example?lang=en')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(status(page)).toHaveText(/^已保存/)
  await open(page, '/admin/posts')
  const link = rows(page)
    .filter({ hasText: '未发布中文标题不得出现' })
    .locator('.ad-cell-title a')
  await expect(link).toHaveAttribute(
    'href',
    '/admin/posts/boundary-example?lang=en',
  )
  const untouched = rows(page)
    .filter({ hasText: '只有中文的文章' })
    .locator('.ad-cell-title a')
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
  await open(idea, '/admin/ideas/idea-boundaries?mode=edit')
  await typeBody(idea, '改了还没保存')
  await expect(idea.getByRole('heading', { name: 'Idea •' })).toBeVisible()
  await idea.getByRole('link', { name: '返回列表' }).click()
  await expect(confirmDialog(idea)).toContainText('有未保存的修改')
  await confirmDialog(idea).getByRole('button', { name: '取消' }).click()
  await expect(idea).toHaveURL(/\/admin\/ideas\/idea-boundaries\?mode=edit$/)
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
  await rows(page)
    .filter({ hasText: '工程' })
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
  await page.getByRole('button', { name: '添加 Idea' }).click()
  await expect(page).toHaveURL(/\/admin\/posts\/[0-9a-f-]{36}\?lang=zh$/)
  await page.locator('.ad-root[data-hydrated]').waitFor()
  await expect(page.getByRole('checkbox', { name: 'TypeScript' })).toBeChecked()
  await expect(page.locator('.ad-shared legend')).toContainText('共享信息 •')
  await expect(page.locator('.ad-references h2')).toHaveText(
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
  await rows(page)
    .filter({ hasText: 'TypeScript' })
    .getByRole('button', { name: '编辑' })
    .click()
  let dialog = page.getByRole('dialog', { name: '编辑标签' })
  await dialog.getByLabel('中文名').fill('类型脚本')
  await dialog.getByLabel('英文名').fill('TS Lang')
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('status')).toHaveText('已保存')

  await open(page, '/admin/taxonomy?tab=categories')
  await rows(page)
    .filter({ hasText: '工程' })
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

// ---- D-163: classic admin layout ---------------------------------------------

test('lists show 15 rows a page; page and filters live in the address', async ({
  page,
  request,
}) => {
  await reset(request, 'many')
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, '/admin/posts')
  await expect(rows(page)).toHaveCount(15)
  const pager = page.getByRole('navigation', { name: '分页' })
  await expect(pager).toContainText('共 44 篇，显示第 1–15 篇')
  await pager.getByRole('link', { name: '下一页' }).click()
  await expect(page).toHaveURL(/\/admin\/posts\?page=2$/)
  await expect(pager).toContainText('显示第 16–30 篇')
  await expect(pager.locator('[aria-current="page"]')).toHaveText('2')

  // Changing a filter starts again from page 1; it is kept in the address.
  await page.getByLabel('状态').selectOption('published')
  await expect(page).toHaveURL(/status=published/)
  await expect(page).not.toHaveURL(/page=/)
  await expect(pager).toContainText('共 3 篇')
  await page.getByLabel('搜索标题').fill('批量草稿 3')
  await page.getByLabel('状态').selectOption('all')
  await expect(page).toHaveURL(/q=/)
  // 批量草稿 30–39.
  await expect(rows(page)).toHaveCount(10)
  await expect(pager).toContainText('共 10 篇')
  // A page past the end shows the last page.
  await open(page, '/admin/posts?page=99')
  await expect(pager).toContainText('显示第 31–44 篇')

  // "← 文章" returns to the page and filters the editor was opened from.
  await open(page, '/admin/posts?page=2&status=pending')
  await rows(page).first().locator('.ad-cell-title a').click()
  await expect(page).toHaveURL(/\/admin\/posts\/many-/)
  await page.getByRole('link', { name: '← 文章' }).click()
  await expect(page).toHaveURL(/\/admin\/posts\?page=2&status=pending$/)

  await open(page, '/admin/ideas?page=3')
  await expect(rows(page)).toHaveCount(11)
  await page.getByLabel('搜索 Idea').fill('Idea 07')
  await expect(page).toHaveURL(/\/admin\/ideas\?q=Idea(\+|%20)07$/)
  await expect(rows(page)).toHaveCount(1)

  await open(page, '/admin/taxonomy?tab=tags&page=2')
  await expect(page.getByRole('tab', { name: '标签（22）' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(rows(page)).toHaveCount(7)
})

test('only the table scrolls; the head and pager stay; scrollbars use tokens', async ({
  page,
  request,
}) => {
  await reset(request, 'many')
  await page.setViewportSize({ width: 1440, height: 700 })
  await open(page, '/admin/ideas')
  const measure = () =>
    page.evaluate(() => {
      const main = document.querySelector('.ad-main')!
      const list = document.querySelector('.ad-list-scroll')!
      list.scrollTop = 400
      const probe = document.createElement('span')
      probe.style.color = 'var(--dot)'
      document.body.append(probe)
      const dot = getComputedStyle(probe).color
      probe.remove()
      return {
        pageScrolls: main.scrollHeight > main.clientHeight,
        listScrolls: list.scrollHeight > list.clientHeight,
        listScrolled: list.scrollTop > 0,
        headTop: document
          .querySelector('.ad-page-head')!
          .getBoundingClientRect().top,
        pagerBottom: document
          .querySelector('.ad-pager')!
          .getBoundingClientRect().bottom,
        height: window.innerHeight,
        scrollbar: getComputedStyle(list).scrollbarColor,
        dot,
      }
    })
  const result = await measure()
  expect(result.pageScrolls).toBe(false)
  expect(result.listScrolls).toBe(true)
  expect(result.listScrolled).toBe(true)
  expect(result.headTop).toBeLessThan(40)
  expect(result.pagerBottom).toBeLessThanOrEqual(result.height)
  expect(result.scrollbar).toContain(result.dot)
  await noOverflow(page)
})

test('the editor can show the other language read-only beside the current one', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, '/admin/posts/boundary-example?lang=zh')
  await page.getByLabel('对照English').check()
  const copy = page.getByRole('complementary', { name: 'English（只读）' })
  await expect(copy).toContainText('Unpublished English title must not appear')
  // Unsaved English edits show in the copy too; it has no inputs of its own.
  await expect(copy.locator('input, textarea, [contenteditable]')).toHaveCount(
    0,
  )
  await page.getByRole('tab', { name: /English/ }).click()
  await page.getByLabel('标题').fill('Changed English title')
  await page.getByRole('tab', { name: /中文/ }).click()
  await page.getByLabel('对照English').check()
  await expect(
    page.getByRole('complementary', { name: 'English（只读）' }),
  ).toContainText('Changed English title')
  // Split mode shows the editor and the rendered preview together.
  await page.getByRole('button', { name: '分栏' }).click()
  await expect(page.locator('.ad-split .cm-content')).toBeVisible()
  await expect(page.locator('.ad-split [data-preview]')).toContainText(
    '让边界清楚',
  )
})

test('narrow screens fold the sidebar; a shared-field error unfolds it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, '/admin/posts/new')
  await expect(page.getByLabel('分类')).toBeHidden()
  await page.getByLabel('标题').fill('窄屏')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(alert(page)).toHaveText('保存失败：请选择分类')
  await expect(page.getByLabel('分类')).toBeVisible()
  await expect(page.getByLabel('分类')).toBeFocused()
  await page.getByRole('button', { name: '收起设置' }).click()
  await expect(page.getByLabel('分类')).toBeHidden()
  await noOverflow(page)
})

test('review fixes: late split preview, search history, long Idea input, narrow table', async ({
  page,
  request,
}) => {
  // 1. An older split preview that answers late never replaces a newer one.
  await open(page, '/admin/posts/boundary-example?lang=zh')
  let first = true
  await page.route(
    (url) => calls('previewMarkdown')(url.href),
    async (route) => {
      if (first) {
        first = false
        await new Promise((done) => setTimeout(done, 1500))
      }
      await route.continue()
    },
  )
  // The first (slow) request for the old text must be on its way before
  // the text changes; otherwise the debounce never sends it.
  const slowSent = page.waitForRequest((candidate) =>
    calls('previewMarkdown')(candidate.url()),
  )
  await page.getByRole('button', { name: '分栏' }).click()
  await slowSent
  await typeBody(page, '## 新的正文')
  const preview = page.locator('.ad-split [data-preview]')
  await expect(preview).toContainText('新的正文')
  await page.waitForTimeout(1800)
  await expect(preview).toContainText('新的正文')
  await expect(preview).not.toContainText('让边界清楚')
  await page.unroute((url) => calls('previewMarkdown')(url.href))

  // 2. Back / forward restore the search box along with the results.
  await reset(request, 'many')
  await page.setViewportSize({ width: 1440, height: 900 })
  await open(page, '/admin/posts')
  // Search A, go to page 2 (a history entry), search B, then go back.
  await page.getByLabel('搜索标题').fill('批量')
  await expect(page).toHaveURL(/q=/)
  await page
    .getByRole('navigation', { name: '分页' })
    .getByRole('link', { name: '下一页' })
    .click()
  await expect(page).toHaveURL(/page=2/)
  await page.getByLabel('搜索标题').fill('批量草稿 2')
  await expect(rows(page).first()).toContainText('批量草稿 2')
  await page.goBack()
  await expect(page).not.toHaveURL(/page=2/)
  await expect(page.getByLabel('搜索标题')).toHaveValue('批量')
  await expect(rows(page)).toHaveCount(15)

  // 3. A long quick Idea scrolls inside its editor; the list keeps its pager.
  await page.setViewportSize({ width: 1440, height: 700 })
  await open(page, '/admin/ideas')
  await typeBody(
    page,
    Array.from({ length: 80 }, (_, line) => `第 ${line + 1} 行`).join('\n'),
  )
  const layout = await page.evaluate(() => {
    const main = document.querySelector('.ad-main')!
    return {
      pageScrolls: main.scrollHeight > main.clientHeight,
      pagerBottom: document.querySelector('.ad-pager')!.getBoundingClientRect()
        .bottom,
      listHeight: document.querySelector('.ad-list-scroll')!.clientHeight,
      height: window.innerHeight,
    }
  })
  expect(layout.pageScrolls).toBe(false)
  expect(layout.pagerBottom).toBeLessThanOrEqual(layout.height)
  expect(layout.listHeight).toBeGreaterThan(100)

  // 4. Narrow screens: one-row navigation, column names kept for readers.
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, '/admin/posts')
  await expect(page.getByRole('columnheader', { name: '中文' })).toHaveCount(1)
  // Brand, links and the identity sit on the same line (no wrapping).
  const centres = await page.evaluate(() =>
    ['.ad-brand', '.ad-nav nav a', '.ad-nav-side'].map((selector) => {
      // Vertical centre: items of different heights on one line.
      const box = document.querySelector(selector)!.getBoundingClientRect()
      return Math.round((box.top + box.bottom) / 2)
    }),
  )
  expect(Math.max(...centres) - Math.min(...centres)).toBeLessThan(4)
  await expect(page.locator('.ad-nav')).toContainText('查看网站')
  await noOverflow(page)
})

test('D-164: Ideas list in one line, open to a preview, save with the shortcut', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  // Attach the seed Idea to a draft, so its detail page lists the article.
  await open(page, '/admin/posts/new?idea=idea-boundaries')
  await page.getByLabel('标题').fill('引用了 Idea 的草稿')
  await page.getByLabel('分类').selectOption('engineering')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(status(page)).toHaveText(/^已保存/)

  await open(page, '/admin/ideas')
  // 保存 sits in the row above the editor, its right edge on the editor's.
  const edges = await page.evaluate(() => {
    const save = document.querySelector('.ad-quick .ad-primary')!
    const editor = document.querySelector('.ad-quick .cm-editor')!
    return {
      saveRight: Math.round(save.getBoundingClientRect().right),
      editorRight: Math.round(editor.getBoundingClientRect().right),
      saveAbove:
        save.getBoundingClientRect().bottom <=
        editor.getBoundingClientRect().top,
    }
  })
  expect(edges.saveAbove).toBe(true)
  expect(Math.abs(edges.saveRight - edges.editorRight)).toBeLessThanOrEqual(2)

  await expect(page.locator('.ad-quick .cm-content')).toHaveAttribute(
    'aria-keyshortcuts',
    'Meta+Enter Control+Enter',
  )
  // ⌘Enter / Ctrl+Enter saves; a long, multi-line Idea shows as one line.
  const long = `第一行${'很长'.repeat(120)}\n第二行`
  await typeBody(page, long)
  await page.keyboard.press('ControlOrMeta+Enter')
  await expect(page.getByRole('status')).toHaveText('已保存')
  const newest = rows(page).first().locator('.ad-idea-link')
  await expect(newest).toContainText('第二行')
  const line = await newest.evaluate((element) => ({
    lines: Math.round(
      element.getBoundingClientRect().height /
        parseFloat(getComputedStyle(element).lineHeight),
    ),
    truncated: element.scrollWidth > element.clientWidth,
  }))
  expect(line).toEqual({ lines: 1, truncated: true })
  await noOverflow(page)

  // The content opens the detail page in preview; 编辑 opens it to edit.
  await rows(page)
    .filter({ hasText: '边界的本质是归属' })
    .locator('.ad-idea-link')
    .click()
  await expect(page).toHaveURL(/\/admin\/ideas\/idea-boundaries$/)
  await expect(page.locator('[data-preview="Idea"]')).toContainText(
    '边界的本质是归属',
  )
  await expect(page.locator('.cm-content')).toHaveCount(0)
  await expect(page.locator('.ad-idea-meta')).toContainText('创建于')
  await expect(
    page
      .locator('.ad-idea-meta')
      .getByRole('link', { name: '引用了 Idea 的草稿' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: '用它写文章' })).toBeVisible()
  await page.getByRole('button', { name: '编辑', exact: true }).click()
  await expect(page.locator('.cm-content')).toContainText('边界的本质是归属')

  await open(page, '/admin/ideas')
  await rows(page)
    .filter({ hasText: '边界的本质是归属' })
    .getByRole('link', { name: '编辑' })
    .click()
  await expect(page).toHaveURL(/\/admin\/ideas\/idea-boundaries\?mode=edit$/)
  await expect(page.locator('.cm-content')).toContainText('边界的本质是归属')
})

test('D-164: the Idea detail page keeps its mode in the address, saves and deletes', async ({
  page,
}) => {
  // A draft that references the Idea, to check the delete removes the link.
  await open(page, '/admin/posts/new?idea=idea-boundaries')
  await page.getByLabel('分类').selectOption('engineering')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(status(page)).toHaveText(/^已保存/)
  const draft = page.url()

  await open(page, '/admin/ideas/idea-boundaries')
  const toggle = page.getByRole('group', { name: 'Idea显示方式' })
  await toggle.getByRole('button', { name: '编辑' }).click()
  await expect(page).toHaveURL(/\/admin\/ideas\/idea-boundaries\?mode=edit$/)
  await expect(page.locator('.cm-content')).toHaveAttribute(
    'aria-keyshortcuts',
    'Meta+Enter Control+Enter',
  )
  await toggle.getByRole('button', { name: '预览' }).click()
  await expect(page).toHaveURL(/\/admin\/ideas\/idea-boundaries$/)
  await expect(page.locator('[data-preview="Idea"]')).toBeVisible()

  // Save from the detail page: the text and the update time change.
  await toggle.getByRole('button', { name: '编辑' }).click()
  const before = await page.locator('.ad-idea-meta').textContent()
  await typeBody(page, '改写后的想法')
  await expect(page.getByRole('heading', { name: 'Idea •' })).toBeVisible()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('已保存')
  await expect(
    page.getByRole('heading', { name: 'Idea', exact: true }),
  ).toBeVisible()
  await expect(page.locator('.ad-idea-meta')).not.toHaveText(before ?? '')
  await open(page, '/admin/ideas')
  await expect(rows(page).first().locator('.ad-idea-link')).toHaveText(
    '改写后的想法',
  )

  // Delete from the detail page: confirm, back to the list, link removed.
  await open(page, '/admin/ideas/idea-boundaries')
  await page.getByRole('button', { name: '删除' }).click()
  await expect(confirmDialog(page)).toContainText('永久删除这条 Idea？')
  await confirmDialog(page).getByRole('button', { name: '删除' }).click()
  await expect(page).toHaveURL(/\/admin\/ideas$/)
  await expect(page.getByText('还没有 Idea。')).toBeVisible()
  await open(page, draft)
  await expect(page.locator('.ad-references h2')).toHaveText(
    '参考资料（Idea · 0）',
  )
})

test('D-164: saving a quick Idea while previewing leaves a settled preview', async ({
  page,
}) => {
  await open(page, '/admin/ideas')
  await typeBody(page, '**预览中保存**')
  const toggle = page.getByRole('group', { name: '新 Idea显示方式' })
  await toggle.getByRole('button', { name: '预览' }).click()
  await expect(page.locator('[data-preview="新 Idea"] strong')).toHaveText(
    '预览中保存',
  )
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('已保存')
  await expect(rows(page).first()).toContainText('**预览中保存**')
  // The cleared input previews as empty, not as a request that never ends.
  await expect(page.locator('.ad-quick')).toContainText('还没有内容。')
  await expect(page.getByText('正在生成预览…')).toHaveCount(0)
  // Writing again after switching back works as before.
  await toggle.getByRole('button', { name: '编辑' }).click()
  await typeBody(page, '第二条')
  await toggle.getByRole('button', { name: '预览' }).click()
  await expect(page.locator('[data-preview="新 Idea"]')).toContainText('第二条')
})
