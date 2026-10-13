export type Language = 'zh' | 'en'

export type PublishedVersion = {
  title: string
  summary: string
  body: string
  publishedAt: string
  /** ISO time of the last publish of this language (sitemap lastmod). */
  updatedAt: string
  /** Category and tags as recorded when this language was published. */
  category: string
  tags: string[]
}

export type PublicPost = {
  slug: string
  zh?: PublishedVersion
  en?: PublishedVersion
}
