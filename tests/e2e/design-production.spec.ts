import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'

test('the development catalogue is inaccessible in production', async ({
  request,
}) => {
  const entry = await request.get('/', {
    headers: { 'Accept-Language': 'zh-CN,zh;q=0.9' },
  })
  expect(entry.status()).toBe(200)
  expect(await entry.text()).toContain('永远的学生')
  for (const path of [
    '/_design',
    '/_design?lang=en',
    '/design',
    '/_writing-variants',
    '/_admin-variants',
    '/_admin-variants?page=editor',
    '/_writing-variants?variant=pills&state=empty',
    '/_og-smoke?id=short',
    // T5.4 / D-132: no admin and no test hook in production builds.
    '/admin',
    '/admin/posts',
    '/admin/posts/new',
    '/admin/posts/boundary-example',
    '/admin/ideas',
    '/admin/taxonomy',
    '/_test-reset',
  ]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
    const body = await response.text()
    expect(body, path).not.toContain('data-design-catalogue')
    expect(body, path).not.toContain('K2 - DESIGN SYSTEM')
    // T4.1b variants and the T3.4 OG fixture route stay out of production.
    expect(body, path).not.toMatch(
      /wv-pill|wv-select|X-Og-Font-Size|ad-root|开发环境假登录/,
    )
    expect(response.headers()['content-type'] ?? '', path).not.toContain(
      'image/png',
    )
  }

  // T6.1: the sitemap exists and never lists a development-only route.
  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.status()).toBe(200)
  expect(await sitemap.text()).not.toContain('/_design')
})

test('the test reset hook does not exist in production', async ({
  request,
}) => {
  const response = await request.post('/_test-reset?fixture=empty')
  expect(response.status()).toBe(404)
  // The store was not reset: published articles are still there.
  expect((await request.get('/zh/writing/boundary-example')).status()).toBe(200)
})

test('admin server functions cannot be called in production', async ({
  request,
}) => {
  // The id a development build uses for saveAdminArticle; production does
  // not bundle the admin module at all, so no id may succeed.
  const id = Buffer.from(
    JSON.stringify({
      file: '/src/features/admin.functions.ts?tss-serverfn-split',
      export: 'saveAdminArticle_createServerFn_handler',
    }),
  ).toString('base64url')
  // Router state embeds a per-request timestamp (u:…); compare without it.
  const article = async () =>
    (await (await request.get('/zh/writing/boundary-example')).text()).replace(
      /u:\d+/g,
      'u:0',
    )
  const before = await article()
  const response = await request.post(`/_serverFn/${id}`, {
    headers: { 'content-type': 'application/json' },
    data: '{}',
  })
  expect(response.status()).not.toBe(200)
  expect(await response.text()).not.toContain('"ok":true')
  expect(await article()).toBe(before)
})
