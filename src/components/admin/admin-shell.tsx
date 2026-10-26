import { useEffect, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import type { VersionState } from '#/features/article-versions'

const stateText: Record<VersionState, string> = {
  missing: '未创建',
  draft: '草稿',
  published: '已发布',
  modified: '已发布 · 有未发布修改',
  withdrawn: '已撤下',
}
const stateClass: Record<VersionState, string> = {
  missing: 'ad-state ad-state-quiet',
  draft: 'ad-state ad-state-quiet',
  published: 'ad-state ad-state-live',
  modified: 'ad-state ad-state-live ad-state-modified',
  withdrawn: 'ad-state ad-state-quiet',
}

export function stateLabel(state: VersionState) {
  return stateText[state]
}

/** Status text with its colour (design.md §9: quiet / indigo / ink 600). */
export function AdminState({
  state,
  prefix,
}: {
  state: VersionState
  prefix?: string
}) {
  return (
    <span className={stateClass[state]}>
      {prefix ? `${prefix} · ` : ''}
      {stateText[state]}
    </span>
  )
}

export function AdminShell({
  user,
  section,
  children,
}: {
  user: string
  section: 'posts' | 'ideas' | 'taxonomy'
  children: ReactNode
}) {
  // Marks the moment event handlers are attached; e2e tests wait for it.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setHydrated(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const current = (name: typeof section) =>
    name === section ? 'page' : undefined
  return (
    <div className="ad-root" lang="zh-CN" data-hydrated={hydrated || undefined}>
      <aside className="ad-nav">
        <strong className="ad-brand">kaili.dev 后台</strong>
        <nav aria-label="后台">
          <Link to="/admin/posts" aria-current={current('posts')}>
            文章
          </Link>
          <Link to="/admin/ideas" aria-current={current('ideas')}>
            Idea
          </Link>
          <Link to="/admin/taxonomy" aria-current={current('taxonomy')}>
            分类与标签
          </Link>
        </nav>
        <span className="ad-nav-side">
          <a href="/zh" target="_blank" rel="noreferrer">
            查看网站 ↗
          </a>
          <form method="post" action="/auth/logout">
            <button type="submit" className="ad-logout">
              {user} · 退出登录
            </button>
          </form>
        </span>
      </aside>
      <main className="ad-main">{children}</main>
    </div>
  )
}
