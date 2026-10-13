import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { create } from 'fontkit'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const subsetPath = resolve(
  root,
  'src/assets/fonts/lxgw-wenkai-content.woff2',
)
export const manifestPath = resolve(
  root,
  'src/assets/fonts/wenkai-manifest.json',
)
export const digest = (buffer) =>
  createHash('sha256').update(buffer).digest('hex')

export async function collectWenkaiContent() {
  const inputPath = 'src/assets/fonts/wenkai-inputs.json'
  const definition = await readFile(resolve(root, inputPath), 'utf8')
  const inputs = JSON.parse(definition)
  const sources = { [inputPath]: digest(JSON.stringify(inputs)) }
  const text = []
  for (const path of inputs.json ?? []) {
    const source = await readFile(resolve(root, path), 'utf8')
    sources[path] = digest(source)
    // Voice fixtures contain only strings, objects and arrays.
    const strings = (value) =>
      typeof value === 'string'
        ? [value]
        : Object.values(value).flatMap(strings)
    text.push(...strings(JSON.parse(source)))
  }
  const dataSource = await readFile(resolve(root, inputs.data.path), 'utf8')
  sources[inputs.data.path] = digest(dataSource)
  const data = JSON.parse(dataSource).zh
  for (const field of inputs.data.fields) {
    if (field === 'introduction') text.push(data.introduction)
    else if (field === 'rows[].text')
      text.push(...data.rows.map((entry) => entry.text))
    else if (field === 'projects[].why')
      text.push(...data.projects.map((entry) => entry.why))
    else if (field === 'projects[].introduction')
      text.push(...data.projects.map((entry) => entry.introduction))
    else if (field === 'books[].note')
      text.push(...data.books.map((entry) => entry.note ?? ''))
    else if (field === 'quote.text') text.push(data.quote.text)
    else throw new Error(`Unsupported voice field: ${field}`)
  }
  const content = text.join(' ').replace(/\s+/g, ' ').trim()
  const characters = [...new Set(content)]
    .sort((a, b) => a.codePointAt(0) - b.codePointAt(0))
    .join('')
  if (!characters) throw new Error('WenKai content input is empty')
  return { content, characters, sources }
}

export function assertCoverage(buffer, text, label = 'WenKai subset') {
  const font = create(buffer)
  const missing = [...new Set(text)].filter(
    (character) => !font.hasGlyphForCodePoint(character.codePointAt(0)),
  )
  if (missing.length) {
    throw new Error(
      `${label} cmap is missing ${missing.map((character) => `${character} (U+${character.codePointAt(0).toString(16).toUpperCase()})`).join(', ')}`,
    )
  }
  return font
}

export async function checkWenkai() {
  const input = await collectWenkaiContent()
  const buffer = await readFile(subsetPath)
  const font = assertCoverage(buffer, input.characters)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (
    JSON.stringify(manifest.sources) !== JSON.stringify(input.sources) ||
    manifest.sha256 !== digest(buffer)
  ) {
    throw new Error(
      'WenKai content or font changed; run pnpm fonts:generate and commit the generated assets',
    )
  }
  const expected = new Set(
    [...input.characters].map((character) => character.codePointAt(0)),
  )
  // cmap format 4 includes a U+FFFF terminator mapped to glyph 0 (.notdef).
  // fontkit lists that entry in characterSet; it is not a retained glyph.
  const mappedCharacters = font.characterSet.filter((codepoint) =>
    font.hasGlyphForCodePoint(codepoint),
  )
  const extra = mappedCharacters.filter((codepoint) => !expected.has(codepoint))
  if (extra.length)
    throw new Error(
      `WenKai cmap contains ${extra.length} characters outside the content input`,
    )
  return {
    bytes: buffer.length,
    characters: mappedCharacters.length,
    sourceCharacters: manifest.sourceCharacters,
  }
}
