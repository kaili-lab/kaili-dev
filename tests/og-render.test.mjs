import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { create } from 'fontkit'
import { describe, expect, it } from 'vitest'

import { publishedOgCard } from '../src/features/og.ts'
import { renderOgCard } from '../src/server/og-card.ts'
import { ogFontAssets, ogFontUrl } from '../src/server/og-fonts.ts'
import { categoryLabel } from '../src/features/taxonomy.server.ts'
import { publishedPosts } from '../src/server/data/posts.ts'

const posts = publishedPosts()
import golden from './fixtures/og-golden.json' with { type: 'json' }

// Serve /og-fonts/<file> from @fontsource, exactly what copy-og-fonts.mjs
// publishes for the Worker.
const fontFiles = new Map(
  ogFontAssets.map((asset) => [ogFontUrl(asset), asset.source]),
)
async function fetchAsset(url) {
  const source = fontFiles.get(url)
  if (!source) throw new Error(`unexpected asset ${url}`)
  const buffer = await readFile(resolve('node_modules/@fontsource', source))
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  )
}

function pngSize(png) {
  const bytes = Buffer.from(png)
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

const base = {
  language: 'zh',
  summary: '所有权、边界和事务结束的位置，决定了服务是否容易理解。',
  category: '工程',
  publishedAt: '2026-09-02',
}

describe('T3.4 OG renderer (D-120 title rules)', { timeout: 60_000 }, () => {
  it('keeps a short title at 60px on one line', async () => {
    const card = await renderOgCard(
      { ...base, title: '把边界写清楚' },
      fetchAsset,
    )
    expect(pngSize(card.png)).toEqual({ width: 1200, height: 630 })
    expect(card).toMatchObject({
      titleFontSize: 60,
      titleLines: 1,
      titleTruncated: false,
      renderedTitle: '把边界写清楚',
    })
  })

  it('drops a title that needs more than 3 lines at 60px to 50px', async () => {
    const title =
      '把代码的所有权和事务边界写清楚才能让服务在六个月以后仍然容易理解和维护'
    const card = await renderOgCard({ ...base, title }, fetchAsset)
    expect(card).toMatchObject({
      titleFontSize: 50,
      titleLines: 3,
      titleTruncated: false,
      renderedTitle: title,
    })
  })

  it('truncates with an ellipsis when 50px still needs more than 3 lines', async () => {
    const title =
      '一套不会把代码库写烂的 AI 辅助开发流程：先计划、小步提交、测试即契约，以及一年里在真实项目上踩过的每一个坑'
    const card = await renderOgCard({ ...base, title }, fetchAsset)
    expect(card.titleFontSize).toBe(50)
    expect(card.titleLines).toBe(3)
    expect(card.titleTruncated).toBe(true)
    expect(card.renderedTitle.endsWith('…')).toBe(true)
    expect(title.startsWith(card.renderedTitle.slice(0, -1))).toBe(true)
  })

  it('lays out an English title at 60px', async () => {
    const card = await renderOgCard(
      {
        language: 'en',
        title: 'Moving Say Right from Next.js to Cloudflare Workers',
        summary:
          'Cold starts, KV consistency, the Durable Object bill, and the $19 a month it saved.',
        category: 'Engineering',
        publishedAt: '2026-08-18',
      },
      fetchAsset,
    )
    expect(card).toMatchObject({ titleFontSize: 60, titleTruncated: false })
    expect(card.titleLines).toBeLessThanOrEqual(3)
  })

  it('cuts a long summary to two lines with an ellipsis', async () => {
    const summary =
      'Cold starts, KV consistency, the Durable Object bill model, request routing, cache invalidation, deployment previews, and finally the nineteen dollars a month it saved after all of that work.'
    const card = await renderOgCard(
      {
        language: 'en',
        title: 'Short',
        summary,
        category: 'Engineering',
        publishedAt: '2026-08-18',
      },
      fetchAsset,
    )
    expect(card.summaryLines).toBe(2)
    expect(card.renderedSummary.endsWith('…')).toBe(true)
    expect(summary.startsWith(card.renderedSummary.slice(0, -1))).toBe(true)
  })

  it('renders Latin words after Chinese punctuation without dropping text', async () => {
    const summary = '冷启动、KV 一致性、Durable Object 的账单模型。'
    const card = await renderOgCard(
      { ...base, title: '迁移', summary },
      fetchAsset,
    )
    expect(card.renderedSummary).toBe(summary)
    expect(card.summaryLines).toBe(1)
    // Reviewed image (docs/notes/2026-10-13-T3.4-evidence/mixed-summary.png):
    // every glyph drawn, one serif face, spaces kept. Any change in font
    // selection or fallback changes these bytes.
    expect(createHash('sha256').update(card.png).digest('hex')).toBe(
      golden.mixedZh,
    )
  })
})

describe(
  'T3.4 OG renderer uses only published versions',
  { timeout: 60_000 },
  () => {
    it.each(['zh', 'en'])(
      'renders the published %s boundary-example card',
      async (language) => {
        const input = publishedOgCard(language, 'boundary-example')
        const card = await renderOgCard(input, fetchAsset)
        expect(card.renderedTitle).toBe(input.title)
        expect(card.renderedSummary).toBe(input.summary)
        expect(`${card.renderedTitle} ${card.renderedSummary}`).not.toMatch(
          /未发布|Unpublished|must not appear/,
        )
      },
    )
  },
)

describe('T3.4 OG glyph coverage', () => {
  // A necessary (not sufficient) condition: each character of the published
  // content, the fixed footer text, the ellipsis and the mixed-script fixture
  // exists in at least one of the 14 OG font files. Which face Satori picks is
  // covered by the reviewed PNG hashes below and in the mixed-script test.
  it('covers all published titles, summaries and category labels', async () => {
    const faces = await Promise.all(
      ogFontAssets.map(async (asset) =>
        create(
          await readFile(resolve('node_modules/@fontsource', asset.source)),
        ),
      ),
    )
    const text = [
      'Kai Li',
      'kaili.dev',
      'KL',
      '…',
      '冷启动、KV 一致性、Durable Object 的账单模型。',
    ]
    for (const post of posts)
      for (const language of ['zh', 'en']) {
        const version = post[language]
        if (!version) continue
        text.push(version.title, version.summary, version.publishedAt)
        text.push(categoryLabel(version.category, language))
      }
    const missing = [...new Set(text.join(''))].filter(
      (character) =>
        !/\s/.test(character) &&
        !faces.some((face) =>
          face.hasGlyphForCodePoint(character.codePointAt(0)),
        ),
    )
    expect(missing).toEqual([])
  })
})

describe('T3.4 OG golden output', { timeout: 60_000 }, () => {
  // tests/e2e/og.spec.ts asserts the production Worker returns these exact
  // bytes for the same published input, tying HTTP output to this renderer.
  it.each(['zh', 'en'])(
    'boundary-example %s matches the recorded PNG hash',
    async (language) => {
      const card = await renderOgCard(
        publishedOgCard(language, 'boundary-example'),
        fetchAsset,
      )
      const hash = createHash('sha256').update(card.png).digest('hex')
      expect(hash).toBe(golden[language])
    },
  )
})
