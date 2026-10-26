/* global structuredClone */
import { readFileSync } from 'node:fs'
import { URL } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  canDeleteArticle,
  hasLivePublished,
  publishArticle,
  saveArticle,
  versionState,
  withdrawArticle,
} from '../src/features/article-versions.ts'

// T5.2: one test per T5.1 case (docs/product/article-state-cases.md). The
// 64-row main table is read from the document itself so the table is the
// contract; every other case is written out below with its ID.

const now = '2026-10-14T00:00:00.000Z'
const earlier = '2026-09-02T00:00:00.000Z'
const context = (taken = []) => ({ now, takenSlugs: new Set(taken) })
const content = (tag) => ({
  title: `${tag} title`,
  summary: `${tag} summary`,
  body: `${tag} body`,
  images: [`${tag}.png`],
})
const snapshot = (tag, category = 'engineering', tags = ['typescript']) => ({
  ...content(tag),
  publishedAt: earlier,
  updatedAt: earlier,
  category,
  tags,
})
const version = (code) =>
  ({
    N: {},
    D: { draft: content('old-draft') },
    P: { draft: content('public'), published: snapshot('public') },
    M: { draft: content('edit'), published: snapshot('public') },
  })[code]
const article = (zh, en) => ({
  slug: 'post',
  category: 'engineering',
  tags: ['typescript'],
  zh: version(zh),
  en: version(en),
})
const X = content('new')
const input = (language, overrides = {}) => ({
  language,
  content: X,
  slug: 'post',
  category: 'engineering',
  tags: ['typescript'],
  ...overrides,
})
const code = { missing: 'N', draft: 'D', published: 'P', modified: 'M' }
const states = (value) =>
  `${code[versionState(value, 'zh')]}/${code[versionState(value, 'en')]}`
const run = (operation, before, language, overrides, taken) =>
  (operation === 'save' ? saveArticle : publishArticle)(
    before,
    input(language, overrides),
    context(taken),
  )
const other = (language) => (language === 'zh' ? 'en' : 'zh')
const clone = (value) => structuredClone(value)

const rows = readFileSync(
  new URL('../docs/product/article-state-cases.md', import.meta.url),
  'utf8',
)
  .split('\n')
  .filter((line) => /^\| T51-\d\d-[ZE][SP] \|/.test(line))
  .map((line) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim()),
  )

describe('T5.1 main table (16 combinations × 2 languages × 2 operations)', () => {
  it('has exactly 64 rows covering every combination once', () => {
    expect(rows).toHaveLength(64)
    expect(
      new Set(rows.map((row) => `${row[1]} ${row[2]} ${row[3]}`)).size,
    ).toBe(64)
  })

  it.each(rows)(
    '%s',
    (
      id,
      before,
      language,
      action,
      validation,
      after,
      draft,
      published,
      otherChange,
    ) => {
      expect(validation, id).toBe(action === '保存' ? 'S✓' : 'P✓')
      const [zh, en] = before.split('/')
      const start = article(zh, en)
      const given = clone(start)
      const result = run(
        action === '保存' ? 'save' : 'publish',
        given,
        language,
      )
      // The pure functions never mutate the article they are given.
      expect(given, id).toEqual(start)
      expect(result.ok, id).toBe(true)
      const next = result.article
      expect(states(next), id).toBe(after)
      // Current-language draft: always becomes X (created or replaced).
      expect(draft.startsWith('是'), id).toBe(true)
      expect(next[language].draft, id).toEqual(X)
      // Current-language public content.
      if (published.startsWith('否')) {
        expect(next[language].published, id).toEqual(start[language].published)
      } else {
        expect(published.startsWith('是'), id).toBe(true)
        const { publishedAt, updatedAt, category, tags, ...shown } =
          next[language].published
        expect(shown, id).toEqual(X)
        expect({ category, tags, updatedAt }, id).toEqual({
          category: 'engineering',
          tags: ['typescript'],
          updatedAt: now,
        })
        expect(publishedAt, id).toBe(start[language].published ? earlier : now)
      }
      // The other language is untouched.
      expect(otherChange, id).toBe('均不变')
      expect(next[other(language)], id).toEqual(start[other(language)])
    },
  )
})

// F: nothing persisted changes. The pure functions return a rejection and
// never a new article, so "unchanged" is the caller keeping `before`; we
// also check the input object was not mutated.
function rejects(operation, before, language, overrides, error, taken) {
  const snapshotBefore = clone(before)
  const result = run(operation, before, language, overrides, taken)
  expect(result).toEqual({ ok: false, errors: expect.arrayContaining([error]) })
  expect(before).toEqual(snapshotBefore)
}

describe.each(['zh', 'en'])('T5.1 validation failures (%s)', (L) => {
  const fresh = () => ({ ...article('N', 'N'), slug: undefined })
  it('T51-V01 save without category', () =>
    rejects(
      'save',
      article('D', 'N'),
      L,
      { category: undefined },
      'category-required',
    ))
  it('T51-V02 publish without category', () =>
    rejects(
      'publish',
      article('D', 'N'),
      L,
      { category: '' },
      'category-required',
    ))
  it('T51-V03 publish with empty title', () =>
    rejects(
      'publish',
      article('D', 'D'),
      L,
      { content: { ...X, title: '' } },
      'title-required',
    ))
  it('T51-V04 publish with blank title', () =>
    rejects(
      'publish',
      article('D', 'D'),
      L,
      { content: { ...X, title: ' \t\n ' } },
      'title-required',
    ))
  it('T51-V05 publish with empty summary', () =>
    rejects(
      'publish',
      article('D', 'D'),
      L,
      { content: { ...X, summary: '' } },
      'summary-required',
    ))
  it('T51-V06 publish with blank summary', () =>
    rejects(
      'publish',
      article('D', 'D'),
      L,
      { content: { ...X, summary: ' \t\n ' } },
      'summary-required',
    ))
  it('T51-V07 publish with empty body', () =>
    rejects(
      'publish',
      article('D', 'D'),
      L,
      { content: { ...X, body: '' } },
      'body-required',
    ))
  it('T51-V08 publish with blank body', () =>
    rejects(
      'publish',
      article('D', 'D'),
      L,
      { content: { ...X, body: ' \t\n ' } },
      'body-required',
    ))
  it('T51-V09 first publish without slug', () =>
    rejects('publish', fresh(), L, { slug: undefined }, 'slug-required'))
  const badSlugs = [
    'Hello',
    'a_b',
    '中文',
    'a b',
    'a/b',
    '-a',
    'a-',
    '   ',
    'a'.repeat(81),
  ]
  it.each(badSlugs)('T51-V10 save with malformed slug %j', (slug) =>
    rejects('save', fresh(), L, { slug }, 'slug-format'),
  )
  it.each(badSlugs)('T51-V11 publish with malformed slug %j', (slug) =>
    rejects('publish', fresh(), L, { slug }, 'slug-format'),
  )
  it('T51-V12 save with a slug used by another article', () =>
    rejects('save', fresh(), L, { slug: 'taken' }, 'slug-taken', ['taken']))
  it('T51-V13 publish with a slug used by another article', () =>
    rejects('publish', fresh(), L, { slug: 'taken' }, 'slug-taken', ['taken']))
  it('T51-V14 save with a different slug after the first publish', () =>
    rejects('save', article('P', 'N'), L, { slug: 'renamed' }, 'slug-locked'))
  it('T51-V15 publish with a different slug after the first publish', () =>
    rejects(
      'publish',
      article('N', 'P'),
      L,
      { slug: 'renamed' },
      'slug-locked',
    ))
  it.each([undefined, null, ''])(
    'T51-V16 category %j means not filled in',
    (category) =>
      rejects('save', article('D', 'D'), L, { category }, 'category-required'),
  )
  it.each(['　', ' ', '​', '﻿⁠'])('T51-V17 title %j counts as blank', (title) =>
    rejects(
      'publish',
      article('D', 'D'),
      L,
      { content: { ...X, title } },
      'title-required',
    ),
  )
})

describe.each(['zh', 'en'])('T5.1 cases that must pass (%s)', (L) => {
  const O = other(L)
  const at = (codes) =>
    L === 'zh' ? article(codes[0], codes[1]) : article(codes[1], codes[0])
  const ok = (operation, before, overrides, taken) => {
    const result = run(operation, before, L, overrides, taken)
    expect(result.ok).toBe(true)
    return result.article
  }
  it('T51-A01 save an empty draft with only a category', () => {
    const before = { ...at(['N', 'N']), slug: undefined }
    const empty = { title: '', summary: '', body: '', images: [] }
    const next = ok('save', before, { slug: undefined, content: empty })
    expect(versionState(next, L)).toBe('draft')
    expect(next[L].draft).toEqual(empty)
    expect(next[L].published).toBeUndefined()
    expect(next[O]).toEqual(before[O])
  })
  it('T51-A02 save blank content over a published version', () => {
    const before = at(['P', 'P'])
    const blank = { title: ' ', summary: ' ', body: ' ', images: [] }
    const next = ok('save', before, { content: blank })
    expect(versionState(next, L)).toBe('modified')
    expect(next[L].published).toEqual(before[L].published)
    expect(next[O]).toEqual(before[O])
  })
  it('T51-A03 publish while the other language does not exist', () => {
    const next = ok('publish', at(['D', 'N']))
    expect(versionState(next, L)).toBe('published')
    expect(next[O]).toEqual({})
  })
  it('T51-A04 publish while the other language is an empty draft', () => {
    const before = at(['D', 'N'])
    before[O] = { draft: { title: '', summary: '', body: '', images: [] } }
    const next = ok('publish', before)
    expect(versionState(next, L)).toBe('published')
    expect(next[O]).toEqual(before[O])
  })
  it.each(['a', '7', 'a--b', 'a'.repeat(80)])(
    'T51-A05 save accepts slug %j',
    (slug) => {
      const next = ok('save', { ...at(['N', 'N']), slug: undefined }, { slug })
      expect(next.slug).toBe(slug)
      expect(versionState(next, L)).toBe('draft')
    },
  )
  it.each(['a', '7', 'a--b', 'a'.repeat(80)])(
    'T51-A06 publish accepts slug %j',
    (slug) => {
      const next = ok(
        'publish',
        { ...at(['D', 'N']), slug: undefined },
        { slug },
      )
      expect(versionState(next, L)).toBe('published')
      expect(next[O]).toEqual({})
    },
  )
  it('T51-A07 an article may keep its own slug on save', () => {
    const before = at(['D', 'D'])
    const next = ok('save', before, {}, ['post'])
    expect(next[L].draft).toEqual(X)
    expect(next[O]).toEqual(before[O])
  })
  it('T51-A08 an article may keep its own slug on publish', () => {
    const before = at(['P', 'P'])
    const next = ok('publish', before, {}, ['post'])
    expect(versionState(next, L)).toBe('published')
    expect(next[O]).toEqual(before[O])
  })
  it('T51-A09 save with no tags', () => {
    const next = ok('save', at(['N', 'N']), { tags: [] })
    expect(versionState(next, L)).toBe('draft')
  })
  it('T51-A10 publish with no tags', () => {
    const next = ok('publish', at(['D', 'N']), { tags: [] })
    expect(versionState(next, L)).toBe('published')
    expect(next[L].published.tags).toEqual([])
  })
})

describe.each(['zh', 'en'])(
  'T5.1 same-content operations and shared data (%s)',
  (L) => {
    const O = other(L)
    const at = (codes) =>
      L === 'zh' ? article(codes[0], codes[1]) : article(codes[1], codes[0])
    const ok = (operation, before, overrides) => {
      const result = run(operation, before, L, overrides)
      expect(result.ok).toBe(true)
      return result.article
    }
    it('T51-E01 saving a draft unchanged keeps it a draft', () => {
      const before = at(['D', 'N'])
      const next = ok('save', before, { content: before[L].draft })
      expect(next[L]).toEqual(before[L])
      expect(versionState(next, L)).toBe('draft')
    })
    it('T51-E02 saving published content unchanged stays published', () => {
      const before = at(['P', 'P'])
      const next = ok('save', before, { content: content('public') })
      expect(next[L]).toEqual(before[L])
      expect(versionState(next, L)).toBe('published')
    })
    it('T51-E03 saving the existing modified draft stays modified', () => {
      const before = at(['M', 'N'])
      const next = ok('save', before, { content: before[L].draft })
      expect(next[L]).toEqual(before[L])
      expect(versionState(next, L)).toBe('modified')
    })
    it('T51-E04 saving the draft back to the public content returns to published', () => {
      const before = at(['M', 'P'])
      const next = ok('save', before, { content: content('public') })
      expect(next[L].published).toEqual(before[L].published)
      expect(versionState(next, L)).toBe('published')
      expect(next[O]).toEqual(before[O])
    })
    it('T51-E05 publishing an unchanged draft creates the public version', () => {
      const before = at(['D', 'N'])
      const next = ok('publish', before, { content: before[L].draft })
      expect(next[L].draft).toEqual(before[L].draft)
      expect(versionState(next, L)).toBe('published')
    })
    it('T51-E06 publishing the existing modified draft updates the public version', () => {
      const before = at(['M', 'D'])
      const next = ok('publish', before, { content: before[L].draft })
      expect(next[L].draft).toEqual(before[L].draft)
      expect(versionState(next, L)).toBe('published')
      expect(next[O]).toEqual(before[O])
    })
    it('T51-E07 republishing identical content keeps publishedAt, updates updatedAt', () => {
      const before = at(['P', 'N'])
      const next = ok('publish', before, { content: content('public') })
      expect(next[L].published).toEqual({
        ...before[L].published,
        updatedAt: now,
      })
      expect(versionState(next, L)).toBe('published')
    })
    it('T51-E08 changing the shared category on save marks both published languages modified', () => {
      const before = article('P', 'P')
      const next = ok('save', before, {
        content: before[L].draft,
        category: 'ai',
      })
      expect(next.category).toBe('ai')
      expect(next.zh.published.category).toBe('engineering')
      expect(next.en.published.category).toBe('engineering')
      expect(states(next)).toBe('M/M')
      expect(next[O]).toEqual(before[O])
    })
    it('T51-E09 changing the shared tags on save marks both published languages modified', () => {
      const before = article('P', 'P')
      const next = ok('save', before, {
        content: before[L].draft,
        tags: ['cloudflare'],
      })
      expect(next.tags).toEqual(['cloudflare'])
      expect(next.zh.published.tags).toEqual(['typescript'])
      expect(next.en.published.tags).toEqual(['typescript'])
      expect(states(next)).toBe('M/M')
    })
    it('T51-E10 publishing after a shared change updates only this language snapshot', () => {
      const changed = ok('save', article('P', 'P'), {
        content: content('public'),
        category: 'ai',
      })
      const next = ok('publish', changed, {
        content: content('public'),
        category: 'ai',
      })
      expect(next[L].published.category).toBe('ai')
      expect(next[O].published.category).toBe('engineering')
      expect(versionState(next, L)).toBe('published')
      expect(versionState(next, O)).toBe('modified')
    })
    it('T51-E10 publishing after a tag-only change updates only this language snapshot', () => {
      const changed = ok('save', article('P', 'P'), {
        content: content('public'),
        tags: ['cloudflare'],
      })
      const next = ok('publish', changed, {
        content: content('public'),
        tags: ['cloudflare'],
      })
      expect(next[L].published.tags).toEqual(['cloudflare'])
      expect(next[O].published.tags).toEqual(['typescript'])
      expect(versionState(next, L)).toBe('published')
      expect(versionState(next, O)).toBe('modified')
    })
    it('T51-E11 slug may change while nothing is published', () => {
      const before = at(['D', 'D'])
      const next = ok('save', before, { slug: 's1' })
      expect(next.slug).toBe('s1')
      expect(next[O]).toEqual(before[O])
    })
    it('T51-E12 the first publish locks the slug', () => {
      const next = ok('publish', at(['D', 'D']), { slug: 's1' })
      expect(next.slug).toBe('s1')
      const relock = run('publish', next, O, { slug: 's2' })
      expect(relock).toEqual({ ok: false, errors: ['slug-locked'] })
    })
  },
)

describe('T5.1 image slots (D-048)', () => {
  const slots = (value) => ({
    zhDraft: value.zh.draft?.images,
    zhPublic: value.zh.published?.images,
    enDraft: value.en.draft?.images,
    enPublic: value.en.published?.images,
  })
  const start = article('M', 'M')
  it.each([
    ['T51-I01', 'save', 'zh', { zhDraft: ['new.png'] }],
    [
      'T51-I02',
      'publish',
      'zh',
      { zhDraft: ['new.png'], zhPublic: ['new.png'] },
    ],
    ['T51-I03', 'save', 'en', { enDraft: ['new.png'] }],
    [
      'T51-I04',
      'publish',
      'en',
      { enDraft: ['new.png'], enPublic: ['new.png'] },
    ],
  ])('%s %s %s updates only its slots', (_id, operation, language, changed) => {
    const result = run(operation, clone(start), language)
    expect(slots(result.article)).toEqual({ ...slots(start), ...changed })
  })
  it.each([
    ['T51-I05', 'save', 'zh'],
    ['T51-I06', 'publish', 'zh'],
    ['T51-I07', 'save', 'en'],
    ['T51-I08', 'publish', 'en'],
  ])('%s failed %s %s changes no slot', (_id, operation, language) => {
    const before = clone(start)
    const result = run(operation, before, language, { category: '' })
    expect(result.ok).toBe(false)
    expect(slots(before)).toEqual(slots(start))
  })
  it('removing an image from the content removes it from the slot', () => {
    const result = run('save', clone(start), 'zh', {
      content: { ...X, images: [] },
    })
    expect(result.article.zh.draft.images).toEqual([])
  })
})

describe.each(['zh', 'en'])(
  'T5.1 public isolation at the state level, %s (O01–O03; O04/O05 are T5.4)',
  (L) => {
    const O = other(L)
    it('T51-O01 saving never changes either public version', () => {
      const before = article('P', 'P')
      const next = run('save', clone(before), L).article
      expect(next[L].published).toEqual(before[L].published)
      expect(next[O]).toEqual(before[O])
    })
    it('T51-O02 publishing changes only this language public version', () => {
      const before = article('P', 'P')
      const next = run('publish', clone(before), L).article
      expect(next[L].published.title).toBe(X.title)
      expect(next[O]).toEqual(before[O])
    })
    it.each(['N', 'D'])(
      'T51-O03 an unpublished (%s) language stays unpublished while the other is published',
      (code) => {
        const before = L === 'zh' ? article(code, 'P') : article('P', code)
        expect(before[L].published).toBeUndefined()
        expect(versionState(before, O)).toBe('published')
        expect(versionState(before, L)).toBe(code === 'N' ? 'missing' : 'draft')
        // Saving the unpublished language keeps it unpublished.
        const saved = run('save', clone(before), L).article
        expect(saved[L].published).toBeUndefined()
        expect(saved[O]).toEqual(before[O])
      },
    )
  },
)

describe.each(['zh', 'en'])('T5.1 timing and comparison, %s (D-156 ②)', (L) => {
  const at = (code) => (L === 'zh' ? article(code, 'N') : article('N', code))
  it('T51-T01 the first publish writes publishedAt = updatedAt = now', () => {
    const next = run('publish', at('D'), L).article
    expect(next[L].published.publishedAt).toBe(now)
    expect(next[L].published.updatedAt).toBe(now)
  })
  it.each(['P', 'M'])(
    'T51-T02 republishing from %s keeps publishedAt',
    (code) => {
      const next = run('publish', at(code), L).article
      expect(next[L].published.publishedAt).toBe(earlier)
      expect(next[L].published.updatedAt).toBe(now)
    },
  )
  it('T51-T03 a trailing space is a real change (no normalisation)', () => {
    const next = run('save', at('P'), L, {
      content: { ...content('public'), body: 'public body ' },
    }).article
    expect(versionState(next, L)).toBe('modified')
  })
})

describe.each(['zh', 'en'])('T5.1 D-156 ④ / ⑤ input edge cases, %s', (L) => {
  const fresh = () => ({ ...article('D', 'D'), slug: undefined })
  it.each([undefined, null, ''])(
    'T51-V16 slug %j is "not filled in" on save',
    (slug) => {
      const result = run('save', fresh(), L, { slug })
      expect(result.ok).toBe(true)
      expect(result.article.slug).toBeUndefined()
    },
  )
  it.each([undefined, null, ''])(
    'T51-V16 slug %j is "not filled in" on first publish',
    (slug) => {
      expect(run('publish', fresh(), L, { slug })).toEqual({
        ok: false,
        errors: ['slug-required'],
      })
    },
  )
  it.each([undefined, null, ''])(
    'T51-V16 slug %j keeps a locked slug',
    (slug) => {
      const result = run('publish', article('P', 'P'), L, { slug })
      expect(result.ok).toBe(true)
      expect(result.article.slug).toBe('post')
    },
  )
  it.each([
    '\u200b',
    '\u200c',
    '\u200d',
    '\u2060',
    '\ufeff',
    '\u3000',
    '\u00a0',
  ])('T51-V17 a title of only %s is blank', (escaped) => {
    const title = JSON.parse(`"${escaped}"`)
    expect(
      run('publish', article('D', 'D'), L, { content: { ...X, title } }),
    ).toEqual({
      ok: false,
      errors: ['title-required'],
    })
  })
})

describe('文章撤下与删除边界', () => {
  it('W01 P/P 撤下当前语言保留快照和草稿', () => {
    const before = article('P', 'P')
    const next = withdrawArticle(before, 'zh', now)
    expect(next.zh.published.withdrawnAt).toBe(now)
    expect(next.zh.published.publishedAt).toBe(earlier)
    expect(next.zh.draft).toEqual(before.zh.draft)
    expect(next.en).toEqual(before.en)
    expect(versionState(next, 'zh')).toBe('withdrawn')
    expect(hasLivePublished(next)).toBe(true)
    expect(canDeleteArticle(next)).toBe(false)
  })

  it('W02 撤下后重复撤下不改变文章', () => {
    const before = withdrawArticle(article('P', 'N'), 'zh', now)
    expect(withdrawArticle(before, 'zh', '2026-10-15T00:00:00.000Z')).toEqual(
      before,
    )
  })

  it('W03 撤下语言重新发布保留首次发布时间', () => {
    const before = withdrawArticle(article('P', 'N'), 'zh', now)
    const next = run('publish', before, 'zh').article
    expect(next.zh.published.withdrawnAt).toBeUndefined()
    expect(next.zh.published.publishedAt).toBe(earlier)
    expect(versionState(next, 'zh')).toBe('published')
    expect(hasLivePublished(next)).toBe(true)
  })

  it('W04 N/N 与 W/N 可删除，W/P 不可删除', () => {
    expect(canDeleteArticle(article('N', 'N'))).toBe(true)
    expect(
      canDeleteArticle(withdrawArticle(article('P', 'N'), 'zh', now)),
    ).toBe(true)
    expect(
      canDeleteArticle(withdrawArticle(article('P', 'P'), 'zh', now)),
    ).toBe(false)
  })
})
