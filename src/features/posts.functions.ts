import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'

import {
  requireArticleRequest,
  requireLanguage,
  requireWritingListRequest,
  visiblePosts,
} from '#/features/routing'
import { writingListView } from '#/features/writing-list'
import { renderMarkdown } from '#/features/markdown'
import { getPost, publishedPosts } from '#/server/data/posts'
import { listTaxonomy } from '#/server/data/taxonomy'
import { runtimeDatabase } from '#/server/data/db'
import { categoryLabel, tagLabel } from '#/features/taxonomy.server'

export const loadPublishedPosts = createServerFn({ method: 'GET' })
  .validator(requireLanguage)
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    const [posts, categories] = await Promise.all([
      publishedPosts(database),
      listTaxonomy(database, 'categories'),
    ])
    return visiblePosts(posts, data).map((post) => ({
      ...post,
      categoryName: categoryLabel(categories, post[data]!.category, data),
    }))
  })

export const loadPublishedPost = createServerFn({ method: 'GET' })
  .validator(requireArticleRequest)
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    const [post, categories, tags] = await Promise.all([
      getPost(database, data.slug),
      listTaxonomy(database, 'categories'),
      listTaxonomy(database, 'tags'),
    ])
    const version = post?.[data.language]
    if (!post || !version) return null
    const rendered = await renderMarkdown(version.body)
    const languagePosts = visiblePosts(
      await publishedPosts(database),
      data.language,
    )
    const position = languagePosts.findIndex((item) => item.slug === post.slug)
    const previousPost = position >= 0 ? languagePosts[position + 1] : undefined
    const nextPost = position > 0 ? languagePosts[position - 1] : undefined
    const previousVersion = previousPost?.[data.language]
    const nextVersion = nextPost?.[data.language]
    return {
      origin: getRequestUrl().origin,
      slug: post.slug,
      category: version.category,
      categoryName: categoryLabel(categories, version.category, data.language),
      version,
      alternatePublished: Boolean(post[data.language === 'zh' ? 'en' : 'zh']),
      rendered,
      tags: version.tags.map((tag) => ({
        slug: tag,
        label: tagLabel(tags, tag, data.language),
      })),
      previous:
        previousPost && previousVersion
          ? {
              title: previousVersion.title,
              href: `/${data.language}/writing/${previousPost.slug}`,
            }
          : undefined,
      next:
        nextPost && nextVersion
          ? {
              title: nextVersion.title,
              href: `/${data.language}/writing/${nextPost.slug}`,
            }
          : undefined,
    }
  })

export const loadWritingList = createServerFn({ method: 'GET' })
  .validator(requireWritingListRequest)
  .handler(async ({ data }) => {
    const database = await runtimeDatabase()
    const [posts, categories, tags] = await Promise.all([
      publishedPosts(database),
      listTaxonomy(database, 'categories'),
      listTaxonomy(database, 'tags'),
    ])
    return writingListView(
      posts,
      data.language,
      { category: data.category, tag: data.tag },
      { categories, tags },
      (slug) => categoryLabel(categories, slug, data.language),
    )
  })
