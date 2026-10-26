/* eslint-disable better-tailwindcss/no-unknown-classes -- Admin CSS classes are defined in admin.css. */
import adminCss from '../styles/admin.css?url'
import { createFileRoute, useRouterState } from '@tanstack/react-router'

import { normalizeAdminReturnTo } from '#/features/github-oauth'

export const Route = createFileRoute('/admin/login')({
  head: () => ({
    meta: [
      { title: '登录后台 · kaili.dev' },
      { name: 'robots', content: 'noindex' },
    ],
    links: [{ rel: 'stylesheet', href: adminCss }],
  }),
  component: AdminLoginPage,
})

function AdminLoginPage() {
  const search = useRouterState({
    select: (state) => state.location.searchStr,
  })
  const params = new URLSearchParams(search)
  const error = params.get('error')
  const returnTo = normalizeAdminReturnTo(params.get('returnTo'))
  const loginHref = `/auth/github/start?${new URLSearchParams({ returnTo })}`
  const message =
    error === 'not-configured'
      ? '本地 GitHub 登录尚未配置。'
      : error === 'login-error'
        ? 'GitHub 登录暂时失败，请稍后重试。'
        : error === 'login-cancelled'
          ? '登录已取消，请重新尝试。'
          : error === 'session-expired'
            ? '登录已过期，请重新登录。'
            : null
  return (
    <main className="ad-root" lang="zh-CN">
      <section className="ad-page ad-auth-page">
        <h1>进入后台</h1>
        <p>使用允许的 GitHub 账号登录。</p>
        {message ? <p role="alert">{message}</p> : null}
        <a className="ad-auth-button" href={loginHref}>
          使用 GitHub 登录
        </a>
      </section>
    </main>
  )
}
