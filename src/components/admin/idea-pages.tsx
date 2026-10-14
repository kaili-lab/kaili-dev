import { useRef, useState } from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'

import {
  removeIdea,
  saveIdea,
  type listIdeas,
} from '#/features/admin.functions'
import { ConfirmDialog, useLeaveGuard } from '#/components/admin/dialogs'
import { ListLayout, Pager } from '#/components/admin/list-page'
import { MarkdownField } from '#/components/admin/markdown-editor'

type IdeaPage = Awaited<ReturnType<typeof listIdeas>>
type Idea = IdeaPage['items'][number]

const deleteTitle = '永久删除这条 Idea？'
const deleteMessage =
  '挂在文章里的参考资料关系也会删除，文章本身和已发布内容不受影响。此操作不能撤销。'
const unknownMessage =
  '无法确认保存结果，请刷新查看当前状态；内容仍保留在输入框中'
const stamp = (iso: string) => iso.slice(0, 16).replace('T', ' ')

export function IdeaList({ list, q }: { list: IdeaPage; q?: string }) {
  const router = useRouter()
  const navigate = useNavigate({ from: '/admin/ideas/' })
  const [text, setText] = useState('')
  // The box follows the address: back / forward restore the search text too.
  const [query, setQuery] = useState(q ?? '')
  const [shownQ, setShownQ] = useState(q)
  if (q !== shownQ) {
    setShownQ(q)
    setQuery(q ?? '')
  }
  const [deleting, setDeleting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  )
  const leaveDialog = useLeaveGuard(text.trim() !== '')

  async function save() {
    const submitted = text
    try {
      const result = await saveIdea({ data: { id: null, text: submitted } })
      if (!result.ok) return setMessage({ ok: false, text: '请输入内容' })
      // Keep anything typed while the request was in flight.
      setText((current) => (current === submitted ? '' : current))
      setMessage({ ok: true, text: '已保存' })
      // The new Idea is first in the list: clear the search, go to page 1.
      setQuery('')
      await navigate({ search: {}, replace: true })
      await router.invalidate()
    } catch {
      setMessage({ ok: false, text: unknownMessage })
    }
  }
  async function remove(id: string) {
    setDeleting(null)
    try {
      await removeIdea({ data: { id } })
      setMessage({ ok: true, text: '已删除' })
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
            <h1>Idea</h1>
            <span className="ad-count">{list.all} 条</span>
          </div>
          <div className="ad-quick">
            <MarkdownField
              label="新 Idea"
              value={text}
              onChange={setText}
              minHeight="72px"
              maxHeight="160px"
              onSubmit={() => void save()}
              actions={
                <button
                  type="button"
                  className="ui-button ad-primary"
                  onClick={() => void save()}
                >
                  保存
                </button>
              }
            />
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
          </div>
          <div className="ad-filters">
            <input
              className="ui-input ad-search"
              type="search"
              aria-label="搜索 Idea"
              placeholder="搜索 Idea"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                void navigate({
                  search: { q: event.target.value || undefined },
                  replace: true,
                })
              }}
            />
          </div>
        </>
      }
      footer={<Pager page={list} unit="条" />}
    >
      <table className="ad-table">
        <thead>
          <tr>
            <th scope="col">内容</th>
            <th scope="col">关联文章</th>
            <th scope="col">更新时间</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          {list.items.length === 0 ? (
            <tr>
              <td colSpan={4} className="ad-table-empty">
                {q ? '没有符合条件的 Idea。' : '还没有 Idea。'}
              </td>
            </tr>
          ) : (
            list.items.map((idea) => (
              <tr key={idea.id}>
                <td data-label="内容" className="ad-cell-idea">
                  <Link
                    className="ad-idea-link"
                    to="/admin/ideas/$id"
                    params={{ id: idea.id }}
                    search={{ mode: undefined }}
                  >
                    {idea.text.replace(/\s+/g, ' ').trim()}
                  </Link>
                </td>
                <td data-label="关联文章">
                  {idea.articles.length === 0 ? (
                    <span className="ad-muted">无</span>
                  ) : (
                    idea.articles.map((article) => (
                      <Link
                        key={article.id}
                        className="ad-cell-link"
                        to="/admin/posts/$id"
                        params={{ id: article.id }}
                        search={{ lang: article.lastLanguage, done: undefined }}
                      >
                        {article.title}
                      </Link>
                    ))
                  )}
                </td>
                <td data-label="更新时间" className="ad-time">
                  {stamp(idea.updatedAt)}
                </td>
                <td data-label="操作">
                  <div className="ad-cell-actions">
                    <Link
                      to="/admin/ideas/$id"
                      params={{ id: idea.id }}
                      search={{ mode: 'edit' }}
                    >
                      编辑
                    </Link>
                    <Link
                      to="/admin/posts/new"
                      search={{ idea: idea.id, lang: 'zh' }}
                    >
                      用它写文章
                    </Link>
                    <button
                      type="button"
                      className="ad-link-button ad-danger-text"
                      onClick={() => setDeleting(idea.id)}
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <ConfirmDialog
        open={deleting !== null}
        title={deleteTitle}
        description={deleteMessage}
        confirm="删除"
        onConfirm={() => deleting && void remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
      {leaveDialog}
    </ListLayout>
  )
}

/** D-164 ③: the Idea detail page; previews first unless opened to edit. */
export function IdeaEditor({ idea, edit }: { idea: Idea; edit: boolean }) {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(idea.text)
  const [updatedAt, setUpdatedAt] = useState(idea.updatedAt)
  const [text, setText] = useState(idea.text)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  )
  // Set just before navigating away after a delete (the page is keyed by id).
  const leaving = useRef(false)
  const [confirming, setConfirming] = useState(false)
  const leaveDialog = useLeaveGuard(text !== saved, { leaving })

  async function save() {
    try {
      const submitted = text
      const result = await saveIdea({ data: { id: idea.id, text: submitted } })
      if (!result.ok) return setMessage({ ok: false, text: '请输入内容' })
      // The baseline is what was sent; later typing stays marked unsaved.
      setSaved(submitted)
      setUpdatedAt(result.idea.updatedAt)
      setMessage({ ok: true, text: '已保存' })
    } catch {
      setMessage({ ok: false, text: unknownMessage })
    }
  }
  async function remove() {
    setConfirming(false)
    try {
      await removeIdea({ data: { id: idea.id } })
      leaving.current = true
      await navigate({ to: '/admin/ideas' })
    } catch {
      setMessage({ ok: false, text: '无法确认删除结果，请刷新查看当前状态' })
    }
  }

  return (
    <section className="ad-page ad-idea-detail">
      <div className="ad-page-head">
        <h1>Idea{text !== saved ? ' •' : ''}</h1>
        <Link to="/admin/ideas">返回列表</Link>
      </div>
      <p className="ad-idea-meta">
        <span>创建于 {stamp(idea.createdAt)}</span>
        <span>更新于 {stamp(updatedAt)}</span>
        <span>
          关联文章：
          {idea.articles.length === 0
            ? '无'
            : idea.articles.map((article, index) => (
                <span key={article.id}>
                  {index > 0 ? '、' : ''}
                  <Link
                    to="/admin/posts/$id"
                    params={{ id: article.id }}
                    search={{ lang: article.lastLanguage, done: undefined }}
                  >
                    {article.title}
                  </Link>
                </span>
              ))}
        </span>
      </p>
      <MarkdownField
        label="Idea"
        value={text}
        onChange={setText}
        minHeight="200px"
        // The address holds the mode, so back / forward and links agree.
        mode={edit ? 'edit' : 'preview'}
        onModeChange={(next) =>
          void navigate({
            to: '.',
            search: { mode: next === 'edit' ? 'edit' : undefined },
            replace: true,
          })
        }
        onSubmit={() => void save()}
      />
      <div className="ad-buttons ad-after">
        <button
          type="button"
          className="ui-button ad-primary"
          onClick={() => void save()}
        >
          保存
        </button>
        <Link
          to="/admin/posts/new"
          search={{ idea: idea.id, lang: 'zh' }}
          className="ui-button"
        >
          用它写文章
        </Link>
        <button
          type="button"
          className="ui-button ad-danger"
          onClick={() => setConfirming(true)}
        >
          删除
        </button>
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
      </div>
      <ConfirmDialog
        open={confirming}
        title={deleteTitle}
        description={deleteMessage}
        confirm="删除"
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      />
      {leaveDialog}
    </section>
  )
}
