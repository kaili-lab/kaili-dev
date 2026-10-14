import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import { PAGE_SIZE } from '#/features/admin'

type Page = { page: number; pages: number; total: number }

/** Page numbers to show: first, last, and the current page's neighbours. */
function pageNumbers({ page, pages }: Page) {
  return [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((number) => number >= 1 && number <= pages)
    .sort((left, right) => left - right)
}

/**
 * Pager links are never "current" (the current page is plain text); match
 * the whole search so TanStack does not mark page 1 active on page 2.
 */
const exact = { exact: true }

/** Keeps every other search value and sets the page (1 is left out). */
const toPage =
  (page: number) =>
  (previous: Record<string, unknown>): Record<string, unknown> => ({
    ...previous,
    page: page > 1 ? page : undefined,
  })

/** D-163 ②: "共 N 篇，显示第 a–b 篇" + previous / numbers / next. */
export function Pager({ page, unit }: { page: Page; unit: string }) {
  const from = page.total === 0 ? 0 : (page.page - 1) * PAGE_SIZE + 1
  const to = Math.min(page.page * PAGE_SIZE, page.total)
  const step = (number: number, label: string) =>
    number >= 1 && number <= page.pages ? (
      <Link
        to="."
        search={toPage(number)}
        activeOptions={exact}
        className="ad-page-link"
      >
        {label}
      </Link>
    ) : (
      <span className="ad-page-link is-off" aria-disabled="true">
        {label}
      </span>
    )
  return (
    <nav className="ad-pager" aria-label="分页">
      <span className="ad-pager-info">
        共 {page.total} {unit}
        {page.total > 0 ? `，显示第 ${from}–${to} ${unit}` : ''}
      </span>
      {page.pages > 1 ? (
        <span className="ad-pager-links">
          {step(page.page - 1, '上一页')}
          {pageNumbers(page).map((number, index, numbers) => {
            const gap = index > 0 && number - numbers[index - 1]! > 1
            return (
              <span key={number} className="ad-pager-group">
                {gap ? <span className="ad-pager-gap">…</span> : null}
                {number === page.page ? (
                  <span className="ad-page-link is-current" aria-current="page">
                    {number}
                  </span>
                ) : (
                  <Link
                    to="."
                    search={toPage(number)}
                    activeOptions={exact}
                    className="ad-page-link"
                    aria-label={`第 ${number} 页`}
                  >
                    {number}
                  </Link>
                )}
              </span>
            )
          })}
          {step(page.page + 1, '下一页')}
        </span>
      ) : null}
    </nav>
  )
}

/**
 * A list page whose head stays put while only the table scrolls (D-163 ②).
 * `head` holds the title, filters and inputs; `footer` the pager.
 */
export function ListLayout({
  head,
  children,
  footer,
}: {
  head: ReactNode
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <section className="ad-page ad-list">
      <div className="ad-list-head">{head}</div>
      <div className="ad-list-scroll">{children}</div>
      {footer}
    </section>
  )
}

/** The article list's page and filters, so "← 文章" returns to them. */
let postsSearch: Record<string, unknown> = {}
export const rememberPostsSearch = (search: Record<string, unknown>) => {
  postsSearch = search
}
export const lastPostsSearch = () => postsSearch
