import { useEffect, useRef, useState } from 'react'
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
}: {
  value: string
  onChange: (value: string) => void
  label: string
  minHeight?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const change = useRef(onChange)
  useEffect(() => {
    change.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!host.current) return
    const editor = new EditorView({
      doc: value,
      parent: host.current,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown(),
        syntaxHighlighting(k2Highlight),
        theme,
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': label }),
        EditorView.theme({ '.cm-content, .cm-gutter': { minHeight } }),
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

/**
 * Edit / preview toggle shared by articles and Ideas (D-071). The preview is
 * rendered by the same server pipeline as public pages; a response is shown
 * only if it still matches the current text (a late answer is dropped).
 * Callers key this by language so switching tabs starts fresh.
 */
export function MarkdownField({
  value,
  onChange,
  label,
  minHeight,
  heading,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  minHeight?: string
  heading?: string
}) {
  const [preview, setPreview] = useState<{ body: string; html: string } | null>(
    null,
  )
  const [previewing, setPreviewing] = useState(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  async function showPreview() {
    setPreviewing(true)
    const body = value
    try {
      const html = await previewMarkdown({ data: { body } })
      if (alive.current) setPreview({ body, html })
    } catch {
      if (alive.current) setPreview({ body, html: '' })
    }
  }

  const showing = previewing && preview !== null && preview.body === value
  return (
    <div className="ad-field">
      <div className="ad-body-head">
        <span>{heading ?? label}</span>
        <span className="ad-toggle">
          <button
            type="button"
            className="ui-button"
            aria-pressed={!previewing}
            onClick={() => setPreviewing(false)}
          >
            编辑
          </button>
          <button
            type="button"
            className="ui-button"
            aria-pressed={previewing}
            onClick={() => void showPreview()}
          >
            预览
          </button>
        </span>
      </div>
      {previewing ? (
        showing ? (
          preview.html ? (
            <div
              className="prose ad-preview"
              data-preview={label}
              dangerouslySetInnerHTML={{ __html: preview.html }}
            />
          ) : (
            <p role="alert" className="ad-feedback ad-error">
              预览失败，请稍后重试
            </p>
          )
        ) : (
          <p className="ad-muted">正在生成预览…</p>
        )
      ) : (
        <MarkdownEditor
          label={label}
          value={value}
          onChange={onChange}
          minHeight={minHeight}
        />
      )}
    </div>
  )
}
