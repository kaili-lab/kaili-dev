import { Buffer } from 'node:buffer'
import console from 'node:console'
import process from 'node:process'
/* global fetch */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import subsetFont from 'subset-font'
import {
  assertCoverage,
  collectWenkaiContent,
  digest,
  manifestPath,
  root,
  subsetPath,
} from './font-inputs.mjs'

const sourceUrl =
  'https://github.com/lxgw/LxgwWenKai/releases/download/v1.522/LXGWWenKai-Regular.ttf'
const sourceSha256 =
  '39ad71264b588165b469e35e6afb162a378dacd1f95348160240ba9038ac3009'
const cachePath = resolve(
  root,
  'node_modules/.cache/kaili-fonts/LXGWWenKai-Regular.ttf',
)

async function getSourceFont() {
  const sourcePath = process.env.LXGW_WENKAI_SOURCE
    ? resolve(process.env.LXGW_WENKAI_SOURCE)
    : cachePath
  let font
  try {
    font = await readFile(sourcePath)
  } catch (error) {
    if (process.env.LXGW_WENKAI_SOURCE || error.code !== 'ENOENT') throw error
    const response = await fetch(sourceUrl)
    if (!response.ok)
      throw new Error(`Could not download ${sourceUrl}: ${response.status}`)
    font = Buffer.from(await response.arrayBuffer())
  }
  if (digest(font) !== sourceSha256)
    throw new Error('Unexpected LXGW WenKai v1.522 source checksum')
  await mkdir(dirname(cachePath), { recursive: true })
  await writeFile(cachePath, font)
  return font
}

const input = await collectWenkaiContent()
const source = await getSourceFont()
const original = assertCoverage(
  source,
  input.characters,
  'Official WenKai Regular',
)
const subset = await subsetFont(source, input.characters, {
  targetFormat: 'woff2',
  preserveNameIds: [0, 1, 2, 4, 5, 6, 13, 14],
})
assertCoverage(subset, input.characters)
await writeFile(subsetPath, subset)
await writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      sourceUrl,
      sourceSha256,
      sourceBytes: source.length,
      sourceCharacters: original.characterSet.length,
      sources: input.sources,
      sha256: digest(subset),
      bytes: subset.length,
      characters: [...input.characters].length,
    },
    null,
    2,
  )}\n`,
)
console.log(
  `Generated WenKai: ${subset.length} bytes; ${[...input.characters].length} characters from ${source.length} bytes`,
)
