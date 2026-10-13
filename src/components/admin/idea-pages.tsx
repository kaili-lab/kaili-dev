import { useRef, useState } from 'react'
import {
  Link,
  useBlocker,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'

import { removeIdea, saveIdea } from '#/features/admin.functions'
import { MarkdownField } from '#/components/admin/markdown-editor'

type Idea = { id: string; text: string; createdAt: string; updatedAt: string }

const deleteMessage =
  '永久删除这条 Idea？挂在文章里的参考资料关系也会删除，文章本身和已发布内容不受影响。此操作不能撤销。'
const unknownMessage =
  '无法确认保存结果，请刷新查看当前状态；内容仍保留在输入框中'
const stamp = (iso: string) => iso.slice(0, 16).replace('T', ' ')

/** D-038 / D-072: same leave guard as the article editor. */
function useLeaveGuard(dirty: boolean, leaving?: { current: boolean }) {
  useBlocker({
    shouldBlockFn: () =>
      !leaving?.current &&
      dirty &&
      !window.confirm('有未保存的修改，确定离开吗？'),
    enableBeforeUnload: () => dirty,
  })
}

export function IdeaList({ ideas }: { ideas: Idea[] }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  )
  useLeaveGuard(text.trim() !== '')

  async function save() {
    const submitted = text
    try {
      const result = await saveIdea({ data: { id: null, text: submitted } })
      if (!result.ok) return setMessage({ ok: false, text: '请输入内容' })
      // Keep anything typed while the request was in flight.
      setText((current) => (current === submitted ? '' : current))
      setMessage({ ok: true, text: '已保存' })
      await router.invalidate()
    } catch {
      setMessage({ ok: false, text: unknownMessage })
    }
  }
  async function remove(id: string) {
    if (!window.confirm(deleteMessage)) return
    try {
      await removeIdea({ data: { id } })
      setMessage({ ok: true, text: '已删除' })
      await router.invalidate()
    } catch {
      setMessage({ ok: false, text: '无法确认删除结果，请刷新查看当前状态' })
    }
  }

  return (
    <section className="ad-page">
      <div className="ad-page-head">
        <h1>Idea</h1>
      </div>
      <div className="ad-quick">
        <MarkdownField
          label="新 Idea"
          value={text}
          onChange={setText}
          minHeight="96px"
        />
        <div className="ad-buttons">
          <button
            type="button"
            className="ui-button ad-primary"
            onClick={() => void save()}
          >
            保存
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
      </div>
      {ideas.length === 0 ? (
        <p className="ad-empty">还没有 Idea。</p>
      ) : (
        <ul className="ad-stack">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <p className="ad-idea-text">{idea.text}</p>
              <div className="ad-stack-meta">
                <span className="ad-time">更新于 {stamp(idea.updatedAt)}</span>
                <Link to="/admin/ideas/$id" params={{ id: idea.id }}>
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
                  className="ui-button"
                  onClick={() => void remove(idea.id)}
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function IdeaEditor({ idea }: { idea: Idea }) {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(idea.text)
  const [text, setText] = useState(idea.text)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  )
  // Set just before navigating away after a delete (the page is keyed by id).
  const leaving = useRef(false)
  useLeaveGuard(text !== saved, leaving)

  async function save() {
    try {
      const submitted = text
      const result = await saveIdea({ data: { id: idea.id, text: submitted } })
      if (!result.ok) return setMessage({ ok: false, text: '请输入内容' })
      // The baseline is what was sent; later typing stays marked unsaved.
      setSaved(submitted)
      setMessage({ ok: true, text: '已保存' })
    } catch {
      setMessage({ ok: false, text: unknownMessage })
    }
  }
  async function remove() {
    if (!window.confirm(deleteMessage)) return
    try {
      await removeIdea({ data: { id: idea.id } })
      leaving.current = true
      await navigate({ to: '/admin/ideas' })
    } catch {
      setMessage({ ok: false, text: '无法确认删除结果，请刷新查看当前状态' })
    }
  }

  return (
    <section className="ad-page">
      <div className="ad-page-head">
        <h1>编辑 Idea{text !== saved ? ' •' : ''}</h1>
        <Link to="/admin/ideas">返回列表</Link>
      </div>
      <MarkdownField
        label="Idea"
        value={text}
        onChange={setText}
        minHeight="200px"
      />
      <div className="ad-buttons ad-after">
        <button
          type="button"
          className="ui-button ad-primary"
          onClick={() => void save()}
        >
          保存
        </button>
        <button
          type="button"
          className="ui-button"
          onClick={() => void remove()}
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
    </section>
  )
}
