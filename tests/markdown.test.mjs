import { describe, expect, it } from 'vitest'

import { renderMarkdown } from '../src/features/markdown.ts'

describe('public Markdown boundaries', () => {
  it('keeps every repeated or suffix-shaped heading reachable by a unique anchor', async () => {
    const result = await renderMarkdown(
      '## Topic\n\n### Topic\n\n## Topic-2\n\n## Topic\n\n## !!!',
    )
    expect(result.toc.map((item) => item.id)).toEqual([
      'topic',
      'topic-2',
      'topic-2-2',
      'topic-3',
      'section',
    ])
    for (const item of result.toc)
      expect(result.html).toContain(`id="${item.id}"`)
  })

  it('renders code as code while excluding author-supplied executable HTML and unsafe links', async () => {
    const result = await renderMarkdown(
      [
        '<script>alert(1)</script>',
        '<img src=x onerror="alert(1)">',
        '[unsafe](javascript:alert%281%29)',
        '| Link |\n| --- |\n| [unsafe](javascript:alert%281%29) |',
        '```typescript',
        'const value = "<script>alert(1)</script>" // literal, not executable',
        '```',
      ].join('\n\n'),
    )
    expect(result.html).not.toContain('<script>')
    expect(result.html).not.toContain('<img')
    expect(result.html).not.toContain('href="javascript:')
    expect(result.html).toContain('<pre ')
    expect(result.html).toContain('data-lang="typescript"')
    expect(result.html).toContain('&#x3C;script>')
    expect(result.html).not.toContain('&#x3C;pre')
  })

  it('preserves unknown-language code and ordinary text with the same escaping boundary', async () => {
    const result = await renderMarkdown(
      '```unregistered-language\n<div>visible</div>\n```\n\nUse `x < y` without interpreting it as markup.',
    )
    expect(result.html).toContain(
      '<pre data-lang="unregistered-language"><code',
    )
    expect(result.html).toContain('&#x3C;div>visible&#x3C;/div>')
    expect(result.html).toContain('<code>x &#x3C; y</code>')
  })
})
