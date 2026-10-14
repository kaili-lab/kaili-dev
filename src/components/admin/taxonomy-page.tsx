import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'

import {
  removeTaxonomyEntry,
  saveTaxonomyEntry,
  type loadTaxonomy,
} from '#/features/admin.functions'
import { ConfirmDialog, FormDialog } from '#/components/admin/dialogs'
import { ListLayout, Pager } from '#/components/admin/list-page'

type Kind = 'categories' | 'tags'
type TaxonomyPageData = Awaited<ReturnType<typeof loadTaxonomy>>
type Row = TaxonomyPageData['items'][number]

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
  data: TaxonomyPageData
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  )

  async function remove(row: Row) {
    setDeleting(null)
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
    <ListLayout
      head={
        <>
          <div className="ad-page-head">
            <h1>分类与标签</h1>
            <button
              type="button"
              className="ui-button ad-primary"
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
                search={{ tab: kind === 'tags' ? kind : undefined }}
                role="tab"
                aria-selected={kind === tab}
                className={kind === tab ? 'ad-tab is-active' : 'ad-tab'}
              >
                {kindName[kind]}（{data.counts[kind]}）
              </Link>
            ))}
          </div>
          {message ? (
            <p
              role={message.ok ? 'status' : 'alert'}
              className={
                message.ok ? 'ad-feedback ad-ok' : 'ad-feedback ad-error'
              }
            >
              {message.text}
            </p>
          ) : null}
        </>
      }
      footer={<Pager page={data} unit="个" />}
    >
      <table className="ad-table">
        <thead>
          <tr>
            <th scope="col">中文名</th>
            <th scope="col">英文名</th>
            <th scope="col">slug</th>
            <th scope="col">引用</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {data.items.length === 0 ? (
            <tr>
              <td colSpan={5} className="ad-table-empty">
                还没有{kindName[tab]}。
              </td>
            </tr>
          ) : (
            data.items.map((row) => (
              <tr key={row.slug}>
                <td className="ad-cell-title" data-label="中文名">
                  {row.zh}
                </td>
                <td data-label="英文名">{row.en}</td>
                <td data-label="slug" className="ad-time">
                  {row.slug}
                </td>
                <td data-label="引用">{row.references}</td>
                <td data-label="操作">
                  <div className="ad-cell-actions">
                    <button
                      type="button"
                      className="ad-link-button"
                      aria-label={`编辑「${row.zh}」`}
                      onClick={() => setEditing(row)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="ad-link-button ad-danger-text"
                      aria-label={`删除「${row.zh}」`}
                      disabled={row.references > 0}
                      onClick={() => setDeleting(row)}
                    >
                      删除
                    </button>
                    {row.references > 0 ? (
                      <span className="ad-muted">
                        有 {row.references} 篇文章引用，不能删除
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
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
      <ConfirmDialog
        open={deleting !== null}
        title={`删除${kindName[tab]}「${deleting?.zh ?? ''}」？`}
        description="此操作不能撤销。"
        confirm="删除"
        onConfirm={() => deleting && void remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </ListLayout>
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
    <FormDialog
      title={title}
      submit="保存"
      onSubmit={() => void save()}
      onClose={onClose}
    >
      {row?.published ? (
        <p className="ad-dialog-text">
          改名会立即显示在所有已发布文章上（D-160）；slug
          已被已发布文章使用，不能修改。
        </p>
      ) : row ? (
        <p className="ad-dialog-text">
          改名会立即显示在所有已发布文章上（D-160）。
        </p>
      ) : null}
      <TaxonomyFields
        entry={entry}
        setEntry={setEntry}
        slugLocked={row?.published}
      />
      {errors.length > 0 ? (
        <p role="alert" className="ad-feedback ad-error">
          {errors.join('；')}
        </p>
      ) : null}
    </FormDialog>
  )
}

/** 中文名 / 英文名 / slug, shared by this page and the editor's new-category dialog. */
export function TaxonomyFields({
  entry,
  setEntry,
  slugLocked,
}: {
  entry: { zh: string; en: string; slug: string }
  setEntry: (entry: { zh: string; en: string; slug: string }) => void
  slugLocked?: boolean
}) {
  return (
    <>
      <label className="ad-field">
        <span>中文名</span>
        <input
          className="ui-input"
          value={entry.zh}
          onChange={(event) => setEntry({ ...entry, zh: event.target.value })}
        />
      </label>
      <label className="ad-field">
        <span>英文名</span>
        <input
          className="ui-input"
          value={entry.en}
          onChange={(event) => setEntry({ ...entry, en: event.target.value })}
        />
      </label>
      <label className="ad-field">
        <span>slug</span>
        <input
          className="ui-input"
          value={entry.slug}
          readOnly={slugLocked}
          onChange={(event) => setEntry({ ...entry, slug: event.target.value })}
        />
      </label>
    </>
  )
}
