import { useEffect, useState } from 'react'
import { createFileRoute, useRouterState } from '@tanstack/react-router'

import type { Language } from '#/features/routing'
import { loadWritingList } from '#/features/posts.functions'
import {
  writingHref,
  type FilterOption,
  type WritingFilter,
} from '#/features/writing-list'
import { writingQueryRedirect } from '#/server/writing-middleware'
import { K2ArticleItem, K2Link } from '#/components/k2'
import { PublicLayout, PublicPageHeading } from '#/components/public-site'

const text = {
  zh: {
    title: '写作',
    description: 'Kai Li 已发布的中文文章。',
    category: '分类',
    tag: '标签',
    all: '全部',
    notice: '这篇文章暂无中文版',
    clear: '看全部文章 →',
  },
  en: {
    title: 'Writing',
    description: 'Published English writing by Kai Li.',
    category: 'Category',
    tag: 'Tag',
    all: 'All',
    notice: "This article isn't available in English.",
    clear: 'See all articles →',
  },
}

export const Route = createFileRoute('/$lang/writing/')({
  server: { middleware: [writingQueryRedirect] },
  validateSearch: (search: Record<string, unknown>) => ({
    category: typeof search.category === 'string' ? search.category : undefined,
    tag: typeof search.tag === 'string' ? search.tag : undefined,
  }),
  loaderDeps: ({ search }) => ({ category: search.category, tag: search.tag }),
  loader: ({ params, deps }) =>
    loadWritingList({
      data: { language: params.lang as Language, ...deps },
    }),
  head: ({ params }) => ({
    meta: [
      { title: `${text[params.lang as Language].title} · Kai Li` },
      {
        name: 'description',
        content: text[params.lang as Language].description,
      },
    ],
    // D-143: filters stay in the address bar only.
    links: [
      { rel: 'canonical', href: `/${params.lang}/writing` },
      { rel: 'alternate', hrefLang: 'zh-CN', href: '/zh/writing' },
      { rel: 'alternate', hrefLang: 'en', href: '/en/writing' },
    ],
  }),
  component: WritingList,
})

function WritingList() {
  const { lang } = Route.useParams()
  const { posts, categories, tags, emptyText } = Route.useLoaderData()
  // D-165: links and the current marks follow the address, not the loaded
  // list. With client-side navigation the address changes first and the list
  // arrives later; building links from the old list would drop a filter that
  // was just chosen (click 工程, then TypeScript before the list returns).
  // Invalid values never reach here: the server middleware cleans them on a
  // document request (D-154), and our own links only carry valid slugs.
  // `location` changes as soon as navigation starts; the route's own search
  // only after its loader finishes, which is the stale window to avoid.
  const filter = useRouterState({
    select: (state) => {
      const search = state.location.search as Record<string, unknown>
      const text = (value: unknown) =>
        typeof value === 'string' ? value : undefined
      return { category: text(search.category), tag: text(search.tag) }
    },
    structuralSharing: true,
  })
  const language = lang as Language
  const t = text[language]
  // D-036: shown once, right after the language switch that led here. With
  // client-side navigation (D-165) this page stays mounted, so the notice
  // is tied to the address it appeared on and goes away on the next move.
  const href = useRouterState({ select: (state) => state.location.href })
  const [noticeAt, setNoticeAt] = useState<string | null>(null)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem('kaili-language-notice') !== language) return
      sessionStorage.removeItem('kaili-language-notice')
      setNoticeAt(href)
    }, 0)
    return () => window.clearTimeout(timer)
    // Only on arrival in a language; later filter moves never show it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])
  // Leaving the address drops the notice for good (back does not restore it).
  if (noticeAt !== null && noticeAt !== href) setNoticeAt(null)
  const notice = noticeAt === href
  return (
    <PublicLayout language={language}>
      <PublicPageHeading title={t.title} />
      {notice ? (
        <p role="status" className="site-writing-notice">
          {t.notice}
        </p>
      ) : null}
      <div className="site-writing-filters">
        <FilterRow
          name={t.category}
          all={t.all}
          options={categories}
          current={filter.category}
          link={(category) => writingHref(language, { ...filter, category })}
        />
        <FilterRow
          name={t.tag}
          all={t.all}
          options={tags}
          current={filter.tag}
          link={(tag) => writingHref(language, { ...filter, tag })}
        />
      </div>
      {posts.length > 0 ? (
        <div className="site-writing-list">
          {posts.map((post) => (
            <K2ArticleItem
              key={post.slug}
              title={post.version.title}
              summary={post.version.summary}
              category={post.categoryName}
              date={post.version.publishedAt}
              href={`/${language}/writing/${post.slug}`}
            />
          ))}
        </div>
      ) : (
        <div className="site-writing-empty">
          <p>{emptyText}</p>
          <K2Link href={writingHref(language, {})}>{t.clear}</K2Link>
        </div>
      )}
    </PublicLayout>
  )
}

function FilterRow({
  name,
  all,
  options,
  current,
  link,
}: {
  name: string
  all: string
  options: FilterOption[]
  current?: string
  link: (slug: WritingFilter[keyof WritingFilter]) => string
}) {
  return (
    <div className="site-writing-filter">
      <span className="site-writing-filter-name">{name}</span>
      <ul>
        {[{ slug: undefined, label: all }, ...options].map((option) => {
          const active = option.slug === current
          return (
            <li key={option.slug ?? ''}>
              <K2Link
                href={link(option.slug)}
                aria-current={active ? 'page' : undefined}
                className={active ? 'is-current' : undefined}
              >
                {option.label}
              </K2Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
