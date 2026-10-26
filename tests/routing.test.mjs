import { describe, expect, it } from 'vitest'

import {
  parseAcceptLanguage,
  resolveLanguage,
  visiblePosts,
  isClientPageHref,
} from '../src/features/routing.ts'
const posts = [
  {
    slug: 'boundary-example',
    zh: {
      title: 'Boundary',
      summary: 'Summary',
      body: 'Body',
      publishedAt: '2026-09-02',
      updatedAt: '2026-09-02T00:00:00.000Z',
      category: 'engineering',
      tags: [],
    },
    en: {
      title: 'Boundary',
      summary: 'Summary',
      body: 'Body',
      publishedAt: '2026-09-02',
      updatedAt: '2026-09-02T00:00:00.000Z',
      category: 'engineering',
      tags: [],
    },
  },
  {
    slug: 'zh-only-example',
    zh: {
      title: 'Chinese only',
      summary: 'Summary',
      body: 'Body',
      publishedAt: '2026-08-01',
      updatedAt: '2026-08-01T00:00:00.000Z',
      category: 'engineering',
      tags: [],
    },
  },
  {
    slug: 'en-only-example',
    en: {
      title: 'English only',
      summary: 'Summary',
      body: 'Body',
      publishedAt: '2026-07-01',
      updatedAt: '2026-07-01T00:00:00.000Z',
      category: 'engineering',
      tags: [],
    },
  },
]

describe('T3.1 language selection', () => {
  it.each([
    ['zh-CN,zh;q=0.9', 'zh'],
    ['en-US,en;q=0.9', 'en'],
    ['fr-FR,en;q=0.8', 'en'],
    ['fr-FR,fr;q=0.9', 'zh'],
    ['', 'zh'],
    [undefined, 'zh'],
  ])('parses %s as %s', (header, expected) => {
    expect(parseAcceptLanguage(header)).toBe(expected)
  })

  it('lets a saved preference override the request header', () => {
    expect(resolveLanguage('en', 'zh-CN')).toBe('en')
    expect(resolveLanguage('zh', 'en-US')).toBe('zh')
  })
})

describe('T3.1 published visibility', () => {
  it('keeps only published versions and sorts newest first', () => {
    expect(visiblePosts(posts, 'zh').map((post) => post.slug)).toEqual([
      'boundary-example',
      'zh-only-example',
    ])
    expect(visiblePosts(posts, 'en').map((post) => post.slug)).toEqual([
      'boundary-example',
      'en-only-example',
    ])
  })
})
describe('published article requests reject unsafe language keys', () => {
  it('accepts only zh and en', async () => {
    const { requireArticleRequest, requireLanguage } =
      await import('../src/features/routing.ts')
    expect(() => requireLanguage('category')).toThrow('Unsupported language')
    expect(() =>
      requireArticleRequest({ slug: 'private-example', language: 'category' }),
    ).toThrow('Unsupported language')
    expect(requireLanguage('zh')).toBe('zh')
  })
})

describe('D-165 client-side page links', () => {
  it.each([
    ['/zh', true],
    ['/en/writing', true],
    ['/zh/writing?category=engineering&tag=typescript', true],
    ['/zh/writing/boundary-example', true],
    ['/zh/writing/boundary-example#start', true],
    ['/writing/boundary-example', false],
    ['/', false],
    ['/zhx', false],
    ['https://github.com/kaili-lab', false],
    ['mailto:hello@kaili.dev', false],
    ['//example.com/zh', false],
    ['#start', false],
    ['/sitemap.xml', false],
    ['/images/say-right.png', false],
    ['/fonts/inter-OFL.txt', false],
  ])('%s → %s', (href, expected) => {
    expect(isClientPageHref(href)).toBe(expected)
  })
})
