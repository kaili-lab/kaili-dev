import { describe, expect, it } from 'vitest'

import {
  emptyListText,
  filterOptions,
  filterWritingPosts,
  normalizeWritingSearch,
  writingHref,
  writingListView,
} from '../src/features/writing-list.ts'

const known = {
  categories: ['engineering', 'ai'],
  tags: ['typescript', 'cloudflare'],
}

describe('T4.2 query normalisation (D-132 / D-154)', () => {
  it.each([
    // [raw search, filter, canonical search or undefined when unchanged]
    ['', {}, undefined],
    ['?category=engineering', { category: 'engineering' }, undefined],
    [
      '?category=engineering&tag=typescript',
      { category: 'engineering', tag: 'typescript' },
      undefined,
    ],
    [
      '?tag=typescript&category=engineering',
      { category: 'engineering', tag: 'typescript' },
      undefined,
    ],
    // D-132: an unknown value is dropped, the other condition stays.
    ['?category=nope', {}, ''],
    ['?category=nope&tag=typescript', { tag: 'typescript' }, '?tag=typescript'],
    [
      '?category=engineering&tag=nope',
      { category: 'engineering' },
      '?category=engineering',
    ],
    ['?category=nope&tag=nope', {}, ''],
    // D-154 ①: empty value means no condition.
    ['?category=', {}, ''],
    ['?category=&tag=typescript', { tag: 'typescript' }, '?tag=typescript'],
    // D-154 ②: repeated keys keep the first value.
    [
      '?tag=typescript&tag=cloudflare',
      { tag: 'typescript' },
      '?tag=typescript',
    ],
    ['?tag=nope&tag=typescript', {}, ''],
    // D-154 ③: case-insensitive match, redirected to lower case.
    ['?tag=TypeScript', { tag: 'typescript' }, '?tag=typescript'],
    [
      '?category=ENGINEERING&tag=Nope',
      { category: 'engineering' },
      '?category=engineering',
    ],
    // D-154 ④: unrelated parameters stay, in order, and never trigger a redirect alone.
    ['?utm_source=x', {}, undefined],
    [
      '?utm_source=x&category=engineering',
      { category: 'engineering' },
      undefined,
    ],
    ['?utm_source=x&category=nope&ref=y', {}, '?utm_source=x&ref=y'],
    [
      '?a=1&tag=TypeScript&b=2',
      { tag: 'typescript' },
      '?a=1&tag=typescript&b=2',
    ],
    // Unrelated segments keep their exact encoding, repeats and bare keys.
    ['?category=nope&ref=a%20b&flag', {}, '?ref=a%20b&flag'],
    ['?ref=a+b&category=nope', {}, '?ref=a+b'],
    [
      '?ref=1&ref=2&tag=TypeScript',
      { tag: 'typescript' },
      '?ref=1&ref=2&tag=typescript',
    ],
    ['?q=%E4%B8%AD&category=', {}, '?q=%E4%B8%AD'],
    // An encoded key is still the filter key.
    [
      '?cat%65gory=nope&tag=typescript',
      { tag: 'typescript' },
      '?tag=typescript',
    ],
  ])('%s', (search, filter, canonical) => {
    const result = normalizeWritingSearch(search, known)
    expect(result.filter).toEqual(filter)
    expect(result.canonicalSearch).toBe(canonical)
    // The canonical address is itself stable.
    if (canonical !== undefined)
      expect(
        normalizeWritingSearch(canonical, known).canonicalSearch,
      ).toBeUndefined()
  })
})

// Category and tags live on each published version (D-155 ⑤).
const post = (slug, category, tags, zhDate, enDate) => {
  const version = (publishedAt) =>
    publishedAt
      ? { title: slug, summary: '', body: '', publishedAt, category, tags }
      : undefined
  return { slug, zh: version(zhDate), en: version(enDate) }
}
const posts = [
  post('old', 'engineering', ['typescript'], '2026-01-01', '2026-01-01'),
  post(
    'new',
    'engineering',
    ['typescript', 'cloudflare'],
    '2026-03-01',
    undefined,
  ),
  post('ai', 'ai', ['cloudflare'], '2026-02-01', '2026-02-01'),
  post('draft', 'engineering', ['typescript'], undefined, undefined),
]

describe('T4.2 filtering', () => {
  const slugs = (list) => list.map((item) => item.slug)
  it('lists only current-language published posts, newest first', () => {
    expect(slugs(filterWritingPosts(posts, 'zh', {}))).toEqual([
      'new',
      'ai',
      'old',
    ])
    expect(slugs(filterWritingPosts(posts, 'en', {}))).toEqual(['ai', 'old'])
  })
  it('intersects category and tag', () => {
    expect(
      slugs(filterWritingPosts(posts, 'zh', { category: 'engineering' })),
    ).toEqual(['new', 'old'])
    expect(
      slugs(filterWritingPosts(posts, 'zh', { tag: 'cloudflare' })),
    ).toEqual(['new', 'ai'])
    expect(
      slugs(
        filterWritingPosts(posts, 'zh', {
          category: 'engineering',
          tag: 'cloudflare',
        }),
      ),
    ).toEqual(['new'])
    expect(
      slugs(
        filterWritingPosts(posts, 'en', {
          category: 'engineering',
          tag: 'cloudflare',
        }),
      ),
    ).toEqual([])
  })
  it('offers only used entries plus the current selection', () => {
    const entries = [
      { slug: 'engineering', zh: '工程', en: 'Engineering' },
      { slug: 'ai', zh: 'AI', en: 'AI' },
      { slug: 'empty', zh: '空', en: 'Empty' },
    ]
    expect(
      filterOptions(entries, new Set(['engineering']), 'en', undefined),
    ).toEqual([{ slug: 'engineering', label: 'Engineering' }])
    expect(
      filterOptions(entries, new Set(['engineering']), 'zh', 'empty').map(
        (o) => o.slug,
      ),
    ).toEqual(['engineering', 'empty'])
  })
  it('builds filter links', () => {
    expect(writingHref('zh', {})).toBe('/zh/writing')
    expect(writingHref('en', { category: 'ai', tag: 'cloudflare' })).toBe(
      '/en/writing?category=ai&tag=cloudflare',
    )
  })
})

describe('T4.2 empty-result text (design.md §9, D-154)', () => {
  it.each([
    [
      'zh',
      '工程',
      'Cloudflare',
      '「工程」分类下没有带「Cloudflare」标签的文章。',
    ],
    ['zh', '工程', undefined, '「工程」分类下还没有文章。'],
    ['zh', undefined, 'Cloudflare', '还没有带「Cloudflare」标签的文章。'],
    ['zh', undefined, undefined, '还没有已发布的文章。'],
    ['en', 'AI', 'Cloudflare', 'No articles in “AI” are tagged “Cloudflare”.'],
    ['en', 'AI', undefined, 'No articles in “AI” yet.'],
    ['en', undefined, 'Cloudflare', 'No articles are tagged “Cloudflare” yet.'],
    ['en', undefined, undefined, 'No articles published yet.'],
  ])('%s %s / %s', (language, category, tag, expected) => {
    expect(emptyListText(language, category, tag)).toBe(expected)
  })
})

describe('T4.2 list view for a language with no published posts', () => {
  const taxonomy = {
    categories: [{ slug: 'engineering', zh: '工程', en: 'Engineering' }],
    tags: [{ slug: 'typescript', zh: 'TypeScript', en: 'TypeScript' }],
  }
  const label = (slug) => `label:${slug}`
  // English has an article; Chinese has none (D-026 allows this).
  const enOnly = [
    post('en-only', 'engineering', ['typescript'], undefined, '2026-01-01'),
  ]

  it('shows the no-posts sentence, no options, and keeps English untouched', () => {
    expect(writingListView(enOnly, 'zh', {}, taxonomy, label)).toEqual({
      filter: { category: undefined, tag: undefined },
      posts: [],
      categories: [],
      tags: [],
      emptyText: '还没有已发布的文章。',
    })
    const en = writingListView(enOnly, 'en', {}, taxonomy, label)
    expect(en.posts.map((item) => [item.slug, item.categoryName])).toEqual([
      ['en-only', 'label:engineering'],
    ])
    expect(en.emptyText).toBeUndefined()
    expect(en.categories).toEqual([
      { slug: 'engineering', label: 'Engineering' },
    ])
  })

  it('keeps a valid selection visible and names it in the empty sentence', () => {
    const view = writingListView(
      enOnly,
      'zh',
      { category: 'engineering' },
      taxonomy,
      label,
    )
    expect(view.categories).toEqual([{ slug: 'engineering', label: '工程' }])
    expect(view.emptyText).toBe('「工程」分类下还没有文章。')
  })

  it('ignores filter values that are not in the taxonomy', () => {
    const view = writingListView(
      enOnly,
      'en',
      { category: 'nope', tag: 'typescript' },
      taxonomy,
      label,
    )
    expect(view.filter).toEqual({ category: undefined, tag: 'typescript' })
    expect(view.posts).toHaveLength(1)
  })
})
