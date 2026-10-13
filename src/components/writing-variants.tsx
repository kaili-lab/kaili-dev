import type { Language } from '#/features/routing'
import { K2ArticleItem, K2PageHeading } from '#/components/k2'

// T4.1b comparison fixtures, development-only. Variant A (links) was chosen
// (D-153) and lives in the real /$lang/writing route; this page is kept so the
// comparison screenshots in docs/notes can be reproduced.

export type Variant = 'links' | 'pills' | 'select'
export type VariantState = 'default' | 'filtered' | 'empty' | 'notice'

type Option = { slug: string; zh: string; en: string }

const categories: Option[] = [
  { slug: 'engineering', zh: '工程', en: 'Engineering' },
  { slug: 'ai', zh: 'AI', en: 'AI' },
  { slug: 'reading', zh: '读书', en: 'Reading' },
]
const tags: Option[] = [
  { slug: 'typescript', zh: 'typescript', en: 'typescript' },
  { slug: 'cloudflare', zh: 'cloudflare', en: 'cloudflare' },
  { slug: 'workflow', zh: 'workflow', en: 'workflow' },
]
const posts = [
  {
    slug: 'a',
    summaryZh:
      '冷启动、KV 一致性、Durable Object 的账单模型，以及最后每月省下的 19 美元。',
    summaryEn:
      'Cold starts, KV consistency, the Durable Object bill, and the $19 a month it saved.',
    category: 'engineering',
    tags: ['typescript', 'cloudflare'],
    zh: '把 Say Right 从 Next.js 搬到 Cloudflare Workers',
    en: 'Moving Say Right to Cloudflare Workers',
    date: '2026-08-18',
  },
  {
    slug: 'b',
    summaryZh: '先计划、小步提交、测试即契约，一年里在真实项目上的记录。',
    summaryEn: 'Plan first, commit small, treat tests as the contract.',
    category: 'ai',
    tags: ['workflow'],
    zh: '一套不会把代码库写烂的 AI 辅助开发流程',
    en: 'An AI-assisted workflow that keeps the codebase sane',
    date: '2026-07-30',
  },
  {
    slug: 'c',
    summaryZh: '所有权、边界和事务结束的位置，决定了服务是否容易理解。',
    summaryEn:
      'Ownership and where the transaction ends make a service understandable.',
    category: 'engineering',
    tags: ['typescript'],
    zh: '把边界写清楚',
    en: 'Make boundaries visible',
    date: '2026-06-02',
  },
  {
    slug: 'd',
    summaryZh: '复杂度从哪里来，以及为什么深模块比浅模块好维护。',
    summaryEn: 'Where complexity comes from, and why deep modules age better.',
    category: 'reading',
    tags: [],
    zh: '读《软件设计的哲学》',
    en: 'Reading A Philosophy of Software Design',
    date: '2026-05-11',
  },
]

const text = {
  zh: {
    title: '写作',
    category: '分类',
    tag: '标签',
    all: '全部',
    notice: '这篇文章暂无中文版',
    empty: (c: string, t: string) => `「${c}」分类下没有带「${t}」标签的文章。`,
    clear: '看全部文章 →',
    apply: '筛选',
  },
  en: {
    title: 'Writing',
    category: 'Category',
    tag: 'Tag',
    all: 'All',
    notice: "This article isn't available in English.",
    empty: (c: string, t: string) => `No articles in “${c}” are tagged “${t}”.`,
    clear: 'See all articles →',
    apply: 'Filter',
  },
}

function selection(state: VariantState) {
  if (state === 'filtered')
    return { category: 'engineering', tag: 'typescript' }
  if (state === 'empty') return { category: 'reading', tag: 'cloudflare' }
  return { category: undefined, tag: undefined }
}

function href(language: Language, category?: string, tag?: string) {
  const query = new URLSearchParams()
  if (category) query.set('category', category)
  if (tag) query.set('tag', tag)
  const search = query.toString()
  return `/${language}/writing${search ? `?${search}` : ''}`
}

type FilterProps = {
  language: Language
  label: string
  options: Option[]
  current?: string
  link: (slug?: string) => string
}

function LinkRow({ language, label, options, current, link }: FilterProps) {
  const t = text[language]
  return (
    <div className="wv-row">
      <span className="wv-label">{label}</span>
      <ul>
        {[{ slug: undefined, zh: t.all, en: t.all }, ...options].map(
          (option) => {
            const active = option.slug === current
            return (
              <li key={option.slug ?? 'all'}>
                <a
                  href={link(option.slug)}
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'is-current' : undefined}
                >
                  {option[language]}
                </a>
              </li>
            )
          },
        )}
      </ul>
    </div>
  )
}

function PillRow({ language, label, options, current, link }: FilterProps) {
  return (
    <div className="wv-row">
      <span className="wv-label">{label}</span>
      <ul>
        {options.map((option) => {
          const active = option.slug === current
          return (
            <li key={option.slug}>
              <a
                href={link(active ? undefined : option.slug)}
                aria-current={active ? 'page' : undefined}
                className={
                  active ? 'k2-pill wv-pill is-current' : 'k2-pill wv-pill'
                }
              >
                {active ? `${option[language]} ×` : option[language]}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SelectRow({
  language,
  current,
}: {
  language: Language
  current: { category?: string; tag?: string }
}) {
  const t = text[language]
  return (
    <form className="wv-select" method="get" action={`/${language}/writing`}>
      <label>
        <span className="wv-label">{t.category}</span>
        <select name="category" defaultValue={current.category ?? ''}>
          <option value="">{t.all}</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c[language]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="wv-label">{t.tag}</span>
        <select name="tag" defaultValue={current.tag ?? ''}>
          <option value="">{t.all}</option>
          {tags.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c[language]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit">{t.apply}</button>
    </form>
  )
}

// Spelled out in full so Tailwind's class scanner and the linter can see them.
const rootClass = {
  links: 'wv-links',
  pills: 'wv-pills',
  select: 'wv-select-variant',
}
const noticeClass = {
  links: 'wv-notice wv-notice-heading',
  pills: 'wv-notice wv-notice-panel',
  select: 'wv-notice',
}
const emptyClass = {
  links: 'wv-empty wv-empty-rule',
  pills: 'wv-empty wv-empty-panel',
  select: 'wv-empty wv-empty-inline',
}

export function WritingVariant({
  variant,
  state,
  language,
}: {
  variant: Variant
  state: VariantState
  language: Language
}) {
  const t = text[language]
  const current = selection(state)
  const shown = posts.filter(
    (post) =>
      (!current.category || post.category === current.category) &&
      (!current.tag || post.tags.includes(current.tag)),
  )
  const label = (list: Option[], slug?: string) =>
    list.find((o) => o.slug === slug)?.[language] ?? ''
  const notice =
    state === 'notice' ? (
      <p role="status" className={noticeClass[variant]}>
        {t.notice}
      </p>
    ) : null
  const filters =
    variant === 'select' ? (
      <SelectRow language={language} current={current} />
    ) : (
      <div className="wv-filters">
        {(variant === 'links' ? LinkRow : PillRow)({
          language,
          label: t.category,
          options: categories,
          current: current.category,
          link: (slug) => href(language, slug, current.tag),
        })}
        {(variant === 'links' ? LinkRow : PillRow)({
          language,
          label: t.tag,
          options: tags,
          current: current.tag,
          link: (slug) => href(language, current.category, slug),
        })}
      </div>
    )
  return (
    <div className={rootClass[variant]}>
      <K2PageHeading title={t.title} />
      {variant === 'links' && notice}
      {variant === 'select' ? (
        <div className="wv-toolbar">
          {filters}
          {notice}
        </div>
      ) : (
        filters
      )}
      {variant === 'pills' && notice}
      {shown.length > 0 ? (
        <div className="wv-list">
          {shown.map((post) => (
            <K2ArticleItem
              key={post.slug}
              title={post[language]}
              summary={language === 'zh' ? post.summaryZh : post.summaryEn}
              category={label(categories, post.category)}
              date={post.date}
              href={`/${language}/writing/${post.slug}`}
            />
          ))}
        </div>
      ) : (
        <div className={emptyClass[variant]}>
          <p>
            {t.empty(
              label(categories, current.category),
              label(tags, current.tag),
            )}
          </p>
          <a href={href(language)}>{t.clear}</a>
        </div>
      )}
    </div>
  )
}
