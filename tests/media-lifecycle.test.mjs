import { describe, expect, it } from 'vitest'

import {
  canReadMedia,
  isEligibleForCleanup,
  mediaObjectKey,
  refreshUnreferencedSince,
  replaceSlotReferences,
  referencesForSlot,
} from '../src/features/media-lifecycle.ts'

const object = {
  objectKey: 'media/test-image.png',
  createdAt: '2026-01-01T00:00:00.000Z',
  unreferencedSince: null,
}

const publishedReference = {
  objectKey: object.objectKey,
  articleId: 'article-1',
  language: 'zh',
  visibility: 'published',
}
describe('media reference lifecycle', () => {
  it('starts a grace period once and clears it when referenced again', () => {
    const first = refreshUnreferencedSince(
      object,
      [],
      '2026-01-02T00:00:00.000Z',
    )
    expect(first.unreferencedSince).toBe('2026-01-02T00:00:00.000Z')

    const stillUnreferenced = refreshUnreferencedSince(
      first,
      [],
      '2026-01-03T00:00:00.000Z',
    )
    expect(stillUnreferenced.unreferencedSince).toBe('2026-01-02T00:00:00.000Z')

    expect(
      refreshUnreferencedSince(
        stillUnreferenced,
        [publishedReference],
        '2026-01-03T00:00:00.000Z',
      ),
    ).toEqual({ ...object, unreferencedSince: null })
  })

  it('requires seven full days and a fresh reference check before cleanup', () => {
    const candidate = {
      ...object,
      unreferencedSince: '2026-01-01T00:00:00.000Z',
    }
    expect(
      isEligibleForCleanup(candidate, [], '2026-01-07T23:59:59.999Z'),
    ).toBe(false)
    expect(
      isEligibleForCleanup(candidate, [], '2026-01-08T00:00:00.000Z'),
    ).toBe(true)
    expect(
      isEligibleForCleanup(
        candidate,
        [publishedReference],
        '2026-01-08T00:00:00.000Z',
      ),
    ).toBe(false)
  })

  it('replaces only one of the four language and visibility slots', () => {
    const references = [
      publishedReference,
      {
        objectKey: 'media/en-draft.png',
        articleId: 'article-1',
        language: 'en',
        visibility: 'draft',
      },
    ]
    const next = replaceSlotReferences(
      references,
      'article-1',
      'zh',
      'published',
      ['media/new-zh.png'],
    )
    expect(referencesForSlot(next, 'article-1', 'zh', 'published')).toEqual([
      {
        ...publishedReference,
        objectKey: 'media/new-zh.png',
      },
    ])
    expect(referencesForSlot(next, 'article-1', 'en', 'draft')).toEqual([
      references[1],
    ])
  })

  it('allows anonymous reads only for published references', () => {
    expect(canReadMedia([publishedReference], object.objectKey, false)).toBe(
      true,
    )
    expect(
      canReadMedia(
        [{ ...publishedReference, visibility: 'draft' }],
        object.objectKey,
        false,
      ),
    ).toBe(false)
    expect(
      canReadMedia(
        [{ ...publishedReference, visibility: 'draft' }],
        object.objectKey,
        true,
      ),
    ).toBe(true)
  })

  it('recognizes only opaque media URLs issued by this site', () => {
    const key = '123e4567-e89b-42d3-a456-426614174000'
    expect(mediaObjectKey(`/media/${key}`)).toBe(key)
    expect(mediaObjectKey(`https://kaili.dev/media/${key}`)).toBe(key)
    expect(mediaObjectKey(`https://other.example/media/${key}`)).toBeNull()
    expect(mediaObjectKey('/media/not-a-key')).toBeNull()
    expect(mediaObjectKey(`/media/${key}?draft=1`)).toBeNull()
  })
})
