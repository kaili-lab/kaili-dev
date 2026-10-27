import { describe, expect, it } from 'vitest'

import { parseSlugCandidates, slugPrompt } from '../src/features/ai-slug.ts'

describe('T8.5 slug candidates', () => {
  it('sends only the current title and summary in the requested prompt', () => {
    expect(slugPrompt({ title: '当前标题', summary: '当前摘要' })).toEqual([
      {
        role: 'system',
        content:
          '你为个人博客文章起英文 URL slug。只输出 JSON：{"slugs":["...","...","..."]}。每个 slug 只用小写英文字母、数字和连字符，3–6 个英文单词，表达文章主题，不用拼音。',
      },
      { role: 'user', content: '标题：当前标题\n摘要：当前摘要' },
    ])
  })

  it('parses JSON with or without surrounding explanatory text', () => {
    const json = '{"slugs":["one-topic","another-topic"]}'
    expect(parseSlugCandidates(json, new Set())).toEqual([
      'one-topic',
      'another-topic',
    ])
    expect(
      parseSlugCandidates(`候选如下：${json}\n仅供参考。`, new Set()),
    ).toEqual(['one-topic', 'another-topic'])
  })

  it('returns no candidates when the payload cannot be parsed', () => {
    for (const text of [
      'not json',
      '{"slugs":',
      '{"slugs":"not an array"}',
      '["one-topic"]',
      '{"slugs":[]} trailing { braces }',
    ]) {
      expect(parseSlugCandidates(text, new Set())).toEqual([])
    }
  })

  it('rejects invalid, taken and duplicate candidates after trimming', () => {
    expect(
      parseSlugCandidates(
        JSON.stringify({
          slugs: [
            'Bad Slug',
            'UPPER-CASE',
            'bad slug',
            ' taken-slug ',
            ' valid-slug ',
            'valid-slug',
            '-bad-edge',
            'other-slug',
            null,
            42,
          ],
        }),
        new Set(['taken-slug']),
      ),
    ).toEqual(['valid-slug', 'other-slug'])
  })

  it('returns no more than the first three valid distinct slugs', () => {
    expect(
      parseSlugCandidates(
        '{"slugs":["one-slug","one-slug","two-slug","three-slug","four-slug"]}',
        new Set(),
      ),
    ).toEqual(['one-slug', 'two-slug', 'three-slug'])
  })
})
