import { expect, test } from '@playwright/test'

function pngSize(body: Buffer) {
  expect(body.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) }
}

test.describe('public article share metadata', () => {
  for (const [header, language, title, summary, locale] of [
    [
      'zh-CN,zh;q=0.9',
      'zh',
      '把边界写清楚',
      '所有权、边界和事务结束的位置，决定了服务是否容易理解。',
      'zh_CN',
    ],
    [
      'en-US,en;q=0.9',
      'en',
      'Make boundaries visible',
      'Ownership, boundaries, and where the transaction ends make a service understandable.',
      'en_US',
    ],
    [
      '',
      'zh',
      '把边界写清楚',
      '所有权、边界和事务结束的位置，决定了服务是否容易理解。',
      'zh_CN',
    ],
  ] as const) {
    test(`neutral share link with Accept-Language "${header}" uses the final ${language} metadata`, async ({
      request,
    }) => {
      const page = await request.get('/writing/boundary-example', {
        headers: header ? { 'Accept-Language': header } : {},
      })
      expect(page.status()).toBe(200)
      expect(new URL(page.url()).pathname).toBe(
        `/${language}/writing/boundary-example`,
      )
      const html = await page.text()
      expect(html).toContain(`<meta property="og:type" content="article"/>`)
      expect(html).toContain(`<meta property="og:title" content="${title}"/>`)
      expect(html).toContain(
        `<meta property="og:description" content="${summary}"/>`,
      )
      expect(html).toContain(
        `<meta property="og:url" content="https://kaili.dev/${language}/writing/boundary-example"/>`,
      )
      expect(html).toContain(`<meta property="og:locale" content="${locale}"/>`)
      expect(html).toContain(
        `<meta property="og:image" content="${new URL(page.url()).origin}/images/share-card.png"/>`,
      )
    })
  }
})

test('the declared shared image is a static 1200x630 PNG', async ({
  request,
}) => {
  const page = await request.get('/zh/writing/boundary-example')
  expect(page.status()).toBe(200)
  const html = await page.text()
  const imageUrl = html.match(
    /<meta property="og:image" content="([^"]+)"\/>/,
  )?.[1]
  expect(imageUrl).toBe(`${new URL(page.url()).origin}/images/share-card.png`)
  const image = await request.get(imageUrl!)
  expect(image.status()).toBe(200)
  expect(image.headers()['content-type']).toBe('image/png')
  expect(pngSize(await image.body())).toEqual({ width: 1200, height: 630 })
})
