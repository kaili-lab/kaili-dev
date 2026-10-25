import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readPalette, savePalette } from '../src/features/palette.ts'

const tokens = readFileSync(resolve('src/styles/tokens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

// Every rule block whose selector list contains `selector`, in source order.
function blocksFor(selector) {
  return [...tokens.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) =>
      selectors.split(',').some((s) => s.trim() === selector),
    )
    .map(([, , body]) =>
      Object.fromEntries(
        [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, n, v]) => [
          n,
          v.trim(),
        ]),
      ),
    )
}

// Later blocks win, like the cascade does for equal specificity.
function resolved(...selectors) {
  return Object.assign({}, ...selectors.flatMap(blocksFor))
}

describe('palette overrides in tokens.css (D-169)', () => {
  it('ships the warm palette with no data-palette attribute', () => {
    const light = resolved(':root')
    const dark = { ...light, ...resolved("[data-theme='dark']") }
    expect([light.paper, light['paper-2'], light.indigo]).toEqual([
      '#f4f2ed',
      '#edebe4',
      '#2c4a6b',
    ])
    expect([dark.paper, dark['paper-2'], dark.indigo]).toEqual([
      '#161514',
      '#252321',
      '#86a7c4',
    ])
    expect(tokens.includes("[data-palette='warm']")).toBe(false)
  })

  it('restores the cool trial under data-palette=cool', () => {
    const light = resolved("[data-palette='cool']")
    const dark = resolved("[data-palette='cool'][data-theme='dark']")
    expect([light.paper, light['paper-2'], light.mute]).toEqual([
      '#f6f9f9',
      '#ffffff',
      '#5b676d',
    ])
    expect([
      dark.paper,
      dark['paper-2'],
      dark.indigo,
      dark['quote-bg'],
    ]).toEqual(['#091011', '#141c1f', '#93b4d9', '#050809'])
  })

  it('applies the adjusted panel on top of cool under data-palette=fix', () => {
    const light = resolved("[data-palette='fix']")
    const dark = resolved("[data-palette='fix'][data-theme='dark']")
    expect([light.paper, light['paper-2']]).toEqual(['#f6f9f9', '#eef3f3'])
    expect([dark.paper, dark['paper-2']]).toEqual(['#101617', '#141c1f'])
  })
})

describe('palette trial preference', () => {
  it('treats missing and invalid storage as the default warm palette', () => {
    const storage = new Map()
    expect(readPalette(undefined)).toBe('warm')
    expect(readPalette({ getItem: (key) => storage.get(key) ?? null })).toBe(
      'warm',
    )
    storage.set('kaili-palette', 'sepia')
    expect(readPalette({ getItem: (key) => storage.get(key) ?? null })).toBe(
      'warm',
    )
  })

  it('remembers the cool and adjusted palettes and clears warm', () => {
    const values = new Map()
    const storage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    }
    savePalette(storage, 'cool')
    expect(readPalette(storage)).toBe('cool')
    savePalette(storage, 'fix')
    expect(readPalette(storage)).toBe('fix')
    savePalette(storage, 'warm')
    expect(readPalette(storage)).toBe('warm')
    expect(values.has('kaili-palette')).toBe(false)
  })
})
