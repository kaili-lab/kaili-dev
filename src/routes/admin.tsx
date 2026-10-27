import {
  Outlet,
  createFileRoute,
  useRouterState,
  type ErrorComponentProps,
} from '@tanstack/react-router'

import adminCss from '../styles/admin.css?url'
import { AdminShell } from '#/components/admin/admin-shell'
import { requireAdminSession } from '#/lib/require-admin-session'

// Every admin document request is gated by the D1-backed GitHub session.
export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: '后台 · kaili.dev' },
      { name: 'robots', content: 'noindex' },
    ],
    links: [{ rel: 'stylesheet', href: adminCss }],
  }),
  server: { middleware: [requireAdminSession] },
  beforeLoad: () => ({ user: 'Kai Li' }),
  component: AdminLayout,
  errorComponent: AdminError,
})

// Loader or server-function failures inside the admin (design.md §9: text
// states, cinnabar for errors, no animation).
function AdminError({ error }: ErrorComponentProps) {
  const reason = error instanceof Error ? error.message : String(error)
  return (
    <div className="ad-root" lang="zh-CN">
      <section className="ad-page">
        <p role="alert" className="ad-feedback ad-error">
          页面加载失败，请刷新重试。（{reason}）
        </p>
        <a href="/admin/posts">返回文章列表</a>
      </section>
    </div>
  )
}

function AdminLayout() {
  const { user } = Route.useRouteContext()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  if (pathname === '/admin/login' || pathname === '/admin/access-denied')
    return <Outlet />
  const section = pathname.startsWith('/admin/ideas')
    ? 'ideas'
    : pathname.startsWith('/admin/taxonomy')
      ? 'taxonomy'
      : pathname.startsWith('/admin/ai')
        ? 'ai'
        : 'posts'
  return (
    <AdminShell user={user} section={section}>
      <Outlet />
    </AdminShell>
  )
}
