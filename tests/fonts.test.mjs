import { readFile } from 'node:fs/promises'
import { create } from 'fontkit'
import { describe, expect, it } from 'vitest'
import {
  assertCoverage,
  collectWenkaiContent,
  subsetPath,
  checkWenkai,
} from '../scripts/font-inputs.mjs'
import { checkFontFaces } from '../scripts/check-fonts-lib.mjs'

describe('D-131 self-hosted fonts', () => {
  it('ships only the required local faces and real cmap coverage', async () => {
    expect((await checkFontFaces()).faces).toBe(14)
  })

  it('keeps the binary subset synchronized with the repository voice copy', async () => {
    const result = await checkWenkai()
    expect(result.bytes).toBeLessThan(100_000)
    expect(result.characters).toBeLessThan(result.sourceCharacters / 10)
  })

  it('rejects a new character missing from the actual binary cmap', async () => {
    const buffer = await readFile(subsetPath)
    const font = create(buffer)
    const missing = Array.from(
      { length: 0x9fff - 0x4e00 + 1 },
      (_, index) => index + 0x4e00,
    ).find((codepoint) => !font.hasGlyphForCodePoint(codepoint))
    expect(missing).toBeDefined()
    const { content } = await collectWenkaiContent()
    const character = String.fromCodePoint(missing)
    expect(() => assertCoverage(buffer, content + character)).toThrow(
      /cmap is missing/,
    )
  })
})
