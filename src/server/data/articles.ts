import type { Article, LanguageVersion } from '#/features/article-versions'
import type { Language, PublicPost } from '#/features/posts'
import { articleBodies } from '#/server/data/article-bodies'

// Prototype article store (D-132: fake data stays behind the data layer).
// Module state lives as long as the Worker isolate; the admin that writes to
// it only exists in development. Real storage (D1) replaces this module.

export type StoredArticle = {
  id: string
  article: Article
  /** ISO time of the last successful save or publish. */
  savedAt: string
  /** Ideas attached as references (D-103); v1 allows only Ideas. */
  ideaIds: string[]
  /** Language of the last successful save or publish. */
  lastLanguage?: Language
}

type SeedText = { title: string; summary: string; body: string }
type Seed = {
  slug: string
  category: string
  tags: string[]
  zh?: SeedText & { publishedAt: string }
  en?: SeedText & { publishedAt: string }
  drafts?: { zh?: SeedText; en?: SeedText }
}

const seeds: Seed[] = [
  {
    slug: 'boundary-example',
    category: 'engineering',
    tags: ['typescript'],
    zh: {
      title: '把边界写清楚',
      summary: '所有权、边界和事务结束的位置，决定了服务是否容易理解。',
      body: '段落使用正文宋体。这里是一篇中文公开文章。',
      publishedAt: '2026-09-02',
    },
    en: {
      title: 'Make boundaries visible',
      summary:
        'Ownership, boundaries, and where the transaction ends make a service understandable.',
      body: 'This is the published English article.',
      publishedAt: '2026-09-02',
    },
    drafts: {
      zh: {
        title: '未发布中文标题不得出现',
        summary: '未发布中文摘要不得出现',
        body: '未发布中文修改不得出现',
      },
      en: {
        title: 'Unpublished English title must not appear',
        summary: 'Unpublished English summary must not appear',
        body: 'Unpublished English edit must not appear',
      },
    },
  },
  {
    slug: 'zh-only-example',
    category: 'engineering',
    tags: ['typescript'],
    zh: {
      title: '只有中文的文章',
      summary: '这篇文章还没有英文版本。',
      body: '这篇文章只有中文公开版本。',
      publishedAt: '2026-08-01',
    },
  },
  {
    slug: 'en-only-example',
    category: 'engineering',
    tags: ['typescript'],
    en: {
      title: 'An English-only article',
      summary: 'This article is currently available in English only.',
      body: 'This article has only an English published version.',
      publishedAt: '2026-07-01',
    },
  },
  {
    slug: 'private-example',
    category: 'engineering',
    tags: [],
  },
]

const languages: Language[] = ['zh', 'en']

function seedVersion(seed: Seed, language: Language): LanguageVersion {
  const published = seed[language]
  const draft = seed.drafts?.[language]
  const withBody = (text: SeedText) => ({
    title: text.title,
    summary: text.summary,
    body: `${text.body}\n\n${articleBodies[seed.slug]?.[language] ?? ''}`.trim(),
    images: [],
  })
  if (!published) return draft ? { draft: withBody(draft) } : {}
  const at = `${published.publishedAt}T00:00:00.000Z`
  const content = withBody(published)
  return {
    draft: draft ? withBody(draft) : content,
    published: {
      ...content,
      publishedAt: at,
      updatedAt: at,
      category: seed.category,
      tags: [...seed.tags],
    },
  }
}

function seedRecord(seed: Seed): [string, StoredArticle] {
  return [
    seed.slug,
    {
      id: seed.slug,
      savedAt: '2026-10-01T00:00:00.000Z',
      ideaIds: [],
      article: {
        slug: seed.slug,
        category: seed.category,
        tags: [...seed.tags],
        zh: seedVersion(seed, 'zh'),
        en: seedVersion(seed, 'en'),
      },
    },
  ]
}

export type StoreFixture = 'default' | 'en-only' | 'empty'

const store = new Map<string, StoredArticle>()

/**
 * Development / test hook: put the store back into a known state.
 * `en-only` keeps only the English-only article (Chinese has nothing
 * published, D-026); `empty` has no articles at all.
 */
export function resetArticles(fixture: StoreFixture = 'default'): void {
  store.clear()
  const chosen =
    fixture === 'empty'
      ? []
      : fixture === 'en-only'
        ? seeds.filter((seed) => seed.slug === 'en-only-example')
        : seeds
  for (const seed of chosen) {
    const [id, record] = seedRecord(seed)
    store.set(id, record)
  }
}
resetArticles()

export function listStoredArticles(): StoredArticle[] {
  return [...store.values()]
}

export function getStoredArticle(id: string): StoredArticle | undefined {
  return store.get(id)
}

export function putStoredArticle(record: StoredArticle): void {
  store.set(record.id, structuredClone(record))
}

export function newArticleId(): string {
  return crypto.randomUUID()
}

/**
 * Public view: only published snapshots, never drafts or the shared editing
 * metadata (D-034, D-155 ⑤). Dates are the published day.
 */
export function publishedPosts(): PublicPost[] {
  return listStoredArticles()
    .filter(
      ({ article }) =>
        article.slug && languages.some((l) => article[l].published),
    )
    .map(({ article }) => {
      const view = (language: Language) => {
        const published = article[language].published
        return published
          ? {
              title: published.title,
              summary: published.summary,
              body: published.body,
              publishedAt: published.publishedAt.slice(0, 10),
              updatedAt: published.updatedAt,
              category: published.category,
              tags: [...published.tags],
            }
          : undefined
      }
      return { slug: article.slug!, zh: view('zh'), en: view('en') }
    })
}
