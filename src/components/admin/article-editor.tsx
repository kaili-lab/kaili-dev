import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'

import type { Language } from '#/features/article-versions'
import {
  publishAdminArticle,
  saveAdminArticle,
  saveTaxonomyEntry,
  type CommitError,
  type EditorView,
} from '#/features/admin.functions'
import { AdminState, stateLabel } from '#/components/admin/admin-shell'
import { FormDialog, useLeaveGuard } from '#/components/admin/dialogs'
import { lastPostsSearch } from '#/components/admin/list-page'
import { MarkdownField } from '#/components/admin/markdown-editor'
import { TaxonomyFields } from '#/components/admin/taxonomy-page'

type Content = { title: string; summary: string; body: string }
type Shared = { slug: string; category: string; tags: string[] }
type Feedback =
  | { kind: 'saved' | 'published'; at: string; language: Language }
  | { kind: 'rejected'; operation: 'save' | 'publish'; errors: string[] }
  | { kind: 'unknown'; operation: 'save' | 'publish' }

const languages: Language[] = ['zh', 'en']
const languageName = { zh: '中文', en: 'English' }

const errorText: Record<CommitError, string> = {
  'category-required': '请选择分类',
  'title-required': '缺少标题',
  'summary-required': '缺少摘要',
  'body-required': '缺少正文',
  'slug-required': '缺少 slug',
  'slug-format':
    'slug 只能用小写字母、数字和连字符（1–80 个字符，不以连字符开头或结尾）',
  'slug-taken': 'slug 已被其他文章使用',
  'slug-locked': '已发布后 slug 不能修改',
  'category-unknown': '分类不存在，请重新选择',
  'tag-unknown': '标签不存在，请刷新后重新选择',
}
const errorField: Record<CommitError, string> = {
  'category-required': 'category',
  'title-required': 'title',
  'summary-required': 'summary',
  'body-required': 'body',
  'slug-required': 'slug',
  'slug-format': 'slug',
  'slug-taken': 'slug',
  'slug-locked': 'slug',
  'category-unknown': 'category',
  'tag-unknown': 'tags',
}

const contentOf = (view: EditorView, language: Language): Content => {
  const draft = view.article[language].draft
  return {
    title: draft?.title ?? '',
    summary: draft?.summary ?? '',
    body: draft?.body ?? '',
  }
}
const sharedOf = (view: EditorView): Shared => ({
  slug: view.article.slug ?? '',
  category: view.article.category ?? '',
  tags: [...view.article.tags],
})
const sameContent = (left: Content, right: Content) =>
  left.title === right.title &&
  left.summary === right.summary &&
  left.body === right.body
const sameShared = (left: Shared, right: Shared) =>
  left.slug === right.slug &&
  left.category === right.category &&
  [...left.tags].sort().join() === [...right.tags].sort().join()
// A new article's first commit navigates to /admin/posts/<id>, which mounts
// a fresh editor. Unsaved edits in the other tab ride along here (client only).
let carried: {
  id: string
  contents: Record<Language, Content>
  shared: Shared
  ideaIds: string[]
} | null = null

// Fixed zone so a server-rendered message matches the browser (hydration).
const clock = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const time = () => clock.format(new Date())

export function ArticleEditor({
  initial,
  language,
  done,
}: {
  initial: EditorView
  language: Language
  /** Feedback carried over the redirect after a new article's first commit. */
  done?: 'save' | 'publish'
}) {
  const navigate = useNavigate()
  const [view, setView] = useState(initial)
  const [baseline, setBaseline] = useState(() => ({
    zh: contentOf(initial, 'zh'),
    en: contentOf(initial, 'en'),
    shared: sharedOf(initial),
    ideaIds: initial.references.map((idea) => idea.id),
  }))
  // Local state carried over a new article's first redirect, if any.
  const [restored] = useState(() => {
    const kept = carried && carried.id === initial.id ? carried : null
    carried = null
    return kept
  })
  const [contents, setContents] = useState(
    () => restored?.contents ?? { zh: baseline.zh, en: baseline.en },
  )
  const [shared, setShared] = useState(
    () => restored?.shared ?? baseline.shared,
  )
  const [ideaIds, setIdeaIds] = useState(
    () => restored?.ideaIds ?? baseline.ideaIds,
  )
  const [feedback, setFeedback] = useState<Feedback | null>(() =>
    done
      ? { kind: done === 'save' ? 'saved' : 'published', at: time(), language }
      : null,
  )
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [newCategory, setNewCategory] = useState(false)
  const [compare, setCompare] = useState(false)
  // Narrow screens fold the sidebar behind 文章设置 (D-163 ③).
  const [settingsOpen, setSettingsOpen] = useState(false)
  const leaving = useRef(false)
  // Latest edits, read after an await (the closure would hold stale ones).
  const latest = useRef({ contents, shared, ideaIds })
  useEffect(() => {
    latest.current = { contents, shared, ideaIds }
  }, [contents, shared, ideaIds])

  // Drop the one-off `done` flag from the address once shown.
  useEffect(() => {
    if (done)
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({
          ...previous,
          done: undefined,
        }),
        replace: true,
      })
  }, [done, navigate])

  const content = contents[language]
  const dirty = {
    zh: !sameContent(contents.zh, baseline.zh),
    en: !sameContent(contents.en, baseline.en),
    shared: !sameShared(shared, baseline.shared),
    refs: ideaIds.join() !== baseline.ideaIds.join(),
  }
  const anyDirty = dirty.zh || dirty.en || dirty.shared || dirty.refs

  // D-038: warn before leaving with unsaved work; switching tabs is not leaving.
  const leaveDialog = useLeaveGuard(anyDirty, { leaving })

  const setField = (field: keyof Content, value: string) =>
    setContents((previous) => ({
      ...previous,
      [language]: { ...previous[language], [field]: value },
    }))

  async function run(operation: 'save' | 'publish') {
    setBusy(operation)
    setFeedback(null)
    setFieldErrors({})
    // What this request commits; edits made while it is in flight stay local
    // and keep their unsaved marks.
    const submitted = {
      language,
      content: { ...content },
      shared: { ...shared, tags: [...shared.tags] },
      ideaIds: [...ideaIds],
    }
    try {
      const request = {
        id: view.id,
        ideaIds: submitted.ideaIds,
        input: {
          language: submitted.language,
          content: { ...submitted.content, images: [] },
          slug: submitted.shared.slug === '' ? null : submitted.shared.slug,
          category:
            submitted.shared.category === '' ? null : submitted.shared.category,
          tags: submitted.shared.tags,
        },
      }
      const result = await (
        operation === 'save' ? saveAdminArticle : publishAdminArticle
      )({
        data: request,
      })
      if (!result.ok) {
        setFeedback({
          kind: 'rejected',
          operation,
          errors: result.errors.map((error) => errorText[error]),
        })
        setFieldErrors(
          Object.fromEntries(
            result.errors.map((error) => [errorField[error], errorText[error]]),
          ),
        )
        const first = result.errors[0]
        if (
          result.errors.some((error) =>
            ['category', 'tags', 'slug'].includes(errorField[error]),
          )
        )
          setSettingsOpen(true)
        if (first)
          // After the sidebar has been unfolded (narrow screens).
          requestAnimationFrame(() =>
            document.getElementById(`field-${errorField[first]}`)?.focus(),
          )
        return
      }
      const next = result.view
      setView(next)
      // A first publish locks the slug at the value actually published; a
      // different slug typed meanwhile could never be saved (D-155 ⑥).
      if (next.slugLocked && !view.slugLocked)
        setShared((current) => ({
          ...current,
          slug: next.article.slug ?? current.slug,
        }))
      // Only what was submitted is now saved; the other tab keeps its edits.
      setBaseline((previous) => ({
        ...previous,
        [submitted.language]: submitted.content,
        shared: submitted.shared,
        ideaIds: submitted.ideaIds,
      }))
      setFeedback({
        kind: operation === 'save' ? 'saved' : 'published',
        at: time(),
        language: submitted.language,
      })
      if (view.id === null && next.id) {
        const local = latest.current
        carried = {
          id: next.id,
          ...local,
          // The ref predates the slug alignment above; apply it here too.
          shared: next.slugLocked
            ? { ...local.shared, slug: next.article.slug ?? local.shared.slug }
            : local.shared,
        }
        leaving.current = true
        await navigate({
          to: '/admin/posts/$id',
          params: { id: next.id },
          search: { lang: submitted.language, done: operation },
          replace: true,
        })
        leaving.current = false
      }
    } catch {
      // D-160 ②: no answer means the outcome is unknown.
      setFeedback({ kind: 'unknown', operation })
    } finally {
      setBusy(null)
    }
  }

  const publishedLanguages = languages.filter(
    (item) => view.article[item].published,
  )
  const attached = ideaIds
    .map((id) => view.ideas.find((idea) => idea.id === id))
    .filter((idea) => idea !== undefined)
  const available = view.ideas.filter((idea) => !ideaIds.includes(idea.id))

  const other: Language = language === 'zh' ? 'en' : 'zh'
  const otherContent = contents[other]
  const heading =
    content.title.trim() ||
    contents.zh.title.trim() ||
    contents.en.title.trim() ||
    '（无标题）'

  return (
    <section className="ad-editor">
      <div className="ad-toolbar">
        <Link to="/admin/posts" search={lastPostsSearch()} className="ad-back">
          ← 文章
        </Link>
        <span className="ad-toolbar-title">{heading}</span>
        {anyDirty ? <span className="ad-dirty">• 有未保存修改</span> : null}
        <span className="ad-toolbar-gap" />
        <FeedbackLine feedback={feedback} />
        <button
          type="button"
          className="ui-button ad-settings-toggle"
          aria-expanded={settingsOpen}
          aria-controls="editor-sidebar"
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          {settingsOpen ? '收起设置' : '文章设置'}
        </button>
        <div className="ad-buttons">
          <button
            type="button"
            className="ui-button"
            disabled={busy !== null}
            onClick={() => void run('save')}
          >
            {busy === 'save' ? '保存中…' : '保存'}
          </button>
          <button
            type="button"
            className="ui-button ad-primary"
            disabled={busy !== null}
            onClick={() => void run('publish')}
          >
            {busy === 'publish'
              ? '发布中…'
              : language === 'zh'
                ? '发布中文'
                : '发布英文'}
          </button>
        </div>
      </div>

      <div className="ad-editor-grid">
        <div className="ad-editor-main">
          <div className="ad-langbar">
            <div role="tablist" aria-label="语言" className="ad-tabs">
              {languages.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={item === language}
                  className={item === language ? 'ad-tab is-active' : 'ad-tab'}
                  onClick={() => {
                    void navigate({
                      to: '.',
                      search: (previous: Record<string, unknown>) => ({
                        ...previous,
                        lang: item,
                      }),
                      replace: true,
                    })
                  }}
                >
                  {languageName[item]} · {stateLabel(view.states[item])}
                  {dirty[item] ? ' •' : ''}
                  {dirty[item] ? (
                    <span className="ad-sr">有未保存修改</span>
                  ) : null}
                </button>
              ))}
            </div>
            <label className="ad-check">
              <input
                type="checkbox"
                checked={compare}
                onChange={(event) => setCompare(event.target.checked)}
              />
              对照{languageName[other]}
            </label>
          </div>

          <div className={compare ? 'ad-compare is-on' : 'ad-compare'}>
            <div className="ad-content">
              <label className="ad-field">
                <span>标题</span>
                <input
                  id="field-title"
                  className="ui-input"
                  value={content.title}
                  onChange={(event) => setField('title', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.title)}
                />
                {fieldErrors.title ? (
                  <small className="ad-field-error">{fieldErrors.title}</small>
                ) : null}
              </label>
              <label className="ad-field">
                <span>摘要</span>
                <input
                  id="field-summary"
                  className="ui-input"
                  value={content.summary}
                  onChange={(event) => setField('summary', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.summary)}
                />
                {fieldErrors.summary ? (
                  <small className="ad-field-error">
                    {fieldErrors.summary}
                  </small>
                ) : null}
              </label>
              <div id="field-body" tabIndex={-1}>
                {fieldErrors.body ? (
                  <small className="ad-field-error">{fieldErrors.body}</small>
                ) : null}
                <MarkdownField
                  key={language}
                  heading="正文"
                  label={`${languageName[language]}正文`}
                  value={content.body}
                  onChange={(value) => setField('body', value)}
                  split
                />
              </div>
            </div>
            {compare ? (
              <aside
                className="ad-reference-copy"
                aria-label={`${languageName[other]}（只读）`}
              >
                <p className="ad-muted">
                  {languageName[other]} · {stateLabel(view.states[other])}
                  （只读）
                </p>
                {otherContent.title ||
                otherContent.summary ||
                otherContent.body ? (
                  <>
                    <p className="ad-reference-title">
                      {otherContent.title || '（无标题）'}
                    </p>
                    <p className="ad-reference-summary">
                      {otherContent.summary}
                    </p>
                    <pre className="ad-reference-body">{otherContent.body}</pre>
                  </>
                ) : (
                  <p className="ad-muted">这个语言还没有内容。</p>
                )}
              </aside>
            ) : null}
          </div>
        </div>

        <div
          id="editor-sidebar"
          className={settingsOpen ? 'ad-sidebar is-open' : 'ad-sidebar'}
        >
          <section className="ad-panel" aria-labelledby="panel-publish">
            <h2 id="panel-publish">发布</h2>
            {languages.map((item) => {
              const date = view.article[item].published?.publishedAt.slice(
                0,
                10,
              )
              return (
                <p key={item} className="ad-publish-row">
                  <span className="ad-muted">{languageName[item]}</span>
                  <span>
                    <AdminState state={view.states[item]} />
                    {date ? (
                      <span className="ad-time ad-publish-date">
                        首次发布 {date}
                      </span>
                    ) : null}
                  </span>
                </p>
              )
            })}
            <p className="ad-muted">
              「保存」不改变公开页面；「发布」只发布{languageName[language]}。
            </p>
            {publishedLanguages.includes(language) && view.article.slug ? (
              <a
                href={`/${language}/writing/${view.article.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                查看公开页 ↗
              </a>
            ) : null}
          </section>

          <fieldset className="ad-panel ad-shared">
            <legend>
              共享信息{dirty.shared ? ' •' : ''}
              {dirty.shared ? (
                <span className="ad-sr"> 有未保存修改</span>
              ) : null}
            </legend>
            <label className="ad-field">
              <span>分类（必填）</span>
              <span className="ad-inline">
                <select
                  id="field-category"
                  className="ui-input"
                  value={shared.category}
                  onChange={(event) =>
                    setShared({ ...shared, category: event.target.value })
                  }
                  aria-invalid={Boolean(fieldErrors.category)}
                >
                  <option value="">请选择</option>
                  {view.categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.zh}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ui-button"
                  onClick={() => setNewCategory(true)}
                >
                  新建分类
                </button>
              </span>
              {fieldErrors.category ? (
                <small className="ad-field-error">{fieldErrors.category}</small>
              ) : null}
            </label>
            <div
              id="field-tags"
              tabIndex={-1}
              className="ad-tags"
              role="group"
              aria-label="标签"
            >
              <span>标签</span>
              {view.tags.map((tag) => (
                <label key={tag.slug}>
                  <input
                    type="checkbox"
                    checked={shared.tags.includes(tag.slug)}
                    onChange={(event) =>
                      setShared({
                        ...shared,
                        tags: event.target.checked
                          ? [...shared.tags, tag.slug]
                          : shared.tags.filter((item) => item !== tag.slug),
                      })
                    }
                  />{' '}
                  {tag.zh}
                </label>
              ))}
              {fieldErrors.tags ? (
                <small className="ad-field-error">{fieldErrors.tags}</small>
              ) : null}
            </div>
            <label className="ad-field">
              <span>slug</span>
              <input
                id="field-slug"
                className="ui-input"
                value={shared.slug}
                readOnly={view.slugLocked}
                onChange={(event) =>
                  setShared({ ...shared, slug: event.target.value })
                }
                aria-invalid={Boolean(fieldErrors.slug)}
              />
              <small className="ad-muted">
                {view.slugLocked
                  ? '已发布后锁定'
                  : '小写字母、数字和连字符；发布前必填'}
              </small>
              {fieldErrors.slug ? (
                <small className="ad-field-error">{fieldErrors.slug}</small>
              ) : null}
            </label>
          </fieldset>

          <section
            className="ad-panel ad-references"
            aria-labelledby="panel-refs"
          >
            <h2 id="panel-refs">
              参考资料（Idea · {attached.length}）{dirty.refs ? ' •' : ''}
            </h2>
            {attached.length === 0 ? (
              <p className="ad-muted">还没有关联 Idea。</p>
            ) : (
              <ul className="ad-refs">
                {attached.map((idea) => (
                  <li key={idea.id}>
                    <details>
                      <summary>{idea.text.split('\n')[0]}</summary>
                      <p>{idea.text}</p>
                    </details>
                    <span className="ad-ref-actions">
                      <a
                        href={`/admin/ideas/${idea.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        打开 ↗
                      </a>
                      <button
                        type="button"
                        className="ad-link-button ad-danger-text"
                        onClick={() =>
                          setIdeaIds(ideaIds.filter((id) => id !== idea.id))
                        }
                      >
                        移除
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {available.length > 0 ? (
              <AddIdea
                ideas={available}
                onAdd={(id) => setIdeaIds([...ideaIds, id])}
              />
            ) : (
              <p className="ad-muted">没有可添加的 Idea。</p>
            )}
          </section>
        </div>
      </div>

      {newCategory ? (
        <CategoryDialog
          onClose={() => setNewCategory(false)}
          onCreated={(entry) => {
            setView({ ...view, categories: [...view.categories, entry] })
            setShared({ ...shared, category: entry.slug })
            setNewCategory(false)
          }}
        />
      ) : null}
      {leaveDialog}
    </section>
  )
}

function FeedbackLine({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null
  if (feedback.kind === 'saved')
    return (
      <p role="status" className="ad-feedback ad-ok">
        已保存 {feedback.at}
      </p>
    )
  if (feedback.kind === 'published')
    return (
      <p role="status" className="ad-feedback ad-ok">
        {feedback.language === 'zh' ? '中文版' : '英文版'}已发布 {feedback.at}
      </p>
    )
  if (feedback.kind === 'rejected')
    return (
      <p role="alert" className="ad-feedback ad-error">
        {feedback.operation === 'save'
          ? '保存失败：'
          : '发布失败，公开内容未改变：'}
        {feedback.errors.join('；')}
      </p>
    )
  if (feedback.kind !== 'unknown') return null
  return (
    <p role="alert" className="ad-feedback ad-error">
      {feedback.operation === 'save' ? '无法确认保存结果' : '无法确认发布结果'}
      ，请刷新查看当前状态；编辑内容仍保留在编辑器中
    </p>
  )
}

function AddIdea({
  ideas,
  onAdd,
}: {
  ideas: { id: string; text: string }[]
  onAdd: (id: string) => void
}) {
  const [choice, setChoice] = useState(ideas[0]?.id ?? '')
  const current = useMemo(
    () =>
      ideas.some((idea) => idea.id === choice) ? choice : (ideas[0]?.id ?? ''),
    [ideas, choice],
  )
  return (
    <span className="ad-inline">
      <select
        className="ui-input"
        aria-label="选择 Idea"
        value={current}
        onChange={(event) => setChoice(event.target.value)}
      >
        {ideas.map((idea) => (
          <option key={idea.id} value={idea.id}>
            {idea.text.slice(0, 40)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="ui-button"
        onClick={() => current && onAdd(current)}
      >
        添加 Idea
      </button>
    </span>
  )
}

const taxonomyErrorText: Record<string, string> = {
  'zh-required': '请填写中文名',
  'en-required': '请填写英文名',
  'slug-format':
    'slug 只能用小写字母、数字和连字符（1–80 个字符，不以连字符开头或结尾）',
  'slug-taken': '已有相同 slug 的分类',
  'slug-locked': '已发布文章在用，slug 不能修改',
}

function CategoryDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (entry: { slug: string; zh: string; en: string }) => void
}) {
  const [entry, setEntry] = useState({ zh: '', en: '', slug: '' })
  const [errors, setErrors] = useState<string[]>([])
  async function create() {
    try {
      const result = await saveTaxonomyEntry({
        data: { kind: 'categories', entry },
      })
      if (result.ok) onCreated(result.entry)
      else
        setErrors(
          result.errors.map((error) => taxonomyErrorText[error] ?? error),
        )
    } catch {
      setErrors(['无法确认是否已创建，请刷新查看'])
    }
  }
  return (
    <FormDialog
      title="新建分类"
      submit="创建并选中"
      onSubmit={() => void create()}
      onClose={onClose}
    >
      <TaxonomyFields entry={entry} setEntry={setEntry} />
      {errors.length > 0 ? (
        <p role="alert" className="ad-feedback ad-error">
          {errors.join('；')}
        </p>
      ) : null}
    </FormDialog>
  )
}
