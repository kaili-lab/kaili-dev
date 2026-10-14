import {
  putStoredArticle,
  resetArticles,
  type StoreFixture,
} from '#/server/data/articles'
import { putStoredIdea, resetIdeas } from '#/server/data/ideas'
import { putTaxonomyEntry, resetTaxonomy } from '#/server/data/taxonomy'

const fixtures = ['default', 'en-only', 'empty', 'many'] as const

/**
 * `many` = the default stores plus enough unpublished rows that every admin
 * list has several pages (D-163): 40 more articles, 40 Ideas, 20 categories
 * and 20 tags. Nothing extra is published, so public pages do not change.
 */
function addMany() {
  const at = (index: number) =>
    new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString()
  for (let index = 1; index <= 40; index += 1) {
    const number = String(index).padStart(2, '0')
    putStoredArticle({
      id: `many-${number}`,
      article: {
        slug: `many-${number}`,
        category: 'engineering',
        tags: [],
        zh: {
          draft: {
            title: `批量草稿 ${number}`,
            summary: '分页用的草稿。',
            body: '草稿正文。',
            images: [],
          },
        },
        en: {},
      },
      savedAt: at(index),
      ideaIds: [],
      lastLanguage: 'zh',
    })
    putStoredIdea({
      id: `many-idea-${number}`,
      text: `批量 Idea ${number}：分页用的想法。`,
      createdAt: at(index),
      updatedAt: at(index),
    })
  }
  for (let index = 1; index <= 20; index += 1) {
    const number = String(index).padStart(2, '0')
    for (const kind of ['categories', 'tags'] as const)
      putTaxonomyEntry(kind, {
        slug: `many-${kind}-${number}`,
        zh: `批量${kind === 'categories' ? '分类' : '标签'} ${number}`,
        en: `Bulk ${kind === 'categories' ? 'category' : 'tag'} ${number}`,
      })
  }
}

/** Development / e2e only: restore every prototype store. */
export function resetStores(fixture: string): boolean {
  if (!fixtures.includes(fixture as (typeof fixtures)[number])) return false
  resetArticles(fixture === 'many' ? 'default' : (fixture as StoreFixture))
  resetIdeas()
  resetTaxonomy()
  if (fixture === 'many') addMany()
  return true
}
