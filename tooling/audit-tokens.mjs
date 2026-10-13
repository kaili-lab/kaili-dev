import console from 'node:console'
import process from 'node:process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, URL } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const tokenSource = await fs.readFile(
  path.join(root, 'src/styles/tokens.css'),
  'utf8',
)
const designSource = await fs.readFile(
  path.join(root, 'docs/product/design.md'),
  'utf8',
)

function readBlock(source, selector) {
  const match = source.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n\\}`))
  return Object.fromEntries(
    [...(match?.[1] ?? '').matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map(
      ([, name, value]) => [name, value.toLowerCase()],
    ),
  )
}

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

const light = readBlock(tokenSource, ':root')
const dark = {
  ...light,
  ...readBlock(tokenSource, "\\[data-theme='dark'\\]"),
}
const colorSection = designSource.split('## 2. 颜色')[1].split('## 3. 字体')[0]
const documented = new Set(
  [...colorSection.matchAll(/#[0-9a-f]{6}/gi)].map(([value]) =>
    value.toLowerCase(),
  ),
)
for (const [, name, lightValue, darkValue] of colorSection.matchAll(
  /\|[^|]+\| `--([\w-]+)` \| `(#[0-9a-f]{6})` \| `(#[0-9a-f]{6})`/gi,
)) {
  if (light[name] !== lightValue || dark[name] !== darkValue)
    throw new Error(`Palette mismatch: --${name}`)
}
const paragraphColors = [
  ['seal', /印章 `--seal` `(#[0-9a-f]{6})`/, false],
  ['cover', /文字封面 `--cover` `(#[0-9a-f]{6})`/, false],
  ['quote-bg', /`--quote-bg` 浅色是墨 `(#[0-9a-f]{6})`/, false],
  ['quote-bg', /深色改为 `(#[0-9a-f]{6})`/, true],
  ['cover-ink', /封面上用 `(#[0-9a-f]{6})`/, false],
  ['quote-ink', /摘抄卡片上正文 `(#[0-9a-f]{6})`/, false],
  ['quote-source', /出处 `(#[0-9a-f]{6})`/, false],
  ['seal-ink', /印章文字 `(#[0-9a-f]{6})`/, false],
]
for (const [name, pattern, isDark] of paragraphColors) {
  const value = colorSection.match(pattern)?.[1]
  if (!value || (isDark ? dark : light)[name] !== value)
    throw new Error(`Paragraph palette mismatch: --${name}`)
  if (!isDark && name !== 'quote-bg' && dark[name] !== value)
    throw new Error(`Fixed dark palette mismatch: --${name}`)
}
const documentedContrasts = colorSection
  .split('**对比度')[1]
  .split('\n')
  .filter((line) =>
    /^\| (墨|次墨|黛蓝|赭灰|朱砂|封面文字|摘抄正文|印章文字)/.test(line),
  )
  .flatMap((line) => {
    const [, , lightCell, darkCell] = line.split('|').map((cell) => cell.trim())
    const values = (cell) =>
      cell.split(' · ').map((value) => (value === '—' ? null : Number(value)))
    const left = values(lightCell)
    const right = darkCell === '同左' ? left : values(darkCell)
    return left.map((value, index) => [value, right[index]])
  })
const tokenColors = new Set([...Object.values(light), ...Object.values(dark)])
const missing = [...documented].filter((value) => !tokenColors.has(value))
const extra = [...tokenColors].filter((value) => !documented.has(value))

const combinations = [
  ['ink / paper', 'ink', 'paper'],
  ['ink / panel', 'ink', 'paper-2'],
  ['ink-2 / paper', 'ink-2', 'paper'],
  ['ink-2 / panel', 'ink-2', 'paper-2'],
  ['indigo / paper', 'indigo', 'paper'],
  ['indigo / panel', 'indigo', 'paper-2'],
  ['mute / paper', 'mute', 'paper'],
  ['mute / panel', 'mute', 'paper-2'],
  ['cinnabar / paper', 'cinnabar', 'paper'],
  ['cinnabar / panel', 'cinnabar', 'paper-2'],
  ['cover ink / cover', 'cover-ink', 'cover'],
  ['quote ink / quote', 'quote-ink', 'quote-bg'],
  ['quote source / quote', 'quote-source', 'quote-bg'],
  ['seal ink / seal', 'seal-ink', 'seal'],
].map((entry, index) => [...entry, ...(documentedContrasts[index] ?? [])])
if (documentedContrasts.length !== combinations.length)
  throw new Error('Contrast table coverage mismatch')

console.log(
  'design colors missing from tokens:',
  missing.length ? missing.join(', ') : 'none',
)
console.log(
  'token colors absent from design:',
  extra.length ? extra.join(', ') : 'none',
)
console.log('contrast table (documented -> actual, delta):')
let belowThreshold = false
for (const [
  name,
  foreground,
  background,
  expectedLight,
  expectedDark,
] of combinations) {
  const lightActual = contrast(light[foreground], light[background])
  const darkActual = contrast(dark[foreground], dark[background])
  if (
    !Number.isFinite(lightActual) ||
    !Number.isFinite(darkActual) ||
    lightActual < 4.5 ||
    darkActual < 4.5
  )
    belowThreshold = true
  for (const [actual, expected] of [
    [lightActual, expectedLight],
    [darkActual, expectedDark],
  ]) {
    if (expected !== null && Math.abs(actual - expected) > 0.05)
      throw new Error(`Contrast estimate mismatch: ${name}`)
  }
  const format = (actual, expected) =>
    expected == null
      ? `${actual.toFixed(3)} (documented —)`
      : `${actual.toFixed(3)} (documented ${expected.toFixed(1)}, delta ${(actual - expected).toFixed(3)})`
  console.log(
    `  ${name}: light ${format(lightActual, expectedLight)}; dark ${format(darkActual, expectedDark)}`,
  )
}

if (missing.length || extra.length || belowThreshold) process.exitCode = 1
