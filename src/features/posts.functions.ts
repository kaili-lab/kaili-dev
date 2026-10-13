import { createServerFn } from '@tanstack/react-start'

import {
  requireArticleRequest,
  requireLanguage,
  requireWritingListRequest,
  visiblePosts,
} from '#/features/routing'
import { writingListView } from '#/features/writing-list'
import { renderMarkdown } from '#/features/markdown'
import { getPost, publishedPosts } from '#/server/data/posts'
import { categories, tags } from '#/server/data/taxonomy'
import { categoryLabel, tagLabel } from '#/features/taxonomy.server'

export const loadPublishedPosts = createServerFn({ method: 'GET' })
  .validator(requireLanguage)
  .handler(({ data }) =>
    visiblePosts(publishedPosts(), data).map((post) => ({
      ...post,
      categoryName: categoryLabel(post[data]!.category, data),
    })),
  )

export const loadPublishedPost = createServerFn({ method: 'GET' })
  .validator(requireArticleRequest)
  .handler(async ({ data }) => {
    const post = getPost(data.slug)
    const version = post?.[data.language]
    if (!post || !version) return null
    const rendered = await renderMarkdown(version.body)
    const languagePosts = visiblePosts(publishedPosts(), data.language)
    const position = languagePosts.findIndex((item) => item.slug === post.slug)
    const previousPost = position >= 0 ? languagePosts[position + 1] : undefined
    const nextPost = position > 0 ? languagePosts[position - 1] : undefined
    const previousVersion = previousPost?.[data.language]
    const nextVersion = nextPost?.[data.language]
    return {
      slug: post.slug,
      category: version.category,
      categoryName: categoryLabel(version.category, data.language),
      version,
      alternatePublished: Boolean(post[data.language === 'zh' ? 'en' : 'zh']),
      rendered,
      tags: version.tags.map((tag) => ({
        slug: tag,
        label: tagLabel(tag, data.language),
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
  .handler(({ data }) =>
    writingListView(
      publishedPosts(),
      data.language,
      { category: data.category, tag: data.tag },
      { categories, tags },
      (slug) => categoryLabel(slug, data.language),
    ),
  )
