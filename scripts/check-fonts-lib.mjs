import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { create } from 'fontkit'
import { checkWenkai, root } from './font-inputs.mjs'

export async function checkFontFaces() {
  const css = await readFile(resolve(root, 'src/styles/fonts.css'), 'utf8')
  const groups = new Map()
  const files = new Set()
  for (const [block] of css.matchAll(/@font-face\s*\{[^}]+\}/g)) {
    if (!/font-display:\s*swap/.test(block))
      throw new Error('Every font face must use swap')
    const family = block.match(/font-family:\s*'([^']+)'/)?.[1]
    const weight = block.match(/font-weight:\s*(\d+)/)?.[1]
    const style = block.match(/font-style:\s*(\w+)/)?.[1]
    const url = block.match(/url\(['"]?([^)'"\s]+)['"]?\)/)?.[1]
    if (!url || !url.endsWith('.woff2') || /https?:|\/\//.test(url))
      throw new Error(`Nonlocal or non-WOFF2 face: ${url}`)
    if (files.has(url)) throw new Error(`Duplicate font payload: ${url}`)
    files.add(url)
    if (
      family === 'Noto Serif SC' &&
      (!['400', '600', '900'].includes(weight) ||
        !block.includes('unicode-range:'))
    ) {
      throw new Error('Noto must retain range slices at 400/600/900 only')
    }
    const path = url.startsWith('@fontsource/')
      ? resolve(root, 'node_modules', url)
      : resolve(root, 'src/styles', url)
    const font = create(await readFile(path))
    const key = `${family}/${weight}/${style}`
    if (!groups.has(key)) groups.set(key, new Set())
    for (const codepoint of font.characterSet) groups.get(key).add(codepoint)
  }
  const required = [
    ['Inter', [400, 500, 600], 'normal', 'Kai Li Ā é'],
    ['IBM Plex Mono', [400, 500], 'normal', '0123456789 Ā é'],
    ['Cormorant Garamond', [500], 'normal', 'Kai Li Ā é'],
    ['Source Serif 4', [400, 600, 800], 'normal', 'Writing Ā é'],
    ['Source Serif 4', [400], 'italic', 'Writing Ā é'],
    ['Noto Serif SC', [400, 600, 900], 'normal', '思源宋体文章正文龘'],
    ['LXGW WenKai', [400], 'normal', '我自己要练英语'],
  ]
  for (const [family, weights, style, sample] of required) {
    for (const weight of weights) {
      const key = `${family}/${weight}/${style}`
      const cmap = groups.get(key)
      if (!cmap) throw new Error(`Missing face: ${key}`)
      const missing = [...sample].filter(
        (character) => !cmap.has(character.codePointAt(0)),
      )
      if (missing.length)
        throw new Error(`${key} cmap is missing ${missing.join('')}`)
    }
  }
  for (const file of [
    'inter-OFL.txt',
    'ibm-plex-mono-OFL.txt',
    'cormorant-garamond-OFL.txt',
    'source-serif-4-OFL.txt',
    'noto-serif-sc-OFL.txt',
    'OFL-1.1-LXGW-WenKai.txt',
  ]) {
    const license = await readFile(resolve(root, 'public/fonts', file), 'utf8')
    if (!license.includes('SIL OPEN FONT LICENSE'))
      throw new Error(`Missing OFL: ${file}`)
  }
  return { faces: groups.size, files: files.size }
}

export async function checkFonts() {
  const tokens = await readFile(resolve(root, 'src/styles/tokens.css'), 'utf8')
  const defaultBlock = tokens.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  const englishBlock =
    tokens.match(/\[lang='en'\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
  for (const [block, name, requiredFallbacks] of [
    [defaultBlock, 'title', ['Songti SC', 'serif']],
    [defaultBlock, 'body', ['Songti SC', 'serif']],
    [defaultBlock, 'hand', ['Kaiti SC', 'STKaiti', 'KaiTi', 'serif']],
    [defaultBlock, 'ui', ['PingFang SC', 'sans-serif']],
    [defaultBlock, 'num', ['Menlo', 'monospace']],
    [defaultBlock, 'latin', ['serif']],
    ...['title', 'body', 'hand'].map((name) => [
      englishBlock,
      name,
      ['Georgia', 'serif'],
    ]),
  ]) {
    const stack = (block.match(new RegExp(`--${name}:([^;]+);`))?.[1] ?? '')
      .split(',')
      .map((family) => family.trim().replace(/^['"]|['"]$/g, ''))
    let previous = 0
    for (const fallback of requiredFallbacks) {
      const position = stack.indexOf(fallback)
      if (position <= previous)
        throw new Error(
          `Missing or misordered fallback ${fallback} in --${name}`,
        )
      previous = position
    }
  }
  return { wenkai: await checkWenkai(), faces: await checkFontFaces() }
}
