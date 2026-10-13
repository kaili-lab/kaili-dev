import { describe, expect, it } from 'vitest'

import { publishedOgCard } from '../src/features/og.ts'

describe('T3.4 OG card content', () => {
  it('uses the published zh version, not the newer draft', () => {
    expect(publishedOgCard('zh', 'boundary-example')).toEqual({
      language: 'zh',
      title: '把边界写清楚',
      summary: '所有权、边界和事务结束的位置，决定了服务是否容易理解。',
      category: '工程',
      publishedAt: '2026-09-02',
    })
  })

  it('uses the published en version, not the newer draft', () => {
    const card = publishedOgCard('en', 'boundary-example')
    expect(card?.title).toBe('Make boundaries visible')
    expect(JSON.stringify(card)).not.toMatch(/Unpublished|must not appear/)
  })

  it.each([
    ['en', 'zh-only-example'],
    ['zh', 'en-only-example'],
    ['zh', 'private-example'],
    ['en', 'private-example'],
    ['zh', 'missing'],
    ['fr', 'boundary-example'],
  ])('has no public card for %s/%s', (language, slug) => {
    expect(publishedOgCard(language, slug)).toBeUndefined()
  })

  it('keeps each language to its own published version', () => {
    expect(publishedOgCard('zh', 'zh-only-example')?.title).toBe(
      '只有中文的文章',
    )
    expect(publishedOgCard('en', 'en-only-example')?.title).toBe(
      'An English-only article',
    )
  })
})
