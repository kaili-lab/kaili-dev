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
    // Development fixtures stay absent after production admin is enabled (D-172).
    '/_test-reset',
  ]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
    const body = await response.text()
    expect(body, path).not.toContain('data-design-catalogue')
    expect(body, path).not.toContain('K2 - DESIGN SYSTEM')
    // T4.1b variants stay out of production.
    expect(body, path).not.toMatch(/wv-pill|wv-select/)
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

test('production admin is public only at login and rejects anonymous writes', async ({
  request,
}) => {
  for (const path of [
    '/admin',
    '/admin/posts',
    '/admin/posts/new',
    '/admin/posts/boundary-example',
    '/admin/ideas',
    '/admin/taxonomy',
  ]) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), path).toBe(302)
    expect(response.headers().location, path).toContain(
      '/admin/login?returnTo=',
    )
  }

  for (const path of ['/admin/login', '/admin/access-denied']) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(200)
  }

  const upload = await request.post('/api/media', {
    multipart: {
      file: {
        name: 'anonymous.png',
        mimeType: 'image/png',
        buffer: Buffer.from([1]),
      },
    },
  })
  expect(upload.status()).toBe(401)
  expect(await upload.json()).toEqual({ error: 'unauthorized' })
})

test('logout accepts only exact same-origin POST requests', async ({
  request,
}) => {
  const foreign = await request.post('/auth/logout', {
    headers: { Origin: 'https://attacker.example' },
    maxRedirects: 0,
  })
  expect(foreign.status()).toBe(403)
  expect(foreign.headers()['set-cookie']).toBeUndefined()

  const local = await request.post('/auth/logout', {
    headers: { Origin: 'http://127.0.0.1:4173' },
    maxRedirects: 0,
  })
  expect(local.status()).toBe(303)
  expect(local.headers().location).toBe('/admin/login')
  expect(local.headers()['set-cookie']).toContain('Max-Age=0')
})
