import { describe, expect, it } from 'vitest'

import {
  readThemePreference,
  resolveTheme,
  saveThemePreference,
} from '../src/features/theme.ts'
describe('D-116 theme preference', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['auto', false, 'light'],
    ['auto', true, 'dark'],
  ])(
    'resolves %s with system dark=%s to %s',
    (preference, systemDark, expected) => {
      expect(resolveTheme(preference, systemDark)).toBe(expected)
    },
  )

  it('treats missing and invalid storage as auto', () => {
    const storage = new Map()
    expect(readThemePreference(undefined)).toBe('auto')
    expect(
      readThemePreference({ getItem: (key) => storage.get(key) ?? null }),
    ).toBe('auto')
    storage.set('kaili-theme', 'sepia')
    expect(
      readThemePreference({ getItem: (key) => storage.get(key) ?? null }),
    ).toBe('auto')
  })

  it('clears storage when switching back to system preference', () => {
    const values = new Map()
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    }
    saveThemePreference(storage, 'dark')
    expect(readThemePreference(storage)).toBe('dark')
    saveThemePreference(storage, 'auto')
    expect(readThemePreference(storage)).toBe('auto')
  })
})
