import { createHighlighterCore } from 'shiki/core'
import type { HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { unified } from 'unified'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'

export type MarkdownTocItem = {
  id: string
  title: string
  level: 2 | 3
}

export type RenderedMarkdown = {
  html: string
  toc: MarkdownTocItem[]
  minutes: number
}

type MarkdownProperties = Record<string, unknown>
type Root = ReturnType<HighlighterCore['codeToHast']>
type ElementContent = Root['children'][number]
type Element = Extract<ElementContent, { type: 'element' }>

let highlighterPromise: Promise<HighlighterCore> | undefined

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    langs: [
      import('shiki/langs/javascript.mjs'),
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/jsx.mjs'),
      import('shiki/langs/tsx.mjs'),
      import('shiki/langs/json.mjs'),
      import('shiki/langs/css.mjs'),
      import('shiki/langs/html.mjs'),
      import('shiki/langs/markdown.mjs'),
      import('shiki/langs/bash.mjs'),
      import('shiki/langs/python.mjs'),
      import('shiki/langs/sql.mjs'),
    ],
    themes: [
      {
        name: 'k2',
        colors: {
          'editor.foreground': 'var(--ink)',
          'editor.background': 'var(--paper-2)',
        },
        tokenColors: [
          {
            scope: ['keyword', 'storage'],
            settings: { foreground: 'var(--cinnabar)' },
          },
          {
            scope: ['string', 'constant.numeric'],
            settings: { foreground: 'var(--indigo)' },
          },
          {
            scope: 'comment',
            settings: { foreground: 'var(--mute)', fontStyle: '' },
          },
        ],
      },
    ],
    engine: createJavaScriptRegexEngine(),
  })
  return highlighterPromise
}

function textContent(node: ElementContent | Root): string {
  if (node.type === 'text') return node.value
  if ('children' in node) return node.children.map(textContent).join('')
  return ''
}

function slugForHeading(title: string, used: Set<string>): string {
  const base =
    title
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]+/gu, '')
      .replace(/[\s-]+/g, '-') || 'section'
  let id = base
  let suffix = 2
  while (used.has(id)) id = `${base}-${suffix++}`
  used.add(id)
  return id
}

function isSafeUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const url = value.trim()
  if (!url) return false
  if (
    url.startsWith('/') ||
    url.startsWith('#') ||
    url.startsWith('./') ||
    url.startsWith('../')
  ) {
    return true
  }
  return /^(?:https?:|mailto:)/i.test(url)
}

function sanitizeProperties(node: Element) {
  const properties = node.properties as MarkdownProperties
  for (const key of ['href', 'src', 'action', 'formaction']) {
    if (key in properties && !isSafeUrl(properties[key])) delete properties[key]
  }
  for (const key of Object.keys(properties)) {
    if (/^on/i.test(key) || key === 'style') delete properties[key]
  }
}

function transformTree(root: Root): MarkdownTocItem[] {
  const usedIds = new Set<string>()
  const toc: MarkdownTocItem[] = []

  const walk = (children: ElementContent[]) => {
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index]
      if (!child || child.type !== 'element') continue
      sanitizeProperties(child)
      const headingLevel =
        child.tagName === 'h2' ? 2 : child.tagName === 'h3' ? 3 : undefined
      if (headingLevel) {
        const title = textContent(child).trim()
        const id = slugForHeading(title, usedIds)
        child.properties.id = id
        toc.push({ id, title, level: headingLevel })
      }
      if (child.tagName === 'p' && child.children.length === 1) {
        const image = child.children[0]
        if (image?.type === 'element' && image.tagName === 'img') {
          sanitizeProperties(image)
          const alt =
            typeof image.properties.alt === 'string'
              ? image.properties.alt.trim()
              : ''
          if (alt) {
            children[index] = {
              type: 'element',
              tagName: 'figure',
              properties: {},
              children: [
                image,
                {
                  type: 'element',
                  tagName: 'figcaption',
                  properties: {},
                  children: [{ type: 'text', value: alt }],
                },
              ],
            }
            continue
          }
        }
      }
      if (child.tagName === 'table') {
        children[index] = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['k2-table'] },
          children: [child],
        }
        walk(child.children)
        continue
      }
      if (child.tagName === 'pre') {
        const code = child.children.find(
          (item): item is Element =>
            item.type === 'element' && item.tagName === 'code',
        )
        if (code) {
          const className = code.properties.className
          const language = Array.isArray(className)
            ? className
                .find(
                  (name): name is string =>
                    typeof name === 'string' && name.startsWith('language-'),
                )
                ?.slice(9)
            : undefined
          if (language) child.properties.dataLang = language
        }
      }
      if ('children' in child) walk(child.children)
    }
  }

  walk(root.children)
  return toc
}

function languageFromCode(node: Element): string | undefined {
  const code = node.children.find(
    (item): item is Element =>
      item.type === 'element' && item.tagName === 'code',
  )
  if (!code || !Array.isArray(code.properties.className)) return undefined
  return code.properties.className
    .find(
      (name): name is string =>
        typeof name === 'string' && name.startsWith('language-'),
    )
    ?.slice(9)
}

async function highlightCode(root: Root) {
  const highlighter = await getHighlighter()
  const walk = (children: ElementContent[]) => {
    for (let index = 0; index < children.length; index += 1) {
      const node = children[index]
      if (!node || node.type !== 'element') continue
      if (node.tagName === 'pre') {
        const language = languageFromCode(node)
        if (language) {
          const code = node.children.find(
            (item): item is Element =>
              item.type === 'element' && item.tagName === 'code',
          )
          const value = code ? textContent(code) : ''
          if (highlighter.getLoadedLanguages().includes(language)) {
            const highlighted = highlighter.codeToHast(value, {
              lang: language,
              theme: 'k2',
            }).children[0]
            if (highlighted?.type === 'element') {
              highlighted.properties.dataLang = language
              children[index] = highlighted
              continue
            }
          }
        }
      }
      if ('children' in node) walk(node.children)
    }
  }
  walk(root.children)
}

export async function renderMarkdown(
  markdown: string,
): Promise<RenderedMarkdown> {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype)
  const tree = (await processor.run(processor.parse(markdown))) as Root
  const toc = transformTree(tree)
  await highlightCode(tree)
  const html = String(unified().use(rehypeStringify).stringify(tree))
  const plainText = markdown.replace(/[`*_>#|~-]/g, ' ')
  const latinWords = plainText.match(/[A-Za-z0-9]+/g)?.length ?? 0
  const cjkCharacters = plainText.match(/[\u3400-\u9fff]/g)?.length ?? 0
  const minutes = Math.max(1, Math.ceil((latinWords + cjkCharacters) / 220))
  return { html, toc, minutes }
}
