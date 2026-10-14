import { useEffect, useRef, useState, type ReactNode } from 'react'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import {
  EditorView,
  drawSelection,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'

import { previewMarkdown } from '#/features/admin.functions'

// One Markdown editor for articles and Ideas (D-045 / D-071). A minimal setup
// instead of `basicSetup`, whose default highlight and bracket styles carry
// their own hex colours; every colour here is a K2 token (D-129).
const theme = EditorView.theme({
  '&': {
    color: 'var(--ink)',
    backgroundColor: 'var(--paper-2)',
    border: '1px solid var(--line)',
    borderRadius: '3px',
    fontSize: '0.95rem',
  },
  '&.cm-focused': {
    outline: '2px solid var(--cinnabar)',
    outlineOffset: '2px',
  },
  '.cm-content': {
    caretColor: 'var(--ink)',
    fontFamily: 'var(--num)',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ink)' },
  '.cm-gutters': {
    backgroundColor: 'var(--paper-2)',
    color: 'var(--mute)',
    border: 'none',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection':
    {
      backgroundColor: 'var(--line)',
    },
})

const k2Highlight = HighlightStyle.define([
  { tag: tags.heading, color: 'var(--ink)', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: [tags.link, tags.url], color: 'var(--indigo)' },
  { tag: [tags.monospace, tags.processingInstruction], color: 'var(--ink-2)' },
  {
    tag: [tags.meta, tags.comment, tags.quote, tags.contentSeparator],
    color: 'var(--mute)',
  },
])

export function MarkdownEditor({
  value,
  onChange,
  label,
  minHeight = '360px',
  maxHeight,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  minHeight?: string
  /** Long text scrolls inside the editor instead of growing the page. */
  maxHeight?: string
  /** ⌘Enter / Ctrl+Enter (D-164). */
  onSubmit?: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const change = useRef(onChange)
  const submit = useRef(onSubmit)
  useEffect(() => {
    change.current = onChange
    submit.current = onSubmit
  }, [onChange, onSubmit])

  useEffect(() => {
    if (!host.current) return
    const editor = new EditorView({
      doc: value,
      parent: host.current,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              if (!submit.current) return false
              submit.current()
              return true
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        markdown(),
        syntaxHighlighting(k2Highlight),
        theme,
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': label,
          // The shortcut lives on the editor, where it is handled (D-164).
          ...(onSubmit
            ? { 'aria-keyshortcuts': 'Meta+Enter Control+Enter' }
            : {}),
        }),
        EditorView.theme({
          '.cm-content, .cm-gutter': { minHeight },
          ...(maxHeight
            ? { '.cm-scroller': { maxHeight, overflow: 'auto' } }
            : {}),
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) change.current(update.state.doc.toString())
        }),
      ],
    })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
    // The editor is created once; later value changes are pushed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Replace the document when the value changes from outside.
  useEffect(() => {
    const editor = view.current
    if (editor && editor.state.doc.toString() !== value)
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
      })
  }, [value])

  return <div ref={host} className="ad-codemirror" data-editor={label} />
}

export type Mode = 'edit' | 'split' | 'preview'
const modeText: Record<Mode, string> = {
  edit: '编辑',
  split: '分栏',
  preview: '预览',
}

/**
 * Edit / (split) / preview toggle shared by articles and Ideas (D-071,
 * D-163 ③). The preview is rendered by the same server pipeline as public
 * pages. In preview mode a response is shown only if it still matches the
 * current text (a late answer is dropped); in split mode the last answer stays
 * until a newer one arrives, so typing does not flicker. Callers key this by
 * language so switching tabs starts fresh.
 */
export function MarkdownField({
  value,
  onChange,
  label,
  minHeight,
  maxHeight,
  heading,
  split = false,
  mode: controlledMode,
  onModeChange,
  actions,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  minHeight?: string
  maxHeight?: string
  heading?: string
  /** Offer 分栏 (editor and preview side by side). */
  split?: boolean
  /**
   * Controlled mode: the Idea detail page keeps it in the address
   * (`?mode=edit`, D-164). Without it the field keeps its own, starting at 编辑.
   */
  mode?: Mode
  onModeChange?: (mode: Mode) => void
  /** Buttons after the mode toggle, e.g. the quick Idea's 保存. */
  actions?: ReactNode
  onSubmit?: () => void
}) {
  const [preview, setPreview] = useState<{ body: string; html: string } | null>(
    null,
  )
  const [ownMode, setOwnMode] = useState<Mode>('edit')
  const mode = controlledMode ?? ownMode
  const setMode = (next: Mode) =>
    onModeChange ? onModeChange(next) : setOwnMode(next)
  const alive = useRef(true)
  // Only the newest request may show its answer; an older one that arrives
  // late is dropped (requests can finish out of order).
  const latest = useRef(0)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  async function render(body: string) {
    const request = ++latest.current
    const show = (html: string) => {
      if (alive.current && request === latest.current)
        setPreview({ body, html })
    }
    try {
      show(await previewMarkdown({ data: { body } }))
    } catch {
      show('')
    }
  }

  // Preview renders on entry (toggle or address) and whenever the text
  // changes from outside while previewing, e.g. cleared after a save.
  useEffect(() => {
    if (mode === 'preview' && value.trim() !== '') void render(value)
  }, [mode, value])

  // Split mode follows the text, a moment after typing stops.
  useEffect(() => {
    if (mode !== 'split') return
    const timer = setTimeout(() => void render(value), 300)
    return () => clearTimeout(timer)
  }, [mode, value])

  const modes: Mode[] = split
    ? ['edit', 'split', 'preview']
    : ['edit', 'preview']
  const current = mode === 'preview' && preview?.body === value ? preview : null
  const shown = mode === 'split' ? preview : current
  const previewBlock =
    value.trim() === '' ? (
      <p className="ad-muted ad-preview-wait">还没有内容。</p>
    ) : shown ? (
      shown.html ? (
        <div
          className="prose ad-preview"
          data-preview={label}
          dangerouslySetInnerHTML={{ __html: shown.html }}
        />
      ) : (
        <p role="alert" className="ad-feedback ad-error">
          预览失败，请稍后重试
        </p>
      )
    ) : (
      <p className="ad-muted ad-preview-wait">正在生成预览…</p>
    )
  const editor = (
    <MarkdownEditor
      label={label}
      value={value}
      onChange={onChange}
      minHeight={minHeight}
      maxHeight={maxHeight}
      onSubmit={onSubmit}
    />
  )
  return (
    <div className="ad-field">
      <div className="ad-body-head">
        <span className="ad-body-label">{heading ?? label}</span>
        <span
          className="ad-toggle"
          role="group"
          aria-label={`${label}显示方式`}
        >
          {modes.map((item) => (
            <button
              key={item}
              type="button"
              className="ad-toggle-button"
              aria-pressed={mode === item}
              onClick={() => {
                setMode(item)
              }}
            >
              {modeText[item]}
            </button>
          ))}
        </span>
        {actions}
      </div>
      {mode === 'edit' ? (
        editor
      ) : mode === 'preview' ? (
        previewBlock
      ) : (
        <div className="ad-split">
          {editor}
          {previewBlock}
        </div>
      )}
    </div>
  )
}
