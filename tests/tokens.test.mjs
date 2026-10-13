import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, URL } from 'node:url'
import { ESLint } from 'eslint'
import { compile } from 'tailwindcss'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../', import.meta.url))
const tokenPath = path.join(root, 'src/styles/tokens.css')
const tokenSource = await fs.readFile(tokenPath, 'utf8')

function readBlock(selector) {
  const match = tokenSource.match(
    new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`),
  )
  return Object.fromEntries(
    [...(match?.[1] ?? '').matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map(
      ([, name, value]) => [name, value.toLowerCase()],
    ),
  )
}

const lightColors = readBlock(':root')
const darkOverrides = readBlock("\\[data-theme='dark'\\]")
const darkColors = { ...lightColors, ...darkOverrides }
const k2ColorNames = [
  'paper',
  'paper-2',
  'ink',
  'ink-2',
  'mute',
  'line',
  'dot',
  'cinnabar',
  'indigo',
  'seal',
  'cover',
  'quote-bg',
  'seal-ink',
  'cover-ink',
  'quote-ink',
  'quote-source',
]
const semanticColorNames = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
]
const fontNames = ['title', 'body', 'hand', 'ui', 'num', 'latin']
const textNames = [
  'display',
  'cover',
  'feature-title',
  'section',
  'now-title',
  'intro',
  'list-title',
  'body',
  'summary',
  'meta',
  'page-title',
  'article-title',
  'prose',
  'caption',
  'table',
  'code',
]

function luminance(hex) {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  )
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

function contrast(foreground, background) {
  const foregroundLuminance = luminance(foreground)
  const backgroundLuminance = luminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

async function sourceFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await sourceFiles(entryPath)))
    else files.push(entryPath)
  }
  return files
}

const textCombinations = [
  ['ink on paper', 'ink', 'paper'],
  ['ink on panel', 'ink', 'paper-2'],
  ['ink-2 on paper', 'ink-2', 'paper'],
  ['ink-2 on panel', 'ink-2', 'paper-2'],
  ['mute on paper', 'mute', 'paper'],
  ['mute on panel', 'mute', 'paper-2'],
  ['indigo on paper', 'indigo', 'paper'],
  ['indigo on panel', 'indigo', 'paper-2'],
  ['cinnabar on paper', 'cinnabar', 'paper'],
  ['cinnabar on panel', 'cinnabar', 'paper-2'],
  ['cover ink on cover', 'cover-ink', 'cover'],
  ['quote ink on quote', 'quote-ink', 'quote-bg'],
  ['quote source on quote', 'quote-source', 'quote-bg'],
  ['seal ink on seal', 'seal-ink', 'seal'],
]

describe('D-128 K2 design tokens', () => {
  it('declares the complete K2 palette and inherits fixed colors in dark mode', () => {
    for (const name of k2ColorNames) {
      expect(lightColors[name], `light --${name}`).toMatch(/^#[0-9a-f]{6}$/)
      expect(darkColors[name], `dark --${name}`).toMatch(/^#[0-9a-f]{6}$/)
    }

    for (const name of [
      'seal',
      'cover',
      'seal-ink',
      'cover-ink',
      'quote-ink',
      'quote-source',
    ]) {
      expect(darkColors[name]).toBe(lightColors[name])
    }
    expect(darkColors['quote-bg']).not.toBe(lightColors['quote-bg'])
  })

  it('maps every standard semantic color to an existing K2 color', () => {
    const theme =
      tokenSource.match(/@theme inline\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    const entries = Object.fromEntries(
      [...theme.matchAll(/^\s*--color-([\w-]+):\s*var\(--([\w-]+)\);/gm)].map(
        ([, name, source]) => [name, source],
      ),
    )
    expect(Object.keys(entries).sort()).toEqual(
      [...k2ColorNames, ...semanticColorNames].sort(),
    )
    for (const name of semanticColorNames) {
      expect(k2ColorNames).toContain(entries[name])
    }
  })

  it('declares all K2 font and text utilities after resetting Tailwind defaults', () => {
    const theme = tokenSource
    for (const name of fontNames)
      expect(theme).toMatch(new RegExp(`--font-${name}:`))
    for (const name of textNames)
      expect(theme).toMatch(new RegExp(`--text-${name}:`))
    expect(theme).toMatch(/--radius-sm:\s*3px;/)
    expect(theme).toMatch(/--radius-md:\s*4px;/)
    expect(theme).toMatch(/--radius-(?:pill|full):\s*999px;/)
  })

  it.each(textCombinations)(
    'keeps %s at or above 4.5:1 in both color schemes',
    (_name, foreground, background) => {
      for (const tokens of [lightColors, darkColors]) {
        expect(tokens[foreground], `foreground --${foreground}`).toBeDefined()
        expect(tokens[background], `background --${background}`).toBeDefined()
        expect(
          contrast(tokens[foreground], tokens[background]),
        ).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it('keeps the WCAG threshold boundary meaningful', () => {
    expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5)
    expect(contrast('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#000000', '#ffffff')).toBe(21)
  })

  it('compiles registered utilities and emits no default color/font/text/radius utilities', async () => {
    const require = createRequire(import.meta.url)
    const compiler = await compile(
      '@import "tailwindcss";\n@import "./src/styles/tokens.css";',
      {
        base: root,
        loadStylesheet: async (id, base) => {
          const stylesheetPath = id.startsWith('.')
            ? path.resolve(base, id)
            : require.resolve(`${id}/index.css`, { paths: [base] })
          return {
            path: stylesheetPath,
            base: path.dirname(stylesheetPath),
            content: await fs.readFile(stylesheetPath, 'utf8'),
          }
        },
      },
    )
    const css = compiler.build([
      'bg-paper',
      'bg-background',
      'text-ink',
      'text-display',
      'font-title',
      'rounded-pill',
      'rounded-full',
      'bg-blue-500',
      'font-sans',
      'text-7xl',
      'rounded-lg',
    ])
    for (const utility of [
      '.bg-paper',
      '.bg-background',
      '.text-ink',
      '.text-display',
      '.font-title',
      '.rounded-pill',
      '.rounded-full',
    ])
      expect(css).toContain(utility)
    for (const utility of [
      '.bg-blue-500',
      '.font-sans',
      '.text-7xl',
      '.rounded-lg',
    ]) {
      expect(css).not.toContain(utility)
    }
    expect(css).toContain('background-color: var(--paper)')
    expect(css).toContain('font-size: var(--text-display)')
    expect(css).toContain('var(--text-display--line-height)')
  })

  it('keeps the lint restriction active for arbitrary colors while allowing K2 colors', async () => {
    const eslint = new ESLint()
    async function rules(code) {
      const results = await eslint.lintText(code, {
        filePath: 'src/routes/token-guardrail-example.tsx',
      })
      return results.flatMap((result) =>
        result.messages.map((message) => message.ruleId),
      )
    }

    expect(
      await rules('export const Example = () => <div className="bg-[#fff]" />'),
    ).toContain('better-tailwindcss/no-restricted-classes')
    expect(
      await rules('export const Example = () => <div className="bg-paper" />'),
    ).toEqual([])
  })

  it('rejects hex colors anywhere in src except tokens.css', async () => {
    const files = await sourceFiles(path.join(root, 'src'))
    const violations = []
    for (const file of files) {
      if (file === tokenPath) continue
      const source = await fs.readFile(file, 'utf8')
      if (/#(?:[0-9a-f]{3,8})\b/i.test(source))
        violations.push(path.relative(root, file))
    }
    expect(violations).toEqual([])
  })
})
