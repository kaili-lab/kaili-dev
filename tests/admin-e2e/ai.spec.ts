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

test('lists masked connections and marks AI 接入 as the current section', async ({
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
  await expect(primary).toContainText('1')
  await expect(primary).toContainText('已发布内容、文章草稿')
  await expect(backup).toContainText('https://ai-mock.test/ok/v1')
  expect(await page.content()).not.toContain('sk-test-0000')
})

test('validates a new connection and defaults its data class to public', async ({
  page,
}) => {
  await open(page, '/admin/ai/new')
  await expect(page.getByLabel('已发布内容')).toBeChecked()
  await expect(page.getByLabel('文章草稿')).not.toBeChecked()

  await page.getByLabel('baseURL').fill('http://example.com')
  await page.getByLabel('API key').fill('sk-new-test-0000')
  await page.getByRole('button', { name: '保存连接' }).click()
  await expect(page.getByText('请填写名称', { exact: true })).toBeVisible()
  await expect(page.getByText(/只允许 HTTPS 地址/)).toBeVisible()

  await page.getByLabel('名称').fill('新连接')
  await page.getByLabel('baseURL').fill('https://example.com/v1/')
  await page.getByRole('button', { name: '保存连接' }).click()
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

test('queries models idempotently and saves the structured-output default', async ({
  page,
}) => {
  await open(page, '/admin/ai/ai-backup')
  await page.getByRole('button', { name: '查询模型' }).click()
  await expect(page.getByRole('status')).toHaveText('模型查询完成')
  await expect(
    page.getByRole('cell', { name: 'mock-chat', exact: true }),
  ).toHaveCount(1)

  await page.getByRole('button', { name: '查询模型' }).click()
  await expect(
    page.getByRole('cell', { name: 'mock-chat', exact: true }),
  ).toHaveCount(1)
  await expect(
    page.getByRole('cell', { name: 'mock-json', exact: true }),
  ).toHaveCount(1)

  await open(page, '/admin/ai')
  await page
    .getByLabel('structured-output 默认模型')
    .selectOption('ai-backup-mock-json')
  await expect(page.getByRole('status')).toHaveText('默认模型已保存')
  await page.reload()
  await expect(page.getByLabel('structured-output 默认模型')).toHaveValue(
    'ai-backup-mock-json',
  )
})

test('manual structured-output capability automatically keeps chat', async ({
  page,
}) => {
  await open(page, '/admin/ai/ai-backup')
  await page.getByLabel('模型 ID').fill('manual-model')
  await page.getByRole('button', { name: '添加模型' }).click()

  const row = page.getByRole('row').filter({ hasText: 'manual-model' })
  await expect(row).toContainText('手动')
  const chat = row.getByRole('checkbox', { name: 'manual-model chat' })
  const structured = row.getByRole('checkbox', {
    name: 'manual-model structured-output',
  })
  await expect(chat).toBeChecked()
  await expect(structured).not.toBeChecked()
  await structured.click()
  await expect(structured).toBeChecked()
  await expect(chat).toBeChecked()
})

test('deleting a connection requires confirmation with cancel focused', async ({
  page,
}) => {
  await open(page, '/admin/ai/ai-backup')
  await page.getByRole('button', { name: '删除连接' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog.getByRole('button', { name: '取消' })).toBeFocused()
  await dialog.getByRole('button', { name: '取消' }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/admin\/ai\/ai-backup$/)

  await page.getByRole('button', { name: '删除连接' }).click()
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
    await expect(call).toContainText('已切换连接')
  } finally {
    await history.close()
  }
})

test('published articles never offer slug candidates', async ({ page }) => {
  await open(page, '/admin/posts/boundary-example?lang=zh')
  await expect(page.getByRole('button', { name: '生成候选' })).toHaveCount(0)
})

test('connections restricted to published content cannot receive a draft', async ({
  page,
}) => {
  for (const id of ['ai-primary', 'ai-backup']) {
    await open(page, `/admin/ai/${id}`)
    await page.getByLabel('文章草稿').uncheck()
    await page.getByRole('button', { name: '保存连接' }).click()
    await expect(page.getByRole('status')).toHaveText('连接已保存')
  }

  await open(page, '/admin/posts/new')
  await page.getByLabel('标题').fill('主题')
  await page.getByLabel('摘要').fill('摘要')
  await page.getByRole('button', { name: '生成候选' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    '没有允许发送这类内容的可用连接',
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
    })
  }
}
