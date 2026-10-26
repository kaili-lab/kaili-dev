import { useEffect, useState } from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'

import type { Language } from '#/features/routing'
import { loadPublishedPost } from '#/features/posts.functions'
import {
  K2ArticleEnd,
  K2ArticleHeading,
  K2ArticleLayout,
  K2Prose,
  K2TableOfContents,
} from '#/components/k2'
import { PublicLayout } from '#/components/public-site'

export const Route = createFileRoute('/$lang/writing/$slug')({
  loader: async ({ params }) => {
    const language = params.lang as Language
    const post = await loadPublishedPost({
      data: { slug: params.slug, language },
    })
    if (!post) throw notFound()
    return { language, ...post }
  },
  head: ({ params, loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.version.title} · Kai Li` },
          { name: 'description', content: loaderData.version.summary },
          { property: 'og:type', content: 'article' },
          { property: 'og:title', content: loaderData.version.title },
          { property: 'og:description', content: loaderData.version.summary },
          {
            property: 'og:url',
            content: `https://kaili.dev/${params.lang}/writing/${encodeURIComponent(params.slug)}`,
          },
          {
            property: 'og:locale',
            content: params.lang === 'zh' ? 'zh_CN' : 'en_US',
          },
          {
            property: 'og:image',
            content: `${loaderData.origin}/images/share-card.png`,
          },
          { property: 'og:image:type', content: 'image/png' },
          { property: 'og:image:width', content: '1200' },
          { property: 'og:image:height', content: '630' },
          { property: 'og:image:alt', content: 'Kai Li · kaili.dev' },
          {
            property: 'article:published_time',
            content: loaderData.version.publishedAt,
          },
        ]
      : [],
    links: loaderData
      ? [
          { rel: 'canonical', href: `/${params.lang}/writing/${params.slug}` },
          ...(['zh', 'en'] as const)
            .filter(
              (language) =>
                language === params.lang || loaderData.alternatePublished,
            )
            .map((language) => ({
              rel: 'alternate',
              hrefLang: language === 'zh' ? 'zh-CN' : 'en',
              href: `/${language}/writing/${params.slug}`,
            })),
        ]
      : [],
  }),
  component: ArticlePage,
})

function ArticlePage() {
  const {
    language,
    version,
    slug,
    category,
    categoryName,
    alternatePublished,
    rendered,
    tags,
    previous,
    next,
  } = Route.useLoaderData()
  const [currentId, setCurrentId] = useState<string>()
  useEffect(() => {
    const headings = rendered.toc.flatMap((item) => {
      const element = document.getElementById(item.id)
      return element ? [element] : []
    })
    const mark = () => {
      let current = headings[0]
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top < 120) current = heading
      }
      setCurrentId(current?.id)
    }
    const frame = requestAnimationFrame(mark)
    window.addEventListener('scroll', mark, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', mark)
    }
  }, [rendered.toc])
  return (
    <PublicLayout language={language} article={{ slug, alternatePublished }}>
      <K2ArticleLayout>
        <K2ArticleHeading
          title={version.title}
          summary={version.summary}
          category={{
            label: categoryName,
            href: `/${language}/writing?category=${encodeURIComponent(category)}`,
          }}
          date={version.publishedAt}
          minutes={rendered.minutes}
          backHref={`/${language}/writing`}
          language={language}
        />
        <K2TableOfContents
          language={language}
          items={rendered.toc}
          currentId={currentId}
        />
        <K2Prose>
          <div dangerouslySetInnerHTML={{ __html: rendered.html }} />
        </K2Prose>
      </K2ArticleLayout>
      <K2ArticleEnd
        language={language}
        tags={tags.map((tag) => ({
          label: tag.label,
          href: `/${language}/writing?tag=${encodeURIComponent(tag.slug)}`,
        }))}
        previous={previous}
        next={next}
      />
    </PublicLayout>
  )
}
