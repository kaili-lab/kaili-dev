import {
  Outlet,
  createFileRoute,
  notFound,
  useRouterState,
  type ErrorComponentProps,
} from '@tanstack/react-router'

import adminCss from '../styles/admin.css?url'
import { AdminShell } from '#/components/admin/admin-shell'
import { developmentOnly } from '#/lib/development-only'

// Development only until the real login lands (D-132). Production builds
// leave the whole /admin tree out (vite.config.ts) and 404 here as well.
export const Route = createFileRoute('/admin')({
  head: () => ({
    meta: [
      { title: '后台 · kaili.dev' },
      { name: 'robots', content: 'noindex' },
    ],
    links: [{ rel: 'stylesheet', href: adminCss }],
  }),
  server: { middleware: [developmentOnly] },
  beforeLoad: () => {
    if (import.meta.env.PROD) throw notFound()
    return { user: 'Kai Li' }
  },
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
  const section = pathname.startsWith('/admin/ideas')
    ? 'ideas'
    : pathname.startsWith('/admin/taxonomy')
      ? 'taxonomy'
      : 'posts'
  return (
    <AdminShell user={user} section={section}>
      <Outlet />
    </AdminShell>
  )
}
