import { createFileRoute } from '@tanstack/react-router'
import type { Language, PublicPost } from '#/features/routing'

import { loadPublishedPosts } from '#/features/posts.functions'
import { PublicLayout, PublicSocialLinks } from '#/components/public-site'
import {
  K2ArticleItem,
  K2BookItem,
  K2FeatureArticle,
  K2Hero,
  K2NowPanel,
  K2ProjectItem,
  K2Quote,
  K2SectionTitle,
} from '#/components/k2'
import { homeAllLink, homeBooks } from '#/features/site-content'
import { loadSiteContent } from '#/features/site-content.functions'

export const Route = createFileRoute('/$lang/')({
  loader: async ({ params }) => {
    const language = params.lang as Language
    const [posts, content] = await Promise.all([
      loadPublishedPosts({ data: language }),
      loadSiteContent({ data: language }),
    ])
    return { posts, content }
  },
  head: ({ params }) => ({
    meta: [
      {
        title:
          params.lang === 'zh'
            ? 'Kai Li · 写作与思考'
            : 'Kai Li · Writing and thinking',
      },
      {
        name: 'description',
        content:
          params.lang === 'zh'
            ? 'Kai Li 的写作、项目和书架。'
            : 'Writing, projects, and bookshelf by Kai Li.',
      },
    ],
    links: [
      { rel: 'canonical', href: `/${params.lang}` },
      { rel: 'alternate', hrefLang: 'zh-CN', href: '/zh' },
      { rel: 'alternate', hrefLang: 'en', href: '/en' },
    ],
  }),
  component: LanguageHome,
})

function LanguageHome() {
  const { lang } = Route.useParams()
  const language = lang as Language
  const { posts, content } = Route.useLoaderData()
  const featured = posts[0]
  const version = featured?.[language]
  const books = homeBooks(content.books)
  return (
    <PublicLayout language={language}>
      <K2Hero
        lines={
          language === 'zh'
            ? [
                '永远的学生，',
                <>
                  与 AI 一起<em>进化</em>。
                </>,
              ]
            : [
                'A perpetual student, ',
                <>
                  <em>evolving</em> with AI.
                </>,
              ]
        }
        introduction={
          <>
            <p>
              <span className="name">Kai Li</span>
              {content.introduction}
            </p>
            <PublicSocialLinks language={language} />
          </>
        }
      >
        <K2NowPanel
          title={language === 'zh' ? '此刻' : 'Now'}
          updated={content.nowUpdated}
          rows={content.rows}
          emptyMessage={
            language === 'zh' ? '暂时没有更新。' : 'No updates yet.'
          }
        />
      </K2Hero>
      <div className="site-home-lower">
        <section aria-label={language === 'zh' ? '最近写的' : 'Recent writing'}>
          <K2SectionTitle
            allLink={{
              label: language === 'zh' ? '全部文章 →' : 'All posts →',
              href: `/${language}/writing`,
            }}
          >
            {language === 'zh' ? '最近写的' : 'Recent writing'}
          </K2SectionTitle>
          {featured && version && (
            <K2FeatureArticle
              title={version.title}
              summary={version.summary}
              category={featured.categoryName}
              date={version.publishedAt}
              href={`/${language}/writing/${featured.slug}`}
              language={language}
            />
          )}
          <PostList language={language} posts={posts.slice(1)} />
        </section>
        <aside className="site-home-side">
          <section
            aria-label={language === 'zh' ? '做过的小东西' : "Things I've made"}
          >
            <K2SectionTitle
              allLink={homeAllLink(
                content.projects.length,
                language,
                'projects',
              )}
            >
              {language === 'zh' ? '做过的小东西' : "Things I've made"}
            </K2SectionTitle>
            <ul className="k2-projects">
              {content.projects.slice(0, 3).map((project) => (
                <K2ProjectItem
                  key={project.name}
                  mode="home"
                  name={project.name}
                  why={project.why}
                  url={project.url}
                  image={{
                    src: project.image,
                    alt:
                      language === 'zh'
                        ? `${project.name} 的首页截图`
                        : `${project.name} home page`,
                  }}
                />
              ))}
            </ul>
          </section>
          <section aria-label={language === 'zh' ? '书架' : 'Bookshelf'}>
            <K2SectionTitle
              allLink={homeAllLink(content.books.length, language, 'bookshelf')}
            >
              {language === 'zh' ? '书架' : 'Bookshelf'}
            </K2SectionTitle>
            <ul className="k2-books">
              {books.map((book) => (
                <K2BookItem
                  key={book.title}
                  mode="home"
                  title={book.title}
                  author={book.author}
                  status={book.status}
                  active={book.reading}
                />
              ))}
            </ul>
          </section>
          <K2Quote source={content.quote.source}>{content.quote.text}</K2Quote>
        </aside>
      </div>
    </PublicLayout>
  )
}

function PostList({
  language,
  posts,
}: {
  language: Language
  posts: (PublicPost & { categoryName: string })[]
}) {
  return (
    <div>
      {posts.map((post) => {
        const version = post[language]
        if (!version) return null
        return (
          <K2ArticleItem
            key={post.slug}
            title={version.title}
            summary={version.summary}
            category={post.categoryName}
            date={version.publishedAt}
            href={`/${language}/writing/${post.slug}`}
          />
        )
      })}
    </div>
  )
}
