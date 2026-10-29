import { expect, test, type Page } from '@playwright/test'

import { noOverflow, open, reset } from './helpers'

let hydrationErrors: string[] = []
test.beforeEach(async ({ request, page }) => {
  await reset(request, 'ai', page)
  hydrationErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrat/i.test(message.text()))
      hydrationErrors.push(message.text().slice(0, 200))
  })
})
test.afterEach(() => {
  expect(hydrationErrors).toEqual([])
})

const connectionRow = (page: Page, name: string) =>
  page.getByRole('row').filter({
    has: page.getByRole('link', { name, exact: true }),
  })

test('lists masked platforms and marks AI 接入 as the current section', async ({
  page,
}) => {
  await open(page, '/admin/ai')

  await expect(
    page.getByRole('link', { name: 'AI 接入', exact: true }),
  ).toHaveAttribute('aria-current', 'page')
  const primary = connectionRow(page, '主中转')
  const backup = connectionRow(page, '备用中转')
  await expect(primary).toContainText('https://ai-mock.test/down/v1')
  await expect(primary).toContainText('sk-…0000')
  await expect(page.getByRole('columnheader', { name: '优先级' })).toHaveCount(
    0,
  )
  await expect(primary).toContainText('已发布内容、文章草稿')
  await expect(backup).toContainText('https://ai-mock.test/ok/v1')
  expect(await page.content()).not.toContain('sk-test-0000')
})

test('validates a new platform and defaults its data class to public', async ({
  page,
}) => {
  await open(page, '/admin/ai/new')
  await expect(page.getByLabel('已发布内容')).toBeChecked()
  await expect(page.getByLabel('文章草稿')).not.toBeChecked()

  await page.getByLabel('baseURL').fill('http://example.com')
  await page.getByLabel('API key').fill('sk-new-test-0000')
  await page.getByRole('button', { name: '保存平台' }).click()
  await expect(page.getByText('请填写名称', { exact: true })).toBeVisible()
  await expect(page.getByText(/只允许 HTTPS 地址/)).toBeVisible()

  await page.getByLabel('名称').fill('新平台')
  await page.getByLabel('baseURL').fill('https://example.com/v1/')
  await page.getByRole('button', { name: '保存平台' }).click()
  await expect(page).toHaveURL(/\/admin\/ai\/[0-9a-f-]{36}$/)
  await expect(page.getByText('sk-…0000', { exact: true })).toBeVisible()
  await expect(page.getByLabel('已发布内容')).toBeChecked()
  await expect(page.getByLabel('文章草稿')).not.toBeChecked()
})

test('tests successful and failing connections without writing models', async ({
  page,
}) => {
  await open(page, '/admin/ai/ai-backup')
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.getByRole('status')).toHaveText('测试成功')
  await expect(
    page.getByRole('cell', { name: 'mock-json', exact: true }),
  ).toHaveCount(1)

  await open(page, '/admin/ai/ai-primary')
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.getByRole('alert')).toHaveText('上游服务错误')
  await expect(
    page.getByRole('cell', { name: 'mock-json', exact: true }),
  ).toHaveCount(1)
})

test('tests the current form values of a new platform without saving', async ({
  page,
}) => {
  await open(page, '/admin/ai/new')
  await page.getByLabel('名称').fill('临时平台')
  await page.getByLabel('baseURL').fill('https://ai-mock.test/ok/v1')
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.getByRole('alert')).toHaveText('请填写 API key')

  await page.getByLabel('API key').fill('sk-any-test-0000')
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.getByRole('status')).toHaveText('测试成功')
  await expect(page).toHaveURL(/\/admin\/ai\/new$/)

  await page.getByLabel('baseURL').fill('http://example.com')
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.getByRole('alert')).toContainText('只允许 HTTPS 地址')
})

test('testing an edited address does not touch the saved last test', async ({
  page,
}) => {
  await open(page, '/admin/ai/ai-primary')
  await page.getByLabel('baseURL').fill('https://ai-mock.test/ok/v1')
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.getByRole('status')).toHaveText('测试成功')

  await open(page, '/admin/ai')
  await expect(connectionRow(page, '主中转')).toContainText('未测试')
})

test('queries models into a dialog, filters, confirms discard and adds', async ({
  page,
}) => {
  await open(page, '/admin/ai/ai-backup')
  await page.getByRole('button', { name: '查询模型' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('选择 mock-chat')).toBeVisible()
  await expect(dialog).not.toContainText('mock-json')
  await expect(
    dialog.getByRole('button', { name: /^添加所选模型/ }),
  ).toBeDisabled()

  const search = dialog.getByLabel('搜索模型')
  await search.fill('CHAT')
  await expect(dialog).toContainText('显示 1 / 1 个')
  await dialog.getByLabel('选择 mock-chat').check()
  await expect(
    dialog.getByRole('button', { name: '添加所选模型（1）' }),
  ).toBeEnabled()

  await search.fill('zzz')
  await expect(dialog.getByText('没有匹配的模型')).toBeVisible()
  await search.fill('')
  await expect(dialog.getByLabel('选择 mock-chat')).toBeChecked()

  await dialog.getByRole('button', { name: '取消' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('放弃已选的 1 个模型？')
  await confirm.getByRole('button', { name: '取消' }).click()
  await expect(confirm).toBeHidden()
  await expect(dialog.getByLabel('选择 mock-chat')).toBeChecked()

  await dialog.getByRole('button', { name: '添加所选模型（1）' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('status')).toHaveText(
    '已添加 1 个模型，已排到调用顺序末尾',
  )
  await expect(
    page.getByRole('cell', { name: 'mock-chat', exact: true }),
  ).toHaveCount(1)

  await page.getByRole('button', { name: '查询模型' }).click()
  await expect(dialog.getByText('没有新的模型')).toBeVisible()
  await expect(dialog.getByLabel('搜索模型')).toHaveCount(0)
  await dialog.getByRole('button', { name: '取消' }).click()
  await expect(dialog).toBeHidden()
})

test('trial calls show per-row results and are logged as model-test', async ({
  page,
}) => {
  await open(page, '/admin/ai/ai-backup')
  await page.getByRole('button', { name: '试调用 mock-json' }).click()
  const row = page.getByRole('row').filter({ hasText: 'mock-json' })
  await expect(row).toContainText(/成功 · \d+\.\d 秒/)

  await open(page, '/admin/ai/ai-primary')
  await page.getByRole('button', { name: '试调用 mock-json' }).click()
  await expect(
    page.getByRole('row').filter({ hasText: 'mock-json' }),
  ).toContainText('上游服务错误')

  await open(page, '/admin/ai')
  await expect(
    page.getByRole('row').filter({ hasText: 'model-test' }).first(),
  ).toBeVisible()
})

test('saving an existing platform returns to the list', async ({ page }) => {
  await open(page, '/admin/ai/ai-backup')
  await page.getByRole('button', { name: '保存平台' }).click()
  await expect(page).toHaveURL(/\/admin\/ai$/)
})

test('list shows the last test time in a minute-precision stamp', async ({
  page,
}) => {
  await open(page, '/admin/ai/ai-backup')
  await page.getByRole('button', { name: '测试连接' }).click()
  await expect(page.getByRole('status')).toHaveText('测试成功')
  await open(page, '/admin/ai')
  await expect(connectionRow(page, '备用中转')).toContainText(
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/,
  )
})

test('manual model type is prefilled from the model id', async ({ page }) => {
  await open(page, '/admin/ai/ai-backup')
  await page.getByLabel('模型 ID').fill('my-embed-model')
  await expect(page.getByLabel('模型类型')).toHaveValue('embedding')
  await page.getByRole('button', { name: '添加模型' }).click()

  const row = page.getByRole('row').filter({ hasText: 'my-embed-model' })
  await expect(row).toContainText('手动')
  const type = row.getByLabel('my-embed-model 类型')
  await expect(type).toHaveValue('embedding')
  await type.selectOption('image')
  await expect(type).toHaveValue('image')
})

test('vector models are checked automatically, image models have no trial', async ({
  page,
}) => {
  await open(page, '/admin/ai/ai-backup')
  const addModel = async (id: string, type: string) => {
    await page.getByLabel('模型 ID').fill(id)
    await page.getByLabel('模型类型').selectOption(type)
    await page.getByRole('button', { name: '添加模型' }).click()
    return page.getByRole('row').filter({ hasText: id })
  }

  const embed = await addModel('mock-embed', 'embedding')
  await expect(embed).toContainText(/成功 · /)

  // A chat-only mock answers the vector endpoint with a rejection.
  const json = page.getByRole('row').filter({ hasText: 'mock-json' })
  await json.getByLabel('mock-json 类型').selectOption('embedding')
  await expect(json).toContainText('上游拒绝了请求')
  await json.getByLabel('mock-json 类型').selectOption('chat')

  const image = await addModel('mock-image', 'image')
  await expect(image).not.toContainText('成功')
  await expect(image).not.toContainText('上游')
  await expect(image.getByRole('button', { name: /试/ })).toHaveCount(0)
})

test('call order can be moved and persists after reload', async ({ page }) => {
  await open(page, '/admin/ai')
  const items = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '调用顺序' }) })
    .getByRole('listitem')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toContainText('主中转 · mock-json')
  await expect(items.nth(1)).toContainText('备用中转 · mock-json')

  await page.getByRole('button', { name: '下移 主中转 · mock-json' }).click()
  await expect(items.nth(0)).toContainText('备用中转 · mock-json')
  await expect(items.nth(1)).toContainText('主中转 · mock-json')

  await page.reload()
  await expect(items.nth(0)).toContainText('备用中转 · mock-json')
  await expect(items.nth(1)).toContainText('主中转 · mock-json')
})

test('deleting a platform requires confirmation with cancel focused', async ({
  page,
}) => {
  await open(page, '/admin/ai/ai-backup')
  await page.getByRole('button', { name: '删除平台' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog.getByRole('button', { name: '取消' })).toBeFocused()
  await dialog.getByRole('button', { name: '取消' }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/admin\/ai\/ai-backup$/)

  await page.getByRole('button', { name: '删除平台' }).click()
  await dialog.getByRole('button', { name: '删除', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/ai$/)
  await expect(
    page.getByRole('link', { name: '备用中转', exact: true }),
  ).toHaveCount(0)
})

test('new draft offers slug candidates without saving or replacing the typed slug', async ({
  page,
}) => {
  await open(page, '/admin/posts/new')
  const generate = page.getByRole('button', { name: '生成候选' })
  const slug = page.locator('#field-slug')
  await page.getByLabel('标题').fill('我的主题')
  await slug.fill('already-typed-slug')
  await expect(generate).toBeDisabled()
  await expect(page.getByText('先填写标题和摘要')).toBeVisible()

  await page.getByLabel('摘要').fill('当前语言的文章摘要')
  await expect(generate).toBeEnabled()
  await generate.click()
  await expect(
    page.getByRole('button', { name: 'mock-first-slug' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'mock-second-slug' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bad Slug' })).toHaveCount(0)
  await expect(slug).toHaveValue('already-typed-slug')
  await page.getByRole('button', { name: 'mock-first-slug' }).click()
  await expect(slug).toHaveValue('mock-first-slug')
  await expect(page.locator('.ad-toolbar .ad-dirty')).toContainText(
    '有未保存修改',
  )

  // A second tab can inspect call history without leaving the unsaved editor.
  const history = await page.context().newPage()
  try {
    await open(history, '/admin/posts')
    await expect(
      history.getByRole('row').filter({ hasText: '我的主题' }),
    ).toHaveCount(0)
    await open(history, '/admin/ai')
    const call = history.getByRole('row').filter({ hasText: 'slug-candidates' })
    await expect(call).toHaveCount(1)
    await expect(call).toContainText('成功')
    await expect(call).toContainText('已切换备用模型')
  } finally {
    await history.close()
  }
})

test('published articles never offer slug candidates', async ({ page }) => {
  await open(page, '/admin/posts/boundary-example?lang=zh')
  await expect(page.getByRole('button', { name: '生成候选' })).toHaveCount(0)
})

test('platforms restricted to published content cannot receive a draft', async ({
  page,
}) => {
  for (const id of ['ai-primary', 'ai-backup']) {
    await open(page, `/admin/ai/${id}`)
    await page.getByLabel('文章草稿').uncheck()
    await page.getByRole('button', { name: '保存平台' }).click()
    await expect(page).toHaveURL(/\/admin\/ai$/)
  }

  await open(page, '/admin/posts/new')
  await page.getByLabel('标题').fill('主题')
  await page.getByLabel('摘要').fill('摘要')
  await page.getByRole('button', { name: '生成候选' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    '没有可用的模型：确认调用顺序里有已启用的模型，且所属平台允许发送这类内容',
  )
})

for (const width of [1440, 820, 390]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`AI pages ${width}px ${colorScheme} screenshots without overflow`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ colorScheme })

      for (const [name, path] of [
        ['ai-list', '/admin/ai'],
        ['ai-detail', '/admin/ai/ai-backup'],
      ] as const) {
        await open(page, path)
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          colorScheme,
        )
        await page.evaluate(() => document.fonts.ready)
        await noOverflow(page)
        await page.screenshot({
          path: testInfo.outputPath(`${name}-${width}-${colorScheme}.png`),
          fullPage: true,
        })
      }

      await page.getByRole('button', { name: '查询模型' }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await noOverflow(page)
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true)
      await page.screenshot({
        path: testInfo.outputPath(`ai-discover-${width}-${colorScheme}.png`),
        fullPage: true,
      })
    })
  }
}
