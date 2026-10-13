import { createFileRoute } from '@tanstack/react-router'

import { K2BookGroup, K2BookItem } from '#/components/k2'
import { PublicLayout, PublicPageHeading } from '#/components/public-site'
import { loadPublishedPosts } from '#/features/posts.functions'
import type { Language } from '#/features/routing'
import { groupBooks } from '#/features/site-content'
import { loadSiteContent } from '#/features/site-content.functions'

export const Route = createFileRoute('/$lang/bookshelf')({
  loader: async ({ params }) => {
    const language = params.lang as Language
    const [content, posts] = await Promise.all([
      loadSiteContent({ data: language }),
      loadPublishedPosts({ data: language }),
    ])
    return { content, posts }
  },
  head: ({ params }) => ({
    meta: [
      {
        title: params.lang === 'zh' ? '书架 — Kai Li' : 'Bookshelf — Kai Li',
      },
    ],
    links: [
      { rel: 'canonical', href: `/${params.lang}/bookshelf` },
      { rel: 'alternate', hrefLang: 'zh-CN', href: '/zh/bookshelf' },
      { rel: 'alternate', hrefLang: 'en', href: '/en/bookshelf' },
    ],
  }),
  component: BookshelfPage,
})

function BookshelfPage() {
  const { lang } = Route.useParams()
  const language = lang as Language
  const { content, posts } = Route.useLoaderData()
  const groups = groupBooks(content.books)
  const publishedArticles = new Map(
    posts.flatMap((post) => {
      const version = post[language]
      return version
        ? [
            [
              post.slug,
              {
                title: version.title,
                href: `/${language}/writing/${post.slug}`,
              },
            ] as const,
          ]
        : []
    }),
  )

  return (
    <PublicLayout language={language} page="bookshelf">
      <PublicPageHeading title={language === 'zh' ? '书架' : 'Bookshelf'} />
      {groups.map((group) => (
        <K2BookGroup
          key={group.reading ? 'reading' : group.title}
          title={
            group.reading
              ? language === 'zh'
                ? '在读'
                : 'Reading now'
              : group.title
          }
          count={group.books.length}
          reading={group.reading}
          language={language}
        >
          {group.books.map((book) => (
            <K2BookItem
              key={`${book.title}:${book.author}`}
              mode="detail"
              title={book.title}
              author={book.author}
              status={book.status}
              active={book.reading}
              finished={book.finished}
              note={book.note}
              language={language}
              article={
                book.articleSlug
                  ? publishedArticles.get(book.articleSlug)
                  : undefined
              }
            />
          ))}
        </K2BookGroup>
      ))}
    </PublicLayout>
  )
}
