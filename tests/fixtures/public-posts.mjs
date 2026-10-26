export const categories = [
  { slug: 'engineering', zh: '工程', en: 'Engineering' },
]

export const posts = [
  {
    slug: 'boundary-example',
    zh: {
      title: '把边界写清楚',
      summary: '所有权、边界和事务结束的位置，决定了服务是否容易理解。',
      body: '已发布中文正文',
      publishedAt: '2026-09-02',
      updatedAt: '2026-09-02T00:00:00.000Z',
      category: 'engineering',
      tags: [],
    },
    en: {
      title: 'Make boundaries visible',
      summary:
        'Ownership, boundaries, and where the transaction ends make a service understandable.',
      body: 'Published English body',
      publishedAt: '2026-09-02',
      updatedAt: '2026-09-02T00:00:00.000Z',
      category: 'engineering',
      tags: [],
    },
  },
  {
    slug: 'zh-only-example',
    zh: {
      title: '只有中文的文章',
      summary: '这篇文章还没有英文版本。',
      body: '已发布中文正文',
      publishedAt: '2026-08-01',
      updatedAt: '2026-08-01T00:00:00.000Z',
      category: 'engineering',
      tags: [],
    },
  },
  {
    slug: 'en-only-example',
    en: {
      title: 'An English-only article',
      summary: 'This article is currently available in English only.',
      body: 'Published English body',
      publishedAt: '2026-07-01',
      updatedAt: '2026-07-01T00:00:00.000Z',
      category: 'engineering',
      tags: [],
    },
  },
]
