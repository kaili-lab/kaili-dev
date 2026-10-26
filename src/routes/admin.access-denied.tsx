/* eslint-disable better-tailwindcss/no-unknown-classes -- Admin CSS classes are defined in admin.css. */
import adminCss from '../styles/admin.css?url'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/access-denied')({
  head: () => ({
    meta: [
      { title: '没有后台权限 · kaili.dev' },
      { name: 'robots', content: 'noindex' },
    ],
    links: [{ rel: 'stylesheet', href: adminCss }],
  }),
  component: AccessDeniedPage,
})

function AccessDeniedPage() {
  return (
    <main className="ad-root" lang="zh-CN">
      <section className="ad-page ad-auth-page">
        <h1>没有后台权限</h1>
        <p>当前 GitHub 账号不能访问 kaili.dev 后台。</p>
        <p>请退出当前 GitHub 账号，或使用浏览器无痕窗口重新登录。</p>
        <a className="ad-auth-button" href="/auth/github/start">
          重新登录
        </a>
      </section>
    </main>
  )
}
