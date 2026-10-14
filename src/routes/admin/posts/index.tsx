import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'

import {
  articleStatusFilters,
  parsePage,
  type ArticleStatusFilter,
} from '#/features/admin'
import { listAdminArticles } from '#/features/admin.functions'
import { AdminState } from '#/components/admin/admin-shell'
import {
  ListLayout,
  Pager,
  rememberPostsSearch,
} from '#/components/admin/list-page'

type Search = {
  page?: number
  q?: string
  status?: Exclude<ArticleStatusFilter, 'all'>
  category?: string
}

export const Route = createFileRoute('/admin/posts/')({
  // D-163 ②: page, search and filters live in the address.
  validateSearch: (search: Record<string, unknown>): Search => {
    const page = parsePage(search.page)
    const status = articleStatusFilters.find(
      (item) => item !== 'all' && item === search.status,
    ) as Search['status']
    const text = (value: unknown) =>
      typeof value === 'string' && value !== '' ? value : undefined
    return {
      page: page > 1 ? page : undefined,
      q: text(search.q),
      status,
      category: text(search.category),
    }
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listAdminArticles({ data: deps }),
  component: AdminPosts,
})

const statusText: Record<ArticleStatusFilter, string> = {
  all: '全部状态',
  pending: '有草稿或未发布修改',
  published: '已发布（任一语言）',
  unpublished: '从未发布',
}

const day = (iso: string) => iso.slice(0, 10)
// One fixed zone so the server render and the browser agree (hydration).
const minuteFormat = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const minute = (iso: string) =>
  minuteFormat.format(new Date(iso)).replace('/', '-')
const live = (state: string) => state === 'published' || state === 'modified'

function AdminPosts() {
  const list = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  // The box follows the address: back / forward restore the search text too.
  const [query, setQuery] = useState(search.q ?? '')
  const [shownQ, setShownQ] = useState(search.q)
  if (search.q !== shownQ) {
    setShownQ(search.q)
    setQuery(search.q ?? '')
  }
  useEffect(() => rememberPostsSearch(search), [search])

  // Any change of search or filter starts again from page 1.
  const filter = (next: Partial<Search>) =>
    void navigate({
      search: (previous) => ({ ...previous, ...next, page: undefined }),
      replace: true,
    })
  const filtered = Boolean(search.q || search.status || search.category)

  return (
    <ListLayout
      head={
        <>
          <div className="ad-page-head">
            <h1>文章</h1>
            <span className="ad-count">{list.total} 篇</span>
            <Link
              to="/admin/posts/new"
              search={{ idea: undefined, lang: 'zh' }}
              className="ui-button ad-primary"
            >
              新建文章
            </Link>
          </div>
          <div className="ad-filters">
            <input
              className="ui-input ad-search"
              type="search"
              aria-label="搜索标题"
              placeholder="搜索标题"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                filter({ q: event.target.value || undefined })
              }}
            />
            <select
              className="ui-input"
              aria-label="状态"
              value={search.status ?? 'all'}
              onChange={(event) =>
                filter({
                  status:
                    event.target.value === 'all'
                      ? undefined
                      : (event.target.value as Search['status']),
                })
              }
            >
              {articleStatusFilters.map((item) => (
                <option key={item} value={item}>
                  {statusText[item]}
                </option>
              ))}
            </select>
            <select
              className="ui-input"
              aria-label="分类"
              value={search.category ?? ''}
              onChange={(event) =>
                filter({ category: event.target.value || undefined })
              }
            >
              <option value="">全部分类</option>
              {list.categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.zh}
                </option>
              ))}
            </select>
          </div>
        </>
      }
      footer={<Pager page={list} unit="篇" />}
    >
      <table className="ad-table">
        <thead>
          <tr>
            <th scope="col">标题</th>
            <th scope="col">中文</th>
            <th scope="col">English</th>
            <th scope="col">分类</th>
            <th scope="col">时间</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {list.items.length === 0 ? (
            <tr>
              <td colSpan={6} className="ad-table-empty">
                {filtered
                  ? '没有符合条件的文章。'
                  : '还没有文章。点「新建文章」开始写第一篇。'}
              </td>
            </tr>
          ) : (
            list.items.map((row) => (
              <tr key={row.id}>
                <td className="ad-cell-title" data-label="标题">
                  <Link
                    to="/admin/posts/$id"
                    params={{ id: row.id }}
                    search={{ lang: row.lastLanguage, done: undefined }}
                  >
                    {row.title}
                  </Link>
                </td>
                <td data-label="中文">
                  <AdminState state={row.zh} />
                </td>
                <td data-label="English">
                  <AdminState state={row.en} />
                </td>
                <td data-label="分类">{row.categoryName ?? '—'}</td>
                <td data-label="时间" className="ad-time">
                  {row.publishedAt
                    ? `发布于 ${day(row.publishedAt)}`
                    : `保存于 ${minute(row.savedAt)}`}
                </td>
                <td data-label="操作">
                  <div className="ad-cell-actions">
                    <Link
                      to="/admin/posts/$id"
                      params={{ id: row.id }}
                      search={{ lang: row.lastLanguage, done: undefined }}
                      aria-label={`编辑「${row.title}」`}
                    >
                      编辑
                    </Link>
                    {(['zh', 'en'] as const)
                      .filter((language) => live(row[language]) && row.slug)
                      .map((language) => (
                        <a
                          key={language}
                          href={`/${language}/writing/${row.slug}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {language === 'zh' ? '查看中文 ↗' : '查看英文 ↗'}
                        </a>
                      ))}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </ListLayout>
  )
}
