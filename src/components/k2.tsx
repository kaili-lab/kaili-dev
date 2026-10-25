import { useRouter } from '@tanstack/react-router'
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'

import { isClientPageHref } from '#/features/routing'
import { PaletteSwitcher } from '#/components/palette-switcher'
import { ThemeSwitcher } from '#/components/theme-switcher'

type Lang = 'zh' | 'en'
type Link = { label: string; href: string }
type FooterLink = { label: string; href?: string }
type Navigation = Link & { current?: boolean }

/**
 * D-165: a plain `<a href>` (so it works without JavaScript) whose ordinary
 * clicks on public pages are handled by the router instead of reloading the
 * document — a reload would re-run the deferred font sheet (D-152) and make
 * the text jump. Modified clicks (new tab, download…) stay with the browser.
 */
export function K2Link({
  href,
  onClick,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const router = useRouter()
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (props.target !== undefined && props.target !== '_self') ||
      props.download !== undefined ||
      !isClientPageHref(href)
    )
      return
    event.preventDefault()
    void router.navigate({ href })
  }
  return (
    <a href={href} {...props} onClick={handleClick}>
      {children}
    </a>
  )
}

export function K2Seal() {
  return (
    <span className="k2-seal" aria-hidden="true">
      KL
    </span>
  )
}

export function K2Header({
  language,
  homeHref,
  navigation,
  languageLinks,
  onLanguageChange,
}: {
  language: Lang
  homeHref: string
  navigation: Navigation[]
  languageLinks: { zh: string; en: string }
  onLanguageChange?: (language: Lang) => void
}) {
  return (
    <header className="k2-header">
      <div className="k2-wrap k2-header-inner">
        <K2Link className="k2-brand" href={homeHref}>
          <K2Seal />
          Kai Li
        </K2Link>
        <nav aria-label={language === 'zh' ? '主导航' : 'Main navigation'}>
          {navigation.map((item) => (
            <K2Link
              key={item.href}
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
            >
              {item.label}
            </K2Link>
          ))}
        </nav>
        <span className="k2-language">
          {language === 'zh' ? (
            <b>中</b>
          ) : (
            <K2Link
              href={languageLinks.zh}
              lang="zh"
              onClick={() => onLanguageChange?.('zh')}
            >
              中
            </K2Link>
          )}{' '}
          /{' '}
          {language === 'en' ? (
            <b>EN</b>
          ) : (
            <K2Link
              href={languageLinks.en}
              lang="en"
              onClick={() => onLanguageChange?.('en')}
            >
              EN
            </K2Link>
          )}
        </span>
        <ThemeSwitcher language={language} />
        {import.meta.env.DEV ? <PaletteSwitcher language={language} /> : null}
      </div>
    </header>
  )
}

export function K2Footer({ links }: { links: FooterLink[] }) {
  return (
    <footer className="k2-footer">
      <div className="k2-wrap">
        <div className="k2-footer-inner">
          {links.map((link) =>
            link.href ? (
              <K2Link key={link.label} href={link.href}>
                {link.label}
              </K2Link>
            ) : (
              <span key={link.label}>{link.label}</span>
            ),
          )}
        </div>
      </div>
    </footer>
  )
}

export function K2Pill({
  children,
  active,
  href,
}: {
  children: ReactNode
  active?: boolean
  href?: string
}) {
  const className = `k2-pill${active ? ' is-active' : ''}`
  return href ? (
    <K2Link className={className} href={href}>
      {children}
    </K2Link>
  ) : (
    <span className={className}>{children}</span>
  )
}

export function K2SectionTitle({
  children,
  allLink,
}: {
  children: ReactNode
  allLink?: Link
}) {
  return (
    <div className="k2-section-title">
      <h2>{children}</h2>
      {allLink && <K2Link href={allLink.href}>{allLink.label}</K2Link>}
    </div>
  )
}

export function K2TextCover({ category }: { category: string }) {
  return (
    <div className="k2-text-cover" aria-hidden="true">
      <span>{Array.from(category)[0]}</span>
    </div>
  )
}

export function K2Hero({
  lines,
  introduction,
  children,
}: {
  lines: ReactNode[]
  introduction: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="k2-hero">
      <div>
        <h1>
          {lines.map((line, index) => (
            <span key={index}>{line}</span>
          ))}
        </h1>
        <div className="k2-introduction">{introduction}</div>
      </div>
      {children}
    </div>
  )
}

export function K2PageHeading({
  title,
  introduction,
}: {
  title: string
  introduction?: ReactNode
}) {
  return (
    <header className="k2-page-heading">
      <h1>{title}</h1>
      {introduction && (
        <div className="k2-page-introduction">{introduction}</div>
      )}
    </header>
  )
}

type ArticleProps = {
  title: string
  summary?: string
  category: string
  date: string
  href: string
}
export function K2ArticleItem({
  title,
  summary,
  category,
  date,
  href,
}: ArticleProps) {
  return (
    <article className="k2-post">
      <K2Link href={href}>
        <h3>{title}</h3>
        {summary && <p>{summary}</p>}
        <div className="k2-meta">
          <span className="k2-category">{category}</span>
          <time dateTime={date}>{date.replaceAll('-', '.')}</time>
        </div>
      </K2Link>
    </article>
  )
}

export function K2FeatureArticle({
  title,
  summary,
  category,
  date,
  href,
  minutes,
  language = 'zh',
}: ArticleProps & { minutes?: number; language?: Lang }) {
  return (
    <article className="k2-feature">
      <K2TextCover category={category} />
      <div>
        <div className="k2-meta">
          <span className="k2-category">{category}</span>
          <time dateTime={date}>{date.replaceAll('-', '.')}</time>
          {minutes !== undefined && (
            <span>
              {minutes} {language === 'zh' ? '分钟' : 'min'}
            </span>
          )}
        </div>
        <K2Link href={href}>
          <h3>{title}</h3>
        </K2Link>
        {summary && <p>{summary}</p>}
      </div>
    </article>
  )
}

type NowRow = { label: string; text: ReactNode; note?: string }
export function K2NowPanel({
  title,
  updated,
  rows,
  emptyMessage,
}: {
  title: string
  updated: string
  rows: NowRow[]
  emptyMessage: string
}) {
  return (
    <aside className="k2-now">
      <div className="k2-now-head">
        <h2>{title}</h2>
        <time dateTime={updated}>{updated.replaceAll('-', '.')}</time>
      </div>
      {rows.length ? (
        <ul>
          {rows.map((row) => (
            <li key={row.label}>
              <b>{row.label}</b>
              <span>
                <span>{row.text}</span>
                {row.note && <small>{row.note}</small>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="k2-empty">{emptyMessage}</p>
      )}
    </aside>
  )
}

// public/images/thumbs/<name>.jpg is 640px wide, <name>-280.jpg 280px (T3.5).
// Home shows 92px scaled 1.5× (design §5); Projects 260 / 200 / 320px (§4).
const HOME_THUMB_SIZES = '138px'
const DETAIL_THUMB_SIZES =
  '(max-width: 640px) 320px, (max-width: 960px) 200px, 260px'
function thumbnailSet(src: string) {
  if (!/^\/images\/thumbs\/[^/]+\.jpg$/.test(src)) return undefined
  return `${src.replace(/\.jpg$/, '-280.jpg')} 280w, ${src} 640w`
}

type ProjectProps = {
  mode: 'home' | 'detail'
  name: string
  why: string
  introduction?: string
  image: { src: string; alt: string }
  url: string
  repository?: string
  status?: string
  active?: boolean
}
export function K2ProjectItem({
  mode,
  name,
  why,
  introduction,
  image,
  url,
  repository,
  status,
  active,
}: ProjectProps) {
  const displayUrl = (href: string) =>
    href.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return (
    <li
      className={
        mode === 'home'
          ? 'k2-project k2-project-home'
          : 'k2-project k2-project-detail'
      }
    >
      <div className="k2-thumb">
        {/* Lazy everywhere: on the home page the 280px files (~10 KB each)
            arrive right after first paint instead of competing with it. */}
        <img
          src={image.src}
          srcSet={thumbnailSet(image.src)}
          sizes={mode === 'home' ? HOME_THUMB_SIZES : DETAIL_THUMB_SIZES}
          alt={image.alt}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div>
        <div className="k2-project-name">
          <h3>{name}</h3>
          {mode === 'detail' && status && (
            <K2Pill active={active}>{status}</K2Pill>
          )}
        </div>
        <p className="k2-project-why">{why}</p>
        {mode === 'detail' && introduction && (
          <p className="k2-project-introduction">{introduction}</p>
        )}
        <div className="k2-project-links">
          <a href={url}>{displayUrl(url)} ↗</a>
          {mode === 'detail' && repository && (
            <a href={repository}>{displayUrl(repository)} ↗</a>
          )}
        </div>
      </div>
    </li>
  )
}

type BookProps = {
  mode: 'home' | 'detail'
  title: string
  author: string
  status: string
  active?: boolean
  finished?: string
  note?: string
  language?: Lang
  article?: { title: string; href: string }
}
export function K2BookItem({
  mode,
  title,
  author,
  status,
  active,
  finished,
  note,
  article,
  language = 'zh',
}: BookProps) {
  return (
    <li
      className={
        mode === 'home'
          ? 'k2-book-item k2-book-home'
          : 'k2-book-item k2-book-detail'
      }
    >
      <div className="k2-book-head">
        <h3>{title}</h3>
        <span className="k2-book-author">{author}</span>
      </div>
      <div className="k2-book-side">
        {mode === 'detail' && finished && (
          <time dateTime={finished}>{finished.replace('-', '.')}</time>
        )}
        <K2Pill active={active}>{status}</K2Pill>
      </div>
      {mode === 'detail' && note && <p className="k2-book-note">{note}</p>}
      {mode === 'detail' && article && (
        <div className="k2-book-article">
          {language === 'zh' ? '写过：' : 'Wrote: '}
          <K2Link href={article.href}>{article.title}</K2Link> →
        </div>
      )}
    </li>
  )
}

export function K2BookGroup({
  title,
  count,
  reading = false,
  language,
  children,
}: {
  title: string
  count: number
  reading?: boolean
  language: Lang
  children: ReactNode
}) {
  return (
    <section className="k2-books-group">
      <h2 className={reading ? 'word' : undefined}>
        {title}{' '}
        <small>
          {count} {language === 'zh' ? '本' : count === 1 ? 'book' : 'books'}
        </small>
      </h2>
      <ul className="k2-books">{children}</ul>
    </section>
  )
}

export function K2Quote({
  children,
  source,
}: {
  children: ReactNode
  source: string
}) {
  return (
    <figure className="k2-quote">
      <blockquote>{children}</blockquote>
      <figcaption>— {source}</figcaption>
    </figure>
  )
}

export function K2ArticleLayout({ children }: { children: ReactNode }) {
  return <div className="k2-article-layout">{children}</div>
}

export function K2ArticleHeading({
  title,
  summary,
  category,
  date,
  minutes,
  backHref,
  language,
}: {
  title: string
  summary?: string
  category: Link
  date: string
  minutes?: number
  backHref: string
  language: Lang
}) {
  return (
    <header className="k2-article-head">
      <K2Link className="k2-article-back" href={backHref}>
        ← {language === 'zh' ? '全部文章' : 'All articles'}
      </K2Link>
      <div className="k2-meta">
        <K2Link className="k2-category" href={category.href}>
          {category.label}
        </K2Link>
        <time dateTime={date}>{date.replaceAll('-', '.')}</time>
        {minutes !== undefined && (
          <span>
            {minutes} {language === 'zh' ? '分钟' : 'min'}
          </span>
        )}
      </div>
      <h1>{title}</h1>
      {summary && <p className="k2-article-summary">{summary}</p>}
    </header>
  )
}

export function K2Prose({ children }: { children: ReactNode }) {
  return <div className="prose">{children}</div>
}

type TocItem = { id: string; title: string; level: 2 | 3 }
export function K2TableOfContents({
  items,
  currentId,
  language,
}: {
  items: TocItem[]
  currentId?: string
  language: Lang
}) {
  if (!items.some((item) => item.level === 2)) return null
  const label = language === 'zh' ? '目录' : 'Contents'
  const contents = (
    <ol>
      {items.map((item) => (
        <li key={item.id} className={item.level === 3 ? 'level-3' : undefined}>
          <a
            href={`#${item.id}`}
            aria-current={item.id === currentId ? 'location' : undefined}
          >
            {item.title}
          </a>
        </li>
      ))}
    </ol>
  )
  return (
    <aside className="k2-toc">
      <nav className="k2-toc-desktop" aria-label={label}>
        <span>{label}</span>
        {contents}
      </nav>
      <details className="k2-toc-mobile">
        <summary
          data-open={language === 'zh' ? '展开' : 'Expand'}
          data-close={language === 'zh' ? '收起' : 'Collapse'}
        >
          {label}
        </summary>
        <nav aria-label={label}>{contents}</nav>
      </details>
    </aside>
  )
}

export function K2ArticleEnd({
  language,
  tags,
  previous,
  next,
}: {
  language: Lang
  tags: Link[]
  previous?: { title: string; href: string }
  next?: { title: string; href: string }
}) {
  return (
    <footer className="k2-article-end">
      {tags.length > 0 && (
        <div className="k2-tags">
          {tags.map((tag) => (
            <K2Pill key={tag.href} href={tag.href}>
              {tag.label}
            </K2Pill>
          ))}
        </div>
      )}
      <nav
        className="k2-article-nav"
        aria-label={language === 'zh' ? '文章翻页' : 'Article pagination'}
      >
        {previous && (
          <K2Link rel="prev" href={previous.href}>
            <small>← {language === 'zh' ? '上一篇' : 'Previous'}</small>
            <b>{previous.title}</b>
          </K2Link>
        )}
        {next && (
          <K2Link rel="next" href={next.href}>
            <small>{language === 'zh' ? '下一篇' : 'Next'} →</small>
            <b>{next.title}</b>
          </K2Link>
        )}
      </nav>
    </footer>
  )
}
