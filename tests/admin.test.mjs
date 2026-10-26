import { describe, expect, it } from 'vitest'

import {
  PAGE_SIZE,
  adminRow,
  filterAdminRows,
  isBlank,
  matchesQuery,
  paginate,
  parsePage,
  sortAdminRows,
  sortIdeas,
  taxonomyUsage,
  validateTaxonomyEntry,
} from '../src/features/admin.ts'
import { referencedImages } from '../src/features/markdown-images.ts'

const entry = (slug, zh = '中', en = 'En') => ({ slug, zh, en })
const snapshot = (
  category,
  tags,
  publishedAt = '2026-01-01T00:00:00.000Z',
) => ({
  title: 't',
  summary: 's',
  body: 'b',
  images: [],
  publishedAt,
  updatedAt: publishedAt,
  category,
  tags,
})
const draft = (title = 't') => ({ title, summary: 's', body: 'b', images: [] })

describe('D-158 ② taxonomy validation', () => {
  const siblings = [entry('engineering'), entry('ai')]
  it('accepts a new unique entry', () => {
    expect(
      validateTaxonomyEntry(entry('reading'), siblings, undefined, false),
    ).toEqual([])
  })
  it.each([
    [entry('reading', ' ', 'Reading'), ['zh-required']],
    [entry('reading', '读书', '　'), ['en-required']],
    [entry('Reading'), ['slug-format']],
    [entry('-a'), ['slug-format']],
    [entry('ai'), ['slug-taken']],
  ])('rejects %j', (value, errors) => {
    expect(validateTaxonomyEntry(value, siblings, undefined, false)).toEqual(
      errors,
    )
  })
  it('lets an entry keep its own slug when renamed', () => {
    expect(
      validateTaxonomyEntry(entry('ai', '人工智能'), siblings, 'ai', true),
    ).toEqual([])
  })
  it('locks the slug once a published snapshot uses it (D-158 ④)', () => {
    expect(validateTaxonomyEntry(entry('ml'), siblings, 'ai', true)).toEqual([
      'slug-locked',
    ])
    expect(validateTaxonomyEntry(entry('ml'), siblings, 'ai', false)).toEqual(
      [],
    )
  })
  it('checks uniqueness only within the same kind', () => {
    // A tag may share a slug with a category: siblings are the tags only.
    expect(
      validateTaxonomyEntry(
        entry('engineering'),
        [entry('typescript')],
        undefined,
        false,
      ),
    ).toEqual([])
  })
})

describe('D-158 ③ taxonomy usage', () => {
  const articles = [
    {
      category: 'engineering',
      tags: ['typescript'],
      zh: { published: snapshot('ai', ['cloudflare']) },
      en: {},
    },
    { category: 'ai', tags: [], zh: { draft: draft() }, en: {} },
  ]
  it('counts the shared editing value and published snapshots once per article', () => {
    expect(taxonomyUsage(articles, 'categories', 'ai')).toEqual({
      references: 2,
      published: true,
    })
    expect(taxonomyUsage(articles, 'categories', 'engineering')).toEqual({
      references: 1,
      published: false,
    })
    expect(taxonomyUsage(articles, 'tags', 'cloudflare')).toEqual({
      references: 1,
      published: true,
    })
    expect(taxonomyUsage(articles, 'tags', 'typescript')).toEqual({
      references: 1,
      published: false,
    })
    expect(taxonomyUsage(articles, 'tags', 'unused')).toEqual({
      references: 0,
      published: false,
    })
  })
})

describe('admin list rows and order (D-104 / D-158 ①)', () => {
  const article = (zh, en) => ({ slug: 's', category: 'c', tags: [], zh, en })
  it('titles prefer the Chinese draft, then English, then a placeholder', () => {
    expect(
      adminRow(
        'a',
        article({ draft: draft('中文') }, { draft: draft('English') }),
        'x',
      ).title,
    ).toBe('中文')
    expect(
      adminRow(
        'a',
        article({ draft: draft(' ') }, { draft: draft('English') }),
        'x',
      ).title,
    ).toBe('English')
    expect(adminRow('a', article({}, {}), 'x').title).toBe('（无标题）')
  })
  it('uses the later first-publish time of the two languages', () => {
    const row = adminRow(
      'a',
      article(
        { published: snapshot('c', [], '2026-01-01T00:00:00.000Z') },
        { published: snapshot('c', [], '2026-03-01T00:00:00.000Z') },
      ),
      'x',
    )
    expect(row.publishedAt).toBe('2026-03-01T00:00:00.000Z')
  })
  it('does not treat withdrawn snapshots as active publication', () => {
    const row = adminRow(
      'a',
      article(
        { published: { ...snapshot('c'), withdrawnAt: '2026-04-01' } },
        {},
      ),
      'x',
    )
    expect(row.publishedAt).toBeUndefined()
    expect(row.withdrawnAt).toBe('2026-04-01')
  })
  it('puts never-published articles first by save time, then by publish time', () => {
    const rows = [
      { id: 'p-old', publishedAt: '2026-01-01', savedAt: '2026-09-09' },
      { id: 'd-old', savedAt: '2026-05-01' },
      { id: 'p-new', publishedAt: '2026-06-01', savedAt: '2026-06-01' },
      { id: 'd-new', savedAt: '2026-10-01' },
    ]
    expect(sortAdminRows(rows).map((row) => row.id)).toEqual([
      'd-new',
      'd-old',
      'p-new',
      'p-old',
    ])
  })
  it('orders withdrawn articles by withdrawal time', () => {
    const rows = [
      { id: 'withdrawn-old', withdrawnAt: '2026-10-05', savedAt: '2026-01-01' },
      { id: 'withdrawn-new', withdrawnAt: '2026-10-10', savedAt: '2026-01-01' },
      { id: 'draft', savedAt: '2026-10-01' },
    ]
    expect(sortAdminRows(rows).map((row) => row.id)).toEqual([
      'withdrawn-new',
      'withdrawn-old',
      'draft',
    ])
  })
})

describe('Ideas (D-073 / D-076)', () => {
  it('orders by updatedAt, then createdAt, then id', () => {
    const ideas = [
      { id: 'b', createdAt: '1', updatedAt: '5' },
      { id: 'a', createdAt: '1', updatedAt: '5' },
      { id: 'c', createdAt: '2', updatedAt: '5' },
      { id: 'd', createdAt: '9', updatedAt: '9' },
    ]
    expect(sortIdeas(ideas).map((idea) => idea.id)).toEqual([
      'd',
      'c',
      'a',
      'b',
    ])
  })
  it.each(['', ' ', '\n\t', '　', '​'])('treats %j as blank', (text) => {
    expect(isBlank(text)).toBe(true)
  })
  it('keeps real text', () => expect(isBlank(' 想法 ')).toBe(false))
})

describe('D-048 image references', () => {
  it('collects inline and reference images, once each', () => {
    const body = [
      '![a](/img/a.png)',
      'text ![b](<https://r2/b.jpg> "t")',
      '![a again](/img/a.png)',
      '![ref][diagram]',
      '',
      '[diagram]: https://r2/diagram.png',
      '[link](/not-image)',
    ].join('\n')
    expect(referencedImages(body)).toEqual([
      '/img/a.png',
      'https://r2/b.jpg',
      'https://r2/diagram.png',
    ])
  })
  it('uses the first definition when a reference is defined twice', () => {
    const body = [
      '![图][asset]',
      '',
      '[asset]: /img/a.png',
      '[asset]: /img/b.png',
    ].join('\n')
    expect(referencedImages(body)).toEqual(['/img/a.png'])
  })
  it('ignores image syntax inside code', () => {
    const body = [
      '```md',
      '![example](/img/in-fence.png)',
      '```',
      '',
      'inline `![x](/img/in-code.png)` text',
    ].join('\n')
    expect(referencedImages(body)).toEqual([])
  })
})

describe('D-163 list pages', () => {
  const numbers = Array.from({ length: 32 }, (_, index) => index + 1)

  it('shows 15 rows per page', () => {
    expect(PAGE_SIZE).toBe(15)
    expect(paginate(numbers, 1)).toEqual({
      items: numbers.slice(0, 15),
      page: 1,
      pages: 3,
      total: 32,
    })
    expect(paginate(numbers, 3).items).toEqual([31, 32])
  })

  it.each([
    [undefined, 1],
    ['', 1],
    ['0', 1],
    ['-2', 1],
    ['1.5', 1],
    ['abc', 1],
    ['2', 2],
    [4, 4],
  ])('reads page %j as %i', (value, page) => {
    expect(parsePage(value)).toBe(page)
  })

  it('clamps a page past the end to the last page', () => {
    expect(paginate(numbers, 99)).toMatchObject({ page: 3, items: [31, 32] })
  })

  it('an empty list still has one page', () => {
    expect(paginate([], 5)).toEqual({ items: [], page: 1, pages: 1, total: 0 })
  })

  it('matches queries ignoring case and outer spaces', () => {
    expect(matchesQuery('Hello World', '  world ')).toBe(true)
    expect(matchesQuery('Hello', '')).toBe(true)
    expect(matchesQuery('Hello', 'bye')).toBe(false)
  })

  const row = (id, title, zh, en, category = 'eng') => ({
    id,
    title,
    zh,
    en,
    category,
    savedAt: '2026-01-01T00:00:00.000Z',
  })
  const rows = [
    row('a', 'Alpha', 'draft', 'missing'),
    row('b', 'Beta', 'published', 'missing', 'read'),
    row('c', 'Gamma', 'modified', 'published'),
    row('d', 'Delta', 'missing', 'missing', 'read'),
    row('e', 'Epsilon', 'withdrawn', 'missing'),
    row('f', 'Zeta', 'published', 'withdrawn'),
  ]
  const ids = (filter) =>
    filterAdminRows(rows, {
      q: '',
      status: 'all',
      category: '',
      ...filter,
    }).map((item) => item.id)

  it.each([
    [{}, ['a', 'b', 'c', 'd', 'e', 'f']],
    [{ status: 'pending' }, ['a', 'c']],
    [{ status: 'published' }, ['b', 'c', 'f']],
    [{ status: 'unpublished' }, ['a', 'd']],
    [{ status: 'withdrawn' }, ['e', 'f']],
    [{ category: 'read' }, ['b', 'd']],
    [{ q: 'ta' }, ['b', 'd', 'f']],
    [{ q: 'ta', status: 'published', category: 'read' }, ['b']],
  ])('filters %j', (filter, expected) => {
    expect(ids(filter)).toEqual(expected)
  })
})
