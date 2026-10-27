import { SLUG } from '#/features/article-versions'
import type { ChatMessage } from '#/features/ai-openai.server'

export function slugPrompt({
  title,
  summary,
}: {
  title: string
  summary: string
}): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        '你为个人博客文章起英文 URL slug。只输出 JSON：{"slugs":["...","...","..."]}。每个 slug 只用小写英文字母、数字和连字符，3–6 个英文单词，表达文章主题，不用拼音。',
    },
    { role: 'user', content: `标题：${title}\n摘要：${summary}` },
  ]
}

export function parseSlugCandidates(
  text: string,
  takenSlugs: ReadonlySet<string>,
): string[] {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end < start) return []

  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1))
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('slugs' in parsed) ||
      !Array.isArray(parsed.slugs)
    )
      return []

    const candidates: string[] = []
    const seen = new Set<string>()
    for (const value of parsed.slugs) {
      if (typeof value !== 'string') continue
      const slug = value.trim()
      if (!SLUG.test(slug) || takenSlugs.has(slug) || seen.has(slug)) continue
      candidates.push(slug)
      seen.add(slug)
      if (candidates.length === 3) break
    }
    return candidates
  } catch {
    return []
  }
}
