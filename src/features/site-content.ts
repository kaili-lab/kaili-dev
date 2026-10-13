import type { Language } from '#/features/posts'

export type SiteProject = {
  name: string
  image: string
  active: boolean
  status: string
  url: string
  repository: string
  why: string
  introduction: string
}
export type SiteBook = {
  title: string
  author: string
  status: string
  reading: boolean
  finished?: string
  note?: string
  articleSlug?: string
}
export type SiteContent = {
  introduction: string
  nowUpdated: string
  rows: Array<{ label: string; text: string; note?: string }>
  projects: SiteProject[]
  books: SiteBook[]
  quote: { text: string; source: string }
}

export function homeBooks(books: SiteBook[]) {
  return [...books]
    .sort(
      (a, b) =>
        Number(b.reading) - Number(a.reading) ||
        (b.finished ?? '').localeCompare(a.finished ?? ''),
    )
    .slice(0, 3)
}

export function groupBooks(books: SiteBook[]) {
  const reading = books.filter((book) => book.reading)
  const finished = books
    .filter((book) => !book.reading && book.finished)
    .sort((a, b) => b.finished!.localeCompare(a.finished!))
  const groups: Array<{ title: string; reading: boolean; books: SiteBook[] }> =
    []
  if (reading.length) groups.push({ title: '', reading: true, books: reading })
  for (const book of finished) {
    const year = book.finished!.slice(0, 4)
    const last = groups.at(-1)
    if (last?.title === year) last.books.push(book)
    else groups.push({ title: year, reading: false, books: [book] })
  }
  return groups
}

export function homeAllLink(
  count: number,
  language: Language,
  page: 'projects' | 'bookshelf',
) {
  return count > 3
    ? {
        label: language === 'zh' ? '全部 →' : 'All →',
        href: `/${language}/${page}`,
      }
    : undefined
}
