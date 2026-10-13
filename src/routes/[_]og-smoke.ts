import { createFileRoute } from '@tanstack/react-router'

import { developmentOnly } from '#/lib/development-only'
import { renderOgCard } from '#/server/og-card'

const titles = {
  short: '把边界写清楚',
  medium:
    '把代码的所有权和事务边界写清楚才能让服务在六个月以后仍然容易理解和维护',
  long: '一套不会把代码库写烂的 AI 辅助开发流程：先计划、小步提交、测试即契约，以及一年里在真实项目上踩过的每一个坑',
  english: 'Moving Say Right from Next.js to Cloudflare Workers',
  boundaryZh: '把边界写清楚',
  boundaryEn: 'Make boundaries visible',
  draftZh: '未发布中文标题不得出现',
  draftEn: 'Unpublished English title must not appear',
}

export const Route = createFileRoute('/_og-smoke')({
  server: {
    middleware: [developmentOnly],
    handlers: {
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get('id')
        if (!id || !(id in titles))
          return new Response('Not Found', { status: 404 })
        const english = id === 'english' || id.endsWith('En')
        const published = id.startsWith('boundary')
        const draft = id.startsWith('draft')
        const card = await renderOgCard(
          {
            language: english ? 'en' : 'zh',
            title: titles[id as keyof typeof titles],
            summary: published
              ? english
                ? 'Ownership, boundaries, and where the transaction ends make a service understandable.'
                : '所有权、边界和事务结束的位置，决定了服务是否容易理解。'
              : draft
                ? english
                  ? 'Unpublished English summary must not appear'
                  : '未发布中文摘要不得出现'
                : english
                  ? 'Cold starts, KV consistency, the Durable Object bill, and the $19 a month it saved.'
                  : '冷启动、KV 一致性、Durable Object 的账单模型，以及最后每月省下的 19 美元。',
            category: english ? 'Engineering' : '工程',
            publishedAt: published || draft ? '2026-09-02' : '2026-08-18',
          },
          async (url) => {
            const response = await fetch(new URL(url, request.url))
            if (!response.ok)
              throw new Error(`Fixture font asset failed: ${url}`)
            return response.arrayBuffer()
          },
        )
        return new Response(card.png as Uint8Array<ArrayBuffer>, {
          headers: {
            'Content-Type': 'image/png',
            'X-Og-Font-Size': String(card.titleFontSize),
            'X-Og-Lines': String(card.titleLines),
            'X-Og-Truncated': String(card.titleTruncated),
            'X-Og-Title': encodeURIComponent(card.renderedTitle),
            'X-Og-Summary': encodeURIComponent(card.renderedSummary),
          },
        })
      },
    },
  },
})
