import { useEffect, useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'

import {
  removeTaxonomyEntry,
  saveTaxonomyEntry,
} from '#/features/admin.functions'

type Kind = 'categories' | 'tags'
type Row = {
  slug: string
  zh: string
  en: string
  references: number
  published: boolean
}

const kindName = { categories: '分类', tags: '标签' }
const errorText: Record<string, string> = {
  'zh-required': '请填写中文名',
  'en-required': '请填写英文名',
  'slug-format':
    'slug 只能用小写字母、数字和连字符（1–80 个字符，不以连字符开头或结尾）',
  'slug-taken': '同类中已有相同 slug',
  'slug-locked': '已发布文章在用，slug 不能修改',
}

export function TaxonomyPage({
  tab,
  data,
}: {
  tab: Kind
  data: Record<Kind, Row[]>
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  )
  const rows = data[tab]

  async function remove(row: Row) {
    if (!window.confirm(`删除${kindName[tab]}「${row.zh}」？此操作不能撤销。`))
      return
    try {
      const result = await removeTaxonomyEntry({
        data: { kind: tab, slug: row.slug },
      })
      setMessage(
        result.ok
          ? { ok: true, text: '已删除' }
          : { ok: false, text: `有 ${result.references} 篇文章引用，不能删除` },
      )
      await router.invalidate()
    } catch {
      setMessage({ ok: false, text: '无法确认删除结果，请刷新查看当前状态' })
    }
  }

  return (
    <section className="ad-page">
      <div className="ad-page-head">
        <h1>分类与标签</h1>
        <button
          type="button"
          className="ui-button"
          onClick={() => setEditing('new')}
        >
          新建{kindName[tab]}
        </button>
      </div>
      <div role="tablist" aria-label="分类与标签" className="ad-tabs">
        {(['categories', 'tags'] as const).map((kind) => (
          <Link
            key={kind}
            to="/admin/taxonomy"
            search={{ tab: kind }}
            role="tab"
            aria-selected={kind === tab}
            className={kind === tab ? 'ad-tab is-active' : 'ad-tab'}
          >
            {kindName[kind]}
          </Link>
        ))}
      </div>
      {message ? (
        <p
          role={message.ok ? 'status' : 'alert'}
          className={message.ok ? 'ad-feedback ad-ok' : 'ad-feedback ad-error'}
        >
          {message.text}
        </p>
      ) : null}
      <ul className="ad-stack ad-taxonomy">
        {rows.map((row) => (
          <li key={row.slug}>
            <strong>{row.zh}</strong> <span>{row.en}</span>
            <div className="ad-stack-meta">
              <span className="ad-time">{row.slug}</span>
              <span>引用 {row.references}</span>
              <button
                type="button"
                className="ui-button"
                onClick={() => setEditing(row)}
              >
                编辑
              </button>
              <button
                type="button"
                className="ui-button"
                disabled={row.references > 0}
                onClick={() => void remove(row)}
              >
                删除
              </button>
              {row.references > 0 ? (
                <span className="ad-muted">
                  有 {row.references} 篇文章引用，不能删除
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {editing ? (
        <TaxonomyDialog
          kind={tab}
          row={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            setMessage({ ok: true, text: '已保存' })
            await router.invalidate()
          }}
        />
      ) : null}
    </section>
  )
}

function TaxonomyDialog({
  kind,
  row,
  onClose,
  onSaved,
}: {
  kind: Kind
  row?: Row
  onClose: () => void
  onSaved: () => void
}) {
  const [entry, setEntry] = useState({
    zh: row?.zh ?? '',
    en: row?.en ?? '',
    slug: row?.slug ?? '',
  })
  const [errors, setErrors] = useState<string[]>([])
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => first.current?.focus(), [])
  async function save() {
    try {
      const result = await saveTaxonomyEntry({
        data: { kind, entry, previousSlug: row?.slug },
      })
      if (result.ok) onSaved()
      else setErrors(result.errors.map((error) => errorText[error] ?? error))
    } catch {
      setErrors(['无法确认保存结果，请刷新查看当前状态'])
    }
  }
  const title = `${row ? '编辑' : '新建'}${kindName[kind]}`
  return (
    <div className="ad-dialog-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="taxonomy-dialog"
        className="ad-dialog"
      >
        <h2 id="taxonomy-dialog">{title}</h2>
        {row?.published ? (
          <p className="ad-muted">
            改名会立即显示在所有已发布文章上（D-160）；slug
            已被已发布文章使用，不能修改。
          </p>
        ) : row ? (
          <p className="ad-muted">
            改名会立即显示在所有已发布文章上（D-160）。
          </p>
        ) : null}
        <label>
          <span>中文名</span>
          <input
            ref={first}
            className="ui-input"
            value={entry.zh}
            onChange={(event) => setEntry({ ...entry, zh: event.target.value })}
          />
        </label>
        <label>
          <span>英文名</span>
          <input
            className="ui-input"
            value={entry.en}
            onChange={(event) => setEntry({ ...entry, en: event.target.value })}
          />
        </label>
        <label>
          <span>slug</span>
          <input
            className="ui-input"
            value={entry.slug}
            readOnly={row?.published}
            onChange={(event) =>
              setEntry({ ...entry, slug: event.target.value })
            }
          />
        </label>
        {errors.length > 0 ? (
          <p role="alert" className="ad-feedback ad-error">
            {errors.join('；')}
          </p>
        ) : null}
        <div className="ad-buttons">
          <button
            type="button"
            className="ui-button ad-primary"
            onClick={() => void save()}
          >
            保存
          </button>
          <button type="button" className="ui-button" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
