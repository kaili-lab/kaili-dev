import { describe, expect, it } from 'vitest'

import {
  parseAcceptLanguage,
  resolveLanguage,
  visiblePosts,
} from '../src/features/routing.ts'
import { publishedPosts } from '../src/server/data/posts.ts'

const posts = publishedPosts()

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
