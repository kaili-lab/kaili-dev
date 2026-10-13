import { Link, createFileRoute } from '@tanstack/react-router'

import { listAdminArticles } from '#/features/admin.functions'
import { AdminState } from '#/components/admin/admin-shell'

export const Route = createFileRoute('/admin/posts/')({
  loader: () => listAdminArticles(),
  component: AdminPosts,
})

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

function AdminPosts() {
  const rows = Route.useLoaderData()
  return (
    <section className="ad-page">
      <div className="ad-page-head">
        <h1>文章</h1>
        <Link
          to="/admin/posts/new"
          search={{ idea: undefined, lang: 'zh' }}
          className="ui-button"
        >
          新建文章
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="ad-empty">还没有文章。点「新建文章」开始写第一篇。</p>
      ) : (
        <ul className="ad-stack">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                to="/admin/posts/$id"
                params={{ id: row.id }}
                search={{ lang: row.lastLanguage, done: undefined }}
              >
                {row.title}
              </Link>
              <div className="ad-stack-meta">
                <AdminState prefix="中" state={row.zh} />
                <AdminState prefix="EN" state={row.en} />
                {row.categoryName ? <span>{row.categoryName}</span> : null}
                <span className="ad-time">
                  {row.publishedAt
                    ? `发布于 ${day(row.publishedAt)}`
                    : `保存于 ${minute(row.savedAt)}`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
